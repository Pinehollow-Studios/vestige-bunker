"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setCoursePrestige } from "../courses/actions";
import { TIER_LABELS, type CourseTier } from "../courses/types";

export type IndexRow = {
  rank: number;
  id: string;
  name: string;
  clubName: string | null;
  countyName: string | null;
  tier: CourseTier;
  prestige: number;
  prestigeSource: string | null;
  vestigeIndex: number | null;
  vestigeRarity: number | null;
  playCount: number;
};

/**
 * The ranked Index table. Prestige is inline-editable (save on blur / Enter);
 * saving recomputes the whole Index server-side, then we refresh so the
 * ranking re-sorts. Index + rarity are read-only.
 */
export function IndexTable({ rows }: { rows: IndexRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  function commit(row: IndexRow) {
    const raw = edits[row.id];
    if (raw === undefined) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast.error("Prestige must be 0–100.");
      setEdits((e) => ({ ...e, [row.id]: String(row.prestige) }));
      return;
    }
    if (n === row.prestige) return;
    setSavingId(row.id);
    startTransition(async () => {
      const res = await setCoursePrestige(row.id, n, row.prestigeSource);
      setSavingId(null);
      if (res.ok) {
        setEdits((e) => {
          const next = { ...e };
          delete next[row.id];
          return next;
        });
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  if (rows.length === 0) {
    return <p className="rounded-xl glass-panel p-6 text-center text-sm text-ink-3">No courses match.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl glass-panel">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule/60 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            <th className="px-3 py-2.5 text-right">#</th>
            <th className="px-3 py-2.5">Course</th>
            <th className="hidden px-3 py-2.5 sm:table-cell">Tier</th>
            <th className="px-3 py-2.5 text-right">Prestige</th>
            <th className="hidden px-3 py-2.5 text-right md:table-cell">Rarity</th>
            <th className="hidden px-3 py-2.5 text-right md:table-cell">Plays</th>
            <th className="px-3 py-2.5 text-right">Index</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule/40">
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-paper-sunken/30">
              <td className="px-3 py-2 text-right tabular-nums text-ink-3">{row.rank}</td>
              <td className="px-3 py-2">
                <Link href={`/courses/${row.id}`} className="font-medium text-ink hover:text-brand">
                  {row.name}
                </Link>
                <p className="truncate text-xs text-ink-3">
                  {[row.clubName, row.countyName].filter(Boolean).join(" · ") || "—"}
                </p>
              </td>
              <td className="hidden px-3 py-2 sm:table-cell">
                <span className="inline-flex items-center rounded-full border border-rule/70 bg-paper-sunken/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-2">
                  {TIER_LABELS[row.tier]}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  disabled={pending && savingId === row.id}
                  value={edits[row.id] ?? String(row.prestige)}
                  onChange={(e) => setEdits((s) => ({ ...s, [row.id]: e.target.value }))}
                  onBlur={() => commit(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="h-8 w-16 rounded-md border border-rule/70 bg-paper-sunken/40 px-2 text-right text-sm tabular-nums text-ink outline-none focus:border-brand/50"
                />
              </td>
              <td className="hidden px-3 py-2 text-right tabular-nums text-ink-3 md:table-cell">
                {row.vestigeRarity ?? "—"}
              </td>
              <td className="hidden px-3 py-2 text-right tabular-nums text-ink-3 md:table-cell">
                {row.playCount}
              </td>
              <td className="px-3 py-2 text-right">
                <span className="font-display text-base font-semibold tabular-nums text-brand">
                  {row.vestigeIndex ?? "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
