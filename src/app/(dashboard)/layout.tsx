import { Sidebar } from "@/components/admin/Sidebar";
import { TopBar } from "@/components/admin/TopBar";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";

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

  // Lightweight counts in parallel for sidebar badges. Each result
  // is independently nullable — a failed query just hides the
  // matching pip. None of these are blocking critical-path data.
  const supabase = await createClient();
  const [
    queueRes,
    curatedRes,
    coursesRes,
    feedbackRes,
    photosRes,
    scorecardsRes,
    safeguardingRes,
    usersRes,
    crashesRes,
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
      .from("scorecard_review_queue")
      .select("id", { count: "exact", head: true })
      .in("state", ["awaiting_review", "in_review"]),
    supabase
      .from("safeguarding_flags")
      .select("id", { count: "exact", head: true })
      .eq("state", "pending"),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("crash_reports")
      .select("id", { count: "exact", head: true })
      .gte("last_seen", sevenDaysAgoIso()),
  ]);

  const counts = {
    verification: Array.isArray(queueRes.data) ? queueRes.data.length : 0,
    curated: curatedRes.count ?? 0,
    courses: coursesRes.count ?? 0,
    feedback: feedbackRes.count ?? 0,
    photos: photosRes.count ?? 0,
    scorecards: scorecardsRes.count ?? 0,
    safeguarding: safeguardingRes.count ?? 0,
    users: usersRes.count ?? 0,
    crashes: crashesRes.count ?? 0,
  };

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar counts={counts} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar email={admin.email} role={admin.role} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
