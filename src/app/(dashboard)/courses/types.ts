/**
 * Shared types for the courses admin surface.
 *
 * Mirrors the iOS-side `Course` + `CourseDTO` (`Vestige/Models/Course.swift`,
 * `Vestige/Repositories/Course/CourseDTO.swift`) so field names + meanings
 * stay aligned across the two clients reading the same Supabase table. The
 * DB columns are documented in the cross-stack courses build migrations
 * (20260504200000…20260504200500).
 *
 * **Bridge note**: the iOS app and admin both speak both shapes during the
 * Option β rollout — the schema column rename `type` → `layout` lands as a
 * later migration once the iOS bridge build is widely adopted. This admin
 * surface writes to the *current* column name (`type`) until the rename
 * lands; reads accept both. The type alias `CourseLayout` here matches the
 * post-rename intent (Heathland is *style*, primary18 is *layout*) so the
 * UI vocabulary is correct from day one.
 */

export type CourseLayout = "primary18" | "secondary18" | "nineHole" | "shortCourse";
export type CourseTier = "championship" | "standard" | "short" | "par3";

/**
 * Compact row shape used by the index table — read straight off
 * `courses` plus joined club + county display names.
 */
export type CourseRow = {
  id: string;
  legacy_fid: number | null;
  name: string;
  slug: string;
  club_id: string | null;
  county_id: string | null;
  club_name: string | null;
  county_name: string | null;
  tier: CourseTier;
  layout: CourseLayout;
  hole_count: number;
  par: number | null;
  yards: number | null;
  style: string | null;
  established: number | null;
  description: string | null;
  curated_list_ids: string[];
  /** Editorial 0–100 prestige input to the Vestige Index (admin-set). */
  prestige: number;
  prestige_source: string | null;
  /** Live computed 0–100 Vestige Index (prestige blended with rarity). */
  vestige_index: number | null;
  /** Computed 0–100 rarity score (100 = rarest). */
  vestige_rarity: number | null;
  /** Distinct players who have this course in their collection. */
  play_count: number;
  hero_photo_storage_key: string | null;
  last_edited_by_admin_id: string | null;
  last_edited_at: string | null;
  last_edited_by_name: string | null;
  updated_at: string;
  created_at: string;
};

/**
 * Detail row shape used by `/courses/[id]` — same as `CourseRow`
 * plus the polygon GeoJSON and curated-list display rows for the
 * meta panel.
 */
export type CourseDetailRow = CourseRow & {
  polygon: GeoJSONPolygonOrMulti | null;
  center_lat: number | null;
  center_lng: number | null;
  curated_lists: CuratedListChip[];
};

export type CuratedListChip = {
  id: string;
  name: string;
};

/**
 * Loose GeoJSON shape — accepts both `Polygon` and `MultiPolygon`
 * (per iOS-side `GeoJSONPolygonDTO`). The polygon preview renders
 * read-only via the Mapbox Static Images API and doesn't need a
 * tighter parse than this.
 */
export type GeoJSONPolygonOrMulti = {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
};

export const TIER_LABELS: Record<CourseTier, string> = {
  championship: "Championship",
  standard: "Standard",
  short: "Short",
  par3: "Par 3",
};

export const LAYOUT_LABELS: Record<CourseLayout, string> = {
  primary18: "18-hole",
  secondary18: "Second 18",
  nineHole: "9-hole",
  shortCourse: "Short course",
};

export const LAYOUTS: CourseLayout[] = [
  "primary18",
  "secondary18",
  "nineHole",
  "shortCourse",
];

export const TIERS: CourseTier[] = ["championship", "standard", "short", "par3"];
