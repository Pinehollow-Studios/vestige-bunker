import Link from "next/link";
import {
  Bug,
  Camera,
  Crown,
  Gauge,
  HelpCircle,
  Image as ImageIcon,
  Lightbulb,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Paintbrush,
  Repeat,
  Rocket,
  UserRound,
  Zap,
} from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { listAdminOwners } from "@/lib/feedback/owners";
import { avatarURL } from "@/lib/storage";
import {
  type FeedbackKind,
  type FeedbackPriority,
  type FeedbackQueueRow,
  type FeedbackSeverity,
  type FeedbackStatus,
  type FeedbackWorkStage,
  FEEDBACK_ACTIVE_WORK_STAGES,
  FEEDBACK_DONE_WORK_STAGES,
  areaSlugLabel,
  kindLabel,
  priorityLabel,
  priorityTone,
  reproducibilityLabel,
  severityLabel,
  statusLabel,
  workStageIsDone,
  workStageLabel,
  workStageTone,
} from "@/lib/feedback/types";
import { QueueFilters } from "./QueueFilters";

/** The three queue partitions. `active` is the working set (everything not
 * Fixed / Won't fix); `done` is the kept record of completed work; `all`
 * removes the partition. */
type QueueView = "active" | "done" | "all";

function parseView(value: SearchParamArray): QueueView {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "done" || v === "all" ? v : "active";
}

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * Feedback queue — the inbox-style list of reports across every
 * status. Slice 1 ships the read surface only; tag/severity/status
 * controls live on the per-report detail page (slice 4 adds them).
 *
 * Default sort matches the SQL RPC's natural order: severity
 * desc nulls last, last_admin_message_at desc nulls last,
 * created_at desc. So a critical-but-untouched report tops the
 * list, and quietly aging untriaged reports drift down.
 */
type SearchParamArray = string | string[] | undefined;

function asArray<T extends string>(value: SearchParamArray): T[] | null {
  if (!value) return null;
  const arr = Array.isArray(value) ? value : [value];
  return arr.length > 0 ? (arr as T[]) : null;
}

export default async function FeedbackQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamArray>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = await createClient();

  const statuses = asArray<FeedbackStatus>(params.status);
  const severities = asArray<FeedbackSeverity>(params.severity);
  const kinds = asArray<FeedbackKind>(params.kind);
  const tags = asArray<string>(params.tag);
  const areas = asArray<string>(params.area);
  const userSeverities = asArray<string>(params.userSeverity);
  const workStages = asArray<FeedbackWorkStage>(params.workStage);
  const priorities = asArray<FeedbackPriority>(params.priority);
  const ownerFilter = asArray<string>(params.owner);
  const view = parseView(params.view);
  // The Active / Done partition is just a work_stage filter. An explicit Stage
  // chip (if the operator picks one) overrides the partition; otherwise the
  // view supplies the stage set ("all" sends none).
  const viewStages: FeedbackWorkStage[] | null =
    view === "active"
      ? FEEDBACK_ACTIVE_WORK_STAGES
      : view === "done"
        ? FEEDBACK_DONE_WORK_STAGES
        : null;
  const effectiveWorkStages = workStages ?? viewStages;
  const query =
    typeof params.q === "string"
      ? params.q
      : Array.isArray(params.q)
        ? params.q[0]
        : "";
  const offset = Number(
    typeof params.offset === "string" ? params.offset : 0,
  );
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;

  // The beta-depth filters (p_area_filter / p_user_severity_filter)
  // only exist on the 9-arg `admin_feedback_queue` from migration
  // 20260606160000. To stay compatible with a project that hasn't had
  // that migration applied yet (e.g. prod before Tom's coordinated
  // deploy), only send the new params when a filter is actually active
  // — base browsing then resolves against the pre-migration 7-arg
  // function, and the new return columns simply arrive undefined (the
  // UI guards hide them) until the migration lands.
  const queueArgs: Record<string, unknown> = {
    p_status_filter: statuses,
    p_severity_filter: severities,
    p_kind_filter: kinds,
    p_tag_filter: tags,
    p_search: query || null,
    p_limit: PAGE_SIZE,
    p_offset: safeOffset,
  };
  if (areas) queueArgs.p_area_filter = areas;
  if (userSeverities) queueArgs.p_user_severity_filter = userSeverities;
  // Admin work-tracking filters (2026-06-08). Only sent when active so
  // base browsing still resolves against a project that predates the
  // admin-workflow migration (e.g. prod before its coordinated deploy).
  if (effectiveWorkStages) queueArgs.p_work_stage_filter = effectiveWorkStages;
  if (priorities) queueArgs.p_priority_filter = priorities;
  if (ownerFilter) queueArgs.p_owner_filter = ownerFilter;

  const [{ data, error }, owners] = await Promise.all([
    supabase.rpc("admin_feedback_queue", queueArgs),
    listAdminOwners(),
  ]);
  const queue = (data as FeedbackQueueRow[] | null) ?? [];

  // Overlay the changelog↔feedback loop: which of these reports have shipped,
  // and in which version. One batch query keyed by the visible report ids.
  // Missing table (pre-migration) returns null → empty map → no markers.
  const reportIds = queue.map((r) => r.report_id);
  let shippedByReport = new Map<string, string>();
  if (reportIds.length > 0) {
    const { data: shippedRows } = await supabase
      .from("app_version_changes")
      .select("feedback_report_id, app_versions ( version, major, minor, patch )")
      .in("feedback_report_id", reportIds);
    shippedByReport = buildShippedMap(shippedRows);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        eyebrow="Queues · review"
        title="Feedback triage"
        description="In-app reports — bugs, data errors, requests, and notes. Highest priority first."
      />

      <ViewTabs view={view} params={params} />

      <QueueFilters initialSearch={query} owners={owners} />

      {error && (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load queue: {error.message}
        </div>
      )}

      {!error && (
        <>
          <SummaryStrip rows={queue} view={view} />
          {queue.length === 0 ? (
            <EmptyQueue />
          ) : (
            <ol className="divide-y divide-rule/60 overflow-hidden rounded-xl glass-panel">
              {queue.map((row) => (
                <li key={row.report_id}>
                  <ReportRow
                    row={row}
                    shippedVersion={shippedByReport.get(row.report_id)}
                    ownerLabel={
                      row.owner_user_id
                        ? owners.find((o) => o.id === row.owner_user_id)?.label
                        : undefined
                    }
                  />
                </li>
              ))}
            </ol>
          )}
          <PaginationFooter
            offset={safeOffset}
            pageSize={PAGE_SIZE}
            currentCount={queue.length}
            params={params}
          />
        </>
      )}
    </div>
  );
}

