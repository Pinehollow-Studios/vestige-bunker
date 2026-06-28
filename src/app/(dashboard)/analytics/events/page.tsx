import Link from "next/link";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { AnalyticsNav } from "@/components/admin/analytics/AnalyticsNav";
import { EventFeed } from "@/components/admin/analytics/EventFeed";
import { Reveal } from "@/components/admin/Motion";
import { SectionLabel, MetricCard, AreaChart, BarList, EmptyHint } from "@/components/admin/analytics/viz";
import { cn } from "@/lib/utils";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { eventLabel, eventGroup, GROUP_LABEL, type EventGroup } from "@/lib/analytics/config";
import {
  getEvents,
  getOverview,
  getDailyActivity,
  getEventVolume,
  isoDaysAgo,
  type EventVolumeRow,
} from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

const FEED_LIMIT = 200;

function relTime(iso?: string | null): string {
  if (!iso) return "-";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const GROUP_ORDER: EventGroup[] = ["onboarding", "discovery", "play", "social", "lifecycle", "other"];

export default async function EventExplorerPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event } = await searchParams;
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

  const [feed, overview, daily, volume] = await Promise.all([
    getEvents(supabase, { sinceIso: isoDaysAgo(30), eventName: event, limit: FEED_LIMIT }),
    getOverview(supabase),
    getDailyActivity(supabase),
    getEventVolume(supabase),
  ]);

  const last30 = daily.slice(-30);
  const eventsSeries = last30.map((d) => ({ day: d.day, count: d.events }));
  const hasEvents = last30.some((d) => d.events > 0);
  const totalEvents = volume.reduce((s, v) => s + v.total, 0);

  // Group the volume table by event group, group order then volume order.
  const grouped: { group: EventGroup; rows: EventVolumeRow[] }[] = GROUP_ORDER.map((group) => ({
    group,
    rows: volume.filter((v) => eventGroup(v.event_name) === group),
  })).filter((g) => g.rows.length > 0);

  return (
    <Shell>
      <Reveal>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Events · all time" value={(overview?.total_events ?? totalEvents).toLocaleString()} tone="brand" />
          <MetricCard label="Events today" value={(overview?.events_today ?? 0).toLocaleString()} />
          <MetricCard label="Event types" value={volume.length.toLocaleString()} />
          <MetricCard label="Last event" value={relTime(feed[0]?.created_at)} />
        </div>
      </Reveal>

      <Reveal delay={60}>
        <section className="space-y-2 rounded-xl glass-panel p-4">
          <SectionLabel>Events per day · 30d</SectionLabel>
          {hasEvents ? <AreaChart data={eventsSeries} height={130} /> : <EmptyHint>No events in the window yet.</EmptyHint>}
        </section>
      </Reveal>

      <Reveal delay={80}>
        <section className="space-y-3">
          <SectionLabel>Filter by event</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip href="/analytics/events" label="All" active={!event} />
            {volume.map((v) => (
              <FilterChip
                key={v.event_name}
                href={`/analytics/events?event=${encodeURIComponent(v.event_name)}`}
                label={`${eventLabel(v.event_name)} (${v.total.toLocaleString()})`}
                active={event === v.event_name}
              />
            ))}
          </div>
        </section>
      </Reveal>

      {!event && grouped.length > 0 && (
        <Reveal delay={100}>
          <section className="space-y-4 rounded-xl glass-panel p-4">
            <SectionLabel>Event volume · by group</SectionLabel>
            <div className="space-y-5">
              {grouped.map(({ group, rows }) => (
                <div key={group} className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                    {GROUP_LABEL[group]}
                  </p>
                  <BarList
                    items={rows.map((r) => ({
                      key: r.event_name,
                      label: eventLabel(r.event_name),
                      value: r.total,
                      trailing: `${r.users.toLocaleString()} users`,
                    }))}
                    tone="info"
                  />
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>{event ? eventLabel(event) : "Live feed"}</SectionLabel>
          <span className="text-[11px] tabular-nums text-ink-3">
            {feed.length}
            {feed.length >= FEED_LIMIT ? "+" : ""} shown
          </span>
        </div>
        <EventFeed
          rows={feed}
          emptyLabel={
            event
              ? "No events of this type in the window."
              : "No events yet. They appear once the instrumented app runs (Debug → dev, or a shipped build → prod)."
          }
        />
      </section>
    </Shell>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
        active ? "border-brand/50 bg-brand/15 text-brand" : "border-rule/70 text-ink-3 hover:text-ink-2",
      )}
    >
      {label}
    </Link>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader eyebrow="Insights · Analytics" title="Events" />
      <AnalyticsNav active="/analytics/events" />
      {children}
    </div>
  );
}
