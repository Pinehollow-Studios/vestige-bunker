"use client";

import { useEffect, useState, useTransition } from "react";
import { CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SectionLabel, BarList, EmptyHint } from "@/components/admin/analytics/viz";
import { eventLabel } from "@/lib/analytics/config";
import {
  loadEventNames,
  loadNextEvents,
  loadTopPaths,
  loadSessionStats,
  type EventNameRow,
  type NextEventRow,
  type TopPathRow,
  type SessionStatsRow,
} from "../actions";

const SELECT =
  "h-9 rounded-lg border border-input bg-paper-sunken/40 px-2.5 text-sm transition-colors focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";

/**
 * Session flows — where sessions open, what follows any chosen event (including
 * the drop-off share that ends the session there), the most common opening
 * sequences, and headline session stats.
 */
export function PathsExplorer() {
  const [names, setNames] = useState<EventNameRow[]>([]);
  const [rangeDays, setRangeDays] = useState(30);
  const [afterEvent, setAfterEvent] = useState("");
  const [entries, setEntries] = useState<NextEventRow[]>([]);
  const [nexts, setNexts] = useState<NextEventRow[]>([]);
  const [paths, setPaths] = useState<TopPathRow[]>([]);
  const [stats, setStats] = useState<SessionStatsRow | null>(null);
  const [loading, startLoad] = useTransition();

  useEffect(() => {
    loadEventNames().then((r) => {
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setNames(r.data);
      // Land useful: default the "what happens after…" panel to the session
      // opener (the highest-signal question) instead of an empty picker.
      setAfterEvent((cur) => cur || (r.data.some((n) => n.event_name === "session_started") ? "session_started" : cur));
    });
  }, []);

  useEffect(() => {
    startLoad(async () => {
      const fromISO = daysAgoISO(rangeDays);
      const [en, pa, st] = await Promise.all([
        loadNextEvents(null, fromISO, 12),
        loadTopPaths(fromISO, 10),
        loadSessionStats(fromISO),
      ]);
      if (en.ok) setEntries(en.data); else toast.error(en.message);
      if (pa.ok) setPaths(pa.data);
      if (st.ok) setStats(st.data);
    });
  }, [rangeDays]);

  useEffect(() => {
    startLoad(async () => {
      if (!afterEvent) {
        setNexts([]);
        return;
      }
      const r = await loadNextEvents(afterEvent, daysAgoISO(rangeDays), 12);
      if (r.ok) setNexts(r.data);
      else toast.error(r.message);
    });
  }, [afterEvent, rangeDays]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select className={SELECT} value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        {loading && <span className="text-xs text-ink-3">Loading…</span>}
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Sessions" value={stats.sessions.toLocaleString()} />
          <StatTile label="People" value={stats.users.toLocaleString()} />
          <StatTile label="Events / session" value={stats.avg_events === null ? "—" : String(stats.avg_events)} />
          <StatTile label="Median length" value={stats.median_duration_minutes === null ? "—" : `${stats.median_duration_minutes}m`} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl glass-panel p-5">
          <SectionLabel>Sessions open with</SectionLabel>
          <BarList
            items={entries.map((e) => ({
              key: e.next_event,
              label: eventLabel(e.next_event),
              value: e.sessions,
            }))}
            emptyLabel="No sessions in that window."
          />
        </section>

        <section className="space-y-4 rounded-2xl glass-panel p-5">
          <SectionLabel>What happens after…</SectionLabel>
          <select className={cn(SELECT, "w-full")} value={afterEvent} onChange={(e) => setAfterEvent(e.target.value)}>
            <option value="">Choose an event…</option>
            {names.map((n) => (
              <option key={n.event_name} value={n.event_name}>{eventLabel(n.event_name)}</option>
            ))}
          </select>
          {afterEvent === "" ? (
            <EmptyHint>Pick an event to see what follows it in the same session.</EmptyHint>
          ) : (
            <NextList rows={nexts} />
          )}
        </section>
      </div>

      <section className="space-y-4 rounded-2xl glass-panel p-5">
        <SectionLabel>Most common opening sequences</SectionLabel>
        {paths.length === 0 ? (
          <EmptyHint>No sessions in that window.</EmptyHint>
        ) : (
          <div className="space-y-1.5">
            {paths.map((p) => (
              <div key={p.path} className="flex items-center gap-2 rounded-lg border border-rule/50 bg-paper-sunken/30 px-3 py-2">
                <CornerDownRight className="size-3.5 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink" title={p.path}>
                  {p.path.split(" → ").map(eventLabel).join("  →  ")}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ink-2">
                  {p.sessions.toLocaleString()} <span className="text-ink-3">sessions</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function NextList({ rows }: { rows: NextEventRow[] }) {
  if (rows.length === 0) return <EmptyHint>Nothing follows it in that window.</EmptyHint>;
  const total = rows.reduce((s, r) => s + r.occurrences, 0);
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const ends = r.next_event === "(session ends)";
        const pct = total > 0 ? Math.round((r.occurrences / total) * 100) : 0;
        return (
          <div key={r.next_event} className="flex items-center gap-3">
            <span className={cn("w-40 shrink-0 truncate text-xs", ends ? "italic text-ink-3" : "text-ink-2")}>
              {ends ? "Session ends there" : eventLabel(r.next_event)}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-paper-sunken/50">
              <div className={cn("h-full rounded-full", ends ? "bg-amber/60" : "bg-brand/70")} style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-ink-2">
              {pct}% <span className="text-ink-3">({r.occurrences})</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-paper-raised/50 p-3">
      <p className="text-[11px] uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}
