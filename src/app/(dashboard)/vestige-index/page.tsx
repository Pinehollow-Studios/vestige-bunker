import Link from "next/link";
import { ArrowLeft, ChevronRight, Gauge, MapPin } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { TableToolbar, TableSelect } from "@/components/admin/table/TableToolbar";
import { TablePagination } from "@/components/admin/table/TablePagination";
import { createClient } from "@/lib/supabase/server";
import { TIER_LABELS, type CourseTier } from "../courses/types";
import { IndexMechanics } from "./IndexMechanics";
import { IndexTable, type IndexRow } from "./IndexTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const NO_COUNTY = "none";
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
 * The Vestige Index surface. Mirrors the Courses page shape: with no selection
 * it lands on a county grid (each tile showing how many courses still sit at
 * the default prestige, i.e. await ranking); picking a county / searching /
 * filtering drills into the scoped ranked batch editor. The global mechanics
 * panel (formula + rarity-swing + recompute) sits on top of both.
 */
export default async function VestigeIndexPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim();
  const county = sp.county ?? "all";
  const tier = sp.tier ?? "all";

  const supabase = await createClient();

  const showTable = county !== "all" || Boolean(q) || tier !== "all";
  if (!showTable) {
    return <CountyLanding supabase={supabase} initialQuery={sp.q ?? ""} />;
  }
  return <TableView supabase={supabase} sp={sp} q={q} county={county} tier={tier} />;
}

// ── Shared: global mechanics (rarity swing + who/when) ──────────────────
async function loadMechanics(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("vestige_index_config")
    .select("rarity_swing, updated_at, updated_by")
    .maybeSingle();
  const raritySwing = (data?.rarity_swing as number | undefined) ?? 0.15;
  const updatedAt = (data?.updated_at as string | undefined) ?? null;
  let updatedByName: string | null = null;
  const updatedBy = data?.updated_by as string | undefined;
  if (updatedBy) {
    const { data: u } = await supabase
      .from("users")
      .select("display_name, username")
      .eq("id", updatedBy)
      .maybeSingle();
    updatedByName = ((u?.display_name as string) || (u?.username as string)) ?? null;
  }
  return { raritySwing, updatedAt, updatedByName };
}

// ── Landing: county grid ────────────────────────────────────────────────
async function CountyLanding({
  supabase,
  initialQuery,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  initialQuery: string;
}) {
  const [aggRes, countiesRes, mechanics] = await Promise.all([
    supabase.from("courses").select("county_id, prestige, vestige_index"),
    supabase.from("counties").select("id, name").order("name", { ascending: true }),
    loadMechanics(supabase),
  ]);

  type Stat = { total: number; unranked: number; indexSum: number; indexCount: number };
  const stats = new Map<string, Stat>();
  for (const r of (aggRes.data as Array<{
    county_id: string | null;
    prestige: number | null;
    vestige_index: number | null;
  }> | null) ?? []) {
    const key = r.county_id ?? NO_COUNTY;
    const s = stats.get(key) ?? { total: 0, unranked: 0, indexSum: 0, indexCount: 0 };
    s.total += 1;
    // "Unranked" = still at the seed prestige of 50 (no editorial pass yet).
    if ((r.prestige ?? 50) === 50) s.unranked += 1;
    if (r.vestige_index != null) {
      s.indexSum += r.vestige_index;
      s.indexCount += 1;
    }
    stats.set(key, s);
  }

  const counties = ((countiesRes.data as Array<{ id: string; name: string }> | null) ?? [])
    .map((c) => ({ ...c, ...(stats.get(c.id) ?? { total: 0, unranked: 0, indexSum: 0, indexCount: 0 }) }))
    .filter((c) => c.total > 0);
  const orphan = stats.get(NO_COUNTY);
  const totalCourses = Array.from(stats.values()).reduce((n, s) => n + s.total, 0);
  const totalUnranked = Array.from(stats.values()).reduce((n, s) => n + s.unranked, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <SectionHeader eyebrow="Editorial" title="Vestige Index" />

      <IndexMechanics
        raritySwing={mechanics.raritySwing}
        updatedAt={mechanics.updatedAt}
        updatedByName={mechanics.updatedByName}
      />

      <TableToolbar
        initialQuery={initialQuery}
        searchPlaceholder="Search every course by name…"
        countLabel={`${totalCourses.toLocaleString()} courses across ${counties.length} counties${
          totalUnranked > 0 ? ` · ${totalUnranked.toLocaleString()} still to rank` : ""
        } - pick a county or search`}
      />

      {aggRes.error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load: {aggRes.error.message}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {counties.map((c) => (
            <CountyCard
              key={c.id}
              href={`/vestige-index?county=${c.id}`}
              name={c.name}
              total={c.total}
              unranked={c.unranked}
              avgIndex={c.indexCount ? Math.round(c.indexSum / c.indexCount) : null}
            />
          ))}
          {orphan && orphan.total > 0 && (
            <CountyCard
              href={`/vestige-index?county=${NO_COUNTY}`}
              name="No county"
              total={orphan.total}
              unranked={orphan.unranked}
              avgIndex={orphan.indexCount ? Math.round(orphan.indexSum / orphan.indexCount) : null}
            />
          )}
        </div>
      )}
    </div>
  );
}

