import { pageShell } from "@/components/admin/PageShell";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Suspense } from "react";
import Link from "next/link";
import {
  Images,
  Megaphone,
  MessageSquareWarning,
  Rocket,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { OverviewCard, PreviewList, StatusBreakdown } from "@/components/admin/OverviewCard";
import { Sparkline } from "@/components/admin/analytics/viz";
import { Skeleton } from "@/components/admin/Skeleton";
import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getDailyActivity, getOverview } from "@/lib/analytics/queries";
import { statusFor, type CuratedListStatus } from "./curated/types";
import { currentVersion, VERSION_STATUS_LABELS, type AppVersion } from "./changelog/types";

export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const isoMsAgo = (ms: number) => new Date(Date.now() - ms).toISOString();

/**
 * Overview - a balanced digest + command center. The header (with the mantra
 * one-liner) + quick actions paint instantly; the three data sections - Pulse,
 * Needs you, Live & shipped - stream in behind their own Suspense boundaries so
 * the page never blocks on the slowest query.
 */
export default async function OverviewPage() {
  await requireAdmin();
  return (
    <div className={pageShell("wide")}>
      <Header />
      <QuickActions />

      <Section title="Pulse">
        <Suspense fallback={<PulseSkeleton />}>
          <PulseSection />
        </Suspense>
      </Section>

      <Section title="Needs you">
        <Suspense fallback={<CardsSkeleton n={4} />}>
          <NeedsYouSection />
        </Suspense>
      </Section>

      <Section title="Live & shipped">
        <Suspense fallback={<CardsSkeleton n={3} />}>
          <LiveShippedSection />
        </Suspense>
      </Section>
    </div>
  );
}

// ── Header + quick actions ─────────────────────────────────────────────
function Header() {
  return (
    <div className="space-y-2">
      <SectionHeader eyebrow="Dashboard" title="Overview" />
      <p className="max-w-2xl text-sm italic leading-relaxed text-ink-3">
        &ldquo;If you don&rsquo;t open one of our apps for a month, that is a successful outcome - for
        both of us.&rdquo;
      </p>
    </div>
  );
}

function QuickActions() {
  const actions: { href: string; label: string; icon: LucideIcon }[] = [
    { href: "/curated", label: "New curated list", icon: Sparkles },
    { href: "/announcements", label: "New announcement", icon: Megaphone },
    { href: "/changelog", label: "Cut a release", icon: Rocket },
    { href: "/feedback", label: "Triage feedback", icon: MessageSquareWarning },
    { href: "/photos", label: "Moderate photos", icon: Images },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href}
            href={a.href}
            className="inline-flex items-center gap-2 rounded-lg border border-rule/70 bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:border-brand/40 hover:text-ink"
          >
            <Icon aria-hidden className="size-3.5 text-ink-3" />
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">{title}</h2>
      {children}
    </section>
  );
}

// ── Pulse ──────────────────────────────────────────────────────────────
async function PulseSection() {
  const svc = await tryCreateServiceClient();
  const supabase = await createClient();
  const [overview, daily, curatedLiveRes] = await Promise.all([
    svc ? getOverview(svc) : Promise.resolve(null),
    svc ? getDailyActivity(svc) : Promise.resolve([]),
    supabase
      .from("curated_lists")
      .select("id", { count: "exact", head: true })
      .eq("is_archived", false)
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString()),
  ]);

  if (!overview) {
    return (
      <div className="rounded-xl border border-dashed border-rule/70 bg-paper-sunken/40 px-4 py-6 text-center text-sm text-ink-3">
        The platform pulse needs the analytics views + a service-role key for this environment.{" "}
        <Link href="/analytics" className="text-brand hover:underline">
          Open analytics
        </Link>
      </div>
    );
  }

  const series = daily.slice(-30);
  const signups = series.map((d) => ({ day: d.day, count: d.signups }));
  const rounds = series.map((d) => ({ day: d.day, count: d.rounds }));
  const active = series.map((d) => ({ day: d.day, count: d.active_users }));

  const activeDeltaPct =
    overview.active_prior_7d > 0
      ? Math.round(((overview.active_7d - overview.active_prior_7d) / overview.active_prior_7d) * 100)
      : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <PulseCard
        label="Total users"
        value={overview.total_users}
        delta={overview.users_7d > 0 ? { text: `+${overview.users_7d} this week`, dir: "up" } : undefined}
        series={signups}
      />
      <PulseCard
        label="Rounds logged"
        value={overview.total_rounds}
        delta={overview.rounds_7d > 0 ? { text: `+${overview.rounds_7d} this week`, dir: "up" } : undefined}
        series={rounds}
      />
      <PulseCard
        label="Active · 7 days"
        value={overview.active_7d}
        delta={
          activeDeltaPct === null
            ? undefined
            : { text: `${activeDeltaPct >= 0 ? "+" : ""}${activeDeltaPct}% vs prior`, dir: activeDeltaPct >= 0 ? "up" : "down" }
        }
        series={active}
      />
      <PulseCard label="Live curated lists" value={curatedLiveRes.count ?? 0} />
    </div>
  );
}

