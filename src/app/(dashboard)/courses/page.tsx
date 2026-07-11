import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { ArrowLeft, ChevronRight, DatabaseZap, ImageOff, MapPin } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { TableToolbar, TableSelect, FilterChips } from "@/components/admin/table/TableToolbar";
import { TablePagination } from "@/components/admin/table/TablePagination";
import type { SortDir } from "@/components/admin/table/DataTable";
import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/admin/fetch-all";
import { LAYOUT_LABELS, TIER_LABELS, type CourseLayout, type CourseTier } from "./types";
import { CoursesTable, type CourseTableRow } from "./CoursesTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const GAP_TYPES = ["photo", "description", "polygon", "stats"] as const;
type Gap = (typeof GAP_TYPES)[number];
const SORT_COLUMN: Record<string, string> = { name: "name", tier: "tier", updated: "updated_at" };
const NO_COUNTY = "none";

type SearchParams = Promise<{
  q?: string;
  tier?: string;
  layout?: string;
  style?: string;
  county?: string;
  gap?: string;
  sort?: string;
  dir?: string;
  offset?: string;
}>;

export default async function CoursesPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim();
  const tier = sp.tier ?? "all";
  const layout = sp.layout ?? "all";
  const style = sp.style ?? "all";
  const county = sp.county ?? "all";
  const gap = (GAP_TYPES.includes(sp.gap as Gap) ? sp.gap : null) as Gap | null;

  const supabase = await createClient();

  // Landing on no selection → the county grid; otherwise the scoped table.
  const showTable =
    county !== "all" || Boolean(q) || Boolean(gap) || tier !== "all" || layout !== "all" || style !== "all";

  if (!showTable) {
    return <CountyLanding supabase={supabase} initialQuery={sp.q ?? ""} />;
  }

  return (
    <TableView
      supabase={supabase}
      sp={sp}
      q={q}
      tier={tier}
      layout={layout}
      style={style}
      county={county}
      gap={gap}
    />
  );
}

/**
 * Course ids that have ≥1 approved, processed community photo (kind=coursePhoto)
 * in the active env. `public.photos` has no admin SELECT policy, so this reads
 * through service-role; an absent key / pre-migration env → empty set (a course
 * just falls back to its editorial-cover state). Lets the grid count an approved
 * community photo as the course having a hero - the fix for "approved photos
 * don't show as the hero in the dashboard".
 */
async function coursesWithCommunityPhotos(): Promise<Set<string>> {
  const svc = await tryCreateServiceClient();
  if (!svc) return new Set();
  const { data, error } = await svc
    .from("photos")
    .select("course_id")
    .eq("kind", "coursePhoto")
    .eq("moderation_state", "approved")
    .is("deleted_at", null)
    .not("variants", "is", null)
    .not("course_id", "is", null);
  if (error || !data) return new Set();
  return new Set((data as Array<{ course_id: string | null }>).map((r) => r.course_id).filter((v): v is string => !!v));
}

