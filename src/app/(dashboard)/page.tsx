import Link from "next/link";
import { OverviewCard, PreviewList, StatusBreakdown } from "@/components/admin/OverviewCard";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { StatsStrip, type Stat } from "@/components/admin/StatsStrip";
import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { TOOL_GROUPS } from "@/lib/admin/tools";
import { statusFor, type CuratedListStatus } from "./curated/types";

export const dynamic = "force-dynamic";

type ListQueueRow = {
  list_id: string;
  list_name: string;
  owner_username: string;
  course_count: number;
  verification_requested_at: string;
};

type CuratedRow = {
  id: string;
  name: string;
  published_at: string | null;
  unpublished_at: string | null;
  is_archived: boolean;
  updated_at: string;
};

type FeedbackPreviewRow = {
  id: string;
  kind: "bug" | "dataError" | "featureRequest" | "general";
  status: "new" | "triaged" | "inProgress" | "resolved" | "wontFix";
  severity: "low" | "medium" | "high" | "critical" | null;
  body: string;
  created_at: string;
};

type SafeguardingRow = {
  flag_id: string;
  username: string | null;
  display_name: string | null;
  flag_kind: string;
  triggered_at: string;
  state: string;
};

type PhotoRow = {
  id: string;
  exif_taken_at: string | null;
  created_at: string;
  moderation_state: "pending" | "approved" | "rejected" | "flagged";
};

