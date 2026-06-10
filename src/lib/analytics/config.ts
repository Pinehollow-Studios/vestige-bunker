/**
 * Display config + constants for the analytics surface.
 *
 * The event *taxonomy* (which events exist, what they carry) is the iOS
 * repo's `docs/analytics-vocabulary.md`; this is the dashboard-side mapping
 * from wire `event_name` → human label + grouping, so the surface reads
 * nicely even before every event is wired on the app side.
 */

/**
 * B2B k-anonymity floor: never surface an aggregate cell covering fewer than
 * this many distinct users (`analytics-vocabulary.md` §6 / §12.2). Default 5.
 *
 * TODO(phase-2): move this to an `analytics_config` row in the iOS migrations
 * so it's tunable without a deploy. A constant is the right shape until the
 * club-facing export exists and legal pins the number.
 */
export const MIN_COHORT_N = 5;

export type EventGroup =
  | "onboarding"
  | "discovery"
  | "play"
  | "social"
  | "lifecycle"
  | "other";

export const GROUP_LABEL: Record<EventGroup, string> = {
  onboarding: "Onboarding",
  discovery: "Discovery",
  play: "Play loop",
  social: "Social",
  lifecycle: "Lifecycle",
  other: "Other",
};

/** The full planned vocabulary (P1 wired today; P2/P3 land as the app side
 *  fills in). Keep in step with `analytics-vocabulary.md` §7. */
export const EVENT_CATALOG: Record<string, { label: string; group: EventGroup }> = {
  // Onboarding & activation funnel
  auth_completed: { label: "Auth completed", group: "onboarding" },
  onboarding_started: { label: "Onboarding started", group: "onboarding" },
  onboarding_step_completed: { label: "Onboarding step", group: "onboarding" },
  onboarding_demographics_set: { label: "Demographics set", group: "onboarding" },
  onboarding_profile_created: { label: "Profile created", group: "onboarding" },
  onboarding_courses_seeded: { label: "Courses seeded", group: "onboarding" },
  onboarding_completed: { label: "Onboarding completed", group: "onboarding" },
  // Discovery & consideration
  course_viewed: { label: "Course viewed", group: "discovery" },
  curated_list_viewed: { label: "Curated list viewed", group: "discovery" },
  course_search_performed: { label: "Search performed", group: "discovery" },
  map_region_explored: { label: "Map region explored", group: "discovery" },
  // Play loop
  course_marked_played: { label: "Marked played", group: "play" },
  course_unmarked_played: { label: "Unmarked played", group: "play" },
  course_bucketed: { label: "Bucketed", group: "play" },
  course_unbucketed: { label: "Unbucketed", group: "play" },
  round_logged: { label: "Round logged", group: "play" },
  round_deleted: { label: "Round deleted", group: "play" },
  // Social, virality & retention
  friend_request_sent: { label: "Friend request sent", group: "social" },
  friend_request_accepted: { label: "Friend request accepted", group: "social" },
  invite_shared: { label: "Invite shared", group: "social" },
  feed_viewed: { label: "Feed viewed", group: "social" },
  session_started: { label: "Session started", group: "lifecycle" },
  feedback_submitted: { label: "Feedback submitted", group: "social" },
  // Privacy & lifecycle
  analytics_opt_out_toggled: { label: "Opt-out toggled", group: "lifecycle" },
  data_exported: { label: "Data exported", group: "lifecycle" },
  account_deleted: { label: "Account deleted", group: "lifecycle" },
};

export function eventLabel(name: string): string {
  return EVENT_CATALOG[name]?.label ?? name;
}

export function eventGroup(name: string): EventGroup {
  return EVENT_CATALOG[name]?.group ?? "other";
}

/** Onboarding wizard step order — drives the activation funnel ordering.
 *  Mirrors `OnboardingStep` in the iOS `AnalyticsEvents.swift`. */
export const ONBOARDING_STEPS = [
  "name",
  "username",
  "avatar",
  "cover",
  "home",
  "demographics",
  "privacy",
  "courses",
] as const;

export const ONBOARDING_STEP_LABEL: Record<string, string> = {
  name: "Name",
  username: "Username",
  avatar: "Avatar",
  cover: "Cover",
  home: "Home",
  demographics: "About you",
  privacy: "Privacy",
  courses: "Courses",
};

/** Discovery sources (course_viewed / marked_played / bucketed `discovery_source`). */
export const DISCOVERY_SOURCE_LABEL: Record<string, string> = {
  map_browse: "Map browse",
  search: "Search",
  curated_list: "Curated list",
  user_list: "User list",
  friend_feed: "Friend feed",
  profile_map: "Profile map",
  notification: "Notification",
  deep_link: "Deep link",
  unknown: "Unknown",
};

/** The analytics sub-routes, in tab order. */
export const ANALYTICS_TABS = [
  { href: "/analytics", label: "Overview" },
  { href: "/analytics/b2b", label: "B2B preview" },
  { href: "/analytics/events", label: "Events" },
] as const;
