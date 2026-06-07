import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Hash } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { listCoverURL } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { CuratedEditor } from "./CuratedEditor";
import {
  STATUS_CHIP,
  STATUS_LABELS,
  statusFor,
  type CuratedCourseRow,
  type CuratedListRow,
  type CourseCatalogRow,
} from "../types";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ id: string }>;

export default async function CuratedListEditorPage(props: { params: RouteParams }) {
  const { id } = await props.params;
  const supabase = await createClient();

  // Three queries in parallel:
  //  1. The list row itself (full payload)
  //  2. The course rows attached to it (joined to courses + clubs + counties for display)
  //  3. The full course catalog for the picker (id + names only — small payload)
  const [listResult, coursesResult, catalogResult] = await Promise.all([
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
    supabase
      .from("courses")
      .select("id,name,club_id,county_id,clubs(name),counties(name)")
      .order("name", { ascending: true })
      .limit(2000),
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
  // FK is one-to-one — that's the typed default and unwrapping
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

  const catalog: CourseCatalogRow[] = (catalogResult.data ?? []).map((row) => {
    return {
      course_id: row.id,
      course_name: row.name,
      club_name: unwrapRow<{ name: string }>(row.clubs)?.name ?? null,
      county_name: unwrapRow<{ name: string }>(row.counties)?.name ?? null,
    };
  });

  // Hydrate the row into the typed shape (no `course_count` join
  // here — the editor renders its own list and counts client-side).
  const row: CuratedListRow = {
    ...listResult.data,
    course_count: courses.length,
  };

  const status = statusFor(row);
  const cover = listCoverURL(row.cover_storage_key);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/curated"
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All curated lists
      </Link>

      <SectionHeader
        eyebrow={`Editorial · ${STATUS_LABELS[status].toLowerCase()}`}
        title={row.name}
        description={
          row.bio?.slice(0, 240) ??
          row.description ??
          "Editorial curated list — full control of every field below."
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rule/70 bg-paper-raised/50 px-4 py-3 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            STATUS_CHIP[status],
          )}
        >
          {STATUS_LABELS[status]}
        </span>
        {row.tier && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              row.tier === "flagship"
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-border bg-paper-sunken/60 text-ink-2",
            )}
          >
            {row.tier}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-paper-sunken/40 px-2 py-0.5 text-ink-2">
          <Hash aria-hidden className="size-3" />
          {courses.length} {courses.length === 1 ? "course" : "courses"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-3">
          <Calendar aria-hidden className="size-3" />
          Updated {new Date(row.updated_at).toLocaleString()}
        </span>
      </div>

      <CuratedEditor row={row} courses={courses} catalog={catalog} coverURL={cover} />
    </div>
  );
}

// Local types for the joined relations Supabase JS returns.
// `clubs` / `counties` come back as arrays even when the FK is
// one-to-one — the runtime is always either an array or a single
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
