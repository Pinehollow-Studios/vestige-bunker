import Link from "next/link";
import { ArrowUpRight, Hash, Sparkles, Tag } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { listCoverURL } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { NewCuratedListButton } from "./NewCuratedListButton";
import {
  STATUS_CHIP,
  STATUS_DOT,
  STATUS_LABELS,
  statusFor,
  type CuratedListRow,
  type CuratedListStatus,
} from "./types";

export const dynamic = "force-dynamic";

/**
 * Curated-lists index. Shows every row in `curated_lists`
 * regardless of state — admin RLS (`curated_lists_select_admin`
 * from `20260503120000_curated_lists_richer_publishing.sql`)
 * sees draft / scheduled / live / expired / archived alike. The
 * iOS app only sees the live subset.
 *
 * Each row links to `/curated/[id]` for editing.
 */
export default async function CuratedListsPage() {
  const supabase = await createClient();

  // Two queries: the rows themselves, then a per-row count from
  // `curated_list_courses`. Keeps the SQL surface here trivial;
  // a future RPC can fold the count in if the row count grows.
  const { data: lists, error: listsErr } = await supabase
    .from("curated_lists")
    .select(
      "id,name,slug,description,bio,tags,region,tier,display_priority,is_ordered,cover_storage_key,published_at,unpublished_at,is_archived,created_at,updated_at",
    )
    .order("is_archived", { ascending: true })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const counts: Record<string, number> = {};
  if (lists && lists.length > 0) {
    const { data: countRows } = await supabase
      .from("curated_list_courses")
      .select("curated_list_id")
      .in(
        "curated_list_id",
        lists.map((l) => l.id),
      );
    for (const row of countRows ?? []) {
      counts[row.curated_list_id] = (counts[row.curated_list_id] ?? 0) + 1;
    }
  }

  const rows: CuratedListRow[] = (lists ?? []).map((l) => ({
    ...l,
    course_count: counts[l.id] ?? 0,
  }));

  const buckets = bucketRows(rows);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SectionHeader
        eyebrow="Editorial"
        title="Curated lists"
        description="Editorial collections owned by Vestige — what users see in the app."
        actions={<NewCuratedListButton />}
      />

      {/* Status counters strip — gives a fast read on how the
          editorial mix is balanced before scrolling the grid. */}
      {rows.length > 0 && <CuratedSummary buckets={buckets} total={rows.length} />}

      {listsErr && (
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load curated lists: {listsErr.message}
        </div>
      )}

      {!listsErr && rows.length === 0 && <EmptyState />}

      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <CuratedRowCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-rule/70 bg-paper-raised/50 p-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <span
          aria-hidden
          className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand"
        >
          <Sparkles className="size-5" />
        </span>
        <p className="font-display text-base font-semibold text-ink">
          No curated lists yet
        </p>
        <p className="text-sm text-ink-2">
          Create your first one to start editorial collections.
        </p>
      </div>
    </div>
  );
}

function CuratedSummary({
  buckets,
  total,
}: {
  buckets: Record<CuratedListStatus, number>;
  total: number;
}) {
  const order: CuratedListStatus[] = [
    "live",
    "scheduled",
    "draft",
    "expired",
    "archived",
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-rule/70 bg-paper-raised/50 px-3 py-1 text-xs font-medium text-ink-2">
        {total} total
      </span>
      {order.map((key) => (
        <span
          key={key}
          className="inline-flex items-center gap-2 rounded-full border border-rule/70 bg-paper-raised/50 px-3 py-1 text-xs"
        >
          <span aria-hidden className={cn("size-2 rounded-full", STATUS_DOT[key])} />
          <span className="text-ink-2">{STATUS_LABELS[key]}</span>
          <span className="font-semibold tabular-nums text-ink">{buckets[key]}</span>
        </span>
      ))}
    </div>
  );
}

function CuratedRowCard({ row }: { row: CuratedListRow }) {
  const status = statusFor(row);
  const cover = listCoverURL(row.cover_storage_key);
  return (
    <Link
      href={`/curated/${row.id}`}
      className="group/card flex gap-4 rounded-xl border border-rule/70 bg-paper-raised/50 p-4 transition-colors hover:border-brand/40"
    >
      <CoverThumb url={cover} title={row.name} />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-0.5 pr-1">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="flex min-w-0 items-center gap-2 truncate font-heading text-base font-semibold leading-snug text-ink">
              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])} />
              <span className="truncate">{row.name}</span>
            </h2>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                STATUS_CHIP[status],
              )}
            >
              {STATUS_LABELS[status]}
            </span>
          </div>
          {row.description && (
            <p className="line-clamp-2 text-xs leading-relaxed text-ink-2">
              {row.description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {row.tier && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wider",
                row.tier === "flagship"
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-border bg-paper-sunken/60 text-ink-2",
              )}
            >
              {row.tier}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-paper-sunken/40 px-2 py-0.5 text-ink-2">
            <Hash aria-hidden className="size-3" />
            {row.course_count} {row.course_count === 1 ? "course" : "courses"}
          </span>
          {row.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-paper-sunken/40 px-2 py-0.5 text-ink-3"
            >
              <Tag aria-hidden className="size-2.5" />
              {tag}
            </span>
          ))}
          {row.tags.length > 3 && (
            <span className="text-ink-3">+{row.tags.length - 3}</span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-brand opacity-0 transition-opacity group-hover/card:opacity-100">
            Edit
            <ArrowUpRight aria-hidden className="size-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function CoverThumb({ url, title }: { url: string | null; title: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`Cover for ${title}`}
        className="h-24 w-32 shrink-0 rounded-lg bg-paper-sunken object-cover"
      />
    );
  }
  return (
    <div
      className="flex h-24 w-32 shrink-0 items-center justify-center rounded-lg border border-rule/70 bg-paper-sunken/60 text-[10px] font-semibold uppercase tracking-wider text-ink-3"
    >
      No cover
    </div>
  );
}

function bucketRows(rows: CuratedListRow[]): Record<CuratedListStatus, number> {
  const out: Record<CuratedListStatus, number> = {
    draft: 0,
    scheduled: 0,
    live: 0,
    expired: 0,
    archived: 0,
  };
  for (const row of rows) {
    out[statusFor(row)] += 1;
  }
  return out;
}
