import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Hash } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { courseCoverURL } from "@/lib/storage";
import { CourseEditor } from "./CourseEditor";
import {
  TIER_LABELS,
  type CourseDetailRow,
  type CourseLayout,
  type CourseTier,
  type CuratedListChip,
  type GeoJSONPolygonOrMulti,
} from "../types";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ id: string }>;

export default async function CourseDetailPage(props: { params: RouteParams }) {
  const { id } = await props.params;
  const supabase = await createClient();

  const [courseResult, stylesResult, curatedJoinResult] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id,legacy_fid,name,slug,club_id,county_id,tier,type,hole_count,par,yards,style,established,description,curated_list_ids,hero_photo_storage_key,polygon,center_lat,center_lng,last_edited_by_admin_id,last_edited_at,updated_at,created_at,clubs(name),counties(id,name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("distinct_course_styles"),
    supabase
      .from("curated_list_courses")
      .select("curated_list_id,curated_lists(id,name)")
      .eq("course_id", id),
  ]);

  if (courseResult.error) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load course: {courseResult.error.message}
        </div>
      </div>
    );
  }
  if (!courseResult.data) notFound();

  const data = courseResult.data;
  const club = unwrapJoin<{ name: string }>(data.clubs);
  const county = unwrapJoin<{ id: string; name: string }>(data.counties);

  let lastEditedByName: string | null = null;
  if (data.last_edited_by_admin_id) {
    const { data: userRow } = await supabase
      .from("users")
      .select("display_name,username")
      .eq("id", data.last_edited_by_admin_id)
      .maybeSingle();
    if (userRow) {
      lastEditedByName = userRow.display_name || userRow.username || "Admin";
    }
  }

  const curatedLists: CuratedListChip[] = (curatedJoinResult.data ?? [])
    .map((row) => unwrapJoin<{ id: string; name: string }>(row.curated_lists))
    .filter((value): value is { id: string; name: string } => value != null);

  const styles: string[] = (stylesResult.data ?? []) as string[];

  const row: CourseDetailRow = {
    id: data.id,
    legacy_fid: data.legacy_fid,
    name: data.name,
    slug: data.slug,
    club_id: data.club_id,
    county_id: data.county_id,
    club_name: club?.name ?? null,
    county_name: county?.name ?? null,
    tier: data.tier as CourseTier,
    // Bridge: surface `type` under `layout` so UI vocabulary is correct.
    layout: (data.type ?? "primary18") as CourseLayout,
    hole_count: data.hole_count,
    par: data.par,
    yards: data.yards,
    style: data.style,
    established: data.established,
    description: data.description,
    curated_list_ids: data.curated_list_ids ?? [],
    hero_photo_storage_key: data.hero_photo_storage_key,
    polygon: data.polygon as GeoJSONPolygonOrMulti | null,
    center_lat: data.center_lat,
    center_lng: data.center_lng,
    last_edited_by_admin_id: data.last_edited_by_admin_id,
    last_edited_at: data.last_edited_at,
    last_edited_by_name: lastEditedByName,
    updated_at: data.updated_at,
    created_at: data.created_at,
    curated_lists: curatedLists,
  };

  const cover = courseCoverURL(row.hero_photo_storage_key);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All courses
      </Link>

      <SectionHeader
        eyebrow={`Editorial · ${TIER_LABELS[row.tier].toLowerCase()}`}
        title={row.name}
        description={
          row.description?.slice(0, 240) ??
          `${row.club_name ?? "Unknown club"} · ${row.county_name ?? "no county"}`
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rule/70 bg-paper-raised/50 px-4 py-3 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full border border-rule/70 bg-paper-sunken/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-2">
          {TIER_LABELS[row.tier]}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-rule/70 bg-paper-sunken/40 px-2 py-0.5 text-ink-2">
          <Hash aria-hidden className="size-3" />
          {row.curated_lists.length}{" "}
          {row.curated_lists.length === 1 ? "curated list" : "curated lists"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-3">
          <Calendar aria-hidden className="size-3" />
          Updated {new Date(row.updated_at).toLocaleString()}
          {row.last_edited_by_name && <> · by {row.last_edited_by_name}</>}
        </span>
        {row.legacy_fid != null && (
          <span className="ml-auto text-[10px] tabular-nums text-ink-3">
            fid {row.legacy_fid}
          </span>
        )}
      </div>

      <CourseEditor row={row} coverURL={cover} styles={styles} />
    </div>
  );
}

function unwrapJoin<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value as T;
}
