import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type FeedbackKind,
  type FeedbackPriority,
  type FeedbackQueueRow,
  type FeedbackSeverity,
  type FeedbackStatus,
  type FeedbackWorkStage,
  FEEDBACK_ACTIVE_WORK_STAGES,
  FEEDBACK_DONE_WORK_STAGES,
} from "./types";

/**
 * Shared feedback-queue data layer - one source of truth for filter parsing +
 * the `admin_feedback_queue` RPC call + the changelog "shipped in vX" overlay.
 * Used by both the server page (first paint) and the `/api/feedback/queue`
 * route handler (live refresh + pagination from the client inbox), so the two
 * can never drift.
 */

export const FEEDBACK_PAGE_SIZE = 50;

export type FeedbackQueueView = "active" | "done" | "all";

export type FeedbackFilters = {
  statuses: FeedbackStatus[] | null;
  severities: FeedbackSeverity[] | null;
  kinds: FeedbackKind[] | null;
  tags: string[] | null;
  areas: string[] | null;
  userSeverities: string[] | null;
  workStages: FeedbackWorkStage[] | null;
  priorities: FeedbackPriority[] | null;
  owners: string[] | null;
  query: string;
  offset: number;
  view: FeedbackQueueView;
};

function arrParam<T extends string>(params: URLSearchParams, key: string): T[] | null {
  const all = params.getAll(key);
  return all.length > 0 ? (all as T[]) : null;
}

/** Parse the queue filters from a URLSearchParams (route handler or page). */
export function parseFeedbackFilters(params: URLSearchParams): FeedbackFilters {
  const v = params.get("view");
  const view: FeedbackQueueView = v === "done" || v === "all" ? v : "active";
  const offsetRaw = Number(params.get("offset") ?? 0);
  return {
    statuses: arrParam(params, "status"),
    severities: arrParam(params, "severity"),
    kinds: arrParam(params, "kind"),
    tags: arrParam(params, "tag"),
    areas: arrParam(params, "area"),
    userSeverities: arrParam(params, "userSeverity"),
    workStages: arrParam(params, "workStage"),
    priorities: arrParam(params, "priority"),
    owners: arrParam(params, "owner"),
    query: params.get("q") ?? "",
    offset: Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0,
    view,
  };
}

/**
 * Build the `admin_feedback_queue` arg object. The beta-depth + work-tracking
 * filters are only sent when active, so a project that predates those
 * migrations still resolves against the older RPC signature.
 */
export function buildQueueArgs(f: FeedbackFilters, offsetOverride?: number): Record<string, unknown> {
  const viewStages =
    f.view === "active"
      ? FEEDBACK_ACTIVE_WORK_STAGES
      : f.view === "done"
        ? FEEDBACK_DONE_WORK_STAGES
        : null;
  const effectiveWorkStages = f.workStages ?? viewStages;
  const args: Record<string, unknown> = {
    p_status_filter: f.statuses,
    p_severity_filter: f.severities,
    p_kind_filter: f.kinds,
    p_tag_filter: f.tags,
    p_search: f.query || null,
    p_limit: FEEDBACK_PAGE_SIZE,
    p_offset: offsetOverride ?? f.offset,
  };
  if (f.areas) args.p_area_filter = f.areas;
  if (f.userSeverities) args.p_user_severity_filter = f.userSeverities;
  if (effectiveWorkStages) args.p_work_stage_filter = effectiveWorkStages;
  if (f.priorities) args.p_priority_filter = f.priorities;
  if (f.owners) args.p_owner_filter = f.owners;
  return args;
}

export type FeedbackQueueResult = {
  rows: FeedbackQueueRow[];
  /** report_id → highest shipped version string. */
  shippedByReport: Record<string, string>;
  hasMore: boolean;
  error: string | null;
};

export async function fetchFeedbackQueue(
  supabase: SupabaseClient,
  f: FeedbackFilters,
  offsetOverride?: number,
): Promise<FeedbackQueueResult> {
  const { data, error } = await supabase.rpc("admin_feedback_queue", buildQueueArgs(f, offsetOverride));
  const rows = (data as FeedbackQueueRow[] | null) ?? [];

  let shippedByReport: Record<string, string> = {};
  if (rows.length > 0) {
    const ids = rows.map((r) => r.report_id);
    const { data: shippedRows } = await supabase
      .from("app_version_changes")
      .select("feedback_report_id, app_versions ( version, major, minor, patch )")
      .in("feedback_report_id", ids);
    shippedByReport = buildShippedMap(shippedRows);
  }

  return {
    rows,
    shippedByReport,
    hasMore: rows.length === FEEDBACK_PAGE_SIZE,
    error: error?.message ?? null,
  };
}

/** Reduce app_version_changes rows into report_id → best (highest) version. */
export function buildShippedMap(rows: unknown): Record<string, string> {
  const best = new Map<string, { version: string; rank: number }>();
  if (!Array.isArray(rows)) return {};
  for (const row of rows as Array<{ feedback_report_id?: string; app_versions?: unknown }>) {
    const reportId = row.feedback_report_id;
    if (!reportId) continue;
    const av = Array.isArray(row.app_versions) ? row.app_versions[0] : row.app_versions;
    if (!av || typeof av !== "object") continue;
    const v = av as { version?: string; major?: number; minor?: number; patch?: number };
    if (!v.version) continue;
    const rank = (v.major ?? 0) * 1_000_000 + (v.minor ?? 0) * 1_000 + (v.patch ?? 0);
    const existing = best.get(reportId);
    if (!existing || rank > existing.rank) best.set(reportId, { version: v.version, rank });
  }
  const out: Record<string, string> = {};
  for (const [k, val] of best) out[k] = val.version;
  return out;
}

export type ShippedVersion = { id: string; version: string; status: string };

/** Deduped list of versions a single report shipped in (detail/thread header). */
export function dedupeShippedVersions(rows: unknown): ShippedVersion[] {
  if (!Array.isArray(rows)) return [];
  const out = new Map<string, ShippedVersion>();
  for (const row of rows as Array<{ app_versions?: unknown }>) {
    const av = Array.isArray(row.app_versions) ? row.app_versions[0] : row.app_versions;
    if (av && typeof av === "object") {
      const v = av as { id?: string; version?: string; status?: string };
      if (v.id && v.version) {
        out.set(v.id, { id: v.id, version: v.version, status: v.status ?? "released" });
      }
    }
  }
  return Array.from(out.values());
}
