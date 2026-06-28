/**
 * Shared types + vocabulary for the admin broadcasts surface ("/notifications").
 *
 * Mirrors the server `admin_broadcasts` table + CHECK constraints
 * (`Vestige-ios/supabase/migrations/20260628100000_admin_broadcasts.sql`) and
 * the iOS `admin_broadcast` notification kind, so what an admin composes here is
 * exactly what lands in users' inbox + on the lock screen. Draft create/edit is
 * direct table read/write under `is_admin()` RLS; the list + the send / schedule
 * / cancel / edit-sent / targeting actions go through the admin RPCs.
 */

// ── Targeting (shared shape with announcements) ─────────────────────────

export type BroadcastAudienceKind = "everyone" | "filtered" | "individuals";

export const AUDIENCE_KINDS: BroadcastAudienceKind[] = ["everyone", "filtered", "individuals"];

export const AUDIENCE_LABELS: Record<BroadcastAudienceKind, string> = {
  everyone: "Everyone",
  filtered: "Filtered cohort",
  individuals: "Hand-picked people",
};

export const PRIVACY_OPTIONS: { value: string; label: string }[] = [
  { value: "onlyMe", label: "Only me" },
  { value: "friendsOnly", label: "Friends only" },
  { value: "everyone", label: "Public" },
];

/**
 * The `target` jsonb for `audience_kind = 'filtered'`. Every key optional;
 * present keys AND together server-side (`broadcast_targets_user`).
 */
export type BroadcastTarget = {
  is_founding_member?: boolean;
  home_county_ids?: string[];
  joined_after?: string; // YYYY-MM-DD
  joined_before?: string; // YYYY-MM-DD
  privacy_in?: string[];
  has_logged_round?: boolean;
};

// ── Status ──────────────────────────────────────────────────────────────

export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "canceled";

export const STATUS_LABELS: Record<BroadcastStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending…",
  sent: "Sent",
  canceled: "Canceled",
};

export const STATUS_CHIP: Record<BroadcastStatus, string> = {
  draft: "border-border bg-paper-sunken/70 text-ink-2",
  scheduled: "border-info/30 bg-info/10 text-info",
  sending: "border-info/30 bg-info/10 text-info",
  sent: "border-brand/40 bg-brand text-brand-fg",
  canceled: "border-ink-3/30 bg-ink-3/10 text-ink-3",
};

export const STATUS_DOT: Record<BroadcastStatus, string> = {
  draft: "bg-ink-3/55",
  scheduled: "bg-info",
  sending: "bg-info",
  sent: "bg-brand",
  canceled: "bg-ink-3/40",
};

export const STATUS_ORDER: BroadcastStatus[] = ["scheduled", "draft", "sending", "sent", "canceled"];

export const STATUS_RANK: Record<BroadcastStatus, number> = {
  scheduled: 0,
  draft: 1,
  sending: 2,
  sent: 3,
  canceled: 4,
};

// ── DB row ──────────────────────────────────────────────────────────────

export type BroadcastRow = {
  id: string;
  title: string;
  body: string;
  destination_url: string | null;
  audience_kind: BroadcastAudienceKind;
  target: BroadcastTarget;
  min_app_version: string | null;
  max_app_version: string | null;
  is_critical: boolean;
  status: BroadcastStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from `admin_broadcasts_overview()` — adds the hand-picked target count. */
export type BroadcastOverviewRow = BroadcastRow & {
  target_user_count: number;
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

// ── Helpers ─────────────────────────────────────────────────────────────

export function audienceSummary(
  row: Pick<BroadcastRow, "audience_kind" | "min_app_version" | "max_app_version">,
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

export function versionBoundsLabel(min: string | null, max: string | null): string | null {
  if (min && max) return min === max ? `v${min}` : `v${min}–${max}`;
  if (min) return `v${min}+`;
  if (max) return `≤v${max}`;
  return null;
}