function PulseCard({
  label,
  value,
  delta,
  series,
}: {
  label: string;
  value: number;
  delta?: { text: string; dir: "up" | "down" };
  series?: { day: string; count: number }[];
}) {
  return (
    <div className="flex flex-col rounded-xl glass-panel p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">{label}</p>
      <p className="mt-1.5 font-display text-3xl font-semibold leading-none tabular-nums text-ink">
        {value.toLocaleString()}
      </p>
      {delta && (
        <span
          className={
            "mt-2 inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold " +
            (delta.dir === "up" ? "bg-brand/15 text-brand" : "bg-alert/15 text-alert")
          }
        >
          {delta.text}
        </span>
      )}
      {series && series.length > 1 && series.some((d) => d.count > 0) && (
        <div className="mt-auto pt-2">
          <Sparkline data={series} />
        </div>
      )}
    </div>
  );
}

// ── Needs you ──────────────────────────────────────────────────────────
type FeedbackPreviewRow = {
  id: string;
  kind: string;
  status: "new" | "triaged" | "inProgress" | "resolved" | "wontFix";
  body: string;
  created_at: string;
};
type SafeguardingRow = {
  flag_id: string;
  username: string | null;
  display_name: string | null;
  flag_kind: string;
  triggered_at: string;
};
type PhotoRow = { id: string; exif_taken_at: string | null; created_at: string };
type CrashRow = { id: string; level: string; message: string | null; last_seen: string; event_count: number };

