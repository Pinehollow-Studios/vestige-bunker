"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SectionLabel, AreaChart, BarList, EmptyHint } from "@/components/admin/analytics/viz";
import { eventLabel } from "@/lib/analytics/config";
import {
  loadEventNames,
  loadEventSeries,
  loadEventBreakdown,
  type EventNameRow,
  type SeriesRow,
  type BreakdownRow,
} from "../actions";

const SELECT =
  "h-9 rounded-lg border border-input bg-paper-sunken/40 px-2.5 text-sm transition-colors focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";

const BREAKDOWNS = [
  { value: "", label: "No breakdown" },
  { value: "app_version", label: "By app version" },
  { value: "ios_version", label: "By iOS version" },
  { value: "device_model", label: "By device" },
  { value: "locale", label: "By locale" },
  { value: "source", label: "By source" },
];

/**
 * Self-serve event explorer — pick any event (or all), a range and bucket, and
 * an optional breakdown dimension. Answers "how often does X happen, by whom,
 * on what" without SQL.
 */
export function EventExplorer() {
  const [names, setNames] = useState<EventNameRow[]>([]);
  const [event, setEvent] = useState<string>("");
  const [rangeDays, setRangeDays] = useState(30);
  const [bucket, setBucket] = useState<"day" | "week">("day");
  // Land useful: version adoption is the breakdown you want most often.
  const [breakdown, setBreakdown] = useState("app_version");
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [byDim, setByDim] = useState<BreakdownRow[]>([]);
  const [loading, startLoad] = useTransition();

  useEffect(() => {
    loadEventNames().then((r) => (r.ok ? setNames(r.data) : toast.error(r.message)));
  }, []);

  useEffect(() => {
    const to = new Date();
    const from = new Date(Date.now() - rangeDays * 86400_000);
    startLoad(async () => {
      const [s, b] = await Promise.all([
        loadEventSeries(event || null, from.toISOString(), to.toISOString(), bucket, null),
        breakdown
          ? loadEventBreakdown(event || null, from.toISOString(), to.toISOString(), breakdown)
          : Promise.resolve({ ok: true as const, data: [] as BreakdownRow[] }),
      ]);
      if (!s.ok) {
        toast.error(s.message);
        return;
      }
      setSeries(s.data);
      setByDim(b.ok ? b.data : []);
      if (!b.ok) toast.error(b.message);
    });
  }, [event, rangeDays, bucket, breakdown]);

  // The unbroken series (dimension 'all') pivoted into chart shapes.
  const { eventsData, usersData, totals } = useMemo(() => {
    const evs = series.map((r) => ({ day: r.bucket, count: r.events }));
    const uss = series.map((r) => ({ day: r.bucket, count: r.users }));
    return {
      eventsData: evs,
      usersData: uss,
      totals: {
        events: series.reduce((s, r) => s + r.events, 0),
        peakUsers: Math.max(0, ...series.map((r) => r.users)),
      },
    };
  }, [series]);

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl glass-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel>Explore an event</SectionLabel>
          {loading && <span className="text-xs text-ink-3">Loading…</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select className={cn(SELECT, "min-w-52")} value={event} onChange={(e) => setEvent(e.target.value)}>
            <option value="">All events</option>
            {names.map((n) => (
              <option key={n.event_name} value={n.event_name}>
                {eventLabel(n.event_name)} ({n.total.toLocaleString()})
              </option>
            ))}
          </select>
          <select className={SELECT} value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <select className={SELECT} value={bucket} onChange={(e) => setBucket(e.target.value as "day" | "week")}>
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
          </select>
          <select className={SELECT} value={breakdown} onChange={(e) => setBreakdown(e.target.value)}>
            {BREAKDOWNS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>

        {series.length === 0 ? (
          <EmptyHint>No events in that window.</EmptyHint>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-ink-3">
                Events · <span className="font-semibold tabular-nums text-ink-2">{totals.events.toLocaleString()}</span> total
              </p>
              <AreaChart data={eventsData} gradientId="explore-events" />
            </div>
            <div>
              <p className="mb-1 text-xs text-ink-3">
                Unique people · peaks at <span className="font-semibold tabular-nums text-ink-2">{totals.peakUsers.toLocaleString()}</span>
              </p>
              <AreaChart data={usersData} gradientId="explore-users" />
            </div>
          </div>
        )}
      </section>

      {breakdown && (
        <section className="space-y-4 rounded-2xl glass-panel p-5">
          <SectionLabel>{BREAKDOWNS.find((b) => b.value === breakdown)?.label ?? "Breakdown"}</SectionLabel>
          <BarList
            items={byDim.map((d) => ({
              key: d.dimension,
              label: d.dimension,
              value: d.events,
              trailing: `${d.users.toLocaleString()} ${d.users === 1 ? "person" : "people"}`,
            }))}
            emptyLabel="Nothing to break down in that window."
          />
        </section>
      )}
    </div>
  );
}
