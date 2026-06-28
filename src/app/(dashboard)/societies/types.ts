/**
 * Shared types for the societies admin surface - the **modes** editor.
 *
 * A society mode is one of a small, fixed, dashboard-editable set of
 * formats a user picks when creating a society (Chase / Sprint / Match /
 * Duel - see `20260627130000_society_modes.sql`). The mechanic lives in
 * code (keyed off `key`); identity, on/off, order, who-can-start, and the
 * per-mode rule knobs in `config` are editable here.
 *
 * Crest tokens mirror iOS `SocietyCrestView` so the phone renders the
 * real SF Symbol.
 */

export type SocietyCrestData = { glyph?: string | null; color?: string | null };

export type WhoCanStart = "manager" | "anyone";

/** The known mechanic keys (code switches on these). New keys are allowed
 *  but need a code mechanic before they do anything in the app. */
export const KNOWN_MODE_KEYS = ["chase", "sprint", "match", "duel", "rally", "tour"] as const;

/** Per-mode tunable rule knobs (the `config` jsonb). All optional - the
 *  editor renders the relevant ones per mode key. */
export type ModeConfig = {
  allowed_targets?: string[];
  default_duration_days?: number | null;
  min_duration_days?: number | null;
  max_duration_days?: number | null;
  allow_open_ended?: boolean;
  team_count?: number | null;
  [key: string]: unknown;
};

export type SocietyModeRow = {
  id: string;
  key: string;
  name: string;
  tagline: string | null;
  description: string | null;
  glyph: string;
  color: string;
  enabled: boolean;
  sort_order: number;
  who_can_start: WhoCanStart;
  config: ModeConfig;
  created_at: string;
  updated_at: string;
};

/** Targets a Chase can complete (the `allowed_targets` knob). */
export const CHASE_TARGETS: { value: string; label: string }[] = [
  { value: "county", label: "A county" },
  { value: "collection", label: "A curated collection" },
  { value: "custom", label: "A custom set" },
];

// ---------------------------------------------------------------------
// Crest tokens - must match iOS `SocietyCrestView.tint(for:)`.
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
