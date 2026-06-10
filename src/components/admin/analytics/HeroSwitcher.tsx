"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AreaChart, BigStat, FunnelBars, BarList } from "./viz";

export type Hero = "pulse" | "activation" | "growth" | "health";

const OPTIONS: { key: Hero; label: string }[] = [
  { key: "pulse", label: "Pulse" },
  { key: "activation", label: "Activation" },
  { key: "growth", label: "Growth" },
  { key: "health", label: "Data health" },
];

type Series = { day: string; count: number }[];
type Stage = { key: string; label: string; count: number };
type Delta = { text: string; dir: "up" | "down" | "flat" };
type BarItem = { key: string; label: string; value: number };

export type HeroData = {
  initial: Hero;
  pulse: { active7d: number; delta: Delta; sub: string; series: Series };
  activation: { firstMarker: number; completionPct: number; stages: Stage[] };
  growth: { total: number; week: number; series: Series };
  health: { eventsToday: number; lastEventAgo: string; events7d: number; versions: BarItem[] };
};

const HEADING = "mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3";

/** Persist the chosen lens so it sticks across loads (server reads this cookie
 *  to render the right hero first paint). Module-level so it's a side effect,
 *  not a flagged in-component mutation. */
function persistHero(h: Hero) {
  document.cookie = `analytics_hero=${h}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * The hero slot at the top of the overview. A little switch picks the lens;
 * the choice is persisted to a cookie (`analytics_hero`) so it sticks and the
 * server can render the right lens on the next load — no flash.
 */
export function HeroSwitcher(props: HeroData) {
  const [hero, setHero] = useState<Hero>(props.initial);

  function pick(h: Hero) {
    setHero(h);
    persistHero(h);
  }

  return (
    <div className="rounded-2xl glass-panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          {OPTIONS.find((o) => o.key === hero)?.label}
        </span>
        <div className="inline-flex gap-0.5 rounded-lg bg-paper-sunken p-0.5 text-[11px]">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => pick(o.key)}
              className={cn(
                "rounded-md px-2.5 py-1 font-semibold transition-colors",
                hero === o.key ? "bg-brand text-brand-fg" : "text-ink-3 hover:text-ink-2",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[210px_1fr] sm:items-center">
        {hero === "pulse" && (
          <>
            <BigStat label="Active users · 7d" value={props.pulse.active7d.toLocaleString()} delta={props.pulse.delta} sub={props.pulse.sub} />
            <div>
              <p className={HEADING}>Daily active users · 14d</p>
              <AreaChart data={props.pulse.series} />
            </div>
          </>
        )}

        {hero === "activation" && (
          <>
            <BigStat
              label="Reached first marker"
              value={props.activation.firstMarker.toLocaleString()}
              sub={`${props.activation.completionPct}% of onboarding starts finish the walkthrough`}
            />
            <div>
              <p className={HEADING}>Onboarding funnel</p>
              <FunnelBars stages={props.activation.stages} />
            </div>
          </>
        )}

        {hero === "growth" && (
          <>
            <BigStat
              label="Total users"
              value={props.growth.total.toLocaleString()}
              delta={{ text: `+${props.growth.week} this week`, dir: props.growth.week > 0 ? "up" : "flat" }}
              sub="New signups per day over the last 14 days →"
            />
            <div>
              <p className={HEADING}>New signups · 14d</p>
              <AreaChart data={props.growth.series} gradientId="growth-fill" />
            </div>
          </>
        )}

        {hero === "health" && (
          <>
            <BigStat
              label="Events today"
              value={props.health.eventsToday.toLocaleString()}
              sub={`Last event ${props.health.lastEventAgo} · ${props.health.events7d.toLocaleString()} in the last 7 days`}
            />
            <div>
              <p className={HEADING}>Events by app version · 30d</p>
              <BarList items={props.health.versions} emptyLabel="No events recorded yet." />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
