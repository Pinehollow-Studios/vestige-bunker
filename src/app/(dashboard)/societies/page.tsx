import { SectionHeader } from "@/components/admin/SectionHeader";
import { TableToolbar, TableSelect } from "@/components/admin/table/TableToolbar";
import type { SortDir } from "@/components/admin/table/DataTable";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { NewTemplateButton } from "./NewTemplateButton";
import { TemplateCard } from "./TemplateCard";
import {
  TEMPLATE_STATUS_DOT,
  TEMPLATE_STATUS_LABELS,
  type SocietyTemplateRow,
  type SocietyTemplateStatus,
} from "./types";

export const dynamic = "force-dynamic";

const STATUS_ORDER: SocietyTemplateStatus[] = ["live", "draft", "archived"];
const STATUS_RANK: Record<SocietyTemplateStatus, number> = { live: 0, draft: 1, archived: 2 };

type SearchParams = Promise<{ q?: string; status?: string; sort?: string; dir?: string }>;

export default async function SocietyTemplatesPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const statusFilter = sp.status ?? "all";
  const sort = sp.sort ?? "name";
  const dir: SortDir = sp.dir === "desc" ? "desc" : "asc";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("society_templates")
    .select(
      "id,slug,name,kind,target_type,fixed_list_id,name_pattern,blurb,story_template,crest,cover_storage_key,default_duration_days,status,featured,sort_order,created_at,updated_at",
    );
  const all = (data as SocietyTemplateRow[] | null) ?? [];

  const buckets: Record<SocietyTemplateStatus, number> = { draft: 0, live: 0, archived: 0 };
  for (const r of all) buckets[r.status] += 1;

  let rows = all;
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || (r.blurb ?? "").toLowerCase().includes(q));
  if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
  rows = [...rows].sort((a, b) => {
    const m = dir === "asc" ? 1 : -1;
    switch (sort) {
      case "status":
        return (STATUS_RANK[a.status] - STATUS_RANK[b.status]) * m;
      case "kind":
        return a.kind.localeCompare(b.kind) * m;
      case "updated":
        return (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()) * m;
      default:
        return a.name.localeCompare(b.name) * m;
    }
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <SectionHeader eyebrow="Editorial" title="Society templates" actions={<NewTemplateButton />} />

      <p className="max-w-2xl text-sm text-ink-2">
        Curated “Vestige collections” that generate a player their own society. They pick a template,
        pick a county, and a themed society is built for them. County templates go live one county at a
        time — theme each in its editor, then publish.
      </p>

      {all.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_ORDER.map((key) => (
            <span key={key} className="inline-flex items-center gap-2 rounded-full glass-panel px-3 py-1 text-xs">
              <span aria-hidden className={cn("size-2 rounded-full", TEMPLATE_STATUS_DOT[key])} />
              <span className="text-ink-2">{TEMPLATE_STATUS_LABELS[key]}</span>
              <span className="font-semibold tabular-nums text-ink">{buckets[key]}</span>
            </span>
          ))}
        </div>
      )}

      <TableToolbar
        initialQuery={sp.q ?? ""}
        searchPlaceholder="Search templates…"
        countLabel={`${rows.length} of ${all.length} ${all.length === 1 ? "template" : "templates"}`}
        hasFilters={Boolean(q) || statusFilter !== "all"}
      >
        <TableSelect
          name="status"
          label="Status"
          value={statusFilter}
          options={[
            { value: "all", label: "All statuses" },
            ...STATUS_ORDER.map((s) => ({ value: s, label: TEMPLATE_STATUS_LABELS[s] })),
          ]}
        />
        <TableSelect
          name="sort"
          label="Sort"
          value={sort}
          options={[
            { value: "name", label: "Name" },
            { value: "status", label: "Status" },
            { value: "kind", label: "Mechanic" },
            { value: "updated", label: "Updated" },
          ]}
        />
      </TableToolbar>

      {error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load: {error.message}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl glass-panel p-6 text-center text-sm text-ink-3">
          No templates yet. Create one to get started.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <TemplateCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}
