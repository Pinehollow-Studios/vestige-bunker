"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setCoursesPrestige } from "../courses/actions";
import { TIER_LABELS, type CourseTier } from "../courses/types";
import { projectIndex } from "./formula";

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

type Edit = { prestige: string; source: string };

/**
 * The ranked Index table as a *batch editor*. Prestige + source edits are
 * staged locally (not autosaved); each edited row previews its projected Index
 * live from the real formula, and a sticky bar commits every change at once via
 * the batch RPC (one recompute, not one per edit). Index + rarity are computed,
 * read-only. Expanding a row shows its plays → rarity → index breakdown and the
 * editorial source note.
 */
export function IndexTable({ rows, raritySwing }: { rows: IndexRow[]; raritySwing: number }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const editFor = (row: IndexRow): Edit =>
    edits[row.id] ?? { prestige: String(row.prestige), source: row.prestigeSource ?? "" };

  const prestigeNum = (row: IndexRow): number => Number(editFor(row).prestige);
  const prestigeValid = (row: IndexRow): boolean => {
    const n = prestigeNum(row);
    return Number.isFinite(n) && n >= 0 && n <= 100 && editFor(row).prestige.trim() !== "";
  };
  const isDirty = (row: IndexRow): boolean => {
    const e = editFor(row);
    const prestigeChanged = prestigeValid(row) && prestigeNum(row) !== row.prestige;
    const sourceChanged = e.source.trim() !== (row.prestigeSource ?? "").trim();
    return prestigeChanged || sourceChanged;
  };

  const dirtyRows = useMemo(
    () => rows.filter((r) => isDirty(r)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, edits],
  );
  const anyInvalid = useMemo(
    () => rows.some((r) => !prestigeValid(r)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, edits],
  );

  function patch(id: string, base: Edit, key: keyof Edit, value: string) {
    setEdits((s) => ({ ...s, [id]: { ...base, ...(s[id] ?? base), [key]: value } }));
  }

  function discard() {
    setEdits({});
  }

  function save() {
    if (dirtyRows.length === 0) return;
    if (anyInvalid) {
      toast.error("Some prestige values are outside 0-100.");
      return;
    }
    const items = dirtyRows.map((r) => ({
      courseId: r.id,
      prestige: prestigeNum(r),
      source: editFor(r).source.trim() || null,
    }));
    startTransition(async () => {
      const res = await setCoursesPrestige(items);
      if (res.ok) {
        toast.success(`Saved ${res.data?.toLocaleString() ?? items.length} courses · index recomputed`);
        setEdits({});
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
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl glass-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule/60 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
              <th className="px-3 py-2.5 text-right">#</th>
              <th className="px-3 py-2.5">Course</th>
              <th className="hidden px-3 py-2.5 sm:table-cell">Tier</th>
              <th className="hidden px-3 py-2.5 text-right md:table-cell">Plays</th>
              <th className="hidden px-3 py-2.5 text-right md:table-cell">Rarity</th>
              <th className="px-3 py-2.5 text-right">Prestige</th>
              <th
                className="px-3 py-2.5 text-right"
                title="Live preview of this row's Index from the current prestige + swing. Exact for the edited row; other rows can shift a point on recompute."
              >
                Projected
              </th>
              <th className="px-3 py-2.5 text-right">Index</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule/40">
            {rows.map((row) => {
              const e = editFor(row);
              const dirty = isDirty(row);
              const valid = prestigeValid(row);
              const open = expanded === row.id;
              const projected = valid ? projectIndex(prestigeNum(row), row.vestigeRarity, raritySwing) : null;
              const showProjected = dirty && valid && projected !== row.vestigeIndex;
              return (
                <FragmentRow key={row.id}>
                  <tr className={dirty ? "bg-brand/[0.04] transition-colors" : "transition-colors hover:bg-paper-sunken/30"}>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {dirty && <span aria-hidden className="size-1.5 rounded-full bg-amber" title="Unsaved" />}
                        {row.rank}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-1.5">
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : row.id)}
                          className="mt-0.5 text-ink-3 transition-colors hover:text-ink"
                          aria-label={open ? "Hide breakdown" : "Show breakdown"}
                        >
                          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        </button>
                        <div className="min-w-0">
                          <Link href={`/courses/${row.id}`} className="font-medium text-ink hover:text-brand">
                            {row.name}
                          </Link>
                          <p className="truncate text-xs text-ink-3">
                            {[row.clubName, row.countyName].filter(Boolean).join(" · ") || "-"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 sm:table-cell">
                      <span className="inline-flex items-center rounded-full border border-rule/70 bg-paper-sunken/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-2">
                        {TIER_LABELS[row.tier]}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2 text-right tabular-nums text-ink-3 md:table-cell">{row.playCount}</td>
                    <td className="hidden px-3 py-2 text-right tabular-nums text-ink-3 md:table-cell">
                      {row.vestigeRarity ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        inputMode="numeric"
                        value={e.prestige}
                        onChange={(ev) => patch(row.id, e, "prestige", ev.target.value)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") ev.currentTarget.blur();
                        }}
                        className={
                          "h-8 w-16 rounded-md border bg-paper-sunken/40 px-2 text-right text-sm tabular-nums text-ink outline-none focus:border-brand/50 " +
                          (valid ? "border-rule/70" : "border-alert/70 text-alert")
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {showProjected ? (
                        <span
                          className="font-display text-base font-semibold tabular-nums text-amber"
                          title="Projected - commit to apply"
                        >
                          {projected}
                        </span>
                      ) : (
                        <span className="tabular-nums text-ink-3">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="font-display text-base font-semibold tabular-nums text-brand">
                        {row.vestigeIndex ?? "-"}
                      </span>
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-paper-sunken/20">
                      <td />
                      <td colSpan={7} className="px-3 pb-3 pt-0">
                        <div className="space-y-2 rounded-lg border border-rule/50 bg-paper/40 p-3">
                          <p className="font-mono text-xs text-ink-2">
                            {row.playCount} plays → rarity{" "}
                            <span className="text-ink">{row.vestigeRarity ?? "-"}</span> → index{" "}
                            <span className="text-brand">{row.vestigeIndex ?? "-"}</span>
                            <span className="text-ink-3">
                              {" "}
                              (prestige {row.prestige}, swing ±{Math.round(raritySwing * 100)}%)
                            </span>
                          </p>
                          <label className="block">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                              Prestige source
                            </span>
                            <input
                              type="text"
                              value={e.source}
                              placeholder="e.g. Top100GolfCourses #42, NCG 2025"
                              onChange={(ev) => patch(row.id, e, "source", ev.target.value)}
                              className="mt-1 h-9 w-full rounded-lg border border-rule/70 bg-paper-sunken/40 px-3 text-sm text-ink outline-none focus:border-brand/50"
                            />
                          </label>
                        </div>
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>

      {dirtyRows.length > 0 && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-paper-raised/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-paper-raised/80">
          <p className="text-sm text-ink-2">
            <span className="font-semibold text-ink">{dirtyRows.length}</span>{" "}
            {dirtyRows.length === 1 ? "course" : "courses"} edited
            {anyInvalid && <span className="text-alert"> · fix out-of-range values to save</span>}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={pending} onClick={discard}>
              Discard
            </Button>
            <Button size="sm" disabled={pending || anyInvalid} onClick={save}>
              {pending ? "Saving…" : `Save ${dirtyRows.length} ${dirtyRows.length === 1 ? "change" : "changes"}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A keyed fragment so a row + its expansion render as siblings in <tbody>. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
