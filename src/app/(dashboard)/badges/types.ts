/**
 * Shared types + visual vocabulary for the badge admin surface.
 *
 * Mirrors the iOS `BadgeDefinition` model (`Vestige/Models/BadgeDefinition.swift`)
 * and the server `badge_definitions` table + CHECK constraints
 * (`20260605140000_editorial_badge_system.sql`) so what Jack designs here is
 * exactly what ships in the app.
 *
 * 2026-07-02 "Sigil" badge rework - the badge artwork is now a flat, graphic,
 * infinitely-scalable emblem driven by ALL SIX axes: a duotone `theme` fill,
 * concentric `tier` rings (ring count = tier index + 1), a tier-climbing
 * `shape` (coin → seal → shield → hexagon → rosette), an `effect` glow, and an
 * SF Symbol `glyph`. Every axis is live again (the June seal rework had
 * collapsed it to tier-only). The shared source of truth is
 * `Vestige-Badge-Sigil-Export/badge-spec.json`, matched pixel-for-pixel with
 * iOS `BadgeMedallion` and the web `BadgeMedallion` renderer here.
 */

// ── Visual vocabulary ───────────────────────────────────────────────

/** Colour family — drives the duotone fill + glyph colour on the Sigil. */
export type BadgeTheme =
  | "mint" | "lime" | "amber" | "claret" | "sea"
  | "violet" | "gold" | "slate" | "rose";

export type BadgeTier = "bronze" | "silver" | "gold" | "platinum" | "legendary";
/** Silhouette — defaults from tier (coin → rosette), overridable. */
export type BadgeShape = "rosette" | "shield" | "coin" | "hexagon" | "seal";
/** Extra flair — auto-corrected to the tier (see `resolveEffect`). */
export type BadgeEffect = "none" | "glow" | "metallic" | "holographic";
export type BadgeCategory =
  | "collection" | "counties" | "lists" | "social" | "rounds" | "milestones" | "special";

/** The engraved plate face - flat deep slate, matches iOS `Theme.Color.paperRaised`
 *  (`rgb(0.078,0.133,0.208)` = #142235). The mint glyph reads against it. */
export const PLATE_COLOR = "#142235";
/** The mint glyph colour (iOS `Theme.Color.accent`), unless a `tint_hex` override. */
export const GLYPH_MINT = "#5BE4C3";

/**
 * @deprecated Theme no longer drives the seal. Retained so legacy rows decode
 * without crashing and the insert path can send a safe `theme: "mint"` default.
 */
export const THEME_COLORS: Record<BadgeTheme, [string, string]> = {
  mint:   ["#5BE4C3", "#2FA98B"],
  lime:   ["#B8F36B", "#6FBF3B"],
  amber:  ["#F4C44B", "#D98A2B"],
  claret: ["#C2566B", "#7E2238"],
  sea:    ["#6FC6E8", "#2E6FA8"],
  violet: ["#A98BE8", "#6A45C0"],
  gold:   ["#F6D873", "#C79A2E"],
  slate:  ["#9BB0C2", "#53697E"],
  rose:   ["#F2A0B8", "#C25677"],
};

/** @deprecated Old face-ink table; the seal glyph is always mint (or a tint). */
export const THEME_INK: Record<BadgeTheme, string> = {
  mint: "#10202C", lime: "#10202C", amber: "#10202C", gold: "#10202C", rose: "#10202C",
  claret: "#F6F2E6", sea: "#F6F2E6", violet: "#F6F2E6", slate: "#F6F2E6",
};

/**
 * Brushed-metal tier rim gradient (topLeft→bottomRight) - the ONE visual that
 * varies by tier, matching iOS `BadgeTier.ringColors`. Restrained linear, no
 * gloss sheen.
 */
export const TIER_RING: Record<BadgeTier, string[]> = {
  bronze:    ["#E6A66B", "#9C6233"],
  silver:    ["#E8EEF3", "#9FB0BE"],
  gold:      ["#FBE38C", "#C79A2E"],
  platinum:  ["#DDF0FF", "#9BC2DE"],
  legendary: ["#A98BE8", "#5BE4C3", "#F4C44B"],
};

