import Link from "next/link";
import { ArrowUpRight, Hash, MapPin, Search } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { courseCoverURL } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  LAYOUT_LABELS,
  TIER_LABELS,
  type CourseLayout,
  type CourseRow,
  type CourseTier,
} from "./types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  tier?: CourseTier | "all";
  layout?: CourseLayout | "all";
  style?: string | "all";
  county?: string | "all";
}>;

/**
 * Courses index. Reads every course (admin RLS sees the full
 * catalogue) joined to `clubs` + `counties` for display names.
 * Filters and search are server-driven via `?q=`/`?tier=` etc so
 * the URL is shareable and the client stays simple.
 *
 * **Bridge note** (Option β): the schema column is still named
 * `type` pre-M6, so the read SELECTs `type as layout` to surface
 * the post-rename name on the page even before the breaking
 * migration applies. iOS bridge decoder reads either; admin reads
 * via the alias. Once M6 lands, drop the alias.
 */
export default async function CoursesPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams;
  const q = (params.q ?? "").trim();
  const tier = (params.tier ?? "all") as CourseTier | "all";
  const layout = (params.layout ?? "all") as CourseLayout | "all";
  const style = params.style ?? "all";
  const countyFilter = params.county ?? "all";

  const supabase = await createClient();

  let query = supabase
    .from("courses")
    .select(
      "id,legacy_fid,name,slug,club_id,county_id,tier,type,hole_count,par,yards,style,established,description,curated_list_ids,hero_photo_storage_key,last_edited_by_admin_id,last_edited_at,updated_at,created_at,clubs(name),counties(id,name)",
    )
    .order("name", { ascending: true })
    .limit(500);

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }
  if (tier !== "all") {
    query = query.eq("tier", tier);
  }
  if (layout !== "all") {
    // Bridge: column is still `type` pre-M6.
    query = query.eq("type", layout);
  }
  if (style !== "all") {
    query = query.eq("style", style);
  }
  if (countyFilter !== "all") {
    query = query.eq("county_id", countyFilter);
  }

  const [coursesResult, stylesResult, countiesResult] = await Promise.all([
    query,
    supabase.rpc("distinct_course_styles"),
    supabase.from("counties").select("id,name").order("name", { ascending: true }),
  ]);

  const styles: string[] = (stylesResult.data ?? []) as string[];
  const counties: Array<{ id: string; name: string }> = countiesResult.data ?? [];

  // Resolve admin display names in one round-trip — last-edited
  // chips need a name, not a UUID. The admin user ids set is
  // typically tiny (a handful), so a single IN query is plenty.
  const adminIds = Array.from(
    new Set(
      (coursesResult.data ?? [])
        .map((row) => row.last_edited_by_admin_id)
        .filter((value): value is string => typeof value === "string"),
    ),
  );
  const adminNames: Record<string, string> = {};
  if (adminIds.length > 0) {
    const { data: usersData } = await supabase
      .from("users")
      .select("id,display_name,username")
      .in("id", adminIds);
    for (const user of usersData ?? []) {
      adminNames[user.id] = user.display_name || user.username || "Admin";
    }
  }

  const rows: CourseRow[] = (coursesResult.data ?? []).map((row) => {
    const clubs = unwrapJoin<{ name: string }>(row.clubs);
    const counties = unwrapJoin<{ id: string; name: string }>(row.counties);
    return {
      id: row.id,
      legacy_fid: row.legacy_fid,
      name: row.name,
      slug: row.slug,
      club_id: row.club_id,
      county_id: row.county_id,
      club_name: clubs?.name ?? null,
      county_name: counties?.name ?? null,
      tier: row.tier as CourseTier,
      // Bridge: surface `type` under `layout` so UI vocabulary is correct.
      layout: (row.type ?? "primary18") as CourseLayout,
      hole_count: row.hole_count,
      par: row.par,
      yards: row.yards,
      style: row.style,
      established: row.established,
      description: row.description,
      curated_list_ids: row.curated_list_ids ?? [],
      hero_photo_storage_key: row.hero_photo_storage_key,
      last_edited_by_admin_id: row.last_edited_by_admin_id,
      last_edited_at: row.last_edited_at,
      last_edited_by_name: row.last_edited_by_admin_id
        ? adminNames[row.last_edited_by_admin_id] ?? null
        : null,
      updated_at: row.updated_at,
      created_at: row.created_at,
    };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SectionHeader
        eyebrow="Editorial"
        title="Courses"
        description="The master course catalogue — editorial fields and hero photos."
      />

      <Filters
        query={q}
        tier={tier}
        layout={layout}
        style={style}
        county={countyFilter}
        styles={styles}
        counties={counties}
        totalRows={rows.length}
      />

      {coursesResult.error && (
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load courses: {coursesResult.error.message}
        </div>
      )}

      {!coursesResult.error && rows.length === 0 && <EmptyState />}

      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <CourseRowCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function Filters({
  query,
  tier,
  layout,
  style,
  county,
  styles,
  counties,
  totalRows,
}: {
  query: string;
  tier: CourseTier | "all";
  layout: CourseLayout | "all";
  style: string | "all";
  county: string | "all";
  styles: string[];
  counties: Array<{ id: string; name: string }>;
  totalRows: number;
}) {
  return (
    <form
      action="/courses"
      method="get"
      className="space-y-3 rounded-xl border border-rule/70 bg-paper-raised/50 p-4"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-ink-3">
          <Search className="size-4" />
        </span>
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search by course name…"
          className="h-9 flex-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SelectField name="tier" label="Tier" defaultValue={tier}>
          <option value="all">All tiers</option>
          {(Object.keys(TIER_LABELS) as CourseTier[]).map((value) => (
            <option key={value} value={value}>
              {TIER_LABELS[value]}
            </option>
          ))}
        </SelectField>
        <SelectField name="layout" label="Layout" defaultValue={layout}>
          <option value="all">All layouts</option>
          {(Object.keys(LAYOUT_LABELS) as CourseLayout[]).map((value) => (
            <option key={value} value={value}>
              {LAYOUT_LABELS[value]}
            </option>
          ))}
        </SelectField>
        <SelectField name="style" label="Style" defaultValue={style}>
          <option value="all">All styles</option>
          {styles.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </SelectField>
        <SelectField name="county" label="County" defaultValue={county}>
          <option value="all">All counties</option>
          {counties.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-3">
          Showing {totalRows.toLocaleString()} {totalRows === 1 ? "course" : "courses"} (cap 500).
        </p>
        <button
          type="submit"
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg transition-colors hover:bg-brand-deep"
        >
          Apply filters
        </button>
      </div>
    </form>
  );
}

function SelectField({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-ink-3">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="flex h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-1 text-sm transition-colors focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      >
        {children}
      </select>
    </label>
  );
}

function CourseRowCard({ row }: { row: CourseRow }) {
  const cover = courseCoverURL(row.hero_photo_storage_key);
  return (
    <Link
      href={`/courses/${row.id}`}
      className="group/card flex gap-3 rounded-xl border border-rule/70 bg-paper-raised/50 p-4 transition-colors hover:border-brand/40"
    >
      <CoverThumb url={cover} title={row.name} />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
        <div className="space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="truncate font-heading text-sm font-semibold leading-snug text-ink">
              {row.name}
            </h2>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-paper-sunken/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-2">
              {TIER_LABELS[row.tier]}
            </span>
          </div>
          <p className="line-clamp-1 text-xs text-ink-2">
            {row.club_name ?? "—"} · {row.county_name ?? "no county"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <Chip>{LAYOUT_LABELS[row.layout]}</Chip>
          {row.par != null && <Chip>Par {row.par}</Chip>}
          {row.yards != null && <Chip>{row.yards.toLocaleString()} yd</Chip>}
          {row.style && <Chip>{row.style}</Chip>}
          {row.established != null && <Chip>est. {row.established}</Chip>}
          {row.curated_list_ids.length > 0 && (
            <Chip>
              <Hash aria-hidden className="size-2.5" /> {row.curated_list_ids.length}
            </Chip>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-ink-3">
            {row.last_edited_by_name ? (
              <>
                Edited by {row.last_edited_by_name}
                {row.last_edited_at && <> · {relativeTime(row.last_edited_at)}</>}
              </>
            ) : (
              <>Updated {relativeTime(row.updated_at)}</>
            )}
            <ArrowUpRight aria-hidden className={cn("size-3 opacity-0 transition-opacity group-hover/card:opacity-100")} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-paper-sunken/40 px-2 py-0.5 text-ink-2">
      {children}
    </span>
  );
}

function CoverThumb({ url, title }: { url: string | null; title: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`Cover for ${title}`}
        className="h-20 w-32 shrink-0 rounded-lg bg-paper-sunken object-cover"
      />
    );
  }
  return (
    <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-lg border border-rule/70 bg-paper-sunken/60">
      <MapPin aria-hidden className="size-5 text-ink-3" />
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
          <MapPin className="size-5" />
        </span>
        <p className="font-display text-base font-semibold text-ink">
          No courses match the filters
        </p>
        <p className="text-sm text-ink-2">
          Clear filters to see the full catalogue, or try a different search term.
        </p>
      </div>
    </div>
  );
}

function unwrapJoin<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value as T;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.round(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.round(diffDays / 30);
  return `${diffMonths}mo ago`;
}