async function NeedsYouSection() {
  const supabase = await createClient();
  const adminRead = (await tryCreateServiceClient()) ?? supabase;
  const sevenDaysAgo = isoMsAgo(WEEK_MS);

  const [feedbackRes, photosCountRes, photosRes, safeguardingRes, crashesRes] = await Promise.all([
    supabase
      .from("feedback_reports")
      .select("id, kind, status, body, created_at")
      .in("status", ["new", "triaged", "inProgress"])
      .order("created_at", { ascending: false })
      .limit(8),
    adminRead.from("photos").select("id", { count: "exact", head: true }).eq("moderation_state", "pending"),
    adminRead
      .from("photos")
      .select("id, exif_taken_at, created_at")
      .eq("moderation_state", "pending")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .rpc("admin_safeguarding_queue", { p_state_filter: "pending", p_limit: 6 })
      .returns<SafeguardingRow[]>(),
    supabase
      .from("crash_reports")
      .select("id, level, message, last_seen, event_count")
      .gte("last_seen", sevenDaysAgo)
      .order("last_seen", { ascending: false })
      .limit(5),
  ]);

  const openFeedback = (feedbackRes.data as FeedbackPreviewRow[] | null) ?? [];
  const photosPending = photosCountRes.count ?? 0;
  const photos = (photosRes.data as PhotoRow[] | null) ?? [];
  const safeguarding = (safeguardingRes.data as SafeguardingRow[] | null) ?? [];
  const crashes = (crashesRes.data as CrashRow[] | null) ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <OverviewCard
        href="/feedback"
        title="Feedback"
        description="In-app reports. Triage in the live inbox - reply, stage, prioritise."
        status="live"
        count={openFeedback.length}
        accent={openFeedback.length === 0 ? "Inbox clear" : "open"}
        ctaLabel={openFeedback.length === 0 ? "Open inbox" : `Triage ${openFeedback.length}`}
      >
        <PreviewList
          items={openFeedback.slice(0, 4).map((r) => ({
            key: r.id,
            primary: previewSentence(r.body),
            secondary: `${feedbackKindLabel(r.kind)} · ${feedbackStatusLabel(r.status)}`,
            trailing: relativeTime(r.created_at),
          }))}
          emptyLabel="No open feedback."
        />
      </OverviewCard>

      <OverviewCard
        href="/photos"
        title="Photo moderation"
        description="Round, avatar, and public course-gallery photos awaiting review."
        status="live"
        count={photosPending}
        accent={photosPending === 0 ? "All clear" : "pending"}
        ctaLabel={photosPending === 0 ? "Open queue" : `Moderate ${photosPending}`}
      >
        <PreviewList
          items={photos.slice(0, 4).map((r) => ({
            key: r.id,
            primary: "Pending photo",
            secondary: r.exif_taken_at ? `taken ${relativeTime(r.exif_taken_at)}` : "no exif",
            trailing: relativeTime(r.created_at),
          }))}
          emptyLabel="Nothing to moderate."
        />
      </OverviewCard>

      <OverviewCard
        href="/safeguarding"
        title="Safeguarding"
        description="Heuristic flags from the round-log trigger. Keep the boards honest."
        status="live"
        count={safeguarding.length}
        accent={safeguarding.length === 0 ? "All clear" : "open flags"}
        ctaLabel={safeguarding.length === 0 ? "Open queue" : `Review ${safeguarding.length}`}
      >
        <PreviewList
          items={safeguarding.slice(0, 4).map((r) => ({
            key: r.flag_id,
            primary: r.display_name?.trim() || `@${r.username ?? "unknown"}`,
            secondary: safeguardingKindLabel(r.flag_kind),
            trailing: relativeTime(r.triggered_at),
          }))}
          emptyLabel="No flags pending."
        />
      </OverviewCard>

      <OverviewCard
        href="/crashes"
        title="Crashes"
        description="Sentry events from the past 7 days. Full traces live in Sentry."
        status="live"
        count={crashes.length}
        accent={crashes.length === 0 ? "Quiet" : "past 7 days"}
        ctaLabel={crashes.length === 0 ? "Open queue" : `Open ${crashes.length}`}
      >
        <PreviewList
          items={crashes.slice(0, 4).map((r) => ({
            key: r.id,
            primary: r.message ?? "(no message)",
            secondary: `${r.level} · ${r.event_count} ${r.event_count === 1 ? "event" : "events"}`,
            trailing: relativeTime(r.last_seen),
          }))}
          emptyLabel="No crashes in the past 7 days."
        />
      </OverviewCard>
    </div>
  );
}

// ── Live & shipped ─────────────────────────────────────────────────────
type CuratedRow = {
  id: string;
  name: string;
  published_at: string | null;
  unpublished_at: string | null;
  is_archived: boolean;
  updated_at: string;
};

