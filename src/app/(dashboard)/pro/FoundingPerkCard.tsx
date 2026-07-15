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
            ? "Founding perk armed — new founding members now get free Pro automatically."
            : "Founding perk disarmed — new founders get nothing. Existing grants are untouched.",
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
        <h2 className="font-hero text-lg text-ink">Founding perk</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          Free Pro for founding members, then a permanently reduced lifetime price. The switch
          arms it for <em>future</em> founders; the button below grants it to the ones who
          already exist.
        </p>
      </div>

      {/* The switch */}
      <div className="flex items-start justify-between gap-4 rounded-lg border border-rule/70 bg-paper-sunken/40 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            Automatic free Pro for new founding members
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            {on
              ? "Armed. Anyone who becomes a founding member gets their free window on signup."
              : "Off. New founding members get the badge, but no free Pro. Nothing is running."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Automatic free Pro for new founding members"
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
          Free months
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
          How long a founder&rsquo;s free window lasts. Used by both the switch and the button
          below, so they can never disagree. Changing it does not affect windows already running.
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
          <p className="text-sm font-semibold text-ink">Grant free Pro to existing founders</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            {pendingFounders === 0
              ? `All ${founders} founding member${founders === 1 ? "" : "s"} already have a free window.`
              : `${pendingFounders} of ${founders} founding member${
                  founders === 1 ? "" : "s"
                } would get ${monthsValid ? parsedMonths : months} months free, starting the moment you press this.`}
          </p>
          <p className="mt-1 text-[11px] text-ink-3">
            Safe to run twice — anyone who already has a window is skipped.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => setConfirmBatch(true)}
          disabled={pending || pendingFounders === 0}
        >
          {pending ? "Working…" : `Grant to ${pendingFounders} founder${pendingFounders === 1 ? "" : "s"}`}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmSwitch}
        title="Arm the founding perk?"
        confirmLabel="Arm it"
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
          From now on, anyone who becomes a founding member automatically gets{" "}
          <strong className="text-ink">{monthsValid ? parsedMonths : months} months</strong> of
          free Pro.
        </p>
        <p className="mt-2 text-ink-3">
          This grants nothing to the {founders} founder{founders === 1 ? "" : "s"} who already
          exist — use the button below for those, when you&rsquo;re ready.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmBatch}
        title={`Start ${pendingFounders} clock${pendingFounders === 1 ? "" : "s"}?`}
        confirmLabel="Grant free Pro"
        tone="danger"
        busy={pending}
        onConfirm={runBatch}
        onCancel={() => {
          if (!pending) setConfirmBatch(false);
        }}
      >
        <p>
          <strong className="text-ink">{pendingFounders}</strong> founding member
          {pendingFounders === 1 ? "" : "s"} will get{" "}
          <strong className="text-ink">{monthsValid ? parsedMonths : months} months</strong> of
          free Pro, counted from right now.
        </p>
        <p className="mt-2 text-ink-3">
          There is no undo for the batch — you&rsquo;d have to revoke each grant individually.
          Do this when Pro actually launches, not before.
        </p>
      </ConfirmDialog>
    </div>
  );
}
