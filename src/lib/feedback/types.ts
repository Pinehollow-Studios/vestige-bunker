/**
 * Feedback / bug-reporting types — shared between the queue page,
 * thread detail page, and any client components that branch on
 * status / kind / severity.
 *
 * These literal-union types mirror the iOS `FeedbackCategory` /
 * `FeedbackStatus` / `FeedbackSeverity` / `FeedbackMessageKind` /
 * `FeedbackMessageAuthorRole` enums (see
 * `Vestige-ios/Vestige/Models/FeedbackReport.swift`) and the SQL
 * enum / CHECK constraints introduced by
 * `20260504210000_feedback_v2_schema.sql`. Any drift here must be
 * matched on both sides.
 */

export type FeedbackKind =
  | "bug"
  | "dataError"
  | "featureRequest"
  | "general"
  // Beta-program report types (Vestige-ios 2026-06-06 beta-depth slice).
  | "crash"
  | "visualGlitch"
  | "performance"
  | "confusingUX";
export type FeedbackStatus =
  | "new"
  | "triaged"
  | "inProgress"
  | "resolved"
  | "wontFix";
export type FeedbackSeverity = "low" | "medium" | "high" | "critical";
/**
 * Admin-only operator pipeline (Vestige-ios 2026-06-08 admin-workflow
 * slice). A superset of `FeedbackStatus` with four internal-only states
 * (backlog / needsInfo / fixed / released). The reporter-facing
 * `FeedbackStatus` is derived from this — see `workStageDerivedStatus`.
 * Never surfaced in the iOS app. */
export type FeedbackWorkStage =
  | "new"
  | "triaged"
  | "backlog"
  | "needsInfo"
  | "inProgress"
  | "fixed"
  | "released"
  | "resolved"
  | "wontFix";
/** Admin-only do-next ordering, distinct from `FeedbackSeverity` (triage
 * scale) and `FeedbackUserSeverity` (reporter impact). */
export type FeedbackPriority = "low" | "normal" | "high";
/** Reporter's own impact read (beta depth) — distinct from the
 * admin-set `FeedbackSeverity` triage scale. */
export type FeedbackUserSeverity = "blocker" | "major" | "minor" | "cosmetic";
/** How reliably the issue reproduces (beta depth). */
export type FeedbackReproducibility = "always" | "sometimes" | "once" | "unsure";
export type FeedbackMessageKind = "reply" | "status_change";
export type FeedbackMessageAuthorRole =
  | "moderator"
  | "editor"
  | "super_admin"
  | "system";

/**
 * Row shape returned by `admin_feedback_queue(...)`. One row per
 * report, enriched with reporter handle/avatar + screenshot count
 * + most-recent admin-message preview + duplicate count.
 */
export type FeedbackQueueRow = {
  report_id: string;
  user_id: string | null;
  reporter_username: string | null;
  reporter_display_name: string | null;
  reporter_avatar_photo_id: string | null;
  is_founder: boolean;
  kind: FeedbackKind;
  status: FeedbackStatus;
  // Admin work-tracking layer (Vestige-ios 2026-06-08). work_stage is the
  // operator pipeline; status is derived from it for the reporter.
  work_stage: FeedbackWorkStage;
  priority: FeedbackPriority | null;
  owner_user_id: string | null;
  owner_username: string | null;
  owner_display_name: string | null;
  owner_avatar_photo_id: string | null;
  severity: FeedbackSeverity | null;
  // Beta-depth fields (nullable for pre-2026-06-06 reports + reports
  // filed before the beta flow existed).
  area: string | null;
  area_label: string | null;
  user_severity: FeedbackUserSeverity | null;
  reproducibility: FeedbackReproducibility | null;
  body_preview: string;
  tags: string[];
  duplicate_of_report_id: string | null;
  duplicate_count: number;
  screenshot_count: number;
  last_admin_message_preview: string | null;
  last_admin_message_at: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

/**
 * Row in the `report` jsonb column returned by
 * `admin_feedback_thread(p_report_id)`. Loose typing for the columns
 * that don't drive UI on slice 1.
 */
export type FeedbackReport = {
  id: string;
  user_id: string | null;
  kind: FeedbackKind;
  status: FeedbackStatus;
  // Admin work-tracking layer (Vestige-ios 2026-06-08).
  work_stage: FeedbackWorkStage;
  priority: FeedbackPriority | null;
  owner_user_id: string | null;
  severity: FeedbackSeverity | null;
  body: string;
  expected_behaviour: string | null;
  steps: string | null;
  screen: string | null;
  breadcrumbs: Array<Record<string, unknown>> | null;
  app_version: string | null;
  ios_version: string | null;
  device_model: string | null;
  category_context: Record<string, string> | null;
  // Beta-depth fields (nullable for non-beta reports).
  area: string | null;
  area_path: string[] | null;
  area_label: string | null;
  user_severity: FeedbackUserSeverity | null;
  reproducibility: FeedbackReproducibility | null;
  tags: string[] | null;
  is_founder: boolean | null;
  duplicate_of_report_id: string | null;
  linked_crash_id: string | null;
  last_admin_message_at: string | null;
  unread_admin_message_for_user: boolean | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type FeedbackReporter = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_photo_id: string | null;
  is_founding_member: boolean | null;
};

/** Assignee (an admin), resolved by `admin_feedback_thread`. */
export type FeedbackOwner = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_photo_id: string | null;
};

