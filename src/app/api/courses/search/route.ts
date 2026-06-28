import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/auth/apiGuard";
import type { CourseCatalogRow } from "@/app/(dashboard)/curated/types";

/**
 * Course catalogue search for the curated-list picker. Lets the editor load
 * fast (no 2000-row upfront fetch) and search the catalogue on demand - same
 * model as the ⌘K palette. `courses` is `select_authenticated`, so the session
 * client reads it; admin-gated all the same.
 */
type CourseJoinRow = {
  id: string;
  name: string;
  clubs: { name: string }[] | { name: string } | null;
  counties: { name: string }[] | { name: string } | null;
};

function unwrap<T>(value: unknown): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value as T;
}

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.error) return guard.error;

  const raw = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const q = raw.replace(/[,()*%\\]/g, " ").trim();

  let query = guard.supabase
    .from("courses")
    .select("id, name, clubs(name), counties(name)")
    .order("name", { ascending: true })
    .limit(40);
  if (q.length >= 1) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ courses: [] as CourseCatalogRow[], error: error.message }, { status: 200 });
  }

  const courses: CourseCatalogRow[] = ((data as CourseJoinRow[] | null) ?? []).map((row) => ({
    course_id: row.id,
    course_name: row.name,
    club_name: unwrap<{ name: string }>(row.clubs)?.name ?? null,
    county_name: unwrap<{ name: string }>(row.counties)?.name ?? null,
  }));

  return NextResponse.json({ courses });
}
