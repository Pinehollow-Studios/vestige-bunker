"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SectionLabel, Sparkline, EmptyHint } from "@/components/admin/analytics/viz";
import { CohortGrid, type CohortRowData } from "@/components/admin/analytics/CohortGrid";
import {
  loadRetention,
  loadSegmentOptions,
  loadEngagementSeries,
  type RetentionRow,
  type EngagementRow,
} from "../actions";
import type { SegmentGroup } from "../../segments/fields";

const SELECT =
  "h-9 rounded-lg border border-input bg-paper-sunken/40 px-2.5 text-sm transition-colors focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";

type Activity = "any" | "event" | "marker" | "round";
type View = "classic" | "unbounded";

const ACTIVITY_LABEL: Record<Activity, string> = {
  any: "Any activity",
  round: "Logged a round",
  marker: "Marked a course",
  event: "Opened the app",
};

/**
 * Retention explorer — the cohort triangle plus the engagement pulse. Classic
 * ("came back IN week N") vs unbounded ("still around at week N or later"),
 * activity definition, cohort window, and an optional saved-segment filter so
 * cohorts can be compared by who they are (the roadmap's cohort analysis).
 */
export function RetentionExplorer() {
  const [weeks, setWeeks] = useState(12);
  const [activity, setActivity] = useState<Activity>("any");
  const [view, setView] = useState<View>("classic");
  const [segmentId, setSegmentId] = useState("");
  const [segments, setSegments] = useState<{ id: string; name: string; definition: SegmentGroup }[]>([]);
  const [rows, setRows] = useState<RetentionRow[]>([]);
  const [engagement, setEngagement] = useState<EngagementRow[]>([]);
  const [loading, startLoad] = useTransition();

  useEffect(() => {
    loadSegmentOptions().then((r) => r.ok && setSegments(r.data));
    loadEngagementSeries(60).then((r) => r.ok && setEngagement(r.data));
  }, []);

  useEffect(() => {
    const seg = segments.find((s) => s.id === segmentId)?.definition ?? null;
    startLoad(async () => {
      const r = await loadRetention(weeks, activity, seg);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setRows(r.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, activity, segmentId, segments.length]);

  const grid = useMemo(() => pivot(rows, view), [rows, view]);
  const latest = engagement[engagement.length - 1];
  const stickiness = latest && latest.mau > 0 ? Math.round((latest.wau / latest.mau) * 100) : null;

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl glass-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel>Retention by signup cohort</SectionLabel>
          {loading && <span className="text-xs text-ink-3">Loading…</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-border">
            {(["classic", "unbounded"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === v ? "bg-brand/15 text-brand" : "bg-surface-2 text-ink-2 hover:text-ink",
                )}
                title={v === "classic" ? "Came back during that exact week" : "Came back that week or any later week"}
              >
                {v === "classic" ? "In that week" : "Still around"}
              </button>
            ))}
          </div>
          <select className={SELECT} value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
            {(Object.keys(ACTIVITY_LABEL) as Activity[]).map((a) => (
              <option key={a} value={a}>{ACTIVITY_LABEL[a]}</option>
            ))}
          </select>
          <select className={SELECT} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            <option value={8}>Last 8 weeks</option>
            <option value={12}>Last 12 weeks</option>
            <option value={26}>Last 26 weeks</option>
          </select>
          {segments.length > 0 && (
            <select className={SELECT} value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              <option value="">All members</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>Segment: {s.name}</option>
              ))}
            </select>
          )}
        </div>

        <CohortGrid rows={grid.rows} maxOffset={grid.maxOffset} />
      </section>

      <section className="space-y-4 rounded-2xl glass-panel p-5">
        <SectionLabel>Engagement pulse · last 60 days</SectionLabel>
        {engagement.length === 0 ? (
          <EmptyHint>No activity yet.</EmptyHint>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PulseTile label="Active today" value={latest?.dau ?? 0} data={engagement.map((e) => ({ day: e.day, count: e.dau }))} />
            <PulseTile label="Weekly actives" value={latest?.wau ?? 0} data={engagement.map((e) => ({ day: e.day, count: e.wau }))} />
            <PulseTile label="Monthly actives" value={latest?.mau ?? 0} data={engagement.map((e) => ({ day: e.day, count: e.mau }))} />
            <div className="rounded-xl border border-border bg-paper-raised/50 p-3">
              <p className="text-[11px] uppercase tracking-wider text-ink-3">Stickiness</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
                {stickiness === null ? "—" : `${stickiness}%`}
              </p>
              <p className="mt-1 text-xs leading-snug text-ink-3">Weekly ÷ monthly actives — how much of the month shows up each week.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function PulseTile({ label, value, data }: { label: string; value: number; data: { day: string; count: number }[] }) {
  return (
    <div className="rounded-xl border border-border bg-paper-raised/50 p-3">
      <p className="text-[11px] uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">{value.toLocaleString()}</p>
      <div className="mt-2">
        <Sparkline data={data} />
      </div>
    </div>
  );
}

function pivot(rows: RetentionRow[], view: View): { rows: CohortRowData[]; maxOffset: number } {
  const byCohort = new Map<string, RetentionRow[]>();
  let maxOffset = 0;
  for (const r of rows) {
    const arr = byCohort.get(r.cohort_week) ?? [];
    arr.push(r);
    byCohort.set(r.cohort_week, arr);
    if (r.week_offset > maxOffset) maxOffset = r.week_offset;
  }
  const out: CohortRowData[] = [];
  for (const [week, cells] of byCohort) {
    const size = cells[0]?.cohort_size ?? 0;
    out.push({
      cohortWeek: week,
      size,
      cells: cells.map((c) => ({
        offset: c.week_offset,
        active: view === "classic" ? c.active_users : c.retained_users,
        pct: size > 0 ? Math.round(((view === "classic" ? c.active_users : c.retained_users) / size) * 100) : null,
      })),
    });
  }
  out.sort((a, b) => (a.cohortWeek < b.cohortWeek ? 1 : -1)); // newest cohort first
  return { rows: out, maxOffset };
}
