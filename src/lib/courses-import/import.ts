import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  transformCounty,
  transformCourse,
  transformCourseToClub,
  slugify,
} from "./transform";
import type {
  CountiesFile,
  CoursesFile,
  CountyRow,
  ClubRow,
  CourseRow,
  ImportResult,
} from "./types";

// Ported from `Vestige-ios/scripts/import-courses/import.ts`. Idempotent upsert
// of counties → clubs → courses (parents first so the child FK reads resolve).
// Upsert-only: nothing is ever deleted, so a bad import is undone by re-running
// a good commit.

const BATCH_SIZE = 100;
const PAGE = 1000;

export async function importDataset(
  supabase: SupabaseClient,
  counties: CountiesFile,
  courses: CoursesFile,
): Promise<ImportResult> {
  const countyRows = counties.features.map(transformCounty);
  const countySlugToId = await upsertCounties(supabase, countyRows);

  const clubRows = courses.features.map(transformCourseToClub);
  const clubFidToId = await upsertClubs(supabase, clubRows);

  const courseRows = courses.features.map(transformCourse);
  const coursesUpserted = await upsertCourses(supabase, courseRows, countySlugToId, clubFidToId);

  return {
    countiesUpserted: countyRows.length,
    clubsUpserted: clubRows.length,
    coursesUpserted,
  };
}

async function upsertCounties(
  supabase: SupabaseClient,
  rows: CountyRow[],
): Promise<Map<string, string>> {
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const { error } = await supabase.from("counties").upsert(
      batch.map((row) => ({ name: row.name, slug: row.slug, polygon: row.polygon })),
      { onConflict: "slug" },
    );
    if (error) throw new Error(`upsert counties failed: ${error.message}`);
  }

  const map = new Map<string, string>();
  const { data, error } = await supabase.from("counties").select("id, slug");
  if (error || !data) throw new Error(`fetch counties for id map failed: ${error?.message}`);
  for (const row of data as Array<{ id: string; slug: string }>) map.set(row.slug, row.id);
  return map;
}

async function upsertClubs(
  supabase: SupabaseClient,
  rows: ClubRow[],
): Promise<Map<number, string>> {
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const { error } = await supabase.from("clubs").upsert(
      batch.map((row) => ({
        legacy_fid: row.legacyFid,
        name: row.name,
        website: row.website,
        location_name: row.locationName,
      })),
      { onConflict: "legacy_fid" },
    );
    if (error) throw new Error(`upsert clubs failed: ${error.message}`);
  }

  // PostgREST caps a plain select at 1000 rows, so page through explicitly -
  // otherwise every club past the first 1000 is missing from the id map and
  // its course silently drops (this bit the 1148-club CLI run).
  const map = new Map<number, string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("clubs")
      .select("id, legacy_fid")
      .not("legacy_fid", "is", null)
      .order("legacy_fid", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data) throw new Error(`fetch clubs for id map failed: ${error?.message}`);
    for (const row of data as Array<{ id: string; legacy_fid: number }>) {
      map.set(row.legacy_fid, row.id);
    }
    if (data.length < PAGE) break;
  }
  return map;
}

async function upsertCourses(
  supabase: SupabaseClient,
  rows: CourseRow[],
  countySlugToId: Map<string, string>,
  clubFidToId: Map<number, string>,
): Promise<number> {
  let upserted = 0;

  for (const batch of chunk(rows, BATCH_SIZE)) {
    const payload = batch
      .map((row) => {
        const clubId = clubFidToId.get(row.clubLegacyFid);
        if (!clubId) return null; // missing club - skip (shouldn't happen post-upsert)
        const countyId = row.countyName ? countySlugToId.get(slugify(row.countyName)) : null;
        return {
          legacy_fid: row.legacyFid,
          name: row.name,
          slug: row.slug,
          club_id: clubId,
          county_id: countyId ?? null,
          area_id: null,
          tier: row.tier,
          // Live column is `type` and holds the layout value (matches the CLI).
          type: row.layout,
          hole_count: row.holeCount,
          polygon: row.polygon,
          center_lat: row.centerLat,
          center_lng: row.centerLng,
          curated_list_ids: [],
          description: row.description,
          par: row.par,
          yards: row.yards,
          style: row.style,
          established: row.established,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (payload.length === 0) continue;
    const { error } = await supabase.from("courses").upsert(payload, { onConflict: "legacy_fid" });
    if (error) throw new Error(`upsert courses failed: ${error.message}`);
    upserted += payload.length;
  }

  return upserted;
}

function* chunk<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}