/** Rim thickness fraction per tier (matches iOS `BadgeTier.ringWidth`). */
export const TIER_RIM_WIDTH: Record<BadgeTier, number> = {
  bronze: 0.045, silver: 0.045, gold: 0.055, platinum: 0.055, legendary: 0.07,
};

// ── Sigil renderer palette (shared source of truth — badge-spec.json + iOS) ──

/**
 * The single duotone theme colour per family — the authoritative Sigil hexes,
 * identical to `badge-spec.json → themes`, iOS `sigilThemeColor`, and the
 * web `BadgeMedallion`. Drives the fill (@14%), the shape stroke, and the glyph.
 */
export const SIGIL_THEME: Record<BadgeTheme, string> = {
  mint: "#5BE4C3", lime: "#8FE85B", sea: "#4FA8E8", violet: "#A78BFA",
  amber: "#F4A85C", gold: "#E8C063", rose: "#F2789F", claret: "#E2664E", slate: "#8A95A2",
};

/**
 * Concentric ring-stroke gradient per tier. Bronze→platinum use [hi, a, b];
 * legendary uses the holographic spectrum. Mirrors `badge-spec.json → tiers.frame`.
 */
export const SIGIL_FRAME: Record<BadgeTier, string[]> = {
  bronze:    ["#F3CB9C", "#E0A062", "#7F4E2C"],
  silver:    ["#FFFFFF", "#E4EAF1", "#8B95A1"],
  gold:      ["#FCEFC0", "#F4D277", "#AE7A1F"],
  platinum:  ["#FFFFFF", "#EFF4FA", "#A6B4C5"],
  legendary: ["#5BE4C3", "#4FA8E8", "#A78BFA", "#F2789F", "#F4A85C"],
};

/** Legendary spectral ring / burst. */
export const SIGIL_HOLO = ["#5BE4C3", "#4FA8E8", "#A78BFA", "#F2789F", "#F4A85C"];

/** Ring count = tier index + 1. */
export const TIER_INDEX: Record<BadgeTier, number> = {
  bronze: 0, silver: 1, gold: 2, platinum: 3, legendary: 4,
};

/** Silhouette a tier defaults to (climbs with rarity). Overridable per badge. */
export const TIER_DEFAULT_SHAPE: Record<BadgeTier, BadgeShape> = {
  bronze: "coin", silver: "seal", gold: "shield", platinum: "hexagon", legendary: "rosette",
};

export const THEME_LABELS: Record<BadgeTheme, string> = {
  mint: "Mint", lime: "Lime", sea: "Sea", violet: "Violet", amber: "Amber",
  gold: "Gold", rose: "Rose", claret: "Claret", slate: "Slate",
};

export const SHAPE_LABELS: Record<BadgeShape, string> = {
  coin: "Coin", seal: "Seal", shield: "Shield", hexagon: "Hexagon", rosette: "Rosette",
};

export const EFFECT_LABELS: Record<BadgeEffect, string> = {
  none: "None", glow: "Glow", metallic: "Metallic", holographic: "Holographic",
};

/**
 * The light guardrail — effects auto-correct to the tier so any authored
 * combination renders intentionally. Legendary is always holographic. Identical
 * to iOS `BadgeMedallion.resolvedEffect` and `badge-spec.json → guardrails`.
 */
export function resolveEffect(effect: BadgeEffect, tier: BadgeTier): BadgeEffect {
  if (tier === "legendary") return "holographic";
  const ti = TIER_INDEX[tier];
  switch (effect) {
    case "holographic": return ti >= 2 ? "glow" : "none";
    case "metallic":    return ti >= 3 ? "metallic" : ti >= 2 ? "glow" : "none";
    case "glow":        return ti >= 2 ? "glow" : "none";
    default:            return ti >= 3 ? "metallic" : "none";
  }
}

export const THEMES: BadgeTheme[] = Object.keys(THEME_COLORS) as BadgeTheme[];
export const TIERS: BadgeTier[] = ["bronze", "silver", "gold", "platinum", "legendary"];

