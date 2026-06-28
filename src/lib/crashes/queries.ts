import { createClient } from "@/lib/supabase/server";
import { sanitizeFilterValue } from "@/lib/security/postgrest";
import type {
  CrashLevel,
  CrashLinkedFeedback,
  CrashReportEnriched,
  CrashReportRow,
} from "./types";

/**
 * Server-side query helpers for `public.crash_reports`. Mirrors the
 * shape of `@/lib/feedback` - server components import from here,
 * RLS enforces admin-only-read at the Postgres layer.
 */

export type CrashListFilters = {
  environment?: string | null;
  release?: string | null;
  level?: CrashLevel | null;
  fingerprint?: string | null;
  userId?: string | null;
  /** Free-text search across message + culprit. */
  query?: string | null;
  limit: number;
  offset: number;
};

export async function listCrashes(
  filters: CrashListFilters,
): Promise<CrashReportEnriched[]> {
  const supabase = await createClient();
  let q = supabase
    .from("crash_reports")
    .select(
      `
        *,
        users:user_id (
          username,
          display_name,
          avatar_photo_id
        )
      `,
    )
    .order("last_seen", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);

  if (filters.environment) q = q.eq("environment", filters.environment);
  if (filters.release) q = q.eq("release_name", filters.release);
  if (filters.level) q = q.eq("level", filters.level);
  if (filters.fingerprint) q = q.eq("fingerprint", filters.fingerprint);
  if (filters.userId) q = q.eq("user_id", filters.userId);
  if (filters.query) {
    // PostgREST `or` for "either column matches". Wildcard match on
    // both message and culprit; sufficient for the v1 admin's "find
    // me the crash with this string in it" workflow. Sanitise the value
    // first - a raw `,`/`.`/`%` etc. would break out of the filter string.
    const escaped = sanitizeFilterValue(filters.query);
    if (escaped.length > 0) {
      q = q.or(`message.ilike.%${escaped}%,culprit.ilike.%${escaped}%`);
    }
  }

  const { data, error } = await q;
  if (error) {
    // The page renders an inline error banner; throw so it surfaces.
    throw new Error(`crash_reports query failed: ${error.message}`);
  }

  // Postgrest returns the joined `users` row as an object on the
  // outer record. Lift it into the enriched flat shape the UI uses.
  return (data ?? []).map((row): CrashReportEnriched => {
    const user = (row as { users?: { username?: string | null; display_name?: string | null; avatar_photo_id?: string | null } | null }).users ?? null;
    const stripped = { ...(row as Record<string, unknown>) };
    delete stripped.users;
    return {
      ...(stripped as unknown as CrashReportRow),
      reporter_username: user?.username ?? null,
      reporter_display_name: user?.display_name ?? null,
      reporter_avatar_photo_id: user?.avatar_photo_id ?? null,
    };
  });
}

export async function getCrash(
  id: string,
): Promise<CrashReportEnriched | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crash_reports")
    .select(
      `
        *,
        users:user_id (
          username,
          display_name,
          avatar_photo_id
        )
      `,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`crash_reports row query failed: ${error.message}`);
  }
  if (!data) return null;
  const user = (data as { users?: { username?: string | null; display_name?: string | null; avatar_photo_id?: string | null } | null }).users ?? null;
  const stripped = { ...(data as Record<string, unknown>) };
  delete stripped.users;
  return {
    ...(stripped as unknown as CrashReportRow),
    reporter_username: user?.username ?? null,
    reporter_display_name: user?.display_name ?? null,
    reporter_avatar_photo_id: user?.avatar_photo_id ?? null,
  };
}

/**
 * Feedback reports linked to this crash. The link is by
 * `feedback_reports.linked_crash_id = crash_reports.sentry_event_id`
 * - the iOS form captures `SentrySDK.lastEventId` immediately
 * before submit (see `FeedbackReportFormModel.submit`). Returns
 * `[]` when nothing is linked.
 */
export async function getLinkedFeedbackForCrash(
  sentryEventId: string,
): Promise<CrashLinkedFeedback[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback_reports")
    .select("id, body, status, created_at")
    .eq("linked_crash_id", sentryEventId)
    .order("created_at", { ascending: false });
  if (error) {
    // Non-fatal - feedback link is enrichment, not core to the
    // crash detail page. Log + return empty.
    console.error("crash linked-feedback query failed", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    body_preview: previewSentence((row.body as string | null) ?? ""),
    status: row.status as string,
    created_at: row.created_at as string,
  }));
}

/**
 * Crash row matching a feedback report's `linked_crash_id` (called
 * from the existing `/feedback/[id]` page to render the "Linked
 * crash" card). Returns null when:
 *   - the feedback report has no linked_crash_id, or
 *   - the crash row hasn't landed yet (the user submitted feedback
 *     before the Sentry webhook fired).
 */
export async function getCrashForFeedback(
  feedbackReportId: string,
): Promise<CrashReportRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("crash_report_for_feedback", { p_report_id: feedbackReportId })
    .maybeSingle();
  if (error) {
    console.error("crash_report_for_feedback failed", error);
    return null;
  }
  return (data as CrashReportRow | null) ?? null;
}

function previewSentence(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= 140) return trimmed;
  return `${trimmed.slice(0, 137).trimEnd()}…`;
}
