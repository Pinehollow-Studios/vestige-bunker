"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowDown, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SectionLabel, EmptyHint } from "@/components/admin/analytics/viz";
import { eventLabel } from "@/lib/analytics/config";
import { loadEventNames, runFunnel, type EventNameRow, type FunnelStepRow } from "../actions";

const SELECT =
  "h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-2.5 text-sm transition-colors focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30";

/**
 * Self-serve funnel builder — pick 2–6 events in order, a date range, and a
 * conversion window (anchored at each user's step 1). Shows step-by-step users,
 * % of the top, % of the previous step, and the median time between steps.
 */
export function FunnelBuilder() {
  const [names, setNames] = useState<EventNameRow[]>([]);
  const [steps, setSteps] = useState<string[]>(["", ""]);
  const [rangeDays, setRangeDays] = useState(30);
  const [windowHours, setWindowHours] = useState(168);
  const [result, setResult] = useState<FunnelStepRow[] | null>(null);
  const [running, startRun] = useTransition();

  useEffect(() => {
    loadEventNames().then((r) => {
      if (r.ok) setNames(r.data);
      else toast.error(r.message);
    });
  }, []);

  const chosen = steps.filter((s) => s !== "");
  const canRun = chosen.length >= 2 && chosen.length === steps.length;

  function run() {
    if (!canRun) {
      toast.error("Pick an event for every step (at least two).");
      return;
    }
    const to = new Date();
    const from = new Date(Date.now() - rangeDays * 86400_000);
    startRun(async () => {
      const r = await runFunnel(steps, from.toISOString(), to.toISOString(), windowHours);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setResult(r.data);
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl glass-panel p-5">
        <SectionLabel>Build a funnel</SectionLabel>
        <p className="text-xs text-ink-3">
          Users count at each step only if they did the steps <strong className="font-medium text-ink-2">in order</strong>,
          all within the conversion window of their first step.
        </p>

        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                {i + 1}
              </span>
              <select className={SELECT} value={s} onChange={(e) => setSteps(steps.map((x, xi) => (xi === i ? e.target.value : x)))}>
                <option value="">Choose an event…</option>
                {names.map((n) => (
                  <option key={n.event_name} value={n.event_name}>
                    {eventLabel(n.event_name)} ({n.total.toLocaleString()})
                  </option>
                ))}
              </select>
              {steps.length > 2 && (
                <button
                  onClick={() => setSteps(steps.filter((_, xi) => xi !== i))}
                  className="shrink-0 text-ink-3 hover:text-alert"
                  aria-label={`Remove step ${i + 1}`}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {steps.length < 6 && (
            <button
              onClick={() => setSteps([...steps, ""])}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-ink-2 transition-colors hover:text-ink"
            >
              <Plus className="size-3" /> Step
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <select className={cn(SELECT, "w-auto")} value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <select className={cn(SELECT, "w-auto")} value={windowHours} onChange={(e) => setWindowHours(Number(e.target.value))}>
              <option value={24}>Within 1 day</option>
              <option value={72}>Within 3 days</option>
              <option value={168}>Within 7 days</option>
              <option value={720}>Within 30 days</option>
            </select>
            <Button onClick={run} disabled={running || !canRun} size="sm" className="bg-brand text-brand-fg hover:bg-brand-deep">
              <Play className="size-4" /> {running ? "Running…" : "Run"}
            </Button>
          </div>
        </div>
      </section>

      {result && (
        <section className="space-y-4 rounded-2xl glass-panel p-5">
          <SectionLabel>Result</SectionLabel>
          {result.length === 0 || result[0].users === 0 ? (
            <EmptyHint>No one hit the first step in that window.</EmptyHint>
          ) : (
            <FunnelSteps rows={result} />
          )}
        </section>
      )}
    </div>
  );
}

function FunnelSteps({ rows }: { rows: FunnelStepRow[] }) {
  const top = Math.max(1, rows[0]?.users ?? 0);
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => {
        const prev = i > 0 ? rows[i - 1].users : r.users;
        const ofTop = Math.round((r.users / top) * 100);
        const ofPrev = prev > 0 ? Math.round((r.users / prev) * 100) : 0;
        return (
          <div key={r.step_index}>
            {i > 0 && (
              <div className="flex items-center gap-1.5 py-0.5 pl-2 text-[11px] text-ink-3">
                <ArrowDown className="size-3" />
                {ofPrev}% continue
                {r.median_minutes_from_prev !== null && <span>· typically {formatMinutes(r.median_minutes_from_prev)} later</span>}
              </div>
            )}
            <div className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-xs text-ink-2 sm:w-56" title={r.event_name}>
                {r.step_index}. {eventLabel(r.event_name)}
              </span>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-paper-sunken/50">
                <div
                  className="flex h-full items-center rounded-md bg-brand/70 px-2 text-[11px] font-semibold text-brand-fg transition-all"
                  style={{ width: `${Math.max(ofTop, 4)}%` }}
                >
                  {r.users.toLocaleString()}
                </div>
              </div>
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-ink-2">{ofTop}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatMinutes(mins: number): string {
  if (mins < 1) return "under a minute";
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${Math.round(mins % 60)}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
