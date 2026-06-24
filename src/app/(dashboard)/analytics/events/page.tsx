import Link from "next/link";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { AnalyticsNav } from "@/components/admin/analytics/AnalyticsNav";
import { EventFeed } from "@/components/admin/analytics/EventFeed";
import { SectionLabel, MetricCard, AreaChart, EmptyHint } from "@/components/admin/analytics/viz";
import { cn } from "@/lib/utils";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { eventLabel } from "@/lib/analytics/config";
import { getEvents, rollupVolume, rollupEventsPerDay, distinctUsers, isoDaysAgo } from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

const FEED_LIMIT = 200;

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

export default async function EventExplorerPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event } = await searchParams;
  const supabase = await tryCreateServiceClient();

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

  const since = isoDaysAgo(30);
  const [feed, windowEvents] = await Promise.all([
    getEvents(supabase, { sinceIso: since, eventName: event, limit: FEED_LIMIT }),
    getEvents(supabase, { sinceIso: since, limit: 10000 }),
  ]);
  const volume = rollupVolume(windowEvents);
  const perDay = rollupEventsPerDay(windowEvents, 14);
  const perDayPeak = Math.max(...perDay.map((d) => d.count), 0);

  return (
    <Shell>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Events · 30d" value={windowEvents.length.toLocaleString()} tone="brand" />
        <MetricCard label="Event types" value={volume.length.toLocaleString()} />
        <MetricCard label="Active users" value={distinctUsers(windowEvents).toLocaleString()} />
        <MetricCard label="Last event" value={relTime(windowEvents[0]?.created_at)} />
      </div>

      <section className="space-y-2 rounded-xl glass-panel p-4">
        <SectionLabel>Events per day · 14d</SectionLabel>
        {perDayPeak > 0 ? <AreaChart data={perDay} height={120} /> : <EmptyHint>No events in the window yet.</EmptyHint>}
      </section>

      <section className="space-y-3">
        <SectionLabel>Filter by event</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip href="/analytics/events" label={`All (${windowEvents.length})`} active={!event} />
          {volume.map((v) => (
            <FilterChip
              key={v.key}
              href={`/analytics/events?event=${encodeURIComponent(v.key)}`}
              label={`${eventLabel(v.key)} (${v.count})`}
              active={event === v.key}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>{event ? eventLabel(event) : "All events"}</SectionLabel>
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
      <SectionHeader
        eyebrow="Insights · Analytics"
        title="Events"
      />
      <AnalyticsNav active="/analytics/events" />
      {children}
    </div>
  );
}