function CountyCard({
  href,
  name,
  total,
  unranked,
  avgIndex,
}: {
  href: string;
  name: string;
  total: number;
  unranked: number;
  avgIndex: number | null;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl glass-panel p-4 transition-colors hover:border-brand/40"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
          <MapPin aria-hidden className="size-4" />
        </span>
        {avgIndex != null && (
          <span className="flex items-center gap-1 text-xs text-ink-3" title="Average Index across this county">
            <Gauge aria-hidden className="size-3" />
            <span className="font-display font-semibold tabular-nums text-ink-2">{avgIndex}</span>
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{name}</p>
        <p className="text-xs text-ink-3">
          <span className="tabular-nums text-ink-2">{total}</span> {total === 1 ? "course" : "courses"}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        {unranked > 0 ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber/30 bg-amber/5 px-2 py-0.5 text-[10px] font-medium text-amber">
            {unranked} to rank
          </span>
        ) : (
          <span className="text-[10px] font-medium text-ink-3">all ranked</span>
        )}
        <ChevronRight aria-hidden className="size-4 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}

// ── Scoped ranked batch editor ──────────────────────────────────────────
async function TableView({
  supabase,
  sp,
  q,
  county,
  tier,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  sp: Awaited<SearchParams>;
  q: string;
  county: string;
  tier: string;
}) {
  const sort = SORT_COLUMN[sp.sort ?? ""] ? (sp.sort as string) : "index";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const offsetRaw = Number(sp.offset ?? 0);
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  let listQ = supabase
    .from("courses")
    .select(
      "id,name,tier,prestige,prestige_source,vestige_index,vestige_rarity,play_count,clubs(name),counties(name)",
      { count: "exact" },
    );
  if (q) listQ = listQ.ilike("name", `%${q}%`);
  if (tier !== "all") listQ = listQ.eq("tier", tier);
  if (county === NO_COUNTY) listQ = listQ.is("county_id", null);
  else if (county !== "all") listQ = listQ.eq("county_id", county);

  const [listRes, countiesRes, countyNameRes, mechanics] = await Promise.all([
    listQ
      .order(SORT_COLUMN[sort], { ascending: dir === "asc", nullsFirst: false })
      .order("name", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1),
    supabase.from("counties").select("id,name").order("name", { ascending: true }),
    county !== "all" && county !== NO_COUNTY
      ? supabase.from("counties").select("name").eq("id", county).maybeSingle()
      : Promise.resolve({ data: null }),
    loadMechanics(supabase),
  ]);

  const counties = (countiesRes.data ?? []) as Array<{ id: string; name: string }>;
  const total = listRes.count ?? 0;
  const countyName =
    county === NO_COUNTY ? "No county" : ((countyNameRes.data as { name?: string } | null)?.name ?? null);

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
      <Link
        href="/vestige-index"
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> All counties
      </Link>

      <SectionHeader
        eyebrow={countyName ? `Editorial · ${countyName}` : "Editorial · search"}
        title={countyName ?? "Vestige Index"}
      />

      <IndexMechanics
        raritySwing={mechanics.raritySwing}
        updatedAt={mechanics.updatedAt}
        updatedByName={mechanics.updatedByName}
      />

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
          options={[{ value: "all", label: "All counties" }, ...counties.map((c) => ({ value: c.id, label: c.name }))]}
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
          <IndexTable rows={rows} raritySwing={mechanics.raritySwing} />
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