/** Display labels for the rarity tiers. */
export const TIER_LABELS: Record<BadgeTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  legendary: "Legendary",
};

/** Catalogue grouping order - rarest (most prestigious) first. */
export const TIER_ORDER: BadgeTier[] = ["legendary", "platinum", "gold", "silver", "bronze"];
export const SHAPES: BadgeShape[] = ["rosette", "shield", "coin", "hexagon", "seal"];
export const EFFECTS: BadgeEffect[] = ["none", "glow", "metallic", "holographic"];
export const CATEGORIES: BadgeCategory[] = [
  "collection", "counties", "lists", "social", "rounds", "milestones", "special",
];

/**
 * Curated SF Symbol glyphs admins can pick. The `sf` string ships to iOS
 * (must be a real SF Symbol); `label` is the human name; the web preview maps
 * `sf` → a lucide icon (see `glyphLucide` in BadgeMedallion). A free-text
 * override lets power users type any valid SF Symbol.
 */
export const GLYPH_OPTIONS: { sf: string; label: string }[] = [
  { sf: "rosette", label: "Rosette" },
  { sf: "trophy.fill", label: "Trophy" },
  { sf: "crown.fill", label: "Crown" },
  { sf: "star.fill", label: "Star" },
  { sf: "flag.fill", label: "Flag" },
  { sf: "flag.2.crossed.fill", label: "Crossed flags" },
  { sf: "flag.checkered", label: "Chequered flag" },
  { sf: "figure.golf", label: "Golfer" },
  { sf: "map.fill", label: "Map" },
  { sf: "mappin.circle.fill", label: "Map pin" },
  { sf: "globe.europe.africa.fill", label: "Globe" },
  { sf: "checklist", label: "Checklist" },
  { sf: "checkmark.seal.fill", label: "Seal check" },
  { sf: "medal.fill", label: "Medal" },
  { sf: "100.circle.fill", label: "100" },
  { sf: "camera.fill", label: "Camera" },
  { sf: "photo.fill", label: "Photo" },
  { sf: "photo.stack.fill", label: "Photo stack" },
  { sf: "person.fill", label: "Person" },
  { sf: "person.2.fill", label: "Two people" },
  { sf: "person.3.fill", label: "Group" },
  { sf: "sparkles", label: "Sparkles" },
  { sf: "bolt.fill", label: "Bolt" },
  { sf: "flame.fill", label: "Flame" },
  { sf: "heart.fill", label: "Heart" },
  { sf: "leaf.fill", label: "Leaf" },
  { sf: "sun.max.fill", label: "Sun" },
  { sf: "moon.stars.fill", label: "Moon" },
  { sf: "mountain.2.fill", label: "Mountains" },
  { sf: "calendar", label: "Calendar" },
  { sf: "clock.fill", label: "Clock" },
  { sf: "shield.fill", label: "Shield" },
];

// ── Criteria DSL ────────────────────────────────────────────────────

export type CriteriaType =
  | "count_threshold"
  | "specific_course"
  | "specific_county_complete"
  | "specific_list_complete"
  | "manual";

export type CriteriaMetric =
  // Active (collection-purist) metrics.
  | "courses_played"
  | "counties_complete"
  | "lists_complete"
  | "partners_best_round"
  // Archived in the 2026-06-17 rework - kept so existing rows still decode and
  // their summaries render. NOT selectable when authoring a new badge.
  | "rounds_logged"
  | "friends"
  | "photos_added"
  | "bucket_list_size";

export const METRIC_LABELS: Record<CriteriaMetric, string> = {
  courses_played: "Courses played",
  counties_complete: "Counties completed",
  lists_complete: "Curated lists completed",
  partners_best_round: "Playing partners on one round",
  // Archived metrics (still labelled so legacy rows read).
  rounds_logged: "Rounds logged",
  friends: "Friends",
  photos_added: "Round photos added",
  bucket_list_size: "Bucket-list courses",
};

