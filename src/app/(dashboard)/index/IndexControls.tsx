"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recomputeVestigeIndex, setVestigeIndexSwing } from "../courses/actions";

/**
 * Global Vestige Index controls: the rarity-swing tuner (how far rarity can
 * move prestige, ±) and a recalculate-now button. Both recompute every
 * course's Index, then refresh the ranked table.
 */
export function IndexControls({ raritySwing }: { raritySwing: number }) {
  const router = useRouter();
  const [swing, setSwing] = useState(String(raritySwing));
  const [pending, startTransition] = useTransition();

  function applySwing() {
    const v = Number(swing);
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      toast.error("Rarity swing must be 0–1.");
      return;
    }
    startTransition(async () => {
      const res = await setVestigeIndexSwing(v);
      if (res.ok) {
        toast.success(`Rarity swing set to ±${Math.round(v * 100)}% · index recomputed`);
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
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl glass-panel p-4">
      <div className="space-y-1">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          Rarity swing (±)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={swing}
            onChange={(e) => setSwing(e.target.value)}
            className="h-9 w-24 rounded-lg border border-rule/70 bg-paper-sunken/40 px-3 text-sm tabular-nums text-ink outline-none focus:border-brand/50"
          />
          <Button size="sm" variant="outline" disabled={pending} onClick={applySwing}>
            Apply
          </Button>
          <span className="text-xs text-ink-3">
            how far rarity can move prestige (0.15 = ±15%)
          </span>
        </div>
      </div>

      <Button size="sm" disabled={pending} onClick={recompute}>
        <RefreshCw aria-hidden className="size-3.5" />
        {pending ? "Working…" : "Recalculate now"}
      </Button>
    </div>
  );
}
