import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { activeStorageBaseUrl, tryCreateServiceClient } from "@/lib/supabase/admin";
import { courseCoverURL, photosRenderedURL } from "@/lib/storage";
import { CourseEditor } from "./CourseEditor";
import type { ManagedPhoto } from "./CoursePhotoManager";
import {
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
        "id,legacy_fid,name,slug,club_id,county_id,tier,type,hole_count,par,yards,style,established,description,curated_list_ids,prestige,prestige_source,vestige_index,vestige_rarity,play_count,hero_photo_storage_key,polygon,center_lat,center_lng,last_edited_by_admin_id,last_edited_at,updated_at,created_at,clubs(name),counties(id,name)",
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
    prestige: data.prestige ?? 50,
    prestige_source: data.prestige_source ?? null,
    vestige_index: data.vestige_index ?? null,
    vestige_rarity: data.vestige_rarity ?? null,
    play_count: data.play_count ?? 0,
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

  // Community gallery (kind='coursePhoto') lives in the active env's `photos`
  // table — uploaded by real users, distinct from the editorial cover. No admin
  // SELECT policy, so read via service-role; absent key → empty (graceful).
  const { approved, pending } = await loadCommunityPhotos(id);
  // What users actually see leading the carousel: editorial cover, else the
  // top-ordered approved community photo.
  const effectiveCoverURL = cover ?? approved[0]?.thumbUrl ?? null;

  return (
    <CourseEditor
      row={row}
      coverURL={cover}
      effectiveCoverURL={effectiveCoverURL}
      approvedPhotos={approved}
      pendingPhotos={pending}
      styles={styles}
    />
  );
}

async function loadCommunityPhotos(
  courseId: string,
): Promise<{ approved: ManagedPhoto[]; pending: ManagedPhoto[] }> {
  const svc = await tryCreateServiceClient();
  if (!svc) return { approved: [], pending: [] };

  const baseUrl = await activeStorageBaseUrl();

  // Order by the admin sort index when the ordering migration is applied; fall
  // back to created_at on envs where `course_sort_index` doesn't exist yet, so
  // the manager still lists photos before the migration lands.
  const base = () =>
    svc
      .from("photos")
      .select("id, moderation_state, variants, uploader_user_id, created_at")
      .eq("course_id", courseId)
      .eq("kind", "coursePhoto")
      .is("deleted_at", null)
      .in("moderation_state", ["approved", "pending"])
      .not("variants", "is", null);

  let { data, error } = await base()
    .order("course_sort_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    ({ data, error } = await base().order("created_at", { ascending: false }));
  }
  // `coursePhoto` enum may not exist on this env yet → empty, not throw.
  if (error || !data) return { approved: [], pending: [] };

  type PhotoRow = {
    id: string;
    moderation_state: string;
    variants: { thumb_storage_key?: string; medium_storage_key?: string } | null;
    uploader_user_id: string | null;
    created_at: string;
  };
  const rows = data as PhotoRow[];

  const uploaderIds = Array.from(
    new Set(rows.map((r) => r.uploader_user_id).filter((v): v is string => !!v)),
  );
  const names: Record<string, string> = {};
  if (uploaderIds.length > 0) {
    const { data: users } = await svc.from("users").select("id, display_name, username").in("id", uploaderIds);
    for (const u of (users as Array<{ id: string; display_name: string | null; username: string | null }> | null) ?? []) {
      names[u.id] = u.display_name || u.username || "A golfer";
    }
  }

  const toManaged = (r: PhotoRow): ManagedPhoto => ({
    id: r.id,
    state: r.moderation_state as ManagedPhoto["state"],
    thumbUrl: photosRenderedURL(r.variants?.medium_storage_key ?? r.variants?.thumb_storage_key, baseUrl),
    uploaderName: r.uploader_user_id ? (names[r.uploader_user_id] ?? null) : null,
    createdAt: r.created_at,
  });

  return {
    approved: rows.filter((r) => r.moderation_state === "approved").map(toManaged),
    pending: rows.filter((r) => r.moderation_state === "pending").map(toManaged),
  };
}

function unwrapJoin<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value as T;
}
