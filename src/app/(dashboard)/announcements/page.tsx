import Link from "next/link";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { cn } from "@/lib/utils";
import { NewAnnouncementButton } from "./NewAnnouncementButton";
import { AnnouncementFilters } from "./AnnouncementFilters";
import {
  audienceSummary,
  KIND_LABELS,
  statusFor,
  STATUS_CHIP,
  STATUS_DOT,
  STATUS_LABELS,
  type AnnouncementAudienceKind,
  type AnnouncementKind,
  type AnnouncementOverviewRow,
  type AnnouncementStatus,
} from "./types";

export const dynamic = "force-dynamic";

type SearchParamArray = string | string[] | undefined;

function asArray<T extends string>(value: SearchParamArray): T[] | null {
  if (!value) return null;
  const arr = Array.isArray(value) ? value : [value];
  return arr.length > 0 ? (arr as T[]) : null;
}

/**
 * Announcements index. Admin RLS + the `admin_announcements_overview()` RPC see
 * every announcement (draft / scheduled / live / expired / archived) with the
 * derived seen / dismissed / acted counts. Each row links to
 * `/announcements/[id]` for the full content + targeting + lifecycle editor.
 *
 * Forward-compat: the overview RPC + tables don't exist on prod until Tom
 * applies the migration, so a missing-table error renders the unconfigured
 * empty state rather than throwing.
 */
export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamArray>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = await createClient();

  const statuses = asArray<AnnouncementStatus>(params.status);
  const kinds = asArray<AnnouncementKind>(params.kind);
  const audiences = asArray<AnnouncementAudienceKind>(params.audience);

  const { data, error } = await supabase.rpc("admin_announcements_overview");
  const rows = (data as AnnouncementOverviewRow[] | null) ?? [];

  // The migration may not be applied in this environment yet (e.g. prod before
  // Tom's coordinated deploy). Treat a missing-function / missing-table error
  // as "not yet wired" rather than a hard failure.
  const notConfigured = !!error && isMissingRelation(error.message);

  const buckets = bucketRows(rows);

  // Client-side filtering keeps the surface single-RPC + URL-driven without a
  // bespoke filtered RPC — the overview already returns every row.
  const now = new Date();
  const filtered = rows.filter((row) => {
    if (statuses && !statuses.includes(statusFor(row, now))) return false;
    if (kinds && !kinds.includes(row.kind)) return false;
    if (audiences && !audiences.includes(row.audience_kind)) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        eyebrow="Editorial"
        title="Announcements"
        description="Author the in-app pop-ups the app raises in front of users — what's-new notices, feature spotlights, outreach. Target everyone, a cohort, or hand-picked people; schedule it; then watch who's seen it."
        actions={<NewAnnouncementButton />}
      />

      {rows.length > 0 && <Summary buckets={buckets} total={rows.length} />}

      {error && !notConfigured && (
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load announcements: {error.message}
        </div>
      )}

      {notConfigured && <NotConfigured />}

      {!notConfigured && rows.length > 0 && <AnnouncementFilters />}

      {!error && rows.length === 0 && <EmptyState />}

      {!notConfigured && rows.length > 0 && (
        <>
          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/70 bg-paper-raised/60 p-8 text-center text-sm text-ink-2">
              No announcements match the current filters.
            </p>
          ) : (
            <ol className="space-y-3">
              {filtered.map((row) => (
                <li key={row.id}>
                  <AnnouncementRowCard row={row} />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

function AnnouncementRowCard({ row }: { row: AnnouncementOverviewRow }) {
  const status = statusFor(row);
  return (
    <Link
      href={`/announcements/${row.id}`}
      className="group/card relative block overflow-hidden rounded-2xl border border-border bg-paper-raised ring-1 ring-foreground/5 shadow-[0_1px_2px_rgba(31,42,36,0.04)] transition-colors hover:border-brand/40 hover:ring-brand/15"
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", STATUS_DOT[status])} />
      <article className="flex flex-col gap-3 p-5">
        <header className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-deep dark:text-brand-soft">
                {KIND_LABELS[row.kind]}
              </span>
              {row.eyebrow && <span className="text-ink-3">· {row.eyebrow}</span>}
              <span className="text-ink-3">· priority {row.priority}</span>
            </div>
            <h2 className="truncate font-heading text-base font-semibold leading-snug text-ink">
              {row.title}
            </h2>
            <p className="text-xs text-ink-2">{audienceSummary(row)}</p>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              STATUS_CHIP[status],
            )}
          >
            {STATUS_LABELS[status]}
          </span>
        </header>

        <footer className="flex flex-wrap items-center gap-4 text-xs text-ink-3">
          <Stat label="seen" value={row.seen_count} />
          <Stat label="dismissed" value={row.dismissed_count} />
          <Stat label="acted" value={row.acted_count} />
          <span className="ml-auto inline-flex items-center gap-1 text-brand-deep opacity-0 transition-opacity group-hover/card:opacity-100 dark:text-brand-soft">
            Edit <ArrowUpRight aria-hidden className="size-3" />
          </span>
        </footer>
      </article>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-semibold tabular-nums text-ink">{value}</span>
      <span className="text-ink-3">{label}</span>
    </span>
  );
}

function Summary({
  buckets,
  total,
}: {
  buckets: Record<AnnouncementStatus, number>;
  total: number;
}) {
  const order: AnnouncementStatus[] = ["live", "scheduled", "draft", "expired", "archived"];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-border bg-paper-raised px-3 py-1 text-xs font-medium text-ink-2">
        {total} total
      </span>
      {order
        .filter((key) => buckets[key] > 0)
        .map((key) => (
          <span
            key={key}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-paper-raised px-3 py-1 text-xs"
          >
            <span aria-hidden className={cn("size-2 rounded-full", STATUS_DOT[key])} />
            <span className="text-ink-2">{STATUS_LABELS[key]}</span>
            <span className="font-semibold tabular-nums text-ink">{buckets[key]}</span>
          </span>
        ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/70 bg-paper-raised/60 p-12 text-center">
      <div className="relative flex flex-col items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand-deep dark:text-brand-soft">
          <Megaphone className="size-5" />
        </span>
        <p className="font-heading text-base font-semibold text-ink">No announcements yet</p>
        <p className="text-sm text-ink-2">
          Author your first announcement — a what&apos;s-new card, a feature spotlight, a note to
          the beta.
        </p>
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/70 bg-paper-raised/60 p-12 text-center">
      <div className="relative flex flex-col items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-full bg-paper-sunken text-ink-3">
          <Megaphone className="size-5" />
        </span>
        <p className="font-heading text-base font-semibold text-ink">Announcements not wired here</p>
        <p className="mx-auto max-w-md text-sm text-ink-2">
          The announcements tables aren&apos;t in this Supabase project yet. Apply the
          <span className="font-mono text-xs"> 20260607100000_announcements.sql</span> migration to
          enable this surface.
        </p>
      </div>
    </div>
  );
}

function bucketRows(rows: AnnouncementOverviewRow[]): Record<AnnouncementStatus, number> {
  const out: Record<AnnouncementStatus, number> = {
    draft: 0,
    scheduled: 0,
    live: 0,
    expired: 0,
    archived: 0,
  };
  const now = new Date();
  for (const row of rows) out[statusFor(row, now)] += 1;
  return out;
}

/** True when a PostgREST error reads like "relation/function does not exist". */
function isMissingRelation(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("schema cache") ||
    m.includes("not found")
  );
}