export type FeedbackMessage = {
  id: string;
  report_id: string;
  author_user_id: string | null;
  author_role: FeedbackMessageAuthorRole;
  kind: FeedbackMessageKind;
  body: string | null;
  attachment_storage_path: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type FeedbackScreenshot = {
  id: string;
  report_id: string;
  storage_path: string;
  auto_captured: boolean;
  redacted: boolean;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
};

export type FeedbackDuplicateLink = {
  id: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  created_at: string;
  body_preview: string;
};

export type FeedbackThread = {
  report: FeedbackReport;
  reporter: FeedbackReporter | null;
  owner: FeedbackOwner | null;
  messages: FeedbackMessage[];
  screenshots: FeedbackScreenshot[];
  duplicates: FeedbackDuplicateLink[];
};

// MARK: - UI helpers

/** Display label for a `FeedbackKind` (the user-facing word, not the
 * raw enum). Mirrored on iOS as `FeedbackCategory.displayLabel`. */
export function kindLabel(kind: FeedbackKind): string {
  switch (kind) {
    case "bug":
      return "Bug";
    case "dataError":
      return "Data error";
    case "featureRequest":
      return "Feature request";
    case "general":
      return "General";
    case "crash":
      return "Crash";
    case "visualGlitch":
      return "Visual glitch";
    case "performance":
      return "Performance";
    case "confusingUX":
      return "Confusing UX";
  }
}

export function statusLabel(status: FeedbackStatus): string {
  switch (status) {
    case "new":
      return "New";
    case "triaged":
      return "Acknowledged";
    case "inProgress":
      return "In progress";
    case "resolved":
      return "Resolved";
    case "wontFix":
      return "Won't fix";
  }
}

export function severityLabel(severity: FeedbackSeverity | null): string {
  if (!severity) return "Unset";
  return severity[0].toUpperCase() + severity.slice(1);
}

/**
 * Tailwind class fragments matching the four severity colours. We
 * pull these out so the queue table + detail page render
 * consistently.
 */
export function severityChipClasses(
  severity: FeedbackSeverity | null,
): string {
  switch (severity) {
    case "critical":
      return "border-alert/40 bg-alert/15 text-alert";
    case "high":
      return "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "medium":
      return "border-brand/30 bg-brand/10 text-brand";
    case "low":
      return "border-border bg-paper-sunken/60 text-ink-2";
    default:
      return "border-dashed border-border/70 bg-paper-sunken/40 text-ink-3";
  }
}

export function statusChipClasses(status: FeedbackStatus): string {
  switch (status) {
    case "new":
      return "border-brand/30 bg-brand/10 text-brand";
    case "triaged":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "inProgress":
      return "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "resolved":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "wontFix":
      return "border-border bg-paper-sunken/60 text-ink-2";
  }
}

// MARK: - Work stage / priority / owner (admin work-tracking layer)

/** Shared calm-chip tone union — the feedback UI keys every pill to one of
 * these four families (brand / amber / alert / neutral). */
export type FeedbackChipTone = "brand" | "amber" | "alert" | "neutral";

/** Operator-pipeline order — drives the side-panel stage picker + the
 * queue filter. Mirrors the `feedback_work_stage` enum order. */
export const FEEDBACK_WORK_STAGES: FeedbackWorkStage[] = [
  "new",
  "triaged",
  "backlog",
  "needsInfo",
  "inProgress",
  "fixed",
  "released",
  "resolved",
  "wontFix",
];

export const FEEDBACK_PRIORITIES: FeedbackPriority[] = ["high", "normal", "low"];

export function workStageLabel(stage: FeedbackWorkStage): string {
  switch (stage) {
    case "new":
      return "New";
    case "triaged":
      return "Triaged";
    case "backlog":
      return "Backlog";
    case "needsInfo":
      return "Needs info";
    case "inProgress":
      return "In progress";
    case "fixed":
      return "Fixed";
    case "released":
      return "Released";
    case "resolved":
      return "Resolved";
    case "wontFix":
      return "Won't fix";
  }
}

export function priorityLabel(priority: FeedbackPriority | null): string {
  switch (priority) {
    case "high":
      return "High";
    case "normal":
      return "Normal";
    case "low":
      return "Low";
    default:
      return "Unset";
  }
}

/** The reporter-facing status this stage maps to. Mirrors the SQL
 * derivation in `set_work_stage` — keep both in sync. */
export function workStageDerivedStatus(stage: FeedbackWorkStage): FeedbackStatus {
  switch (stage) {
    case "new":
      return "new";
    case "triaged":
    case "backlog":
    case "needsInfo":
      return "triaged";
    case "inProgress":
    case "fixed":
      return "inProgress";
    case "released":
    case "resolved":
      return "resolved";
    case "wontFix":
      return "wontFix";
  }
}

/** Stages whose derived status is terminal (resolved / wontFix) and so
 * require a resolution note — the note is shown to the reporter. */
export function workStageNeedsResolutionNote(stage: FeedbackWorkStage): boolean {
  const derived = workStageDerivedStatus(stage);
  return derived === "resolved" || derived === "wontFix";
}

export function workStageTone(stage: FeedbackWorkStage): FeedbackChipTone {
  switch (stage) {
    case "new":
      return "brand";
    case "inProgress":
    case "fixed":
    case "needsInfo":
      return "amber";
    case "released":
    case "resolved":
      return "brand";
    case "triaged":
    case "backlog":
    case "wontFix":
      return "neutral";
  }
}

export function priorityTone(priority: FeedbackPriority | null): FeedbackChipTone {
  switch (priority) {
    case "high":
      return "alert";
    case "normal":
      return "amber";
    case "low":
      return "neutral";
    default:
      return "neutral";
  }
}

// MARK: - Beta-depth helpers (area / user severity / reproducibility)

/** Reporter-set impact label. Mirrors iOS `FeedbackUserSeverity`. */
export function userSeverityLabel(value: FeedbackUserSeverity | null): string {
  switch (value) {
    case "blocker":
      return "Blocker";
    case "major":
      return "Major";
    case "minor":
      return "Minor";
    case "cosmetic":
      return "Cosmetic";
    default:
      return "—";
  }
}

export function userSeverityChipClasses(
  value: FeedbackUserSeverity | null,
): string {
  switch (value) {
    case "blocker":
      return "border-alert/40 bg-alert/15 text-alert";
    case "major":
      return "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "minor":
      return "border-brand/30 bg-brand/10 text-brand";
    case "cosmetic":
      return "border-border bg-paper-sunken/60 text-ink-2";
    default:
      return "border-dashed border-border/70 bg-paper-sunken/40 text-ink-3";
  }
}

/** Reproducibility label. Mirrors iOS `FeedbackReproducibility`. */
export function reproducibilityLabel(
  value: FeedbackReproducibility | null,
): string {
  switch (value) {
    case "always":
      return "Every time";
    case "sometimes":
      return "Sometimes";
    case "once":
      return "Just once";
    case "unsure":
      return "Not sure";
    default:
      return "—";
  }
}

/** All report types — drives the queue kind filter. */
export const FEEDBACK_KINDS: FeedbackKind[] = [
  "bug",
  "crash",
  "visualGlitch",
  "performance",
  "confusingUX",
  "dataError",
  "featureRequest",
  "general",
];

/** Reporter-impact filter options. */
export const FEEDBACK_USER_SEVERITIES: FeedbackUserSeverity[] = [
  "blocker",
  "major",
  "minor",
  "cosmetic",
];

/**
 * Top-level page-location areas — the `feedback_reports.area` slug the
 * queue filter matches on. Mirrors the top level of the iOS
 * `FeedbackArea.tree`. The full breadcrumb lives in `area_label`.
 */
export const FEEDBACK_AREAS: { slug: string; label: string }[] = [
  { slug: "home", label: "Home" },
  { slug: "atlas", label: "Atlas / map" },
  { slug: "club", label: "Club" },
  { slug: "you", label: "You / profile" },
  { slug: "round", label: "Logging a round" },
  { slug: "onboarding", label: "Sign in & onboarding" },
  { slug: "settings", label: "Settings" },
  { slug: "notifications", label: "Notifications" },
  { slug: "other", label: "Other" },
];

export function areaSlugLabel(slug: string | null): string {
  if (!slug) return "—";
  return FEEDBACK_AREAS.find((a) => a.slug === slug)?.label ?? slug;
}