function PaginationFooter({
  offset,
  pageSize,
  currentCount,
  params,
}: {
  offset: number;
  pageSize: number;
  currentCount: number;
  params: Record<string, SearchParamArray>;
}) {
  if (offset === 0 && currentCount < pageSize) return null;
  const previousOffset = Math.max(0, offset - pageSize);
  const nextOffset = offset + pageSize;
  const hasNext = currentCount === pageSize;
  return (
    <nav className="flex items-center justify-between text-xs text-ink-3">
      {offset > 0 ? (
        <Link
          href={paramsURL(params, previousOffset)}
          className="rounded-lg glass-panel px-3 py-1.5 font-semibold text-ink-2 transition-colors hover:border-brand/40 hover:text-ink"
        >
          ← Previous {pageSize}
        </Link>
      ) : (
        <span />
      )}
      <span>
        Showing {offset + 1}–{offset + currentCount}
      </span>
      {hasNext ? (
        <Link
          href={paramsURL(params, nextOffset)}
          className="rounded-lg glass-panel px-3 py-1.5 font-semibold text-ink-2 transition-colors hover:border-brand/40 hover:text-ink"
        >
          Next {pageSize} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function paramsURL(
  params: Record<string, SearchParamArray>,
  offset: number,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "offset") continue;
    if (Array.isArray(value)) {
      for (const v of value) next.append(key, v);
    } else if (typeof value === "string" && value.length > 0) {
      next.set(key, value);
    }
  }
  if (offset > 0) next.set("offset", String(offset));
  const query = next.toString();
  return query ? `/feedback?${query}` : "/feedback";
}

// --------------------------------------------------------------
// Calm chip helpers (presentation-only, local to the feedback UI)
//
// The shared `*ChipClasses` helpers in lib/feedback/types render
// noisy multi-tone pills (amber-500 / blue-500 / emerald-500). The
// Atlas calm convention is single-tone bordered pills keyed to the
// brand / amber / alert / ink-3 family only. We map to that here
// without touching the type logic.
// --------------------------------------------------------------

const CHIP_BASE =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider";

type ChipTone = "brand" | "amber" | "alert" | "neutral";

function toneClasses(tone: ChipTone): string {
  switch (tone) {
    case "brand":
      return "border-brand/35 text-brand";
    case "amber":
      return "border-amber/40 text-amber";
    case "alert":
      return "border-alert/40 text-alert";
    case "neutral":
      return "border-rule/70 text-ink-3";
  }
}

function statusTone(status: FeedbackStatus): ChipTone {
  switch (status) {
    case "new":
      return "brand";
    case "inProgress":
      return "amber";
    case "triaged":
      return "neutral";
    case "resolved":
      return "brand";
    case "wontFix":
      return "neutral";
  }
}

function severityTone(severity: FeedbackSeverity | null): ChipTone {
  switch (severity) {
    case "critical":
      return "alert";
    case "high":
      return "amber";
    case "medium":
      return "brand";
    default:
      return "neutral";
  }
}

// --------------------------------------------------------------
// View tabs — Active / Done / All partition over the queue.
// --------------------------------------------------------------

function ViewTabs({
  view,
  params,
}: {
  view: QueueView;
  params: Record<string, SearchParamArray>;
}) {
  const tabs: { key: QueueView; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "done", label: "Done" },
    { key: "all", label: "All" },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-xl glass-panel p-1 text-xs">
      {tabs.map((tab) => {
        const isActive = tab.key === view;
        return (
          <Link
            key={tab.key}
            href={viewURL(params, tab.key)}
            className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${
              isActive
                ? "bg-brand/15 text-brand"
                : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Build a URL that flips the `view` param (dropping any explicit Stage chips
 * so the partition is authoritative, and resetting pagination). */
function viewURL(
  params: Record<string, SearchParamArray>,
  view: QueueView,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "offset" || key === "view" || key === "workStage") continue;
    if (Array.isArray(value)) {
      for (const v of value) next.append(key, v);
    } else if (typeof value === "string" && value.length > 0) {
      next.set(key, value);
    }
  }
  if (view !== "active") next.set("view", view);
  const query = next.toString();
  return query ? `/feedback?${query}` : "/feedback";
}

// --------------------------------------------------------------
// Summary strip
// --------------------------------------------------------------

function SummaryStrip({
  rows,
  view,
}: {
  rows: FeedbackQueueRow[];
  view: QueueView;
}) {
  const total = rows.length;
  const fixed = rows.filter(
    (r) =>
      r.work_stage === "fixed" ||
      r.work_stage === "resolved" ||
      r.work_stage === "released",
  ).length;
  const closed = rows.filter((r) => r.work_stage === "wontFix").length;
  const active = rows.filter((r) => !workStageIsDone(r.work_stage)).length;
  const noun =
    view === "done" ? "done" : view === "all" ? "report" : "active";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl glass-panel px-4 py-3 text-xs text-ink-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">
          {total} {total === 1 ? noun : `${noun}${noun === "report" ? "s" : ""}`}
        </span>
        {(view === "done" || view === "all") && (fixed > 0 || closed > 0) && (
          <>
            <span aria-hidden className="text-ink-3">
              ·
            </span>
            <span className="text-ink-3">
              {view === "all" && (
                <>
                  <span className="font-medium text-ink-2">{active}</span> active
                  {" · "}
                </>
              )}
              <span className="font-medium text-ink-2">{fixed}</span> fixed
              {" · "}
              <span className="font-medium text-ink-2">{closed}</span> closed
            </span>
          </>
        )}
      </div>
      <span className="text-ink-3">priority ↓ · latest activity ↓</span>
    </div>
  );
}

// --------------------------------------------------------------
// Empty state
// --------------------------------------------------------------

function EmptyQueue() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl glass-panel px-6 py-14 text-center">
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand"
      >
        <MessageSquare className="size-5" />
      </span>
      <p className="font-display text-lg font-semibold text-ink">
        Nothing in the inbox
      </p>
      <p className="max-w-sm text-sm text-ink-2">
        When users tap Send feedback in the iOS app, their reports show up here.
      </p>
    </div>
  );
}

// --------------------------------------------------------------
// Row
// --------------------------------------------------------------

function ReportRow({
  row,
  shippedVersion,
  ownerLabel,
}: {
  row: FeedbackQueueRow;
  shippedVersion?: string;
  ownerLabel?: string;
}) {
  const reporterAvatar = avatarURL(row.user_id, row.reporter_avatar_photo_id);
  const reporterDisplay =
    row.reporter_display_name ?? row.reporter_username ?? "anonymous";
  const reporterHandle = row.reporter_username
    ? `@${row.reporter_username}`
    : null;
  const areaName = row.area_label ?? (row.area ? areaSlugLabel(row.area) : null);

  return (
    <Link
      href={`/feedback/${row.report_id}`}
      className="block px-5 py-4 transition-colors hover:bg-paper-raised/40"
    >
      <article className="flex items-start gap-4">
        <KindGlyph kind={row.kind} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
              {kindLabel(row.kind)}
            </span>
            {row.is_founder && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber">
                <Crown aria-hidden className="size-3" />
                Founder
              </span>
            )}
            <span className="text-ink-3">{formatRelative(row.created_at)}</span>
            {areaName && (
              <span className="inline-flex items-center gap-1 text-ink-3">
                <MapPin aria-hidden className="size-3" />
                {areaName}
              </span>
            )}
          </div>

          <p className="line-clamp-2 text-sm leading-snug text-ink">
            {row.body_preview}
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              {reporterAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={reporterAvatar}
                  alt=""
                  className="size-5 rounded-full bg-paper-sunken object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex size-5 items-center justify-center rounded-full bg-paper-sunken text-[9px] font-semibold uppercase text-ink-3"
                >
                  {row.user_id ? reporterDisplay.slice(0, 2) : "—"}
                </span>
              )}
              <span className="text-ink-2">
                {row.user_id ? reporterDisplay : "Anonymous"}
                {reporterHandle && (
                  <span className="ml-1 text-ink-3">{reporterHandle}</span>
                )}
              </span>
            </span>
            {row.screenshot_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <Camera aria-hidden className="size-3" />
                {row.screenshot_count}
              </span>
            )}
            {row.duplicate_of_report_id && <span>· duplicate</span>}
            {row.duplicate_count > 0 && !row.duplicate_of_report_id && (
              <span>
                {row.duplicate_count}{" "}
                {row.duplicate_count === 1 ? "duplicate" : "duplicates"}
              </span>
            )}
            {row.reproducibility && (
              <span className="inline-flex items-center gap-1">
                <Repeat aria-hidden className="size-3" />
                {reproducibilityLabel(row.reproducibility)}
              </span>
            )}
            {row.owner_user_id && (
              <span className="inline-flex items-center gap-1 text-ink-2">
                <UserRound aria-hidden className="size-3" />
                {row.owner_display_name ??
                  ownerLabel ??
                  (row.owner_username ? `@${row.owner_username}` : "assigned")}
              </span>
            )}
            {shippedVersion && (
              <span className="inline-flex items-center gap-1 font-medium text-brand">
                <Rocket aria-hidden className="size-3" />
                Shipped in v{shippedVersion}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`${CHIP_BASE} ${toneClasses(
              row.work_stage ? workStageTone(row.work_stage) : statusTone(row.status),
            )}`}
          >
            {row.work_stage ? workStageLabel(row.work_stage) : statusLabel(row.status)}
          </span>
          {row.priority && (
            <span
              className={`${CHIP_BASE} ${toneClasses(priorityTone(row.priority))}`}
            >
              {priorityLabel(row.priority)}
            </span>
          )}
          {row.severity && (
            <span
              className={`${CHIP_BASE} ${toneClasses(severityTone(row.severity))}`}
            >
              {severityLabel(row.severity)}
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}

function KindGlyph({ kind }: { kind: FeedbackKind }) {
  const styles =
    "flex size-9 shrink-0 items-center justify-center rounded-xl border";
  return <span className={`${styles} ${kindTone(kind)}`}>{kindIcon(kind)}</span>;
}

function kindTone(kind: FeedbackKind): string {
  switch (kind) {
    case "bug":
    case "crash":
      return "border-alert/30 bg-alert/5 text-alert";
    case "dataError":
    case "visualGlitch":
    case "performance":
      return "border-amber/30 bg-amber/5 text-amber";
    case "featureRequest":
    case "confusingUX":
      return "border-brand/30 bg-brand/5 text-brand";
    default:
      return "border-rule/70 bg-paper-sunken/40 text-ink-2";
  }
}

function kindIcon(kind: FeedbackKind) {
  const cls = "size-4";
  switch (kind) {
    case "bug":
      return <Bug aria-hidden className={cls} />;
    case "dataError":
      return <MapIcon aria-hidden className={cls} />;
    case "featureRequest":
      return <Lightbulb aria-hidden className={cls} />;
    case "general":
      return <ImageIcon aria-hidden className={cls} />;
    case "crash":
      return <Zap aria-hidden className={cls} />;
    case "visualGlitch":
      return <Paintbrush aria-hidden className={cls} />;
    case "performance":
      return <Gauge aria-hidden className={cls} />;
    case "confusingUX":
      return <HelpCircle aria-hidden className={cls} />;
    default:
      return <MessageSquare aria-hidden className={cls} />;
  }
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/**
 * Reduce app_version_changes rows (tagged to the visible reports) into a
 * report-id → best version string map. A report can appear in more than one
 * version; we keep the highest by semver rank. PostgREST embeds the parent as
 * an object, but we normalise array-or-object defensively.
 */
function buildShippedMap(rows: unknown): Map<string, string> {
  const best = new Map<string, { version: string; rank: number }>();
  if (!Array.isArray(rows)) return new Map();
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
  return new Map(Array.from(best, ([k, val]) => [k, val.version]));
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.round(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: diffDays > 365 ? "numeric" : undefined,
  });
}
