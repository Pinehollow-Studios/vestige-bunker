import { cn } from "@/lib/utils";

/**
 * The retention triangle — weekly signup cohorts down the side, weeks-since-
 * signup across the top, each cell the % of the cohort active (classic) or
 * still-around (unbounded) at that offset. Cell intensity is a mint ramp;
 * week 0 is shown but visually muted (it's ~always high).
 */

export type CohortCell = { offset: number; pct: number | null; active: number };
export type CohortRowData = { cohortWeek: string; size: number; cells: CohortCell[] };

export function CohortGrid({ rows, maxOffset }: { rows: CohortRowData[]; maxOffset: number }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-rule/60 bg-paper-sunken/30 px-3 py-8 text-center text-sm text-ink-3">
        No signups in this window yet.
      </p>
    );
  }
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: "3px" }}>
        <thead>
          <tr>
            <th className="min-w-28 pb-1 pr-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-3">Cohort</th>
            <th className="pb-1 pr-2 text-right text-[10px] font-semibold uppercase tracking-wider text-ink-3">Size</th>
            {offsets.map((o) => (
              <th key={o} className="min-w-11 pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                W{o}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cohortWeek}>
              <td className="pr-2 text-xs text-ink-2">{formatWeek(r.cohortWeek)}</td>
              <td className="pr-2 text-right text-xs tabular-nums text-ink-3">{r.size}</td>
              {offsets.map((o) => {
                const cell = r.cells.find((c) => c.offset === o);
                return <Cell key={o} cell={cell} muted={o === 0} />;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-ink-3">
        Each cell: % of that week&apos;s signups counted at that many weeks after joining. Empty cells haven&apos;t happened yet.
      </p>
    </div>
  );
}

function Cell({ cell, muted }: { cell?: CohortCell; muted: boolean }) {
  if (!cell || cell.pct === null) {
    return <td className="rounded-md bg-paper-sunken/20 py-1.5 text-center text-[11px] text-ink-3/40">·</td>;
  }
  const pct = cell.pct;
  // Mint intensity ramp — meaningful differences visible at low percentages too.
  const bg =
    pct >= 60 ? "bg-brand/80 text-brand-fg" :
    pct >= 40 ? "bg-brand/60 text-brand-fg" :
    pct >= 25 ? "bg-brand/40 text-ink" :
    pct >= 10 ? "bg-brand/25 text-ink" :
    pct > 0 ? "bg-brand/12 text-ink-2" :
    "bg-paper-sunken/50 text-ink-3";
  return (
    <td
      className={cn("rounded-md py-1.5 text-center text-[11px] font-medium tabular-nums", bg, muted && "opacity-70")}
      title={`${cell.active} of the cohort · ${pct}%`}
    >
      {pct}%
    </td>
  );
}

function formatWeek(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
