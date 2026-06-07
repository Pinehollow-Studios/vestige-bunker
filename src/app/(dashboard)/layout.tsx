import { cookies } from "next/headers";
import { FlaskConical } from "lucide-react";
import { Sidebar } from "@/components/admin/Sidebar";
import { TopBar } from "@/components/admin/TopBar";
import { AuroraBackdrop, ScrollProgress } from "@/components/admin/Motion";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { activeEnvKey, DEV_SWITCH_ENABLED, ENV_COOKIE } from "@/lib/supabase/env";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function sevenDaysAgoIso(): string {
  return new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const env = activeEnvKey((await cookies()).get(ENV_COOKIE)?.value);

  // Lightweight counts in parallel for sidebar badges. Each result
  // is independently nullable — a failed query just hides the
  // matching pip. None of these are blocking critical-path data.
  const supabase = await createClient();
  // The users count is read through the service-role client when available:
  // `public.users` has no admin SELECT policy, so the anon session would
  // undercount to only public/friend profiles. Falls back to the session
  // client when service-role isn't configured (pill just shows the slice).
  const svc = await tryCreateServiceClient();
  const usersClient = svc ?? supabase;
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
  ] = await Promise.all([
    supabase.rpc("admin_list_verification_queue"),
    supabase
      .from("curated_lists")
      .select("id", { count: "exact", head: true })
      .eq("is_archived", false),
    supabase
      .from("courses")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("feedback_reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "triaged", "inProgress"]),
    supabase
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("moderation_state", "pending"),
    supabase
      .from("safeguarding_flags")
      .select("id", { count: "exact", head: true })
      .eq("state", "pending"),
    usersClient
      .from("users")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("crash_reports")
      .select("id", { count: "exact", head: true })
      .gte("last_seen", sevenDaysAgoIso()),
    // Live announcements pill — published, not archived. The announcements
    // tables may not exist in this env yet (prod before Tom's deploy); a
    // missing-table query returns { count: null } here rather than throwing,
    // so the pill silently hides — same resilience as every other count.
    supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("is_archived", false)
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString()),
  ]);

  const counts = {
    verification: Array.isArray(queueRes.data) ? queueRes.data.length : 0,
    curated: curatedRes.count ?? 0,
    courses: coursesRes.count ?? 0,
    feedback: feedbackRes.count ?? 0,
    photos: photosRes.count ?? 0,
    safeguarding: safeguardingRes.count ?? 0,
    users: usersRes.count ?? 0,
    crashes: crashesRes.count ?? 0,
    announcements: announcementsRes.count ?? 0,
  };

  return (
    <div className="relative min-h-dvh">
      {/* Animated aurora behind everything; glass surfaces float over it.
          Content sits at z-10; the fixed sidebar at z-30. */}
      <AuroraBackdrop />
      <ScrollProgress />
      {/* Sidebar is position:fixed at lg+; the right column gets
          `lg:pl-64` to compensate so the main content never slides
          under it. On <lg the sidebar is hidden entirely. */}
      <Sidebar counts={counts} adminRole={admin.role} />
      <div className="relative z-10 flex min-h-dvh min-w-0 flex-col lg:pl-64">
        <TopBar admin={admin} env={env} devSwitchEnabled={DEV_SWITCH_ENABLED} />
        {DEV_SWITCH_ENABLED && env === "dev" && (
          <div className="flex items-start gap-3 border-b border-amber/40 bg-amber/10 px-6 py-2.5 text-xs text-amber">
            <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p className="leading-relaxed">
              <strong className="font-semibold">Developer dev view.</strong> You&apos;re on the DEV
              database, not the live app — changes here do not affect TestFlight users. Switch back
              to prod from the toggle when you&apos;re done.
            </p>
          </div>
        )}
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
