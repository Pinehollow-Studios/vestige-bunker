import Link from "next/link";
import {
  Bug,
  Camera,
  Crown,
  Gauge,
  HelpCircle,
  Image as ImageIcon,
  Lightbulb,
  Map,
  MapPin,
  MessageSquare,
  Paintbrush,
  Repeat,
  Zap,
} from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { avatarURL } from "@/lib/storage";
import {
  type FeedbackKind,
  type FeedbackQueueRow,
  type FeedbackSeverity,
  type FeedbackStatus,
  type FeedbackUserSeverity,
  areaSlugLabel,
  kindLabel,
  reproducibilityLabel,
  severityLabel,
  statusLabel,
  userSeverityLabel,
} from "@/lib/feedback/types";
import { QueueFilters } from "./QueueFilters";

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

  const { data, error } = await supabase.rpc("admin_feedback_queue", queueArgs);
  const queue = (data as FeedbackQueueRow[] | null) ?? [];

  const byStatus = bucketByStatus(queue);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        eyebrow="Queues · review"
        title="Feedback triage"
        description="In-app reports — bugs, data errors, requests, and notes. Highest severity first."
      />

      <QueueFilters initialSearch={query} />

      {error && (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load queue: {error.message}
        </div>
      )}

      {!error && (
        <>
          <SummaryStrip byStatus={byStatus} total={queue.length} />
          {queue.length === 0 ? (
            <EmptyQueue />
          ) : (
            <ol className="divide-y divide-rule/60 overflow-hidden rounded-xl border border-rule/70 bg-paper-raised/50">
              {queue.map((row) => (
                <li key={row.report_id}>
                  <ReportRow row={row} />
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
          className="rounded-lg border border-rule/70 bg-paper-raised/50 px-3 py-1.5 font-semibold text-ink-2 transition-colors hover:border-brand/40 hover:text-ink"
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
          className="rounded-lg border border-rule/70 bg-paper-raised/50 px-3 py-1.5 font-semibold text-ink-2 transition-colors hover:border-brand/40 hover:text-ink"
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

function userSeverityTone(value: FeedbackUserSeverity | null): ChipTone {
  switch (value) {
    case "blocker":
      return "alert";
    case "major":
      return "amber";
    case "minor":
      return "brand";
    default:
      return "neutral";
  }
}

// --------------------------------------------------------------
// Summary strip
// --------------------------------------------------------------

function SummaryStrip({
  byStatus,
  total,
}: {
  byStatus: Record<FeedbackStatus, number>;
  total: number;
}) {
  const open = byStatus.new + byStatus.triaged + byStatus.inProgress;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule/70 bg-paper-raised/50 px-4 py-3 text-xs text-ink-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">
          {total} {total === 1 ? "report" : "reports"}
        </span>
        <span aria-hidden className="text-ink-3">
          ·
        </span>
        <span className="text-ink-3">
          {open} open
          {byStatus.resolved > 0 && (
            <>
              {" · "}
              <span className="font-medium text-ink-2">{byStatus.resolved}</span>{" "}
              resolved
            </>
          )}
          {byStatus.wontFix > 0 && (
            <>
              {" · "}
              <span className="font-medium text-ink-2">{byStatus.wontFix}</span>{" "}
              won&apos;t fix
            </>
          )}
        </span>
      </div>
      <span className="text-ink-3">severity ↓ · latest activity ↓</span>
    </div>
  );
}

// --------------------------------------------------------------
// Empty state
// --------------------------------------------------------------

function EmptyQueue() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-rule/70 bg-paper-raised/50 px-6 py-14 text-center">
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

function ReportRow({ row }: { row: FeedbackQueueRow }) {
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
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`${CHIP_BASE} ${toneClasses(statusTone(row.status))}`}>
            {statusLabel(row.status)}
          </span>
          {row.severity && (
            <span
              className={`${CHIP_BASE} ${toneClasses(severityTone(row.severity))}`}
            >
              {severityLabel(row.severity)}
            </span>
          )}
          {row.user_severity && (
            <span
              className={`${CHIP_BASE} ${toneClasses(userSeverityTone(row.user_severity))}`}
            >
              {userSeverityLabel(row.user_severity)}
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
      return <Map aria-hidden className={cls} />;
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

function bucketByStatus(
  rows: FeedbackQueueRow[],
): Record<FeedbackStatus, number> {
  const acc: Record<FeedbackStatus, number> = {
    new: 0,
    triaged: 0,
    inProgress: 0,
    resolved: 0,
    wontFix: 0,
  };
  for (const row of rows) {
    acc[row.status] += 1;
  }
  return acc;
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
