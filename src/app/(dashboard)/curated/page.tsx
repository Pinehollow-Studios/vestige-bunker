import { SectionHeader } from "@/components/admin/SectionHeader";
import { TableToolbar, TableSelect } from "@/components/admin/table/TableToolbar";
import type { SortDir } from "@/components/admin/table/DataTable";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { NewCuratedListButton } from "./NewCuratedListButton";
import { CuratedCard } from "./CuratedCard";
import {
  STATUS_DOT,
  STATUS_LABELS,
  statusFor,
  type CuratedListRow,
  type CuratedListStatus,
} from "./types";

export const dynamic = "force-dynamic";

const STATUS_ORDER: CuratedListStatus[] = ["live", "scheduled", "draft", "expired", "archived"];
const STATUS_RANK: Record<CuratedListStatus, number> = {
  live: 0,
  scheduled: 1,
  draft: 2,
  expired: 3,
  archived: 4,
};

type SearchParams = Promise<{ q?: string; status?: string; sort?: string; dir?: string }>;

export default async function CuratedListsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const statusFilter = sp.status ?? "all";
  const sort = sp.sort ?? "name";
  const dir: SortDir = sp.dir === "desc" ? "desc" : "asc";

  const supabase = await createClient();
  const { data: lists, error } = await supabase
    .from("curated_lists")
    .select(
      "id,name,slug,description,bio,tags,region,tier,display_priority,is_ordered,cover_storage_key,published_at,unpublished_at,is_archived,created_at,updated_at",
    );

  const counts: Record<string, number> = {};
  if (lists && lists.length > 0) {
    const { data: countRows } = await supabase
      .from("curated_list_courses")
      .select("curated_list_id")
      .in("curated_list_id", lists.map((l) => l.id));
    for (const row of countRows ?? []) counts[row.curated_list_id] = (counts[row.curated_list_id] ?? 0) + 1;
  }

  const all: CuratedListRow[] = (lists ?? []).map((l) => ({ ...l, course_count: counts[l.id] ?? 0 }));

  // Status counters (over everything, before filtering).
  const buckets: Record<CuratedListStatus, number> = {
    draft: 0,
    scheduled: 0,
    live: 0,
    expired: 0,
    archived: 0,
  };
  for (const r of all) buckets[statusFor(r)] += 1;

  // Filter (search + status) then sort — small dataset, all in memory.
  let rows = all;
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q));
  if (statusFilter !== "all") rows = rows.filter((r) => statusFor(r) === statusFilter);
  rows = [...rows].sort((a, b) => {
    const m = dir === "asc" ? 1 : -1;
    switch (sort) {
      case "status":
        return (STATUS_RANK[statusFor(a)] - STATUS_RANK[statusFor(b)]) * m;
      case "tier":
        return (a.tier ?? "").localeCompare(b.tier ?? "") * m;
      case "courses":
        return (a.course_count - b.course_count) * m;
      case "updated":
        return (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()) * m;
      default:
        return a.name.localeCompare(b.name) * m;
    }
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <SectionHeader eyebrow="Editorial" title="Curated lists" actions={<NewCuratedListButton />} />

      {all.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_ORDER.map((key) => (
            <span key={key} className="inline-flex items-center gap-2 rounded-full glass-panel px-3 py-1 text-xs">
              <span aria-hidden className={cn("size-2 rounded-full", STATUS_DOT[key])} />
              <span className="text-ink-2">{STATUS_LABELS[key]}</span>
              <span className="font-semibold tabular-nums text-ink">{buckets[key]}</span>
            </span>
          ))}
        </div>
      )}

      <TableToolbar
        initialQuery={sp.q ?? ""}
        searchPlaceholder="Search lists…"
        countLabel={`${rows.length} of ${all.length} ${all.length === 1 ? "list" : "lists"}`}
        hasFilters={Boolean(q) || statusFilter !== "all"}
      >
        <TableSelect
          name="status"
          label="Status"
          value={statusFilter}
          options={[
            { value: "all", label: "All statuses" },
            ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
          ]}
        />
        <TableSelect
          name="sort"
          label="Sort"
          value={sort}
          options={[
            { value: "name", label: "Name" },
            { value: "status", label: "Status" },
            { value: "tier", label: "Tier" },
            { value: "courses", label: "Courses" },
            { value: "updated", label: "Updated" },
          ]}
        />
      </TableToolbar>

      {error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load: {error.message}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl glass-panel p-6 text-center text-sm text-ink-3">No curated lists match.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <CuratedCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}
