import { SectionHeader } from "@/components/admin/SectionHeader";
import { TableToolbar, TableSelect } from "@/components/admin/table/TableToolbar";
import { TablePagination } from "@/components/admin/table/TablePagination";
import { createClient } from "@/lib/supabase/server";
import { TIER_LABELS, type CourseTier } from "../courses/types";
import { IndexControls } from "./IndexControls";
import { IndexTable, type IndexRow } from "./IndexTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const SORT_COLUMN: Record<string, string> = {
  index: "vestige_index",
  prestige: "prestige",
  name: "name",
  plays: "play_count",
};

type SearchParams = Promise<{
  q?: string;
  county?: string;
  tier?: string;
  sort?: string;
  dir?: string;
  offset?: string;
}>;

/**
 * The Vestige Index tab — every course ranked 100 → 0 with inline prestige
 * editing, plus the global blend (rarity swing) + a recalculate-now control.
 * Prestige is the only editable value; rarity + the Index are computed.
 */
export default async function IndexPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim();
  const county = sp.county ?? "all";
  const tier = sp.tier ?? "all";
  const sort = SORT_COLUMN[sp.sort ?? ""] ? (sp.sort as string) : "index";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const offsetRaw = Number(sp.offset ?? 0);
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  const supabase = await createClient();

  let listQ = supabase
    .from("courses")
    .select(
      "id,name,tier,prestige,prestige_source,vestige_index,vestige_rarity,play_count,clubs(name),counties(name)",
      { count: "exact" },
    );
  if (q) listQ = listQ.ilike("name", `%${q}%`);
  if (tier !== "all") listQ = listQ.eq("tier", tier);
  if (county !== "all") listQ = listQ.eq("county_id", county);

  const [listRes, countiesRes, configRes] = await Promise.all([
    listQ
      .order(SORT_COLUMN[sort], { ascending: dir === "asc", nullsFirst: false })
      .order("name", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1),
    supabase.from("counties").select("id,name").order("name", { ascending: true }),
    supabase.from("vestige_index_config").select("rarity_swing").maybeSingle(),
  ]);

  const counties = (countiesRes.data ?? []) as Array<{ id: string; name: string }>;
  const total = listRes.count ?? 0;
  const raritySwing = (configRes.data?.rarity_swing as number | undefined) ?? 0.15;

  const rows: IndexRow[] = (listRes.data ?? []).map((r, i) => ({
    rank: offset + i + 1,
    id: r.id,
    name: r.name,
    clubName: unwrap<{ name: string }>(r.clubs)?.name ?? null,
    countyName: unwrap<{ name: string }>(r.counties)?.name ?? null,
    tier: r.tier as CourseTier,
    prestige: r.prestige ?? 50,
    prestigeSource: r.prestige_source ?? null,
    vestigeIndex: r.vestige_index ?? null,
    vestigeRarity: r.vestige_rarity ?? null,
    playCount: r.play_count ?? 0,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <SectionHeader eyebrow="Editorial" title="Vestige Index" />

      <IndexControls raritySwing={raritySwing} />

      <TableToolbar
        initialQuery={q}
        searchPlaceholder="Search course name…"
        countLabel={`${total.toLocaleString()} ${total === 1 ? "course" : "courses"} · ranked by Index`}
        hasFilters={Boolean(q) || tier !== "all" || county !== "all"}
      >
        <TableSelect
          name="county"
          label="County"
          value={county}
          options={[
            { value: "all", label: "All counties" },
            ...counties.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <TableSelect
          name="tier"
          label="Tier"
          value={tier}
          options={[
            { value: "all", label: "All tiers" },
            ...(Object.keys(TIER_LABELS) as CourseTier[]).map((v) => ({ value: v, label: TIER_LABELS[v] })),
          ]}
        />
        <TableSelect
          name="sort"
          label="Sort"
          value={sort}
          options={[
            { value: "index", label: "Index" },
            { value: "prestige", label: "Prestige" },
            { value: "plays", label: "Plays" },
            { value: "name", label: "Name" },
          ]}
        />
      </TableToolbar>

      {listRes.error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load: {listRes.error.message}
        </div>
      ) : (
        <>
          <IndexTable rows={rows} />
          <TablePagination
            offset={offset}
            pageSize={PAGE_SIZE}
            count={rows.length}
            hasMore={offset + rows.length < total}
          />
        </>
      )}
    </div>
  );
}

function unwrap<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value as T;
}
