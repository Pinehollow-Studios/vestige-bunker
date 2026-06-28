import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { FEEDBACK_ACTIVE_WORK_STAGES } from "@/lib/feedback/types";

export type DashboardCounts = {
  verification: number;
  curated: number;
  courses: number;
  feedback: number;
  photos: number;
  safeguarding: number;
  users: number;
  crashes: number;
  announcements: number;
  changelog: number;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The sidebar / mobile-drawer badge counts.
 *
 * Wrapped in React `cache()` so the streamed Sidebar and the streamed TopBar
 * (both await this within the same render) share ONE execution - no double
 * round-trip. These are non-critical chrome decoration: a failed query just
 * hides the matching pip, never blocks a page. The dashboard layout streams
 * this behind a Suspense boundary so page content paints without waiting on it.
 */
export const getDashboardCounts = cache(async (): Promise<DashboardCounts> => {
  const supabase = await createClient();
  // `public.users` / `public.photos` have no admin SELECT policy, so the anon
  // session undercounts. Read those through service-role when configured; fall
  // back to the session client (pips just show the visible slice) otherwise.
  const svc = await tryCreateServiceClient();
  const adminRead = svc ?? supabase;
  const sevenDaysAgoIso = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
  const nowIso = new Date().toISOString();

  const [
    queueRes,
    curatedRes,
    coursesRes,
    feedbackRes,
    photosRes,
    safeguardingRes,
    usersRes,
    crashesRes,
    announcementsRes,
    changelogRes,
  ] = await Promise.all([
    // Public user lists awaiting the verified stamp. The old
    // admin_list_verification_queue() RPC was dropped (PII-drop migration), so
    // count the table directly through service-role.
    adminRead
      .from("user_lists")
      .select("id", { count: "exact", head: true })
      .not("verification_requested_at", "is", null)
      .is("verified_at", null),
    supabase
      .from("curated_lists")
      .select("id", { count: "exact", head: true })
      .eq("is_archived", false),
    supabase.from("courses").select("id", { count: "exact", head: true }),
    supabase
      .from("feedback_reports")
      .select("id", { count: "exact", head: true })
      .in("work_stage", FEEDBACK_ACTIVE_WORK_STAGES),
    adminRead
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("moderation_state", "pending"),
    supabase
      .from("safeguarding_flags")
      .select("id", { count: "exact", head: true })
      .eq("state", "pending"),
    adminRead.from("users").select("id", { count: "exact", head: true }),
    supabase
      .from("crash_reports")
      .select("id", { count: "exact", head: true })
      .gte("last_seen", sevenDaysAgoIso),
    supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("is_archived", false)
      .not("published_at", "is", null)
      .lte("published_at", nowIso),
    supabase
      .from("app_versions")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
  ]);

  return {
    verification: queueRes.count ?? 0,
    curated: curatedRes.count ?? 0,
    courses: coursesRes.count ?? 0,
    feedback: feedbackRes.count ?? 0,
    photos: photosRes.count ?? 0,
    safeguarding: safeguardingRes.count ?? 0,
    users: usersRes.count ?? 0,
    crashes: crashesRes.count ?? 0,
    announcements: announcementsRes.count ?? 0,
    changelog: changelogRes.count ?? 0,
  };
});
