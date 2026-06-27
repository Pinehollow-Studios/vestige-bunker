"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { recomputeVestigeIndex, setVestigeIndexSwing } from "../courses/actions";
import { projectIndex } from "./formula";

/** A fixed reference course used to show, live, what the current swing does. */
const EXAMPLE = { prestige: 70, rarity: 90 } as const;

/**
 * The Vestige Index control panel — the global mechanics, laid bare. Shows the
 * exact blend formula, a live worked example, the one global knob (rarity
 * swing) as a slider + numeric bound together, and a recompute-now action.
 * Built so Jack can see *why* every Index is what it is and tune the blend with
 * full confidence. Prestige itself is edited per-course in the table below.
 */
export function IndexMechanics({
  raritySwing,
  updatedAt,
  updatedByName,
}: {
  raritySwing: number;
  updatedAt: string | null;
  updatedByName: string | null;
}) {
  const router = useRouter();
  const [swing, setSwing] = useState(raritySwing);
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const dirty = swing !== raritySwing;
  const pct = Math.round(swing * 100);
  const exampleIndex = projectIndex(EXAMPLE.prestige, EXAMPLE.rarity, swing);

  function clampSwing(v: number) {
    if (!Number.isFinite(v)) return;
    setSwing(Math.max(0, Math.min(1, v)));
  }

  function applySwing() {
    startTransition(async () => {
      const res = await setVestigeIndexSwing(swing);
      setConfirmOpen(false);
      if (res.ok) {
        toast.success(`Rarity swing set to ±${Math.round(swing * 100)}% · index recomputed`);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  function recompute() {
    startTransition(async () => {
      const res = await recomputeVestigeIndex();
      if (res.ok) {
        toast.success(`Recomputed ${res.data?.toLocaleString() ?? ""} courses`);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl glass-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-brand/10 text-brand">
            <SlidersHorizontal aria-hidden className="size-3.5" />
          </span>
          <h2 className="text-sm font-semibold text-ink">Index mechanics</h2>
        </div>
        <Button size="sm" variant="outline" disabled={pending} onClick={recompute}>
          <RefreshCw aria-hidden className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
          {pending ? "Working…" : "Recompute now"}
        </Button>
      </div>

      {/* The formula, written out. */}
      <div className="rounded-lg border border-rule/60 bg-paper-sunken/40 px-4 py-3">
        <p className="font-mono text-[13px] leading-relaxed text-ink-2">
          <span className="text-brand">index</span> = clamp( <span className="text-ink">prestige</span> ×
          (1 + <span className="text-ink">swing</span> × (<span className="text-ink">rarity</span> − 50) / 50), 0, 100 )
        </p>
        <p className="mt-1 text-xs text-ink-3">
          Prestige is your editorial anchor (0–100). Rarity (0–100, 100 = rarest) is computed live from plays. Swing
          is how far rarity may push prestige, ±.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
        {/* Rarity swing control. */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="swing-range" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              Rarity swing
            </label>
            <span className="text-xs tabular-nums text-ink-3">
              ±{pct}% {dirty && <span className="text-amber">· unsaved</span>}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="swing-range"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={swing}
              onChange={(e) => clampSwing(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-brand"
            />
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={swing}
              onChange={(e) => clampSwing(Number(e.target.value))}
              className="h-9 w-20 rounded-lg border border-rule/70 bg-paper-sunken/40 px-3 text-sm tabular-nums text-ink outline-none focus:border-brand/50"
            />
            <Button size="sm" disabled={pending || !dirty} onClick={() => setConfirmOpen(true)}>
              Apply
            </Button>
          </div>
          <p className="text-xs text-ink-3">
            {updatedAt
              ? `Last tuned ${relativeTime(updatedAt)} ago${updatedByName ? ` by ${updatedByName}` : ""}.`
              : "Not yet tuned."}{" "}
            Applying recomputes every course.
          </p>
        </div>

        {/* Live worked example. */}
        <div className="rounded-lg border border-rule/60 bg-paper-sunken/30 px-4 py-3 lg:w-56">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Worked example</p>
          <p className="mt-1 text-xs text-ink-3">
            prestige {EXAMPLE.prestige} · rarity {EXAMPLE.rarity}
          </p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="text-ink-3">→ index</span>
            <span className="font-display text-2xl font-semibold tabular-nums text-brand">{exampleIndex}</span>
          </p>
          <p className="mt-1 text-[11px] text-ink-3">at ±{pct}% swing</p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Apply rarity swing?"
        confirmLabel={`Apply ±${pct}%`}
        busy={pending}
        onConfirm={applySwing}
        onCancel={() => {
          if (!pending) setConfirmOpen(false);
        }}
      >
        <p>
          Setting the swing to <strong className="text-ink">±{pct}%</strong> recomputes the Vestige
          Index for <strong className="text-ink">every course</strong> — shifting rankings across
          the app.
        </p>
        <p className="mt-2 text-ink-3">Reversible: set it back and re-apply.</p>
      </ConfirmDialog>
    </section>
  );
}

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.round(days / 30)}mo`;
}
