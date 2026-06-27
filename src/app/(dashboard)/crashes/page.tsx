import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Smartphone } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { avatarURL } from "@/lib/storage";
import { listCrashes } from "@/lib/crashes/queries";
import {
  type CrashLevel,
  type CrashReportEnriched,
  levelLabel,
} from "@/lib/crashes/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// Calm, single-tone bordered chips — fatal/error read claret (alert),
// warning amber, info/debug muted. Kept local to the presentation
// layer so the queue reads in the Atlas palette without touching the
// shared lib helpers.
function levelChip(level: CrashLevel): string {
  switch (level) {
    case "fatal":
    case "error":
      return "border-alert/40 text-alert";
    case "warning":
      return "border-amber/40 text-amber";
    default:
      return "border-rule/70 text-ink-3";
  }
}

function environmentChip(env: string | null): string {
  if (env === "release") return "border-brand/40 text-brand";
  return "border-rule/70 text-ink-3";
}

/**
 * Crash queue — every Sentry-issued event we've received via the
 * `sentry-webhook` Edge Function (CLAUDE.md §3 Crash row + §13.4).
 *
 * The local `crash_reports` table is the index; Sentry remains the
 * canonical store for stack traces / breadcrumbs / release-health.
 * The detail page (`/crashes/[id]`) pulls richer event detail from
 * Sentry on demand and offers an "Open in Sentry" deep-link.
 *
 * Default sort is `last_seen desc` — the busiest crashes top the
 * list. Filters: environment / release / level / fingerprint /
 * userId / text search across message + culprit. All in URL params
 * so the queue is shareable and bookmarkable.
 */
type SearchParamArray = string | string[] | undefined;

function asString(value: SearchParamArray): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function asLevel(value: SearchParamArray): CrashLevel | null {
  const raw = asString(value);
  if (!raw) return null;
  if (
    raw === "fatal" ||
    raw === "error" ||
    raw === "warning" ||
    raw === "info" ||
    raw === "debug"
  ) {
    return raw;
  }
  return null;
}

export default async function CrashesQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamArray>>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const environment = asString(params.env);
  const release = asString(params.release);
  const level = asLevel(params.level);
  const fingerprint = asString(params.fingerprint);
  const userId = asString(params.userId);
  const query = asString(params.q) ?? "";
  const offset = Number(asString(params.offset) ?? "0");
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;

  let rows: CrashReportEnriched[] = [];
  let queryError: string | null = null;
  try {
    rows = await listCrashes({
      environment,
      release,
      level,
      fingerprint,
      userId,
      query: query || null,
      limit: PAGE_SIZE,
      offset: safeOffset,
    });
  } catch (e) {
    queryError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        eyebrow="Queues · review"
        title="Crashes"
      />

      {queryError && (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load crashes: {queryError}
        </div>
      )}

      {!queryError && (
        <>
          <ActiveFiltersStrip
            environment={environment}
            release={release}
            level={level}
            fingerprint={fingerprint}
            userId={userId}
            query={query}
            count={rows.length}
          />
          {rows.length === 0 ? (
            <EmptyQueue />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {rows.map((row) => (
                <CrashRow key={row.id} row={row} />
              ))}
            </div>
          )}
          <PaginationFooter
            offset={safeOffset}
            pageSize={PAGE_SIZE}
            currentCount={rows.length}
            params={params}
          />
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------
// Active filters
// --------------------------------------------------------------

function ActiveFiltersStrip({
  environment,
  release,
  level,
  fingerprint,
  userId,
  query,
  count,
}: {
  environment: string | null;
  release: string | null;
  level: CrashLevel | null;
  fingerprint: string | null;
  userId: string | null;
  query: string;
  count: number;
}) {
  const filters: Array<{ key: string; label: string }> = [];
  if (environment) filters.push({ key: "env", label: `env: ${environment}` });
  if (release) filters.push({ key: "release", label: `release: ${release}` });
  if (level) filters.push({ key: "level", label: `level: ${level}` });
  if (fingerprint) filters.push({ key: "fingerprint", label: `fingerprint: ${fingerprint.slice(0, 12)}…` });
  if (userId) filters.push({ key: "userId", label: `user: ${userId.slice(0, 8)}…` });
  if (query) filters.push({ key: "q", label: `text: "${query}"` });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl glass-panel px-4 py-3 text-xs text-ink-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-ink">
          {count} {count === 1 ? "row" : "rows"}
        </span>
        {filters.length > 0 && (
          <>
            <span aria-hidden className="text-ink-3">·</span>
            <span className="text-ink-3">filtered by</span>
            {filters.map((f) => (
              <Link
                key={f.key}
                href={`/crashes`}
                className="rounded-full border border-rule/70 px-2 py-0.5 text-[10px] font-semibold text-ink-2 hover:border-brand"
              >
                {f.label} ✕
              </Link>
            ))}
          </>
        )}
      </div>
      <span className="text-ink-3">sort: last seen ↓</span>
    </div>
  );
}

// --------------------------------------------------------------
// Empty state
// --------------------------------------------------------------

function EmptyQueue() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl glass-panel p-12 text-center">
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand"
      >
        <AlertTriangle className="size-5" />
      </span>
      <p className="font-display text-lg text-ink">No crashes recorded</p>
      <p className="max-w-md text-sm text-ink-2">
        Sentry events land here via the sentry-webhook Edge Function. If you
        expected something, check the Function logs in Supabase.
      </p>
    </div>
  );
}