// ── Landing: county grid ───────────────────────────────────────────────
async function CountyLanding({
  supabase,
  initialQuery,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  initialQuery: string;
}) {
  const [aggRes, countiesRes, community] = await Promise.all([
    // Page past PostgREST's 1000-row cap so the grand total + per-county
    // totals count every course (the dataset is already >1000).
    fetchAllRows<{ id: string; county_id: string | null; hero_photo_storage_key: string | null }>(
      (from, to) =>
        supabase
          .from("courses")
          .select("id, county_id, hero_photo_storage_key")
          .order("id", { ascending: true })
          .range(from, to),
    ),
    supabase.from("counties").select("id, name").order("name", { ascending: true }),
    coursesWithCommunityPhotos(),
  ]);

  const stats = new Map<string, { total: number; missingPhoto: number }>();
  for (const r of (aggRes.data as Array<{ id: string; county_id: string | null; hero_photo_storage_key: string | null }> | null) ?? []) {
    const key = r.county_id ?? NO_COUNTY;
    const s = stats.get(key) ?? { total: 0, missingPhoto: 0 };
    s.total += 1;
    // A course "has a photo" if it has an editorial cover OR an approved
    // community photo - so approving a contribution clears the gap.
    if (!r.hero_photo_storage_key && !community.has(r.id)) s.missingPhoto += 1;
    stats.set(key, s);
  }

  const counties = ((countiesRes.data as Array<{ id: string; name: string }> | null) ?? [])
    .map((c) => ({ ...c, ...(stats.get(c.id) ?? { total: 0, missingPhoto: 0 }) }))
    .filter((c) => c.total > 0);
  const orphan = stats.get(NO_COUNTY);
  const totalCourses = Array.from(stats.values()).reduce((n, s) => n + s.total, 0);

  return (
    <div className={pageShell("wide")}>
      <SectionHeader
        eyebrow="Editorial"
        title="Courses"
        actions={
          <Link
            href="/courses/import"
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule/70 bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:border-brand/40 hover:text-ink"
          >
            <DatabaseZap aria-hidden className="size-3.5 text-ink-3" />
            Course dataset
          </Link>
        }
      />

      <TableToolbar
        initialQuery={initialQuery}
        searchPlaceholder="Search every course by name…"
        countLabel={`${totalCourses.toLocaleString()} courses across ${counties.length} counties - pick a county or search`}
      />

      {aggRes.error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load: {aggRes.error.message}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {counties.map((c) => (
            <CountyCard key={c.id} href={`/courses?county=${c.id}`} name={c.name} total={c.total} missingPhoto={c.missingPhoto} />
          ))}
          {orphan && orphan.total > 0 && (
            <CountyCard href={`/courses?county=${NO_COUNTY}`} name="No county" total={orphan.total} missingPhoto={orphan.missingPhoto} />
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
  missingPhoto,
}: {
  href: string;
  name: string;
  total: number;
  missingPhoto: number;
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
        <ChevronRight aria-hidden className="size-4 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{name}</p>
        <p className="text-xs text-ink-3">
          <span className="tabular-nums text-ink-2">{total}</span> {total === 1 ? "course" : "courses"}
        </p>
      </div>
      {missingPhoto > 0 && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber/30 bg-amber/5 px-2 py-0.5 text-[10px] font-medium text-amber">
          <ImageOff aria-hidden className="size-2.5" />
          {missingPhoto} need photos
        </span>
      )}
    </Link>
  );
}

// ── Scoped table view ──────────────────────────────────────────────────
async function TableView({
  supabase,
  sp,
  q,
  tier,
  layout,
  style,
  county,
  gap,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  sp: Awaited<SearchParams>;
  q: string;
  tier: string;
  layout: string;
  style: string;
  county: string;
  gap: Gap | null;
}) {
  const sort = SORT_COLUMN[sp.sort ?? ""] ? (sp.sort as string) : "name";
  const dir: SortDir = sp.dir === "desc" ? "desc" : "asc";
  const offsetRaw = Number(sp.offset ?? 0);
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  const applyCounty = <T extends { eq: (c: string, v: string) => T; is: (c: string, v: null) => T }>(b: T): T => {
    if (county === NO_COUNTY) return b.is("county_id", null);
    if (county !== "all") return b.eq("county_id", county);
    return b;
  };

  const gapCountQuery = (g: Gap) => {
    let b = supabase.from("courses").select("id", { count: "exact", head: true });
    if (q) b = b.ilike("name", `%${q}%`);
    if (tier !== "all") b = b.eq("tier", tier);
    if (layout !== "all") b = b.eq("type", layout);
    if (style !== "all") b = b.eq("style", style);
    b = applyCounty(b);
    if (g === "photo") b = b.is("hero_photo_storage_key", null);
    else if (g === "description") b = b.is("description", null);
    else if (g === "polygon") b = b.is("polygon", null);
    else if (g === "stats") b = b.or("par.is.null,yards.is.null");
    return b;
  };

  let listQ = supabase
    .from("courses")
    .select(
      "id,name,club_id,county_id,tier,type,par,yards,style,description,hero_photo_storage_key,last_edited_by_admin_id,last_edited_at,updated_at,clubs(name),counties(name)",
      { count: "exact" },
    );
  if (q) listQ = listQ.ilike("name", `%${q}%`);
  if (tier !== "all") listQ = listQ.eq("tier", tier);
  if (layout !== "all") listQ = listQ.eq("type", layout);
  if (style !== "all") listQ = listQ.eq("style", style);
  listQ = applyCounty(listQ);
  if (gap === "photo") listQ = listQ.is("hero_photo_storage_key", null);
  else if (gap === "description") listQ = listQ.is("description", null);
  else if (gap === "polygon") listQ = listQ.is("polygon", null);
  else if (gap === "stats") listQ = listQ.or("par.is.null,yards.is.null");
  const listPromise = listQ
    .order(SORT_COLUMN[sort], { ascending: dir === "asc" })
    .range(offset, offset + PAGE_SIZE - 1);

  const [listRes, stylesRes, countiesRes, countyNameRes, community, ...gapCountResults] = await Promise.all([
    listPromise,
    supabase.rpc("distinct_course_styles"),
    supabase.from("counties").select("id,name").order("name", { ascending: true }),
    county !== "all" && county !== NO_COUNTY
      ? supabase.from("counties").select("name").eq("id", county).maybeSingle()
      : Promise.resolve({ data: null }),
    coursesWithCommunityPhotos(),
    ...GAP_TYPES.map((g) => gapCountQuery(g)),
  ]);

  const gapCounts = Object.fromEntries(GAP_TYPES.map((g, i) => [g, gapCountResults[i].count ?? 0])) as Record<Gap, number>;
  const styles = (stylesRes.data ?? []) as string[];
  const counties = (countiesRes.data ?? []) as Array<{ id: string; name: string }>;
  const total = listRes.count ?? 0;
  const countyName =
    county === NO_COUNTY ? "No county" : ((countyNameRes.data as { name?: string } | null)?.name ?? null);

  const adminIds = Array.from(
    new Set((listRes.data ?? []).map((r) => r.last_edited_by_admin_id).filter((v): v is string => typeof v === "string")),
  );
  const adminNames: Record<string, string> = {};
  if (adminIds.length > 0) {
    const { data } = await supabase.from("users").select("id,display_name,username").in("id", adminIds);
    for (const u of data ?? []) adminNames[u.id] = u.display_name || u.username || "Admin";
  }

  const rows: CourseTableRow[] = (listRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    club_name: unwrap<{ name: string }>(r.clubs)?.name ?? null,
    county_name: unwrap<{ name: string }>(r.counties)?.name ?? null,
    tier: r.tier as CourseTier,
    layout: (r.type ?? "primary18") as CourseLayout,
    par: r.par,
    yards: r.yards,
    hasPhoto: Boolean(r.hero_photo_storage_key) || community.has(r.id),
    hasDescription: Boolean(r.description && String(r.description).trim()),
    hasStats: r.par != null && r.yards != null,
    lastEditedByName: r.last_edited_by_admin_id ? (adminNames[r.last_edited_by_admin_id] ?? null) : null,
    updatedAt: r.updated_at,
  }));

  return (
    <div className={pageShell("wide")}>
      <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> All counties
      </Link>

      <SectionHeader eyebrow={countyName ? `Editorial · ${countyName}` : "Editorial · search"} title={countyName ?? "Courses"} />

      <TableToolbar
        initialQuery={q}
        searchPlaceholder="Search course name…"
        countLabel={`${total.toLocaleString()} ${total === 1 ? "course" : "courses"}${gap ? ` · ${gapLabel(gap)}` : ""}`}
        hasFilters={Boolean(q) || tier !== "all" || layout !== "all" || style !== "all" || Boolean(gap)}
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
          options={[{ value: "all", label: "All tiers" }, ...(Object.keys(TIER_LABELS) as CourseTier[]).map((v) => ({ value: v, label: TIER_LABELS[v] }))]}
        />
        <TableSelect
          name="layout"
          label="Layout"
          value={layout}
          options={[{ value: "all", label: "All layouts" }, ...(Object.keys(LAYOUT_LABELS) as CourseLayout[]).map((v) => ({ value: v, label: LAYOUT_LABELS[v] }))]}
        />
        <TableSelect
          name="style"
          label="Style"
          value={style}
          options={[{ value: "all", label: "All styles" }, ...styles.map((s) => ({ value: s, label: s }))]}
        />
      </TableToolbar>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">Spot gaps</span>
        <FilterChips
          name="gap"
          value={gap}
          options={GAP_TYPES.map((g) => ({ value: g, label: `${gapLabel(g)}${gapCounts[g] ? ` (${gapCounts[g].toLocaleString()})` : ""}` }))}
        />
      </div>

      {listRes.error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load courses: {listRes.error.message}
        </div>
      ) : (
        <>
          <CoursesTable rows={rows} sort={sort} dir={dir} />
          <TablePagination offset={offset} pageSize={PAGE_SIZE} count={rows.length} hasMore={offset + rows.length < total} />
        </>
      )}
    </div>
  );
}

function gapLabel(g: Gap): string {
  return g === "photo" ? "No photo" : g === "description" ? "No description" : g === "polygon" ? "No polygon" : "No par/yards";
}

function unwrap<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value as T;
}
