import { ArrowUpRight } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { AnalyticsNav } from "@/components/admin/analytics/AnalyticsNav";
import { Reveal } from "@/components/admin/Motion";
import {
  SectionLabel,
  BarList,
  BigStat,
  FunnelBars,
  AreaChart,
  Sparkline,
  EmptyHint,
} from "@/components/admin/analytics/viz";
import Link from "next/link";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { eventLabel, DISCOVERY_SOURCE_LABEL } from "@/lib/analytics/config";
import {
  getOverview,
  getDailyActivity,
  getOnboardingFunnel,
  getDiscovery,
  getEventVolume,
} from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

/** Percent delta of `now` vs `prior`; "-" when the base is 0 and now is 0. */
function deltaPct(now: number, prior: number): number {
  if (prior > 0) return Math.round(((now - prior) / prior) * 100);
  return now > 0 ? 100 : 0;
}

export default async function AnalyticsOverviewPage() {
  const supabase = await tryCreateServiceClient();

  if (!supabase) {
    return (
      <Shell>
        <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-amber">
          Service-role key not configured - set <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> to read the
          analytics views.
        </div>
      </Shell>
    );
  }

  const [overview, daily, funnel, discovery, eventVolume] = await Promise.all([
    getOverview(supabase),
    getDailyActivity(supabase),
    getOnboardingFunnel(supabase),
    getDiscovery(supabase),
    getEventVolume(supabase),
  ]);

  if (!overview) {
    return (
      <Shell>
        <EmptyHint>
          The <code className="font-mono">analytics_overview</code> view returned no data. Confirm the analytics view
          layer is deployed to this environment.
        </EmptyHint>
      </Shell>
    );
  }

  const totalUsers = overview.total_users;

  // ── Hero pulse figures ──
  const activeDelta = deltaPct(overview.active_7d, overview.active_prior_7d);
  const optOutPct = totalUsers > 0 ? Math.round((overview.opt_out_users / totalUsers) * 100) : null;
  const sellablePct = optOutPct === null ? null : 100 - optOutPct;

  // ── Daily activity series (last 30 of the 90-day window) ──
  const last30 = daily.slice(-30);
  const activeSeries = last30.map((d) => ({ day: d.day, count: d.active_users }));
  const roundsSeries = last30.map((d) => ({ day: d.day, count: d.rounds }));
  const signupsSeries = last30.map((d) => ({ day: d.day, count: d.signups }));
  const hasDaily = last30.some((d) => d.active_users > 0 || d.rounds > 0);

  // ── Funnel (already ordered + labelled) ──
  const started = funnel.find((s) => s.step === "started")?.users ?? funnel[0]?.users ?? 0;
  const completed = funnel.find((s) => s.step === "completed")?.users ?? funnel[funnel.length - 1]?.users ?? 0;
  const activationPct = started > 0 ? Math.round((completed / started) * 100) : 0;

  // ── Discovery + feature adoption ──
  const discoveryItems = discovery.map((d) => ({
    key: d.discovery_source,
    label: DISCOVERY_SOURCE_LABEL[d.discovery_source] ?? d.discovery_source,
    value: d.plays,
    trailing: `${d.users.toLocaleString()} users`,
  }));
  const adoptionItems = eventVolume.slice(0, 8).map((e) => ({
    key: e.event_name,
    label: eventLabel(e.event_name),
    value: e.total,
    trailing: `${e.users.toLocaleString()} users`,
  }));

  return (
    <Shell>
      {/* ── Hero pulse row ── */}
      <Reveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PulseCard>
            <BigStat
              label="Active · last 7d"
              value={overview.active_7d.toLocaleString()}
              delta={{
                text: `${activeDelta >= 0 ? "+" : ""}${activeDelta}% vs prior week`,
                dir: activeDelta > 0 ? "up" : activeDelta < 0 ? "down" : "flat",
              }}
              sub={`${overview.active_30d.toLocaleString()} active in the last 30 days`}
            />
          </PulseCard>
          <PulseCard>
            <BigStat
              label="Rounds logged"
              value={overview.total_rounds.toLocaleString()}
              delta={{
                text: `+${overview.rounds_7d.toLocaleString()} this week`,
                dir: overview.rounds_7d > 0 ? "up" : "flat",
              }}
              sub="Lifetime logged rounds"
            />
          </PulseCard>
          <PulseCard>
            <BigStat
              label="New signups · 30d"
              value={overview.users_30d.toLocaleString()}
              delta={{
                text: `+${overview.users_7d.toLocaleString()} this week`,
                dir: overview.users_7d > 0 ? "up" : "flat",
              }}
              sub={`${totalUsers.toLocaleString()} users in total`}
            />
          </PulseCard>
          <PulseCard>
            <BigStat
              label="Analytics opt-out"
              value={optOutPct === null ? "-" : `${optOutPct}%`}
              sub={
                sellablePct === null
                  ? "No users yet"
                  : `Sellable cohort ${sellablePct}% · ${overview.opt_out_users.toLocaleString()} opted out`
              }
            />
          </PulseCard>
        </div>
      </Reveal>

      {/* ── Daily activity ── */}
      <Reveal delay={60}>
        <section className="space-y-4 rounded-2xl glass-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>Daily activity · 30d</SectionLabel>
            <div className="flex items-center gap-3 text-[11px] text-ink-3">
              <Legend dotClass="bg-brand" label="Active users" />
            </div>
          </div>
          {hasDaily ? (
            <>
              <AreaChart data={activeSeries} height={150} />
              <div className="grid grid-cols-2 gap-4 border-t border-rule/60 pt-4">
                <MiniSeries label="Rounds logged" total={overview.total_rounds} series={roundsSeries} />
                <MiniSeries label="New signups" total={overview.users_30d} series={signupsSeries} />
              </div>
            </>
          ) : (
            <EmptyHint>No activity recorded in the last 30 days yet.</EmptyHint>
          )}
        </section>
      </Reveal>

      {/* ── Activation funnel + discovery ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal delay={80}>
          <section className="space-y-3 rounded-xl glass-panel p-4">
            <div className="flex items-center justify-between">
              <SectionLabel>Activation funnel</SectionLabel>
              <span className="rounded-md bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand">
                {activationPct}% complete
              </span>
            </div>
            {funnel.length > 0 ? (
              <FunnelBars stages={funnel.map((s) => ({ key: s.step, label: s.label, count: s.users }))} />
            ) : (
              <EmptyHint>No onboarding events yet.</EmptyHint>
            )}
          </section>
        </Reveal>

        <Reveal delay={100}>
          <section className="space-y-3 rounded-xl glass-panel p-4">
            <SectionLabel>Where plays come from</SectionLabel>
            <p className="text-[11px] text-ink-3">Discovery source attributed at the moment of play.</p>
            <BarList items={discoveryItems} tone="brand" emptyLabel="No attributed plays yet." />
          </section>
        </Reveal>
      </div>

      {/* ── Feature adoption ── */}
      <Reveal delay={120}>
        <section className="space-y-3 rounded-xl glass-panel p-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Feature adoption · top events</SectionLabel>
            <Link href="/analytics/events" className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">
              Open explorer <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <BarList items={adoptionItems} tone="info" emptyLabel="No events recorded yet." />
        </section>
      </Reveal>
    </Shell>
  );
}

function PulseCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl glass-panel p-5">{children}</div>;
}

function Legend({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}

function MiniSeries({
  label,
  total,
  series,
}: {
  label: string;
  total: number;
  series: { day: string; count: number }[];
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">{label}</p>
        <p className="font-display text-lg leading-none tabular-nums text-ink">{total.toLocaleString()}</p>
      </div>
      <Sparkline data={series} />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader eyebrow="Insights · Analytics" title="Analytics" />
      <AnalyticsNav active="/analytics" />
      {children}
    </div>
  );
}
