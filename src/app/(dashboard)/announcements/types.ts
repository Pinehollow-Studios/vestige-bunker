/**
 * Shared types + vocabulary for the announcements admin surface.
 *
 * Mirrors the server `announcements` table + CHECK constraints
 * (`Vestige-ios/supabase/migrations/20260607100000_announcements.sql`) and the
 * iOS-side announcement model so what an admin authors here is exactly what the
 * app raises as an in-app pop-up. CRUD is direct table read/write under
 * `is_admin()` RLS (same as `badge_definitions`); the aggregate counts +
 * recipients come from the `admin_announcements_overview` /
 * `admin_announcement_stats` / `admin_announcement_recipients` RPCs.
 */

// ── Vocabulary ──────────────────────────────────────────────────────

export type AnnouncementKind =
  | "update"
  | "feature"
  | "news"
  | "outreach"
  | "system";

export type AnnouncementActionKind = "dismiss" | "external_url" | "deep_link";

export type AnnouncementStyle = "modal_card" | "full_screen";

export type AnnouncementAudienceKind = "everyone" | "filtered" | "individuals";

export const ANNOUNCEMENT_KINDS: AnnouncementKind[] = [
  "update",
  "feature",
  "news",
  "outreach",
  "system",
];

export const KIND_LABELS: Record<AnnouncementKind, string> = {
  update: "Update",
  feature: "Feature",
  news: "News",
  outreach: "Outreach",
  system: "System",
};

export const ACTION_KINDS: AnnouncementActionKind[] = [
  "dismiss",
  "external_url",
  "deep_link",
];

export const ACTION_KIND_LABELS: Record<AnnouncementActionKind, string> = {
  dismiss: "Dismiss only",
  external_url: "Open a link",
  deep_link: "Go to a screen",
};

export const STYLES: AnnouncementStyle[] = ["modal_card", "full_screen"];

export const STYLE_LABELS: Record<AnnouncementStyle, string> = {
  modal_card: "Card on a dimmed backdrop",
  full_screen: "Full screen",
};

export const AUDIENCE_KINDS: AnnouncementAudienceKind[] = [
  "everyone",
  "filtered",
  "individuals",
];

export const AUDIENCE_LABELS: Record<AnnouncementAudienceKind, string> = {
  everyone: "Everyone",
  filtered: "Filtered cohort",
  individuals: "Hand-picked people",
};

/** In-app deep-link tokens the app understands (action_kind = deep_link). */
export const DEEP_LINK_TOKENS: { value: string; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "explore", label: "Atlas / Explore" },
  { value: "club", label: "Club" },
  { value: "you", label: "You (profile)" },
];

export const PRIVACY_OPTIONS: { value: string; label: string }[] = [
  { value: "onlyMe", label: "Only me" },
  { value: "friendsOnly", label: "Friends only" },
  { value: "everyone", label: "Public" },
];

// ── Targeting ───────────────────────────────────────────────────────

/**
 * The `target` jsonb shape for `audience_kind = 'filtered'`. Every key is
 * optional; present keys AND together server-side (see
 * `announcement_targets_user`). Omit a key to ignore that dimension.
 */
export type AnnouncementTarget = {
  is_founding_member?: boolean;
  home_county_ids?: string[];
  joined_after?: string; // date string (YYYY-MM-DD)
  joined_before?: string; // date string (YYYY-MM-DD)
  privacy_in?: string[]; // 'onlyMe' | 'friendsOnly' | 'everyone'
  has_logged_round?: boolean;
};

// ── DB row ──────────────────────────────────────────────────────────

/**
 * Full announcement row read straight off the `announcements` table via
 * admin RLS. The editor hydrates its local state from this.
 */
