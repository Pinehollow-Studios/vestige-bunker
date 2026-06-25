import { SectionHeader } from "@/components/admin/SectionHeader";
import { TableToolbar, TableSelect } from "@/components/admin/table/TableToolbar";
import type { SortDir } from "@/components/admin/table/DataTable";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { NewBadgeButton } from "./NewBadgeButton";
import { BadgesTable, type BadgeTableRow } from "./BadgesTable";
import {
  CATEGORIES,
  criteriaSummary,
  statusFor,
  STATUS_DOT,
  STATUS_LABELS,
  TIER_ORDER,
  TIERS,
  type BadgeDefinitionRow,
  type BadgeStatus,
} from "./types";

export const dynamic = "force-dynamic";

const STATUS_ORDER: BadgeStatus[] = ["live", "draft", "archived"];
const STATUS_RANK: Record<BadgeStatus, number> = { live: 0, draft: 1, archived: 2 };

type SearchParams = Promise<{
  q?: string;
  status?: string;
  tier?: string;
  category?: string;
  sort?: string;
  dir?: string;
}>;

export default async function BadgesPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const statusFilter = sp.status ?? "all";
  const tierFilter = sp.tier ?? "all";
  const categoryFilter = sp.category ?? "all";
  const sort = sp.sort ?? "name";
  const dir: SortDir = sp.dir === "desc" ? "desc" : "asc";

  const supabase = await createClient();
  const { data, error } = await supabase.from("badge_definitions").select("*");
  const defs = (data ?? []) as BadgeDefinitionRow[];
  const lookups = await loadLookups(supabase, defs);

  const buckets: Record<BadgeStatus, number> = { live: 0, draft: 0, archived: 0 };
  for (const d of defs) buckets[statusFor(d)] += 1;

  let rows: BadgeTableRow[] = defs.map((d) => ({
    id: d.id,
    name: d.name,
    tagline: d.tagline,
    glyph: d.glyph,
    tint_hex: d.tint_hex,
    tier: d.tier,
    category: d.category,
    is_secret: d.is_secret,
    status: statusFor(d),
    criteriaText: criteriaSummary(d.criteria, lookups),
  }));

  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || (r.tagline ?? "").toLowerCase().includes(q));
  if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
  if (tierFilter !== "all") rows = rows.filter((r) => r.tier === tierFilter);
  if (categoryFilter !== "all") rows = rows.filter((r) => r.category === categoryFilter);

  const tierRank = (t: BadgeTableRow["tier"]) => TIER_ORDER.indexOf(t);
  rows = [...rows].sort((a, b) => {
    const m = dir === "asc" ? 1 : -1;
    switch (sort) {
      case "status":
        return (STATUS_RANK[a.status] - STATUS_RANK[b.status]) * m;
      case "tier":
        return (tierRank(a.tier) - tierRank(b.tier)) * m;
      case "category":
        return a.category.localeCompare(b.category) * m;
      default:
        return a.name.localeCompare(b.name) * m;
    }
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <SectionHeader eyebrow="Editorial" title="Badges" actions={<NewBadgeButton />} />

      {defs.length > 0 && (
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
        searchPlaceholder="Search badges…"
        countLabel={`${rows.length} of ${defs.length} ${defs.length === 1 ? "badge" : "badges"}`}
        hasFilters={Boolean(q) || statusFilter !== "all" || tierFilter !== "all" || categoryFilter !== "all"}
      >
        <TableSelect
          name="status"
          label="Status"
          value={statusFilter}
          options={[{ value: "all", label: "All" }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
        />
        <TableSelect
          name="tier"
          label="Tier"
          value={tierFilter}
          options={[{ value: "all", label: "All tiers" }, ...TIERS.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))]}
        />
        <TableSelect
          name="category"
          label="Category"
          value={categoryFilter}
          options={[{ value: "all", label: "All" }, ...CATEGORIES.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))]}
        />
      </TableToolbar>

      {error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load badges: {error.message}
        </div>
      ) : (
        <BadgesTable rows={rows} sort={sort} dir={dir} />
      )}
    </div>
  );
}

type Lookups = { counties: Record<string, string>; courses: Record<string, string>; lists: Record<string, string> };

async function loadLookups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  defs: BadgeDefinitionRow[],
): Promise<Lookups> {
  const counties: Record<string, string> = {};
  const courses: Record<string, string> = {};
  const lists: Record<string, string> = {};

  const { data: countyRows } = await supabase.from("counties").select("id,name");
  for (const c of countyRows ?? []) counties[c.id] = c.name;
  const { data: listRows } = await supabase.from("curated_lists").select("id,name");
  for (const l of listRows ?? []) lists[l.id] = l.name;

  const courseIds = defs
    .map((d) => (d.criteria.type === "specific_course" ? d.criteria.course_id : null))
    .filter((x): x is string => !!x);
  if (courseIds.length > 0) {
    const { data: courseRows } = await supabase.from("courses").select("id,name").in("id", courseIds);
    for (const c of courseRows ?? []) courses[c.id] = c.name;
  }
  return { counties, courses, lists };
}
