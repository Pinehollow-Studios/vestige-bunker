// Shapes of the upstream vestige-tool dataset + the transformed iOS-schema
// rows. Mirrors `Pinehollow-Studios/vestige-tool/src/{counties,courses}.js`
// at a pinned commit; if Jack changes the shape, this file follows.
//
// Ported from `Vestige-ios/scripts/import-courses` so the dashboard can run
// the same import without a terminal. Keep the two in step.

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface GeoJsonMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

/** A course/county boundary is either a single Polygon or, for courses merged
 *  from several OSM ways, a MultiPolygon. ~12% of courses are MultiPolygon. */
export type GeoJsonGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;

export interface CountyFeature {
  type: "Feature";
  properties: { name: string };
  geometry: GeoJsonGeometry;
}

export interface CountiesFile {
  type: "FeatureCollection";
  features: CountyFeature[];
}

export interface CourseProperties {
  fid: number;
  Course_Name: string;
  website?: string;
  type?: string;
  par?: number;
  yards?: number;
  established?: number;
  county?: string;
  description?: string;
  photo?: string;
}

export interface CourseFeature {
  type: "Feature";
  properties: CourseProperties;
  geometry: GeoJsonGeometry;
}

export interface CoursesFile {
  type: "FeatureCollection";
  features: CourseFeature[];
}

// ── Transformed rows ──────────────────────────────────────────────────────

export interface CountyRow {
  name: string;
  slug: string;
  polygon: GeoJsonGeometry;
}

export interface ClubRow {
  legacyFid: number;
  name: string;
  website: string | null;
  locationName: string | null;
}

export interface CourseRow {
  legacyFid: number;
  name: string;
  slug: string;
  clubLegacyFid: number;
  countyName: string | null;
  tier: "championship" | "standard" | "short" | "par3";
  layout: "primary18" | "secondary18" | "nineHole" | "shortCourse";
  holeCount: number;
  polygon: GeoJsonGeometry;
  centerLat: number | null;
  centerLng: number | null;
  description: string | null;
  par: number | null;
  yards: number | null;
  style: string | null;
  established: number | null;
}

export interface ImportResult {
  countiesUpserted: number;
  clubsUpserted: number;
  coursesUpserted: number;
}
