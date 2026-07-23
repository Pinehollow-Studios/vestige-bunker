"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { setFoundingPerk, grantBetaProToFounders } from "./actions";

type Props = {
  enabled: boolean;
  months: number;
  /** Founders who exist right now. */
  founders: number;
  /** Founders already holding a live free-Pro grant. */
  granted: number;
};

/**
 * The founding perk — free Pro for founding members, and the switch that arms it.
 *
 * Two deliberately separate acts, because they do different things:
 *
 *  1. **The switch** (`founding_pro_enabled`) arms the dormant trigger so anyone
 *     who becomes a founding member *from now on* gets their free window
 *     automatically. Flipping it grants nobody retroactively.
 *  2. **The launch batch** grants every founder who *already exists* their
 *     window, counted from the moment you press it.
 *
 * At launch you do both, in that order. Splitting them is what makes the switch
 * safe to flip early — it can't start anybody's clock on its own.
 */
export function FoundingPerkCard({ enabled, months, founders, granted }: Props) {
  const [on, setOn] = useState(enabled);
  const [free, setFree] = useState(String(months));
  const [pending, startTransition] = useTransition();
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [confirmBatch, setConfirmBatch] = useState(false);

  const parsedMonths = parseInt(free, 10);
  const monthsValid = Number.isInteger(parsedMonths) && parsedMonths >= 1 && parsedMonths <= 60;
  const dirty = on !== enabled || parsedMonths !== months;
  const pendingFounders = Math.max(founders - granted, 0);

  function save(nextOn: boolean) {
    startTransition(async () => {
      const result = await setFoundingPerk(nextOn, parsedMonths);
      setConfirmSwitch(false);
      if (result.ok) {
        setOn(nextOn);
        toast.success(
          nextOn
            ? "On - new early members now get their free Pro automatically."
            : "Off - new early members get nothing. Anyone already running keeps theirs.",
        );
      } else {
        setOn(enabled);
        toast.error(result.message);
      }
    });
  }

  function attemptSave() {
    if (!monthsValid) {
      toast.error("Free months must be a whole number between 1 and 60.");
      return;
    }
    // Arming is the consequential direction — confirm it.
    if (on && !enabled) setConfirmSwitch(true);
    else save(on);
  }

  function runBatch() {
    startTransition(async () => {
      const result = await grantBetaProToFounders();
      setConfirmBatch(false);
      if (result.ok) toast.success(result.message ?? "Done.");
      else toast.error(result.message);
    });
  }

  return (
    <div className="space-y-5 rounded-xl glass-panel p-5">
      <div>
        <h2 className="font-hero text-lg text-ink">Free Pro for early members</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          Everyone who joins during the beta gets a stretch of Pro free, and keeps a permanently
          cheaper price after it. Two separate things here: the switch handles everyone who joins
          <em>from now on</em>, and the button at the bottom starts the clock for the people who
          have <em>already</em> joined.
        </p>
      </div>

      {/* The switch */}
      <div className="flex items-start justify-between gap-4 rounded-lg border border-rule/70 bg-paper-sunken/40 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            Give free Pro to new early members automatically
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            {on
              ? "On. Anyone who joins as an early member gets their free months the moment they sign up."
              : "Off. New early members still get the badge, but no free Pro. Nothing is running."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Give free Pro to new early members automatically"
          disabled={pending}
          onClick={() => setOn((v) => !v)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            on ? "bg-brand" : "bg-rule-strong"
          } disabled:opacity-50`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              on ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* How long */}
      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-2">
          How many free months
        </span>
        <input
          type="number"
          min={1}
          max={60}
          value={free}
          onChange={(e) => setFree(e.target.value)}
          className="w-28 rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
        />
        <span className="block text-[11px] leading-snug text-ink-3">
          How long the free stretch lasts. Both the switch above and the button below use this
          number, so they can never disagree. Changing it does not shorten or extend anyone whose
          free months have already started.
        </span>
      </label>

      <div className="flex justify-end">
        <Button onClick={attemptSave} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>

      {/* The launch batch */}
      <div className="space-y-3 rounded-lg border border-rule/70 bg-paper-sunken/40 p-4">
        <div>
          <p className="text-sm font-semibold text-ink">Start the people who have already joined</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            {pendingFounders === 0
              ? `All ${founders} early member${founders === 1 ? "" : "s"} already have their free months.`
              : `${pendingFounders} of ${founders} early member${
                  founders === 1 ? "" : "s"
                } would get ${monthsValid ? parsedMonths : months} months free, counted from the moment you press this.`}
          </p>
          <p className="mt-1 text-[11px] text-ink-3">
            Safe to press twice - anyone who already has their free months is skipped.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setConfirmBatch(true)}
          disabled={pending || pendingFounders === 0}
        >
          {pending ? "Working…" : `Start ${pendingFounders} early member${pendingFounders === 1 ? "" : "s"}`}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmSwitch}
        title="Turn this on?"
        confirmLabel="Turn it on"
        busy={pending}
        onConfirm={() => save(true)}
        onCancel={() => {
          if (!pending) {
            setConfirmSwitch(false);
            setOn(enabled);
          }
        }}
      >
        <p>
          From now on, anyone who joins as an early member automatically gets{" "}
          <strong className="text-ink">{monthsValid ? parsedMonths : months} months</strong> of
          free Pro.
        </p>
        <p className="mt-2 text-ink-3">
          This gives nothing to the {founders} person{founders === 1 ? "" : "s"} who have already
          joined - use the button at the bottom for those, when you&rsquo;re ready.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmBatch}
        title={`Start ${pendingFounders} free ${pendingFounders === 1 ? "membership" : "memberships"}?`}
        confirmLabel="Start them"
        tone="danger"
        busy={pending}
        onConfirm={runBatch}
        onCancel={() => {
          if (!pending) setConfirmBatch(false);
        }}
      >
        <p>
          <strong className="text-ink">{pendingFounders}</strong> early member
          {pendingFounders === 1 ? "" : "s"} will get{" "}
          <strong className="text-ink">{monthsValid ? parsedMonths : months} months</strong> of
          free Pro, counted from right now.
        </p>
        <p className="mt-2 text-ink-3">
          There is no single undo - you&rsquo;d have to take it back from each person one at a
          time. Do this on the day Pro launches, not before.
        </p>
      </ConfirmDialog>
    </div>
  );
}
