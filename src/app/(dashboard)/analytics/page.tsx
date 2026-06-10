import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowUpRight, Database } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { StatsStrip, type Stat } from "@/components/admin/StatsStrip";
import { AnalyticsNav } from "@/components/admin/analytics/AnalyticsNav";
import { EventFeed } from "@/components/admin/analytics/EventFeed";
import { HeroSwitcher, type HeroData, type Hero } from "@/components/admin/analytics/HeroSwitcher";
import { SectionLabel, BarList, ProportionBar } from "@/components/admin/analytics/viz";
import { cn } from "@/lib/utils";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { eventLabel, DISCOVERY_SOURCE_LABEL } from "@/lib/analytics/config";
import {
  getPlatformStats,
  getEvents,
  getSignupSeries,
  getB2BConversion,
  rollupOnboardingFunnel,
  rollupDAU,
  rollupVolume,
  rollupDiscovery,
  rollupByVersion,
  activeUsersInWindow,
  activeUsersPriorWindow,
  isoDaysAgo,
} from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

const HEROES: readonly string[] = ["pulse", "activation", "growth", "health"];

function relTime(iso?: string): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function AnalyticsOverviewPage() {
  const supabase = await tryCreateServiceClient();
  const cookieStore = await cookies();
  const heroPref = cookieStore.get("analytics_hero")?.value;
  const initialHero: Hero = HEROES.includes(heroPref ?? "") ? (heroPref as Hero) : "pulse";

  if (!supabase) {
    return (
      <Shell>
        <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-amber">
          Service-role key not configured — set <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> to read the
          analytics tables.
        </div>
      </Shell>
    );
  }

  const [stats, events30, signups14, conversion] = await Promise.all([
    getPlatformStats(supabase),
    getEvents(supabase, { sinceIso: isoDaysAgo(30), limit: 10000 }),
    getSignupSeries(supabase, 14),
    getB2BConversion(supabase),
  ]);

  // ── Hero datasets (all four lenses; the switcher picks one) ──
  const dau14 = rollupDAU(events30, 14);
  const active7d = activeUsersInWindow(events30, 7);
  const prior7d = activeUsersPriorWindow(events30, 7);
  const deltaPct = prior7d > 0 ? Math.round(((active7d - prior7d) / prior7d) * 100) : active7d > 0 ? 100 : 0;
  const dauToday = dau14[dau14.length - 1]?.count ?? 0;
  const dauPeak = Math.max(...dau14.map((d) => d.count), 0);

  const funnel = rollupOnboardingFunnel(events30);
  const started = funnel[0]?.count ?? 0;
  const completed = funnel[funnel.length - 1]?.count ?? 0;
  const firstMarker = new Set(
    events30.filter((r) => r.event_name === "course_marked_played" && r.user_id).map((r) => r.user_id),
  ).size;

  const since7 = isoDaysAgo(7);
  const events7d = events30.filter((r) => r.created_at >= since7).length;
  const versions = rollupByVersion(events30)
    .slice(0, 5)
    .map((v) => ({ key: v.key, label: v.label, value: v.count }));

  const heroData: HeroData = {
    initial: initialHero,
    pulse: {
      active7d,
      delta: {
        text: `${deltaPct >= 0 ? "+" : ""}${deltaPct}% vs prior week`,
        dir: deltaPct > 0 ? "up" : deltaPct < 0 ? "down" : "flat",
      },
      sub: `${dauToday} active today · peak ${dauPeak}`,
      series: dau14,
    },
    activation: {
      firstMarker,
      completionPct: started > 0 ? Math.round((completed / started) * 100) : 0,
      stages: funnel,
    },
    growth: { total: stats.users, week: stats.usersWeek, series: signups14 },
    health: { eventsToday: stats.eventsToday, lastEventAgo: relTime(events30[0]?.created_at), events7d, versions },
  };

  // ── Supporting sections ──
  const metricStats: Stat[] = [
    { key: "users", label: "Total users", value: stats.users, hint: `+${stats.usersWeek} this week` },
    { key: "events", label: "Events", value: stats.events, hint: `${stats.eventsToday} today`, tone: "attention" },
    { key: "rounds", label: "Rounds", value: stats.rounds, hint: `+${stats.roundsWeek} this week` },
    { key: "played", label: "Played markers", value: stats.playedMarkers, hint: "Lifetime plays" },
  ];
  const topActions = rollupVolume(events30)
    .slice(0, 6)
    .map((v) => ({ key: v.key, label: eventLabel(v.key), value: v.count }));
  const discovery = rollupDiscovery(events30)
    .slice(0, 5)
    .map((d) => ({ label: DISCOVERY_SOURCE_LABEL[d.key] ?? d.key, value: d.count }));
  const recent = events30.slice(0, 6);

  return (
    <Shell>
      <HeroSwitcher {...heroData} />

      <StatsStrip stats={metricStats} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl glass-panel p-4">
          <SectionLabel>Top actions · 30d</SectionLabel>
          <BarList items={topActions} emptyLabel="No events in the window yet." />
        </section>
        <section className="space-y-3 rounded-xl glass-panel p-4">
          <SectionLabel>How users find courses</SectionLabel>
          <ProportionBar segments={discovery} />
        </section>
      </div>

      <Link href="/analytics/b2b" className="block rounded-xl glass-panel p-4 transition-colors hover:border-brand">
        <div className="flex items-center justify-between">
          <SectionLabel>B2B signal · bucket → played</SectionLabel>
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-3">
            Full preview <ArrowUpRight className="size-3" />
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-x-10 gap-y-3">
          <InlineStat value={`${Math.round(conversion.rate * 100)}%`} label="Conversion rate" big />
          <InlineStat value={conversion.bucketed.toLocaleString()} label="Bucket-listed" />
          <InlineStat value={conversion.converted.toLocaleString()} label="Converted to played" />
          <InlineStat value={conversion.users.toLocaleString()} label="Contributing users" />
        </div>
      </Link>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Recent activity</SectionLabel>
          <Link href="/analytics/events" className="text-[11px] font-semibold text-brand hover:underline">
            Open explorer →
          </Link>
        </div>
        <EventFeed
          rows={recent}
          emptyLabel="No events yet. They appear once the instrumented app runs (Debug → dev, or a shipped build → prod)."
        />
      </section>

      <a
        href="https://supabase.com/dashboard/project/_/sql/new"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 text-[11px] text-ink-3 hover:text-ink-2"
      >
        <Database className="size-3.5" />
        Drill deeper in the Supabase SQL editor · Metabase embeds here when NEXT_PUBLIC_METABASE_DASHBOARD_URL is set
      </a>
    </Shell>
  );
}

function InlineStat({ value, label, big }: { value: string; label: string; big?: boolean }) {
  return (
    <div>
      <p
        className={cn(
          "font-display leading-none tabular-nums",
          big ? "text-4xl text-brand" : "text-2xl text-ink",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-ink-3">{label}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader
        eyebrow="Insights · Analytics"
        title="Analytics"
        description="The app at a glance. Switch the hero to the lens you care about — it sticks."
      />
      <AnalyticsNav active="/analytics" />
      {children}
    </div>
  );
}