// --------------------------------------------------------------
// Row
// --------------------------------------------------------------

function CrashRow({ row }: { row: CrashReportEnriched }) {
  const reporterAvatar = avatarURL(row.user_id, row.reporter_avatar_photo_id);
  const reporterDisplay =
    row.reporter_display_name ?? row.reporter_username ?? null;
  return (
    <Link
      href={`/crashes/${row.id}`}
      className="group block h-full rounded-xl glass-panel transition-colors hover:border-brand/40"
    >
      <article className="flex h-full flex-col gap-3 p-5">
        <header className="flex flex-wrap items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-alert/10 text-alert">
            <AlertTriangle aria-hidden className="size-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${levelChip(row.level)}`}
              >
                {levelLabel(row.level)}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${environmentChip(row.environment)}`}
              >
                {row.environment ?? "no env"}
              </span>
              {row.release_name && (
                <span className="rounded-full border border-rule/70 px-2 py-0.5 font-mono text-[10px] text-ink-2">
                  {row.release_name}
                </span>
              )}
              <span className="text-ink-3">{formatRelative(row.last_seen)}</span>
              {row.event_count > 1 && (
                <span className="text-ink-3">· seen {row.event_count}×</span>
              )}
            </div>
            <p className="line-clamp-2 text-sm leading-snug text-ink">
              {row.message ?? row.culprit ?? "(no message)"}
            </p>
            {row.culprit && row.message && (
              <p className="truncate font-mono text-[11px] text-ink-3">
                {row.culprit}
              </p>
            )}
          </div>
          <ArrowUpRight aria-hidden className="size-4 shrink-0 text-ink-3" />
        </header>

        <footer className="flex flex-wrap items-center gap-3 text-xs text-ink-3">
          {row.user_id ? (
            <>
              {reporterAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={reporterAvatar}
                  alt=""
                  className="size-6 rounded-full border border-rule/70 bg-paper-sunken object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex size-6 items-center justify-center rounded-full border border-rule/70 bg-paper-sunken text-[10px] font-semibold uppercase text-ink-3"
                >
                  {(reporterDisplay ?? "??").slice(0, 2)}
                </span>
              )}
              <span className="text-ink-2">
                {reporterDisplay ?? "anonymous"}
                {row.reporter_username && (
                  <span className="ml-1 text-ink-3">@{row.reporter_username}</span>
                )}
              </span>
            </>
          ) : (
            <span className="italic text-ink-3">Anonymous</span>
          )}
          {row.device_model && (
            <span className="inline-flex items-center gap-1 text-ink-3">
              <Smartphone aria-hidden className="size-3" />
              {row.device_model}
              {row.os_version && ` · iOS ${row.os_version}`}
            </span>
          )}
        </footer>
      </article>
    </Link>
  );
}

// --------------------------------------------------------------
// Pagination
// --------------------------------------------------------------

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
          className="rounded-lg glass-panel px-3 py-1 font-semibold text-ink-2 hover:border-brand"
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
          className="rounded-lg glass-panel px-3 py-1 font-semibold text-ink-2 hover:border-brand"
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
  return query ? `/crashes?${query}` : "/crashes";
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
  // Locked en-GB per CLAUDE.md §3.6 (UK-style date), matches the
  // detail page's formatAbsolute().
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: diffDays > 365 ? "numeric" : undefined,
  });
}