async function LiveShippedSection() {
  const supabase = await createClient();
  const [curatedRes, announcementsRes, versionsRes] = await Promise.all([
    supabase
      .from("curated_lists")
      .select("id,name,published_at,unpublished_at,is_archived,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("is_archived", false)
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString()),
    supabase
      .from("app_versions")
      .select("id, version, major, minor, patch, title, summary, status, released_at, created_at, updated_at")
      .order("major", { ascending: false })
      .order("minor", { ascending: false })
      .order("patch", { ascending: false }),
  ]);

  const curated = (curatedRes.data as CuratedRow[] | null) ?? [];
  const buckets = bucketCurated(curated);
  const versions = (versionsRes.data as AppVersion[] | null) ?? [];
  const current = currentVersion(versions);
  const activeDraft = versions.find((v) => v.status === "draft") ?? null;
  const announcementsLive = announcementsRes.count ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <OverviewCard
        href="/curated"
        title="Curated lists"
        description="Editorial collections - title, bio, cover, courses, publish state."
        status="live"
        count={curated.length}
        accent="lists total"
        ctaLabel={`Open ${curated.length} ${curated.length === 1 ? "list" : "lists"}`}
      >
        <div className="space-y-3">
          <StatusBreakdown
            segments={[
              { key: "live", label: "Live", count: buckets.live, tone: "live" },
              { key: "scheduled", label: "Scheduled", count: buckets.scheduled, tone: "scheduled" },
              { key: "draft", label: "Draft", count: buckets.draft, tone: "draft" },
              { key: "expired", label: "Expired", count: buckets.expired, tone: "expired" },
              { key: "archived", label: "Archived", count: buckets.archived, tone: "archived" },
            ]}
          />
          <PreviewList
            items={curated.slice(0, 4).map((r) => ({
              key: r.id,
              primary: r.name,
              secondary: prettyStatus(curatedStatus(r)),
              trailing: relativeTime(r.updated_at),
            }))}
            emptyLabel="No curated lists yet."
          />
        </div>
      </OverviewCard>

      <OverviewCard
        href="/announcements"
        title="Announcements"
        description="In-app pop-ups raised on launch. Author, target, track receipts."
        status="live"
        count={announcementsLive}
        accent={announcementsLive === 0 ? "none live" : "live now"}
        ctaLabel="Open announcements"
      >
        <p className="rounded-lg border border-dashed border-border/70 bg-paper-sunken/50 px-3 py-4 text-center text-xs text-ink-3">
          {announcementsLive === 0
            ? "No announcements are live right now."
            : `${announcementsLive} announcement${announcementsLive === 1 ? "" : "s"} live across targeted cohorts.`}
        </p>
      </OverviewCard>

      <OverviewCard
        href="/changelog"
        title="Changelog"
        description="What shipped in each release - and the bugs each version tackled."
        status="live"
        accent={
          activeDraft
            ? `v${activeDraft.version} in development`
            : current
              ? `v${current.version} current`
              : "no releases"
        }
        ctaLabel="Open changelog"
      >
        <PreviewList
          items={versions.slice(0, 4).map((v) => ({
            key: v.id,
            primary: `v${v.version}`,
            secondary: v.title ?? VERSION_STATUS_LABELS[v.status],
            trailing: v.released_at ? relativeTime(v.released_at) : "draft",
          }))}
          emptyLabel="No versions tracked yet."
        />
      </OverviewCard>
    </div>
  );
}

// ── Skeletons ──────────────────────────────────────────────────────────
function PulseSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}
function CardsSkeleton({ n }: { n: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-44 rounded-xl" />
      ))}
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────
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
  const b: CuratedBuckets = { draft: 0, scheduled: 0, live: 0, expired: 0, archived: 0 };
  for (const row of rows) b[curatedStatus(row)] += 1;
  return b;
}
function prettyStatus(status: CuratedListStatus): string {
  return status[0].toUpperCase() + status.slice(1);
}
function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.round(days / 30)}mo`;
}
function feedbackKindLabel(kind: string): string {
  switch (kind) {
    case "bug":
      return "Bug";
    case "dataError":
      return "Data error";
    case "featureRequest":
      return "Feature request";
    case "crash":
      return "Crash";
    case "visualGlitch":
      return "Visual glitch";
    case "performance":
      return "Performance";
    case "confusingUX":
      return "Confusing UX";
    default:
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
    case "first_county_completion":
      return "First county completion";
    default:
      return kind;
  }
}
function previewSentence(body: string): string {
  const t = body.trim();
  return t.length <= 90 ? t : t.slice(0, 87) + "…";
}
