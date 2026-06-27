// Fairways-web shape → iOS schema rows. Ported verbatim from
// `Vestige-ios/scripts/import-courses/transform.ts` (pure functions — no I/O).
//
// Editorial defaults baked in for v1 (Jack overrides via the dashboard):
// - each course is its own implicit "club" (web data has no club entity)
// - `tier` defaults to 'standard'; `layout` inferred from par/type
// - naming gotcha: the web `properties.type` is what we now call **style**
//   (Heathland / Parkland / Links / Pitch & Putt); the iOS **layout** column
//   is the physical shape (18 / 9 / short), inferred separately.

import type {
  CountyFeature,
  CourseFeature,
  CountyRow,
  ClubRow,
  CourseRow,
  GeoJsonGeometry,
} from "./types";

/** Deterministic slug — ported verbatim from the iOS `lib/slug.ts` that minted
 *  the EXISTING `counties.slug` / `courses.slug` values. Must match exactly, or
 *  `onConflict` upserts would create duplicate rows instead of updating. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/['’`]/g, "") // drop apostrophes (keep "stannes" not "st-annes")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function transformCounty(feature: CountyFeature): CountyRow {
  return {
    name: feature.properties.name,
    slug: slugify(feature.properties.name),
    polygon: feature.geometry,
  };
}

export function transformCourseToClub(feature: CourseFeature): ClubRow {
  const props = feature.properties;
  return {
    legacyFid: props.fid,
    name: props.Course_Name,
    website: props.website?.trim() || null,
    locationName: props.county?.trim() || null,
  };
}

export function transformCourse(feature: CourseFeature): CourseRow {
  const props = feature.properties;
  const tier = inferTier(props);
  const { holeCount, layout } = inferLayout(props);
  const center = polygonCentroid(feature.geometry);

  return {
    legacyFid: props.fid,
    name: props.Course_Name,
    slug: slugify(`${props.Course_Name}-${props.fid}`),
    clubLegacyFid: props.fid,
    countyName: props.county?.trim() || null,
    tier,
    layout,
    holeCount,
    polygon: feature.geometry,
    centerLat: center?.lat ?? null,
    centerLng: center?.lng ?? null,
    description: props.description?.trim() || null,
    par: typeof props.par === "number" && props.par > 0 ? props.par : null,
    yards: typeof props.yards === "number" && props.yards > 0 ? props.yards : null,
    style: props.type?.trim() || null,
    established:
      typeof props.established === "number" && props.established > 0 ? props.established : null,
  };
}

function inferTier(props: CourseFeature["properties"]): CourseRow["tier"] {
  const par = props.par ?? 0;
  if (par > 0 && par <= 36) return "short";
  if (props.type && /pitch\s*&?\s*putt/i.test(props.type)) return "short";
  if (props.type && /par\s*3/i.test(props.type)) return "par3";
  return "standard";
}

function inferLayout(props: CourseFeature["properties"]): {
  holeCount: number;
  layout: CourseRow["layout"];
} {
  const par = props.par ?? 0;
  const isNine = par > 0 && par <= 36;
  const isPar3 = !!props.type && /par\s*3/i.test(props.type);
  const isPitchPutt = !!props.type && /pitch\s*&?\s*putt/i.test(props.type);

  if (isPitchPutt || isPar3) return { holeCount: isNine ? 9 : 18, layout: "shortCourse" };
  if (isNine) return { holeCount: 9, layout: "nineHole" };
  return { holeCount: 18, layout: "primary18" };
}

function polygonCentroid(geom: GeoJsonGeometry): { lat: number; lng: number } | null {
  // Polygon → outer ring; MultiPolygon → outer ring of its first sub-polygon.
  // (~12% of courses are MultiPolygon — merged from several OSM ways. The CLI
  // import left these with a null centre; handling them here backfills a real
  // map pin on the next apply.)
  const ring = geom.type === "MultiPolygon" ? geom.coordinates[0]?.[0] : geom.coordinates[0];
  if (!ring || ring.length === 0) return null;
  let sumLng = 0;
  let sumLat = 0;
  for (const point of ring) {
    const lng = point[0];
    const lat = point[1];
    if (typeof lng !== "number" || typeof lat !== "number") return null;
    sumLng += lng;
    sumLat += lat;
  }
  return { lng: sumLng / ring.length, lat: sumLat / ring.length };
}
