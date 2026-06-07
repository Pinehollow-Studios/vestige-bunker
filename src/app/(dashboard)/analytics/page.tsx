import { BarChart3, Database, ExternalLink, FileTerminal } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function isoMsAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

/**
 * Analytics surface. The long-term plan (CLAUDE.md §3) is to embed
 * Metabase here; this page renders that embed when
 * NEXT_PUBLIC_METABASE_DASHBOARD_URL is set, and otherwise gives
 * devs a useful holding page: live first-cut counts pulled straight
 * from Supabase, deep-links to the SQL editor, and a starter library
 * of queries.
 */
export default async function AnalyticsPage() {
  const metabaseUrl = process.env.NEXT_PUBLIC_METABASE_DASHBOARD_URL;
  const supabase = await createClient();
  // These are platform-wide totals, but `users` / `logged_rounds` /
  // `played_markers` / `photos` / `friendships` / `bucket_list_items` are all
  // own-scoped under RLS (no admin SELECT policy), so the session client would
  // only count the admin's own rows. Read via service-role (gated by the
  // layout's requireAdmin) for true counts; fall back to the session client
  // when unconfigured.
  const adminRead = (await tryCreateServiceClient()) ?? supabase;
  const weekAgo = isoMsAgo(WEEK_MS);
  const monthAgo = isoMsAgo(MONTH_MS);

  const [
    usersTotalRes,
    usersWeekRes,
    roundsTotalRes,
    roundsWeekRes,
    roundsMonthRes,
    playedTotalRes,
    photosTotalRes,
    friendsTotalRes,
    bucketTotalRes,
  ] = await Promise.all([
    adminRead.from("users").select("id", { count: "exact", head: true }),
    adminRead
      .from("users")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo),
    adminRead.from("logged_rounds").select("id", { count: "exact", head: true }),
    adminRead
      .from("logged_rounds")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo),
    adminRead
      .from("logged_rounds")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthAgo),
    adminRead.from("played_markers").select("id", { count: "exact", head: true }),
    adminRead.from("photos").select("id", { count: "exact", head: true }),
    adminRead
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted"),
    adminRead.from("bucket_list_items").select("user_id", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Users", value: usersTotalRes.count ?? 0, hint: `+${usersWeekRes.count ?? 0} this week` },
    { label: "Played markers", value: playedTotalRes.count ?? 0, hint: "All-time plays" },
    { label: "Bucket list", value: bucketTotalRes.count ?? 0, hint: "Wants-to-play markers" },
    { label: "Photos", value: photosTotalRes.count ?? 0, hint: "All-time uploads" },
    {
      label: "Rounds (all-time)",
      value: roundsTotalRes.count ?? 0,
      hint: `${roundsMonthRes.count ?? 0} in last 30d`,
    },
    {
      label: "Rounds (7d)",
      value: roundsWeekRes.count ?? 0,
      hint: "Created in the last week",
    },
    {
      label: "Friendships",
      value: friendsTotalRes.count ?? 0,
      hint: "Accepted (mutual)",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        eyebrow="Insights · Analytics"
        title="Analytics"
        description="Live first-cut counts from the database, with the Metabase embed taking over once it's configured."
      />

      {metabaseUrl ? (
        <div className="overflow-hidden rounded-xl glass-panel">
          <iframe
            src={metabaseUrl}
            className="h-[720px] w-full"
            allowTransparency
            title="Metabase dashboard"
          />
        </div>
      ) : (
        <div className="rounded-xl glass-panel p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
              <BarChart3 className="size-4" />
            </span>
            <div className="space-y-1">
              <p className="font-display text-base text-ink">
                Metabase embed not configured
              </p>
              <p className="text-xs leading-relaxed text-ink-2">
                Set{" "}
                <code className="rounded bg-paper-sunken px-1 py-px font-mono text-[11px]">
                  NEXT_PUBLIC_METABASE_DASHBOARD_URL
                </code>{" "}
                in the Vercel project to embed a dashboard. Until then, the
                live counts and SQL snippets below cover the most-asked
                questions.
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          First-cut counts
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl glass-panel p-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                {stat.label}
              </p>
              <p className="mt-2 font-display text-3xl leading-none tabular-nums text-ink">
                {stat.value.toLocaleString()}
              </p>
              {stat.hint && (
                <p className="mt-2 text-[11px] text-ink-3">{stat.hint}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          Starter queries
        </h2>
        <p className="text-xs text-ink-3">
          Paste into the Supabase SQL editor. Every query respects RLS;
          run as the admin role to read across users.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QueryCard
            title="DAU (last 7 days)"
            sql={"select date_trunc('day', created_at)::date as day,\n       count(distinct user_id) as dau\nfrom logged_rounds\nwhere created_at > now() - interval '7 days'\ngroup by 1 order by 1;"}
          />
          <QueryCard
            title="Top courses by plays"
            sql={"select c.name, count(*) as plays\nfrom logged_rounds lr\njoin courses c on c.id = lr.course_id\ngroup by c.id, c.name\norder by plays desc limit 20;"}
          />
          <QueryCard
            title="Polygon-missing catalogue"
            sql={"select id, name, slug from courses where polygon is null order by name;"}
          />
          <QueryCard
            title="Verified-list leaderboard"
            sql={"select * from admin_list_verification_queue();"}
          />
          <QueryCard
            title="County completion (per user)"
            sql={"select u.username, county_completion(u.id);"}
          />
          <QueryCard
            title="Friend-graph density"
            sql={"select count(*) filter (where status = 'accepted') as accepted,\n       count(*) filter (where status = 'pending')  as pending\nfrom friendships;"}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          Jump to a tool
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ExternalCard
            href="https://supabase.com/dashboard/project/_/sql/new"
            label="Supabase SQL editor"
            description="Author and save ad-hoc queries. Use the saved-queries panel for the team library."
            icon={<Database className="size-4" />}
          />
          <ExternalCard
            href="https://supabase.com/dashboard/project/_/database/tables"
            label="Supabase table editor"
            description="Browse rows, inspect indexes, check RLS policies."
            icon={<FileTerminal className="size-4" />}
          />
        </div>
      </section>
    </div>
  );
}

function QueryCard({ title, sql }: { title: string; sql: string }) {
  return (
    <div className="rounded-xl glass-panel p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        {title}
      </p>
      <pre className="mt-2 overflow-x-auto rounded-lg border border-rule/60 bg-paper-sunken/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink">
{sql}
      </pre>
    </div>
  );
}

function ExternalCard({
  href,
  label,
  description,
  icon,
}: {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-start gap-3 rounded-xl glass-panel p-4 transition-colors hover:border-brand"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex items-center gap-1 font-display text-base text-ink">
          {label}
          <ExternalLink aria-hidden className="size-3 text-ink-3" />
        </p>
        <p className="text-[11px] leading-relaxed text-ink-2">{description}</p>
      </div>
    </a>
  );
}
