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
  Sparkles,
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
  areaSlugLabel,
  kindLabel,
  reproducibilityLabel,
  severityChipClasses,
  severityLabel,
  statusChipClasses,
  statusLabel,
  userSeverityChipClasses,
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
        description="In-app feedback reports — every bug, data error, feature request, and general note. Highest severity first; quietly-aging reports drift to the bottom."
      />

      <QueueFilters initialSearch={query} />

      {error && (
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load queue: {error.message}
        </div>
      )}

      {!error && (
        <>
          <SummaryStrip byStatus={byStatus} total={queue.length} />
          {queue.length === 0 ? (
            <EmptyQueue />
          ) : (
            <ol className="space-y-3">
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
          className="rounded-md border border-border bg-paper-raised px-3 py-1 font-semibold text-ink-2 hover:border-brand/40"
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
          className="rounded-md border border-border bg-paper-raised px-3 py-1 font-semibold text-ink-2 hover:border-brand/40"
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-brand/8 px-4 py-3 text-xs text-brand-deep dark:bg-brand/15 dark:text-brand-soft">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">
          {total} {total === 1 ? "report" : "reports"}
        </span>
        <span aria-hidden className="text-ink-3">
          ·
        </span>
        <span className="text-ink-3">
          {open} open
          {byStatus.resolved > 0 && (
            <>
              {" "}
              · <span className="font-medium text-ink">{byStatus.resolved}</span>{" "}
              resolved
            </>
          )}
          {byStatus.wontFix > 0 && (
            <>
              {" "}
              · <span className="font-medium text-ink">{byStatus.wontFix}</span>{" "}
              won&apos;t fix
            </>
          )}
        </span>
      </div>
      <span className="text-ink-3">sort: severity ↓, latest activity ↓</span>
    </div>
  );
}

// --------------------------------------------------------------
// Empty state
// --------------------------------------------------------------

function EmptyQueue() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/70 bg-paper-raised/60 p-12 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--brand) 12%, transparent) 0%, transparent 60%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-2">
        <span
          aria-hidden
          className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand-deep dark:text-brand-soft"
        >
          <MessageSquare className="size-5" />
        </span>
        <p className="font-heading text-base font-semibold text-ink">
          Nothing in the inbox
        </p>
        <p className="max-w-md text-sm text-ink-2">
          When users tap{" "}
          <span className="font-semibold">Send feedback</span> in the iOS app,
          their reports show up here.
        </p>
      </div>
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

  return (
    <Link
      href={`/feedback/${row.report_id}`}
      className="block rounded-2xl border border-border bg-paper-raised ring-1 ring-foreground/5 shadow-[0_1px_2px_rgba(31,42,36,0.04)] transition-colors hover:border-brand/40 hover:ring-brand/15"
    >
      <article className="flex flex-col gap-3 p-5">
        <header className="flex flex-wrap items-start gap-3">
          <KindGlyph kind={row.kind} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-deep dark:text-brand-soft">
                {kindLabel(row.kind)}
              </span>
              {row.is_founder && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  <Crown aria-hidden className="size-3" />
                  Founder
                </span>
              )}
              <span className="text-ink-3">
                {formatRelative(row.created_at)}
              </span>
              {row.duplicate_of_report_id && (
                <span className="text-ink-3">· marked duplicate</span>
              )}
              {row.duplicate_count > 0 && !row.duplicate_of_report_id && (
                <span className="text-ink-3">
                  · {row.duplicate_count}{" "}
                  {row.duplicate_count === 1 ? "duplicate" : "duplicates"}
                </span>
              )}
              {(row.area_label || row.area) && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-paper-sunken/60 px-2 py-0.5 text-[10px] font-medium text-ink-2">
                  <MapPin aria-hidden className="size-3" />
                  {row.area_label ?? areaSlugLabel(row.area)}
                </span>
              )}
            </div>
            <p className="line-clamp-3 text-sm leading-snug text-ink">
              {row.body_preview}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${severityChipClasses(row.severity)}`}
            >
              {severityLabel(row.severity)}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusChipClasses(row.status)}`}
            >
              {statusLabel(row.status)}
            </span>
          </div>
        </header>

        {row.last_admin_message_preview && (
          <div className="rounded-xl border border-border/60 bg-paper-sunken/40 p-3 text-xs leading-relaxed text-ink-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              Latest reply
            </p>
            <p className="mt-1 line-clamp-2 text-ink-2">
              {row.last_admin_message_preview}
            </p>
          </div>
        )}

        <footer className="flex flex-wrap items-center gap-3 text-xs text-ink-3">
          {reporterAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reporterAvatar}
              alt=""
              className="size-6 rounded-full bg-paper-sunken object-cover ring-1 ring-foreground/10"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-6 items-center justify-center rounded-full bg-paper-sunken text-[10px] font-semibold uppercase text-ink-3 ring-1 ring-foreground/10"
            >
              {row.user_id ? reporterDisplay.slice(0, 2) : "—"}
            </span>
          )}
          <span className="text-ink-2">
            {row.user_id ? reporterDisplay : "Anonymous (account deleted)"}
            {reporterHandle && (
              <span className="ml-1 text-ink-3">{reporterHandle}</span>
            )}
          </span>
          {row.screenshot_count > 0 && (
            <span className="inline-flex items-center gap-1 text-ink-3">
              <Camera aria-hidden className="size-3" />
              {row.screenshot_count}
            </span>
          )}
          {row.tags.length > 0 && (
            <span className="inline-flex items-center gap-1 text-ink-3">
              <Sparkles aria-hidden className="size-3" />
              {row.tags.slice(0, 3).join(" · ")}
              {row.tags.length > 3 && ` +${row.tags.length - 3}`}
            </span>
          )}
          {row.user_severity && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${userSeverityChipClasses(row.user_severity)}`}
            >
              {userSeverityLabel(row.user_severity)}
            </span>
          )}
          {row.reproducibility && (
            <span className="inline-flex items-center gap-1 text-ink-3">
              <Repeat aria-hidden className="size-3" />
              {reproducibilityLabel(row.reproducibility)}
            </span>
          )}
        </footer>
      </article>
    </Link>
  );
}

function KindGlyph({ kind }: { kind: FeedbackKind }) {
  const styles = "flex size-9 shrink-0 items-center justify-center rounded-xl";
  switch (kind) {
    case "bug":
      return (
        <span className={`${styles} bg-alert/10 text-alert`}>
          <Bug aria-hidden className="size-4" />
        </span>
      );
    case "dataError":
      return (
        <span className={`${styles} bg-amber-500/15 text-amber-700 dark:text-amber-300`}>
          <Map aria-hidden className="size-4" />
        </span>
      );
    case "featureRequest":
      return (
        <span className={`${styles} bg-brand/10 text-brand-deep dark:text-brand-soft`}>
          <Lightbulb aria-hidden className="size-4" />
        </span>
      );
    case "general":
      return (
        <span className={`${styles} bg-paper-sunken text-ink-2`}>
          <ImageIcon aria-hidden className="size-4" />
        </span>
      );
    case "crash":
      return (
        <span className={`${styles} bg-alert/10 text-alert`}>
          <Zap aria-hidden className="size-4" />
        </span>
      );
    case "visualGlitch":
      return (
        <span className={`${styles} bg-amber-500/15 text-amber-700 dark:text-amber-300`}>
          <Paintbrush aria-hidden className="size-4" />
        </span>
      );
    case "performance":
      return (
        <span className={`${styles} bg-amber-500/15 text-amber-700 dark:text-amber-300`}>
          <Gauge aria-hidden className="size-4" />
        </span>
      );
    case "confusingUX":
      return (
        <span className={`${styles} bg-brand/10 text-brand-deep dark:text-brand-soft`}>
          <HelpCircle aria-hidden className="size-4" />
        </span>
      );
    default:
      return (
        <span className={`${styles} bg-paper-sunken text-ink-2`}>
          <MessageSquare aria-hidden className="size-4" />
        </span>
      );
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
