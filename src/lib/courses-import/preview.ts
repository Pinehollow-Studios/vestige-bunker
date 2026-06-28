import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { transformCounty, transformCourse, slugify } from "./transform";
import type { CountiesFile, CoursesFile } from "./types";

const PAGE = 1000;

export interface ImportPreview {
  /** Totals in the source dataset at the chosen commit. */
  sourceCounties: number;
  sourceCourses: number;
  /** Rows already present in the live DB (matched by legacy_fid / slug). */
  existingCourses: number;
  existingCounties: number;
  /** Brand-new rows this import would add. */
  newCourses: { fid: number; name: string; county: string | null }[];
  newCounties: string[];
  /** Existing courses the import will refresh in place (upsert). */
  updatedCourses: number;
}

/**
 * Diffs the transformed source dataset against the live DB by `legacy_fid`
 * (courses) and `slug` (counties). No writes. "New" = not yet in the DB;
 * "updated" = present and will be re-upserted. We don't deep-diff polygons
 * (too heavy) - the headline signal Jack wants is *which courses are new*.
 */
export async function buildPreview(
  supabase: SupabaseClient,
  counties: CountiesFile,
  courses: CoursesFile,
): Promise<ImportPreview> {
  const existingFids = await fetchExistingCourseFids(supabase);
  const existingCountySlugs = await fetchExistingCountySlugs(supabase);

  const newCourses: ImportPreview["newCourses"] = [];
  let updatedCourses = 0;
  for (const feature of courses.features) {
    const row = transformCourse(feature);
    if (existingFids.has(row.legacyFid)) updatedCourses += 1;
    else newCourses.push({ fid: row.legacyFid, name: row.name, county: row.countyName });
  }

  const newCounties: string[] = [];
  for (const feature of counties.features) {
    const row = transformCounty(feature);
    if (!existingCountySlugs.has(row.slug)) newCounties.push(row.name);
  }

  return {
    sourceCounties: counties.features.length,
    sourceCourses: courses.features.length,
    existingCourses: existingFids.size,
    existingCounties: existingCountySlugs.size,
    newCourses: newCourses.sort((a, b) => a.name.localeCompare(b.name)),
    newCounties: newCounties.sort((a, b) => a.localeCompare(b)),
    updatedCourses,
  };
}

async function fetchExistingCourseFids(supabase: SupabaseClient): Promise<Set<number>> {
  const fids = new Set<number>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("courses")
      .select("legacy_fid")
      .not("legacy_fid", "is", null)
      .order("legacy_fid", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data) throw new Error(`read existing courses failed: ${error?.message}`);
    for (const row of data as Array<{ legacy_fid: number }>) fids.add(row.legacy_fid);
    if (data.length < PAGE) break;
  }
  return fids;
}

async function fetchExistingCountySlugs(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from("counties").select("slug");
  if (error || !data) throw new Error(`read existing counties failed: ${error?.message}`);
  // Normalise through slugify in case any legacy slug drifted from the algorithm.
  return new Set((data as Array<{ slug: string }>).map((r) => slugify(r.slug)));
}