/**
 * Metrics an admin can pick when authoring. The collection-purist catalogue
 * dropped `rounds_logged` / `friends` / `photos_added` / `bucket_list_size`;
 * they remain valid on existing rows (tolerated everywhere) but are no longer
 * offered. `partners_best_round` (the Fourball badge - most playing-partners
 * tagged on a single round) is the new addition.
 */
export const SELECTABLE_METRICS: CriteriaMetric[] = [
  "courses_played",
  "counties_complete",
  "lists_complete",
  "partners_best_round",
];

/** Metrics retired in the 2026-06-17 rework - tolerated, never offered. */
export const ARCHIVED_METRICS: CriteriaMetric[] = [
  "rounds_logged", "friends", "photos_added", "bucket_list_size",
];

/** `courses_played` is the only metric that supports scoping. */
export const SCOPEABLE_METRICS: CriteriaMetric[] = ["courses_played"];

export const COURSE_TIERS = ["championship", "standard", "short", "par3"] as const;

export type Criteria =
  | { type: "count_threshold"; metric: CriteriaMetric; threshold: number; scope?: CriteriaScope }
  | { type: "specific_course"; course_id: string }
  | { type: "specific_county_complete"; county_id: string }
  | { type: "specific_list_complete"; curated_list_id: string }
  | { type: "manual" };

export type CriteriaScope = {
  county_id?: string;
  tier?: string;
  style?: string;
};

/** Human one-liner for a criteria blob - used on the index cards. */
export function criteriaSummary(
  criteria: Criteria,
  lookups?: {
    counties?: Record<string, string>;
    courses?: Record<string, string>;
    lists?: Record<string, string>;
  },
): string {
  switch (criteria.type) {
    case "manual":
      return "Awarded manually";
    case "specific_course":
      return `Play ${lookups?.courses?.[criteria.course_id] ?? "a specific course"}`;
    case "specific_county_complete":
      return `Complete ${lookups?.counties?.[criteria.county_id] ?? "a specific county"}`;
    case "specific_list_complete":
      return `Complete ${lookups?.lists?.[criteria.curated_list_id] ?? "a specific list"}`;
    case "count_threshold": {
      const base = `${METRIC_LABELS[criteria.metric]} ≥ ${criteria.threshold}`;
      const s = criteria.scope;
      if (!s) return base;
      const parts: string[] = [];
      if (s.county_id) parts.push(`in ${lookups?.counties?.[s.county_id] ?? "a county"}`);
      if (s.tier) parts.push(s.tier);
      if (s.style) parts.push(s.style);
      return parts.length ? `${base} (${parts.join(", ")})` : base;
    }
  }
}

// ── DB row ──────────────────────────────────────────────────────────

export type BadgeDefinitionRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  how_to_earn: string | null;
  glyph: string;
  theme: BadgeTheme;
  tint_hex: string | null;
  tier: BadgeTier;
  shape: BadgeShape;
  effect: BadgeEffect;
  custom_image_key: string | null;
  criteria: Criteria;
  category: BadgeCategory;
  series_key: string | null;
  series_rank: number | null;
  display_priority: number;
  is_published: boolean;
  is_secret: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type BadgeStatus = "live" | "draft" | "archived";

export function statusFor(row: Pick<BadgeDefinitionRow, "is_published" | "is_archived">): BadgeStatus {
  if (row.is_archived) return "archived";
  return row.is_published ? "live" : "draft";
}

export const STATUS_LABELS: Record<BadgeStatus, string> = {
  live: "Live",
  draft: "Draft",
  archived: "Archived",
};

export const STATUS_CHIP: Record<BadgeStatus, string> = {
  live: "border-brand/40 bg-brand text-brand-fg",
  draft: "border-border bg-paper-sunken/70 text-ink-2",
  archived: "border-ink-3/30 bg-ink-3/10 text-ink-3",
};

export const STATUS_DOT: Record<BadgeStatus, string> = {
  live: "bg-brand",
  draft: "bg-ink-3/55",
  archived: "bg-ink-3/40",
};

/** Picker rows the editor needs for the criteria entity selects. */
export type CountyOption = { id: string; name: string };
export type CuratedListOption = { id: string; name: string };
export type CourseOption = { id: string; name: string; county_name: string | null };
