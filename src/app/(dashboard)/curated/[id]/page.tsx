import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listCoverURL } from "@/lib/storage";
import { CuratedEditor } from "./CuratedEditor";
import { type CuratedCourseRow, type CuratedListRow } from "../types";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ id: string }>;

export default async function CuratedListEditorPage(props: { params: RouteParams }) {
  const { id } = await props.params;
  const supabase = await createClient();

  // Two queries in parallel - the editor no longer loads the whole catalogue
  // upfront (the picker searches it on demand via /api/courses/search):
  //  1. The list row itself (full payload)
  //  2. The course rows attached to it (joined to courses + clubs + counties for display)
  const [listResult, coursesResult] = await Promise.all([
    supabase
      .from("curated_lists")
      .select(
        "id,name,slug,description,bio,tags,region,tier,display_priority,is_ordered,cover_storage_key,published_at,unpublished_at,is_archived,created_at,updated_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("curated_list_courses")
      .select(
        "course_id,position,editor_note,courses(name,club_id,county_id,clubs(name),counties(name))",
      )
      .eq("curated_list_id", id)
      .order("position", { ascending: true, nullsFirst: false }),
  ]);

  if (listResult.error) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load list: {listResult.error.message}
        </div>
      </div>
    );
  }
  if (!listResult.data) notFound();

  // Supabase JS returns joined relations as arrays even when the
  // FK is one-to-one - that's the typed default and unwrapping
  // here is the canonical pattern. Flatten into the display
  // shape the editor expects; missing relations stay null.
  const courses: CuratedCourseRow[] = (coursesResult.data ?? []).map((row) => {
    const c = unwrapRow<CourseRowFromJoin>(row.courses);
    return {
      course_id: row.course_id,
      course_name: c?.name ?? "Unknown course",
      club_name: unwrapRow<{ name: string }>(c?.clubs)?.name ?? null,
      county_name: unwrapRow<{ name: string }>(c?.counties)?.name ?? null,
      position: row.position,
      editor_note: row.editor_note,
    };
  });

  // Hydrate the row into the typed shape (no `course_count` join
  // here - the editor renders its own list and counts client-side).
  const row: CuratedListRow = {
    ...listResult.data,
    course_count: courses.length,
  };

  const cover = listCoverURL(row.cover_storage_key);

  return <CuratedEditor row={row} courses={courses} coverURL={cover} />;
}

// Local types for the joined relations Supabase JS returns.
// `clubs` / `counties` come back as arrays even when the FK is
// one-to-one - the runtime is always either an array or a single
// object depending on the embed kind. `unwrapRow` handles both.
type CourseRowFromJoin = {
  name: string;
  clubs: { name: string }[] | { name: string } | null;
  counties: { name: string }[] | { name: string } | null;
};

function unwrapRow<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value as T;
}