type CrashRow = {
  id: string;
  level: string;
  message: string | null;
  last_seen: string;
  event_count: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isoMsAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

export default async function OverviewPage() {
  const supabase = await createClient();
  await requireAdmin();
  // Several tables have no admin SELECT policy, so the session (anon) client
  // only sees the admin's own slice — `photos` (own uploads), `users`
  // (own/public/friends), `logged_rounds` (own), `friendships` (party). Read
  // those through service-role (gated by the requireAdmin above) for true
  // platform totals; fall back to the session client when unconfigured.
  // `courses` (select_authenticated), `curated_lists`/`feedback_reports`/
  // `crash_reports` (admin-gated policies) are fine on the session client.
  const adminRead = (await tryCreateServiceClient()) ?? supabase;
  const sevenDaysAgo = isoMsAgo(WEEK_MS);

  const [
    queueRes,
    curatedRes,
    feedbackRes,
    safeguardingRes,
    photosPendingCountRes,
    photosRes,
    crashesRes,
    // Platform-health raw counts:
    usersCountRes,
    usersThisWeekRes,
    roundsCountRes,
    roundsThisWeekRes,
    coursesCountRes,
    coursesWithPolygonRes,
    friendshipsCountRes,
  ] = await Promise.all([
    supabase.rpc("admin_list_verification_queue"),
    supabase
      .from("curated_lists")
      .select("id,name,published_at,unpublished_at,is_archived,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("feedback_reports")
      .select("id, kind, status, severity, body, created_at")
      .in("status", ["new", "triaged", "inProgress"])
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .rpc("admin_safeguarding_queue", { p_state_filter: "pending", p_limit: 6 })
      .returns<SafeguardingRow[]>(),
    adminRead
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("moderation_state", "pending"),
    adminRead
      .from("photos")
      .select("id, exif_taken_at, created_at, moderation_state")
      .eq("moderation_state", "pending")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("crash_reports")
      .select("id, level, message, last_seen, event_count")
      .gte("last_seen", sevenDaysAgo)
      .order("last_seen", { ascending: false })
      .limit(5),
    adminRead.from("users").select("id", { count: "exact", head: true }),
    adminRead
      .from("users")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    adminRead.from("logged_rounds").select("id", { count: "exact", head: true }),
    adminRead
      .from("logged_rounds")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    supabase.from("courses").select("id", { count: "exact", head: true }),
    supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .not("polygon", "is", null),
    adminRead
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted"),
  ]);

  const queue: ListQueueRow[] = (queueRes.data as ListQueueRow[] | null) ?? [];
  const curated: CuratedRow[] = (curatedRes.data as CuratedRow[] | null) ?? [];
  const openFeedback: FeedbackPreviewRow[] =
    (feedbackRes.data as FeedbackPreviewRow[] | null) ?? [];
  const safeguarding: SafeguardingRow[] =
    (safeguardingRes.data as SafeguardingRow[] | null) ?? [];
  const photos: PhotoRow[] = (photosRes.data as PhotoRow[] | null) ?? [];
  const photosPending = photosPendingCountRes.count ?? 0;
  const crashes: CrashRow[] = (crashesRes.data as CrashRow[] | null) ?? [];

  const curatedByStatus = bucketCurated(curated);
  const curatedDraftCount = curatedByStatus.draft + curatedByStatus.scheduled;

  const usersTotal = usersCountRes.count ?? 0;
  const usersThisWeek = usersThisWeekRes.count ?? 0;
  const roundsTotal = roundsCountRes.count ?? 0;
  const roundsThisWeek = roundsThisWeekRes.count ?? 0;
  const coursesTotal = coursesCountRes.count ?? 0;
  const coursesWithPolygon = coursesWithPolygonRes.count ?? 0;
  const polygonCoveragePct =
    coursesTotal > 0 ? Math.round((coursesWithPolygon / coursesTotal) * 100) : 0;
  const friendshipsTotal = friendshipsCountRes.count ?? 0;

  // One calm platform-health row — the underlying data shape at a glance.
  const platformStats: Stat[] = [
    {
      key: "users",
      label: "Total users",
      value: usersTotal,
      hint:
        usersThisWeek === 0
          ? "No sign-ups this week"
          : usersThisWeek === 1
            ? "1 new this week"
            : `${usersThisWeek} new this week`,
    },
    {
      key: "rounds",
      label: "Rounds logged",
      value: roundsTotal,
      hint:
        roundsThisWeek === 0
          ? "None logged this week"
          : `${roundsThisWeek} in the last 7 days`,
    },
    {
      key: "courses",
      label: "Courses in catalogue",
      value: coursesTotal,
      hint: `${polygonCoveragePct}% with polygons`,
    },
    {
      key: "friendships",
      label: "Accepted friendships",
      value: friendshipsTotal,
      hint:
        friendshipsTotal === 0
          ? "No friendships yet"
          : "Mutual connections",
    },
  ];

  const curatedPreview = curated.slice(0, 4).map((row) => ({
    key: row.id,
    primary: row.name,
    secondary: prettyStatus(curatedStatus(row)),
    trailing: relativeTime(row.updated_at),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <SectionHeader
        eyebrow="Dashboard"
        title="Overview"
        description="The state of Vestige at a glance — what needs your attention, and the numbers underneath it."
      />

      <StatsStrip stats={platformStats} />

      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          Needs attention
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OverviewCard
            href="/feedback"
            title="Feedback"
            description="In-app reports awaiting acknowledgement. Reply, change status, tag, or block reporters."
            status="live"
            count={openFeedback.length}
            accent={openFeedback.length === 0 ? "Inbox clear" : "open"}
            ctaLabel={
              openFeedback.length === 0 ? "Open inbox" : `Triage ${openFeedback.length}`
            }
          >
            <PreviewList
              items={openFeedback.slice(0, 4).map((row) => ({
                key: row.id,
                primary: previewSentence(row.body),
                secondary: `${feedbackKindLabel(row.kind)} · ${feedbackStatusLabel(row.status)}`,
                trailing: relativeTime(row.created_at),
              }))}
              emptyLabel="No open feedback reports."
            />
          </OverviewCard>

          <OverviewCard
            href="/photos"
            title="Photo moderation"
            description="Round photos awaiting moderation before they show on course pages."
            status="live"
            count={photosPending}
            accent={photosPending === 0 ? "All clear" : "pending"}
            ctaLabel={photosPending === 0 ? "Open queue" : `Moderate ${photosPending}`}
          >
            <PreviewList
              items={photos.slice(0, 4).map((row) => ({
                key: row.id,
                primary: "Pending photo",
                secondary: row.exif_taken_at ? `taken ${relativeTime(row.exif_taken_at)}` : "no exif",
                trailing: relativeTime(row.created_at),
              }))}
              emptyLabel="No photos awaiting moderation."
            />
          </OverviewCard>

          <OverviewCard
            href="/safeguarding"
            title="Safeguarding"
            description="Heuristic flags from the round-log trigger. Triage to keep the leaderboards honest."
            status="live"
            count={safeguarding.length}
            accent={safeguarding.length === 0 ? "All clear" : "open flags"}
            ctaLabel={
              safeguarding.length === 0 ? "Open queue" : `Review ${safeguarding.length}`
            }
          >
            <PreviewList
              items={safeguarding.slice(0, 4).map((row) => ({
                key: row.flag_id,
                primary:
                  row.display_name && row.display_name.trim().length > 0
                    ? row.display_name
                    : `@${row.username ?? "unknown"}`,
                secondary: safeguardingKindLabel(row.flag_kind),
                trailing: relativeTime(row.triggered_at),
              }))}
              emptyLabel="No safeguarding flags pending."
            />
          </OverviewCard>

          <OverviewCard
            href="/crashes"
            title="Crashes"
            description="Sentry events from the past 7 days. Local index; full traces live in Sentry."
            status="live"
            count={crashes.length}
            accent={crashes.length === 0 ? "Quiet" : "past 7 days"}
            ctaLabel={crashes.length === 0 ? "Open queue" : `Open ${crashes.length}`}
          >
            <PreviewList
              items={crashes.slice(0, 4).map((row) => ({
                key: row.id,
                primary: row.message ?? "(no message)",
                secondary: `${row.level} · ${row.event_count} ${row.event_count === 1 ? "event" : "events"}`,
                trailing: relativeTime(row.last_seen),
              }))}
              emptyLabel="No crashes in the past 7 days."
            />
          </OverviewCard>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          Editorial
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OverviewCard
            href="/curated"
            title="Curated lists"
            description="Editorial collections — title, bio, cover, courses, publish state."
            status="live"
            count={curated.length}
            accent="lists total"
            ctaLabel={`Open ${curated.length} ${curated.length === 1 ? "list" : "lists"}`}
          >
            <div className="space-y-3">
              <StatusBreakdown
                segments={[
                  { key: "live", label: "Live", count: curatedByStatus.live, tone: "live" },
                  { key: "scheduled", label: "Scheduled", count: curatedByStatus.scheduled, tone: "scheduled" },
                  { key: "draft", label: "Draft", count: curatedByStatus.draft, tone: "draft" },
                  { key: "expired", label: "Expired", count: curatedByStatus.expired, tone: "expired" },
                  { key: "archived", label: "Archived", count: curatedByStatus.archived, tone: "archived" },
                ]}
              />
              <PreviewList items={curatedPreview} emptyLabel="No curated lists yet." />
            </div>
          </OverviewCard>

          <OverviewCard
            href="/announcements"
            title="Announcements"
            description="In-app pop-ups raised on launch. Author, target, and track seen / dismissed receipts."
            status="live"
            accent="messaging"
            ctaLabel="Open announcements"
          >
            <p className="rounded-lg border border-dashed border-border/70 bg-paper-sunken/50 px-3 py-4 text-center text-xs text-ink-3">
              {queue.length === 0
                ? "No public lists are awaiting verification."
                : `${queue.length} user ${queue.length === 1 ? "list is" : "lists are"} awaiting the verified stamp — see /lists.`}
            </p>
          </OverviewCard>
        </div>
      </section>

      {(queueRes.error || curatedRes.error || safeguardingRes.error) && (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-xs text-alert">
          Some live data failed to load.
          {queueRes.error && <> Verification queue: {queueRes.error.message}.</>}
          {curatedRes.error && <> Curated: {curatedRes.error.message}.</>}
          {safeguardingRes.error && <> Safeguarding: {safeguardingRes.error.message}.</>}
        </div>
      )}

      {curatedDraftCount > 0 && (
        <p className="text-center text-[11px] text-ink-3">
          {curatedDraftCount} curated list{curatedDraftCount === 1 ? "" : "s"} in
          draft / scheduled — visit{" "}
          <Link href="/curated" className="text-brand hover:underline">
            /curated
          </Link>{" "}
          to publish.
        </p>
      )}

      <details className="group rounded-xl glass-panel p-5">
        <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3 transition-colors hover:text-brand">
          Developer tools
        </summary>
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          {TOOL_GROUPS.map((group) => (
            <div key={group.key} className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.links.map((tool) => (
                  <li key={tool.href}>
                    <a
                      href={tool.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] text-ink-2 transition-colors hover:text-brand"
                    >
                      {tool.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

type CuratedBuckets = Record<CuratedListStatus, number>;

function curatedStatus(row: CuratedRow): CuratedListStatus {
  return statusFor({
    id: row.id,
    name: row.name,
    slug: "",
    description: null,
    bio: null,
    tags: [],
    region: null,
    tier: null,
    display_priority: null,
    is_ordered: false,
    cover_storage_key: null,
    published_at: row.published_at,
    unpublished_at: row.unpublished_at,
    is_archived: row.is_archived,
    created_at: row.updated_at,
    updated_at: row.updated_at,
    course_count: 0,
  });
}

function bucketCurated(rows: CuratedRow[]): CuratedBuckets {
  const buckets: CuratedBuckets = {
    draft: 0,
    scheduled: 0,
    live: 0,
    expired: 0,
    archived: 0,
  };
  for (const row of rows) {
    buckets[curatedStatus(row)] += 1;
  }
  return buckets;
}

function prettyStatus(status: CuratedListStatus): string {
  switch (status) {
    case "live":
      return "Live";
    case "scheduled":
      return "Scheduled";
    case "draft":
      return "Draft";
    case "expired":
      return "Expired";
    case "archived":
      return "Archived";
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.round(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d`;
  const diffMonths = Math.round(diffDays / 30);
  return `${diffMonths}mo`;
}

function feedbackKindLabel(kind: FeedbackPreviewRow["kind"]): string {
  switch (kind) {
    case "bug":
      return "Bug";
    case "dataError":
      return "Data error";
    case "featureRequest":
      return "Feature request";
    case "general":
      return "General";
  }
}

function feedbackStatusLabel(status: FeedbackPreviewRow["status"]): string {
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

function safeguardingKindLabel(kind: string): string {
  switch (kind) {
    case "same_day_excess":
      return "Same-day excess";
    case "impossible_geography":
      return "Impossible geography";
    case "velocity_spike":
      return "Velocity spike";
    default:
      return kind;
  }
}

function previewSentence(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= 90) return trimmed;
  return trimmed.slice(0, 87) + "…";
}
