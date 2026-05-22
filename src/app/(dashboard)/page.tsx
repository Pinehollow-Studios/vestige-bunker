import Link from "next/link";
import {
  AlertTriangle,
  BookText,
  Code2,
  Database,
  ExternalLink,
  FileTerminal,
  type LucideIcon,
  ScrollText,
  Terminal,
} from "lucide-react";
import { OverviewCard, PreviewList, StatusBreakdown } from "@/components/admin/OverviewCard";
import { StatsStrip, type Stat } from "@/components/admin/StatsStrip";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
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

type ScorecardRow = {
  id: string;
  state: "awaiting_review" | "in_review" | "approved" | "rejected";
  created_at: string;
};

type PhotoRow = {
  id: string;
  taken_at: string | null;
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
  const admin = await requireAdmin();
  const sevenDaysAgo = isoMsAgo(WEEK_MS);

  const [
    queueRes,
    curatedRes,
    feedbackRes,
    safeguardingRes,
    scorecardRes,
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
    supabase
      .from("scorecard_review_queue")
      .select("id, state, created_at")
      .in("state", ["awaiting_review", "in_review"])
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("photos")
      .select("id, taken_at, created_at, moderation_state")
      .eq("moderation_state", "pending")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("crash_reports")
      .select("id, level, message, last_seen, event_count")
      .gte("last_seen", sevenDaysAgo)
      .order("last_seen", { ascending: false })
      .limit(5),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    supabase.from("logged_rounds").select("id", { count: "exact", head: true }),
    supabase
      .from("logged_rounds")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    supabase.from("courses").select("id", { count: "exact", head: true }),
    supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .not("polygon", "is", null),
    supabase
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
  const scorecards: ScorecardRow[] = (scorecardRes.data as ScorecardRow[] | null) ?? [];
  const photos: PhotoRow[] = (photosRes.data as PhotoRow[] | null) ?? [];
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

  // Top-of-page stats — kept tight on the operational signals. Platform
  // health gets its own strip below.
  const stats: Stat[] = [
    {
      key: "verification",
      label: "Pending verifications",
      value: queue.length,
      hint:
        queue.length === 0
          ? "Queue clear"
          : queue.length === 1
            ? "1 list awaiting review"
            : `${queue.length} lists awaiting review`,
      tone: queue.length > 0 ? "attention" : "muted",
    },
    {
      key: "safeguarding",
      label: "Safeguarding flags",
      value: safeguarding.length,
      hint:
        safeguarding.length === 0
          ? "No open flags"
          : `${safeguarding.length} pending review`,
      tone: safeguarding.length > 0 ? "attention" : "muted",
    },
    {
      key: "feedback",
      label: "Open feedback",
      value: openFeedback.length,
      hint:
        openFeedback.length === 0
          ? "Inbox clear"
          : openFeedback.length === 1
            ? "1 open report"
            : `${openFeedback.length} open reports`,
      tone: openFeedback.length > 0 ? "attention" : "muted",
    },
    {
      key: "crashes-7d",
      label: "Crashes (7d)",
      value: crashes.length,
      hint: crashes.length === 0 ? "Quiet week" : "see /crashes",
      tone: crashes.length > 0 ? "attention" : "muted",
    },
  ];

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
      hint: `${coursesWithPolygon} with polygons (${polygonCoveragePct}%)`,
      tone: polygonCoveragePct < 90 ? "attention" : "default",
    },
    {
      key: "friendships",
      label: "Accepted friendships",
      value: friendshipsTotal,
      hint:
        friendshipsTotal === 0
          ? "No friendships yet"
          : "Mutual, single-row friendships",
    },
  ];

  const queuePreview = queue.slice(0, 4).map((row) => ({
    key: row.list_id,
    primary: row.list_name,
    secondary: `@${row.owner_username} · ${row.course_count} ${row.course_count === 1 ? "course" : "courses"}`,
    trailing: relativeTime(row.verification_requested_at),
  }));

  const curatedPreview = curated.slice(0, 4).map((row) => ({
    key: row.id,
    primary: row.name,
    secondary: prettyStatus(curatedStatus(row)),
    trailing: relativeTime(row.updated_at),
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <HeroGreeting
        email={admin.email}
        queueLen={queue.length}
        flagsLen={safeguarding.length}
        feedbackLen={openFeedback.length}
        usersTotal={usersTotal}
      />

      <StatsStrip stats={stats} />

      <section className="space-y-4">
        <SectionLabel
          title="Platform health"
          subtitle="At-a-glance signal on the underlying data shape."
          accent="insights"
        />
        <StatsStrip stats={platformStats} />
      </section>

      <section className="space-y-4">
        <SectionLabel
          title="Queues"
          subtitle="Time-sensitive review work — clear these first."
          accent="queues"
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <OverviewCard
            href="/lists"
            title="List verification"
            description="Public user lists awaiting the verified stamp. Approve to freeze, reject to clear and let the owner re-edit."
            status="live"
            count={queue.length}
            accent={queue.length === 0 ? "All clear" : "in queue"}
            ctaLabel={queue.length === 0 ? "Open queue" : `Review ${queue.length}`}
          >
            <PreviewList
              items={queuePreview}
              emptyLabel="No public lists are awaiting verification."
            />
          </OverviewCard>

          <OverviewCard
            href="/feedback"
            title="Feedback triage"
            description="In-app feedback and bug reports awaiting acknowledgement. Reply, change status, tag, or block reporters."
            status="live"
            count={openFeedback.length}
            accent={openFeedback.length === 0 ? "Inbox clear" : "open"}
            ctaLabel={
              openFeedback.length === 0
                ? "Open inbox"
                : `Triage ${openFeedback.length}`
            }
          >
            <PreviewList
              items={openFeedback.slice(0, 4).map((row) => ({
                key: row.id,
                primary: previewSentence(row.body),
                secondary: `${feedbackKindLabel(row.kind)} · ${feedbackStatusLabel(row.status)}${
                  row.severity ? ` · ${row.severity}` : ""
                }`,
                trailing: relativeTime(row.created_at),
              }))}
              emptyLabel="No open feedback reports."
            />
          </OverviewCard>

          <OverviewCard
            href="/safeguarding"
            title="Safeguarding"
            description="Heuristic flags (same-day excess, impossible geography, velocity spike) from the round-log trigger. Triage to keep the leaderboards honest."
            status="live"
            count={safeguarding.length}
            accent={safeguarding.length === 0 ? "All clear" : "open flags"}
            ctaLabel={
              safeguarding.length === 0
                ? "Open queue"
                : `Review ${safeguarding.length}`
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
            description="Sentry-issued events ingested via the sentry-webhook Edge Function. Local index; full traces live in Sentry."
            status="live"
            count={crashes.length}
            accent={crashes.length === 0 ? "Quiet" : "past 7 days"}
            ctaLabel={
              crashes.length === 0
                ? "Open queue"
                : `Open ${crashes.length}`
            }
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

          <OverviewCard
            href="/scorecards"
            title="Scorecard verification"
            description="Manual evidence path for rounds without GPS coverage. Reviewer confirms scorecard photo against entered scores."
            status="live"
            count={scorecards.length}
            accent={scorecards.length === 0 ? "All clear" : "to review"}
            ctaLabel={
              scorecards.length === 0
                ? "Open queue"
                : `Review ${scorecards.length}`
            }
          >
            <PreviewList
              items={scorecards.slice(0, 4).map((row) => ({
                key: row.id,
                primary: row.state === "in_review" ? "In review" : "Awaiting review",
                secondary: "Scorecard photo + entered scores",
                trailing: relativeTime(row.created_at),
              }))}
              emptyLabel="No scorecards awaiting review."
            />
          </OverviewCard>

          <OverviewCard
            href="/photos"
            title="Photo moderation"
            description="User-uploaded round + scorecard photos awaiting moderation before they show on course pages."
            status="live"
            count={photos.length}
            accent={photos.length === 0 ? "All clear" : "pending"}
            ctaLabel={
              photos.length === 0
                ? "Open queue"
                : `Moderate ${photos.length}`
            }
          >
            <PreviewList
              items={photos.slice(0, 4).map((row) => ({
                key: row.id,
                primary: "Pending photo",
                secondary: row.taken_at ? `taken ${relativeTime(row.taken_at)}` : "no exif",
                trailing: relativeTime(row.created_at),
              }))}
              emptyLabel="No photos awaiting moderation."
            />
          </OverviewCard>
        </div>
      </section>

      <section className="space-y-4">
        <SectionLabel
          title="Editorial"
          subtitle="Content under Fairways' own byline."
          accent="editorial"
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <OverviewCard
            href="/curated"
            title="Curated lists"
            description="Editorial collections — title, bio, cover, courses, publish state. What users see in the app."
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
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  Recently edited
                </p>
                <PreviewList
                  items={curatedPreview}
                  emptyLabel="No curated lists yet."
                />
              </div>
            </div>
          </OverviewCard>

          <OverviewCard
            href="/courses"
            title="Courses"
            description="Master course catalogue — search, filter, edit editorial fields (par, yards, style, established), upload hero photos."
            status="live"
            count={coursesTotal}
            accent={`${polygonCoveragePct}% polygons`}
            ctaLabel="Open catalogue"
          />
        </div>
      </section>

      <OperatorTools
        polygonGap={Math.max(coursesTotal - coursesWithPolygon, 0)}
        usersTotal={usersTotal}
      />

      {(queueRes.error || curatedRes.error || safeguardingRes.error) && (
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-xs text-alert">
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
    </div>
  );
}

/**
 * Branded hero. Sets the tone for the whole dashboard with a deep
 * Atlas paper backdrop, an editorial serif greeting, and three
 * "what's hot today" pills keyed off live counts.
 */
function HeroGreeting({
  email,
  queueLen,
  flagsLen,
  feedbackLen,
  usersTotal,
}: {
  email: string | null;
  queueLen: number;
  flagsLen: number;
  feedbackLen: number;
  usersTotal: number;
}) {
  const greeting = greetingFor(new Date());
  const name = email?.split("@")[0] ?? "admin";
  return (
    <section className="surface-aurora relative rounded-3xl px-6 py-8 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.55)] sm:px-8 sm:py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 92% 8%, color-mix(in oklab, var(--brand) 32%, transparent) 0%, transparent 45%)," +
            "radial-gradient(circle at 10% 100%, color-mix(in oklab, var(--info) 25%, transparent) 0%, transparent 55%)",
        }}
      />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-3">
            {greeting} · {todayLabel(new Date())}
          </p>
          <h1 className="display-serif text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            Welcome back,{" "}
            <span className="italic text-brand">{name}</span>.
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-ink-2">
            {summaryLine(queueLen, flagsLen, feedbackLen, usersTotal)}
          </p>
        </div>
        <ul className="flex shrink-0 flex-wrap gap-3">
          <HeroPill label="In queue" value={queueLen} highlight={queueLen > 0} />
          <HeroPill label="Flags" value={flagsLen} highlight={flagsLen > 0} tone="amber" />
          <HeroPill label="Feedback" value={feedbackLen} highlight={feedbackLen > 0} />
        </ul>
      </div>
    </section>
  );
}

function HeroPill({
  label,
  value,
  highlight,
  tone = "mint",
}: {
  label: string;
  value: number;
  highlight?: boolean;
  tone?: "mint" | "amber";
}) {
  const ringClass =
    tone === "amber"
      ? "ring-amber/55"
      : "ring-brand/55";
  return (
    <li
      className={
        "flex min-w-[120px] flex-col gap-1 rounded-2xl border border-white/10 bg-paper-sunken/70 px-4 py-3 backdrop-blur-sm" +
        (highlight ? ` ring-1 ${ringClass}` : "")
      }
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
        {label}
      </span>
      <span
        className={
          "font-hero text-3xl leading-none tabular-nums " +
          (highlight
            ? tone === "amber"
              ? "text-amber"
              : "text-brand"
            : "text-ink")
        }
      >
        {value}
      </span>
    </li>
  );
}

/**
 * Lower panel of operator-flavoured shortcuts: tools the team
 * actually opens (Supabase Studio, Sentry, Metabase, repos),
 * plus a polygon-coverage callout — the single most common data
 * hygiene job on the Fairways catalogue.
 */
function OperatorTools({
  polygonGap,
  usersTotal,
}: {
  polygonGap: number;
  usersTotal: number;
}) {
  const tools: Array<{
    href: string;
    label: string;
    description: string;
    icon: LucideIcon;
    external?: boolean;
  }> = [
    {
      href: "https://supabase.com/dashboard/project/_/sql/new",
      label: "Supabase SQL editor",
      description: "Ad-hoc queries against the live database. Read-only via `auth.uid()` policies.",
      icon: Database,
      external: true,
    },
    {
      href: "https://sentry.io/organizations/fairways/issues/",
      label: "Sentry issues",
      description: "Stack traces, breadcrumbs, release health. Webhook ingests the index here.",
      icon: AlertTriangle,
      external: true,
    },
    {
      href: "https://github.com/Fairways-app/Fairways-ios/blob/main/docs/admin-runbook.md",
      label: "Admin runbook",
      description: "Bootstrap, curated-list CRUD, polygon ingest, common queries. Source of truth.",
      icon: BookText,
      external: true,
    },
    {
      href: "https://github.com/Fairways-app/Fairways-ios",
      label: "iOS repo",
      description: "Schema lives here — every admin RPC / column starts as a migration in this tree.",
      icon: Code2,
      external: true,
    },
  ];

  return (
    <section className="space-y-4">
      <SectionLabel
        title="Operator tools"
        subtitle="Shortcuts to the systems behind the dashboard."
        accent="insights"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="surface-glass rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                Data hygiene
              </p>
              <h3 className="font-heading text-base font-semibold text-ink">
                Polygon coverage
              </h3>
              <p className="text-xs leading-relaxed text-ink-2">
                Courses without polygons don&apos;t shade on the Atlas map. The
                ingest script lives in{" "}
                <code className="rounded bg-paper-sunken px-1 py-px text-[11px] font-mono text-ink">
                  Fairways-ios/scripts/
                </code>
                .
              </p>
            </div>
            <span className="font-hero text-3xl leading-none tabular-nums text-ink">
              {polygonGap}
            </span>
          </div>
          <p className="mt-4 text-[11px] text-ink-3">
            Courses still missing a polygon. {usersTotal > 0 ? "Live users will not see these on the map." : "Will block onboarding once users are live."}
          </p>
        </div>
        <div className="surface-glass rounded-2xl p-5">
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Drop into a SQL prompt
            </p>
            <h3 className="font-heading text-base font-semibold text-ink">
              Quick snippets
            </h3>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-ink-2">
            <SnippetRow
              icon={Terminal}
              label="Verified-list leaderboard"
              snippet="select * from admin_list_verification_queue();"
            />
            <SnippetRow
              icon={FileTerminal}
              label="Safeguard queue"
              snippet="select * from admin_safeguarding_queue('pending');"
            />
            <SnippetRow
              icon={ScrollText}
              label="Active users (7d)"
              snippet={"select count(distinct user_id) from logged_rounds where created_at > now() - interval '7 days';"}
            />
          </ul>
        </div>

        {tools.map((tool) => {
          const Icon = tool.icon;
          const body = (
            <article className="group/tool surface-glass flex h-full items-start gap-3 rounded-2xl p-4 transition-all hover:-translate-y-px hover:border-brand/30">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-paper-sunken text-brand">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex items-center gap-1 font-heading text-sm font-semibold text-ink">
                  {tool.label}
                  {tool.external && (
                    <ExternalLink
                      aria-hidden
                      className="size-3 text-ink-3 transition-transform group-hover/tool:translate-x-0.5 group-hover/tool:-translate-y-0.5"
                    />
                  )}
                </p>
                <p className="text-[11px] leading-relaxed text-ink-2">
                  {tool.description}
                </p>
              </div>
            </article>
          );
          return tool.external ? (
            <a
              key={tool.href}
              href={tool.href}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              {body}
            </a>
          ) : (
            <Link key={tool.href} href={tool.href} className="block">
              {body}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SnippetRow({
  icon: Icon,
  label,
  snippet,
}: {
  icon: LucideIcon;
  label: string;
  snippet: string;
}) {
  return (
    <li className="space-y-1">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-2">
        <Icon className="size-3 text-ink-3" /> {label}
      </p>
      <code className="block overflow-x-auto rounded-md border border-border/60 bg-paper-sunken/80 px-2 py-1.5 font-mono text-[10px] text-ink">
        {snippet}
      </code>
    </li>
  );
}

function summaryLine(
  queueLen: number,
  flagsLen: number,
  feedbackLen: number,
  usersTotal: number,
): string {
  const parts: string[] = [];
  if (queueLen === 0 && flagsLen === 0 && feedbackLen === 0) {
    parts.push("All queues are clear.");
  } else {
    if (queueLen > 0) parts.push(`${queueLen} list${queueLen === 1 ? "" : "s"} waiting on verification`);
    if (flagsLen > 0) parts.push(`${flagsLen} safeguarding flag${flagsLen === 1 ? "" : "s"}`);
    if (feedbackLen > 0) parts.push(`${feedbackLen} open feedback report${feedbackLen === 1 ? "" : "s"}`);
  }
  const head = parts.join(parts.length === 3 ? ", and " : " and ");
  const tail =
    usersTotal === 0
      ? " The platform has no users yet — quiet by design."
      : ` Serving ${usersTotal.toLocaleString()} registered ${usersTotal === 1 ? "user" : "users"}.`;
  return head.endsWith(".") ? head + tail : head + "." + tail;
}

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function todayLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function SectionLabel({
  title,
  subtitle,
  accent,
}: {
  title: string;
  subtitle: string;
  accent: "queues" | "editorial" | "insights";
}) {
  const dotClass =
    accent === "queues"
      ? "bg-brand"
      : accent === "editorial"
        ? "bg-info"
        : "bg-amber";
  return (
    <div className="flex items-end justify-between gap-3 border-b border-border/60 pb-2">
      <div className="flex items-center gap-2">
        <span aria-hidden className={"size-2 rounded-full " + dotClass} />
        <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.14em] text-ink">
          {title}
        </h2>
      </div>
      <p className="hidden text-xs text-ink-3 sm:block">{subtitle}</p>
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