export type AnnouncementRow = {
  id: string;
  slug: string | null;
  kind: AnnouncementKind;
  eyebrow: string | null;
  title: string;
  body: string;
  highlights: string[];
  image_storage_key: string | null;
  action_kind: AnnouncementActionKind;
  action_label: string | null;
  action_value: string | null;
  dismiss_label: string;
  style: AnnouncementStyle;
  is_dismissible: boolean;
  priority: number;
  audience_kind: AnnouncementAudienceKind;
  min_app_version: string | null;
  max_app_version: string | null;
  target: AnnouncementTarget;
  published_at: string | null;
  unpublished_at: string | null;
  is_archived: boolean;
  created_by_admin_id: string | null;
  last_edited_by_admin_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Index row shape returned by `admin_announcements_overview()` — every
 * announcement plus the derived seen / dismissed / acted counts in one
 * round-trip.
 */
export type AnnouncementOverviewRow = {
  id: string;
  slug: string | null;
  kind: AnnouncementKind;
  title: string;
  eyebrow: string | null;
  audience_kind: AnnouncementAudienceKind;
  min_app_version: string | null;
  max_app_version: string | null;
  priority: number;
  published_at: string | null;
  unpublished_at: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  seen_count: number;
  dismissed_count: number;
  acted_count: number;
};

/** Detail stats from `admin_announcement_stats(p_id)`. */
export type AnnouncementStats = {
  targeted_count: number;
  seen_count: number;
  dismissed_count: number;
  acted_count: number;
  is_reach_estimate: boolean;
};

export type RecipientState = "acted" | "dismissed" | "seen" | "not_seen";

/** A recipient row from `admin_announcement_recipients(...)`. */
export type AnnouncementRecipient = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_photo_id: string | null;
  state: RecipientState;
  first_seen_at: string | null;
  dismissed_at: string | null;
  acted_at: string | null;
  impression_count: number;
};

export const RECIPIENT_STATE_LABELS: Record<RecipientState | "all", string> = {
  all: "Everyone",
  acted: "Acted",
  dismissed: "Dismissed",
  seen: "Seen",
  not_seen: "Not seen",
};

/** Minimal user shape for the individuals-targeting picker. */
export type UserPickRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_photo_id: string | null;
};

/** County option for the filtered-cohort home-county multiselect. */
export type CountyOption = { id: string; name: string };

// ── Derived status ──────────────────────────────────────────────────
// Same idiom as curated_lists: draft → scheduled → live → expired →
// archived, computed from the timestamps + archive flag.

export type AnnouncementStatus =
  | "draft" // published_at is null
  | "scheduled" // published_at > now
  | "live" // published_at <= now AND (unpublished_at null OR > now)
  | "expired" // unpublished_at <= now
  | "archived"; // is_archived = true (overrides for display)

export function statusFor(
  row: Pick<
    AnnouncementRow | AnnouncementOverviewRow,
    "published_at" | "unpublished_at" | "is_archived"
  >,
  now: Date = new Date(),
): AnnouncementStatus {
  if (row.is_archived) return "archived";
  if (!row.published_at) return "draft";
  const published = new Date(row.published_at);
  if (published > now) return "scheduled";
  if (row.unpublished_at) {
    const unpublished = new Date(row.unpublished_at);
    if (unpublished <= now) return "expired";
  }
  return "live";
}

export const STATUS_LABELS: Record<AnnouncementStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  live: "Live",
  expired: "Expired",
  archived: "Archived",
};

/** Coloured chip class per status — brand green for the live state,
 *  semantic info / alert tokens for the rest. Mirrors curated's table. */
export const STATUS_CHIP: Record<AnnouncementStatus, string> = {
  draft: "border-border bg-paper-sunken/70 text-ink-2",
  scheduled: "border-info/30 bg-info/10 text-info",
  live: "border-brand/40 bg-brand text-brand-fg",
  expired: "border-alert/30 bg-alert/10 text-alert",
  archived: "border-ink-3/30 bg-ink-3/10 text-ink-3",
};

/** Tone bar accent (left edge / dot) per status. */
export const STATUS_DOT: Record<AnnouncementStatus, string> = {
  draft: "bg-ink-3/55",
  scheduled: "bg-info",
  live: "bg-brand",
  expired: "bg-alert",
  archived: "bg-ink-3/40",
};

// ── Helpers ─────────────────────────────────────────────────────────

/** Human one-liner summarising who an announcement reaches. */
export function audienceSummary(
  row: Pick<
    AnnouncementRow | AnnouncementOverviewRow,
    "audience_kind" | "min_app_version" | "max_app_version"
  >,
  targetCount?: number,
): string {
  let base: string;
  switch (row.audience_kind) {
    case "everyone":
      base = "Everyone";
      break;
    case "filtered":
      base = "Filtered cohort";
      break;
    case "individuals":
      base =
        targetCount !== undefined
          ? `${targetCount} ${targetCount === 1 ? "person" : "people"}`
          : "Hand-picked people";
      break;
  }
  const bounds = versionBoundsLabel(row.min_app_version, row.max_app_version);
  return bounds ? `${base} · ${bounds}` : base;
}

/** Short label for a min/max app-version pair, or null when unbounded. */
export function versionBoundsLabel(
  min: string | null,
  max: string | null,
): string | null {
  if (min && max) return min === max ? `v${min}` : `v${min}–${max}`;
  if (min) return `v${min}+`;
  if (max) return `≤v${max}`;
  return null;
}
