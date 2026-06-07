/**
 * Crash-reporting types — shared between the queue page, detail
 * page, and the linked-crash card on `/feedback/[id]`.
 *
 * Mirrors the Postgres `crash_reports` table introduced by
 * `Vestige-ios/supabase/migrations/20260507150000_crash_reports.sql`.
 * Sentry remains the canonical store for stack traces, breadcrumbs,
 * and release-health metrics; this dashboard joins our local handle
 * back to the Sentry issue via the `Open in Sentry` deep-link and
 * pulls richer event detail on demand via the Sentry Web API
 * (`@/lib/sentry/client`).
 */

export type CrashLevel = "fatal" | "error" | "warning" | "info" | "debug";

/**
 * One row of `public.crash_reports`. Every column the queue + detail
 * pages render is here; `raw_payload` is intentionally `unknown`
 * (the column is `jsonb` and we don't want to lock it to a Sentry
 * payload shape that may shift).
 */
export type CrashReportRow = {
  id: string;
  sentry_event_id: string;
  sentry_issue_id: string;
  sentry_project_slug: string;
  fingerprint: string | null;
  level: CrashLevel;
  environment: string | null;
  release_name: string | null;
  platform: string;
  message: string | null;
  culprit: string | null;
  user_id: string | null;
  device_model: string | null;
  os_version: string | null;
  first_seen: string;
  last_seen: string;
  event_count: number;
  raw_payload: unknown;
  ingested_at: string;
};

/**
 * Crash row joined to the reporter's display name + avatar (server-side
 * join from the queries layer). Drives the queue rows.
 */
export type CrashReportEnriched = CrashReportRow & {
  reporter_username: string | null;
  reporter_display_name: string | null;
  reporter_avatar_photo_id: string | null;
};

export type CrashLinkedFeedback = {
  id: string;
  body_preview: string;
  status: string;
  created_at: string;
};

// MARK: - UI helpers

export function levelLabel(level: CrashLevel): string {
  switch (level) {
    case "fatal":
      return "Fatal";
    case "error":
      return "Error";
    case "warning":
      return "Warning";
    case "info":
      return "Info";
    case "debug":
      return "Debug";
  }
}

/**
 * Tailwind class fragments matching the level colours. Reuses the
 * same palette as the feedback severity chips so the two queues
 * read consistently.
 */
export function levelChipClasses(level: CrashLevel): string {
  switch (level) {
    case "fatal":
      return "border-alert/40 bg-alert/15 text-alert";
    case "error":
      return "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "warning":
      return "border-brand/30 bg-brand/10 text-brand";
    case "info":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "debug":
      return "border-border bg-paper-sunken/60 text-ink-2";
  }
}

export function environmentChipClasses(env: string | null): string {
  if (!env) return "border-dashed border-border/70 bg-paper-sunken/40 text-ink-3";
  if (env === "release") return "border-brand/30 bg-brand/10 text-brand";
  // Debug + everything else stays muted.
  return "border-border bg-paper-sunken/60 text-ink-2";
}
