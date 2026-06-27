/**
 * Shared types for the societies admin surface.
 *
 * The surface is the curated **society templates** workbench — Jack's
 * blueprints that GENERATE a user's own society (see
 * `20260627110000_society_templates.sql`). A template = a mechanic
 * (cooperative `completion` | competitive `race`) × a target set
 * (`county` | `curated_list` | `custom`) × per-county theming.
 *
 * Crest tokens mirror iOS `SocietyCrestView` so the phone renders the
 * real SF Symbol from the `crest` jsonb the admin writes.
 */

/** Wire shape of a `crest` jsonb (template-level or per-county override). */
export type SocietyCrestData = {
  glyph?: string | null;
  color?: string | null;
};

export type SocietyTemplateKind = "completion" | "race";
export type SocietyTemplateTargetType = "county" | "curated_list" | "custom";
export type SocietyTemplateStatus = "draft" | "live" | "archived";

/** A row from `society_templates`. */
export type SocietyTemplateRow = {
  id: string;
  slug: string;
  name: string;
  kind: SocietyTemplateKind;
  target_type: SocietyTemplateTargetType | null;
  fixed_list_id: string | null;
  name_pattern: string;
  blurb: string | null;
  story_template: string | null;
  crest: SocietyCrestData | null;
  cover_storage_key: string | null;
  default_duration_days: number | null;
  status: SocietyTemplateStatus;
  featured: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** Per-county theming row, as returned by `admin_template_counties()`. */
export type TemplateCountyStatus = "untouched" | "draft" | "live";

export type TemplateCountyRow = {
  county_id: string;
  county_name: string;
  course_count: number;
  status: TemplateCountyStatus;
  has_story: boolean;
  has_cover: boolean;
  demand_count: number;
};

/** The persisted per-county theming record (when one exists). */
export type TemplateCountyTheme = {
  template_id: string;
  county_id: string;
  status: "draft" | "live";
  name_override: string | null;
  story: string | null;
  crest: SocietyCrestData | null;
  cover_storage_key: string | null;
  published_at: string | null;
};

export type CountyOption = { id: string; name: string };
export type CuratedListOption = { id: string; name: string };

// ---------------------------------------------------------------------
// Labels + presentation
// ---------------------------------------------------------------------

export const TEMPLATE_KIND_LABELS: Record<SocietyTemplateKind, string> = {
  completion: "Complete together",
  race: "Race",
};

export const TEMPLATE_TARGET_LABELS: Record<SocietyTemplateTargetType, string> = {
  county: "A county",
  curated_list: "A curated list",
  custom: "A custom set",
};

export const TEMPLATE_STATUS_LABELS: Record<SocietyTemplateStatus, string> = {
  draft: "Draft",
  live: "Live",
  archived: "Archived",
};

/** Coloured chip class per template status — matches the curated surface. */
export const TEMPLATE_STATUS_CHIP: Record<SocietyTemplateStatus, string> = {
  draft: "border-border bg-paper-sunken/70 text-ink-2",
  live: "border-brand/40 bg-brand text-brand-fg",
  archived: "border-ink-3/30 bg-ink-3/10 text-ink-3",
};

export const TEMPLATE_STATUS_DOT: Record<SocietyTemplateStatus, string> = {
  draft: "bg-ink-3/55",
  live: "bg-brand",
  archived: "bg-ink-3/40",
};

/** County-coverage chip class per theming status (the workbench grid). */
export const COUNTY_STATUS_LABELS: Record<TemplateCountyStatus, string> = {
  untouched: "Untouched",
  draft: "Coming soon",
  live: "Live",
};

export const COUNTY_STATUS_CHIP: Record<TemplateCountyStatus, string> = {
  untouched: "border-border bg-paper-sunken/70 text-ink-3",
  draft: "border-amber/30 bg-amber/10 text-amber",
  live: "border-brand/40 bg-brand/15 text-brand",
};

// ---------------------------------------------------------------------
// Crest tokens — must match iOS `SocietyCrestView.tint(for:)`.
// ---------------------------------------------------------------------

export const CREST_COLORS: { token: string; label: string; hex: string }[] = [
  { token: "mint", label: "Mint", hex: "#5BE4C3" },
  { token: "lime", label: "Lime", hex: "#8FE85B" },
  { token: "amber", label: "Amber", hex: "#E5A13A" },
  { token: "claret", label: "Claret", hex: "#B23A55" },
  { token: "sea", label: "Sea", hex: "#3E7CA6" },
];

export const DEFAULT_CREST = { glyph: "flag.fill", color: "mint" };

export function crestColorHex(token: string | null | undefined): string {
  return CREST_COLORS.find((c) => c.token === token)?.hex ?? CREST_COLORS[0].hex;
}
