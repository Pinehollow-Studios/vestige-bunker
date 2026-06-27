"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { COUNTY_STATUS_CHIP, COUNTY_STATUS_LABELS, type TemplateCountyRow } from "../types";

/**
 * The per-county theming workbench — a coverage checklist Jack works
 * down, sorted by demand. Each county links to its theming editor;
 * status reads Live / Coming soon (draft) / Untouched. This is the
 * heart of the editorial work: turning a generic auto-society into one
 * that feels hand-made, county by county.
 */
export function CountyWorkbench({ templateId, rows }: { templateId: string; rows: TemplateCountyRow[] }) {
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    let live = 0;
    let draft = 0;
    for (const r of rows) {
      if (r.status === "live") live += 1;
      else if (r.status === "draft") draft += 1;
    }
    return { live, draft, untouched: rows.length - live - draft };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => r.county_name.toLowerCase().includes(needle));
  }, [q, rows]);

  const pct = rows.length > 0 ? Math.round((counts.live / rows.length) * 100) : 0;

  return (
    <section className="space-y-4 rounded-xl glass-panel p-5">
      <header className="space-y-0.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">County coverage</h2>
        <p className="text-xs text-ink-3">
          Theme each county, then publish it live. Un-published counties read “coming soon” in the app. Sorted by
          demand.
        </p>
      </header>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-ink-2">{pct}% live</span>
          <span className="text-ink-3">
            <span className="font-semibold tabular-nums text-brand">{counts.live}</span> live ·{" "}
            <span className="font-semibold tabular-nums text-amber">{counts.draft}</span> coming soon ·{" "}
            <span className="tabular-nums">{counts.untouched}</span> untouched
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-paper-sunken">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-rule/70 bg-paper-sunken/40 px-3">
        <Search aria-hidden className="size-4 shrink-0 text-ink-3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search counties…"
          className="h-9 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-rule/70 bg-paper-sunken/30 p-6 text-center text-sm text-ink-3">
          No counties match.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule/70">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-paper-sunken/50 text-left text-[11px] uppercase tracking-wider text-ink-3">
                <th className="px-3 py-2 font-semibold">County</th>
                <th className="px-3 py-2 text-right font-semibold">Courses</th>
                <th className="px-3 py-2 text-right font-semibold">Waiting</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.county_id} className="border-t border-rule/60">
                  <td className="px-3 py-2">
                    <Link
                      href={`/societies/${templateId}/counties/${r.county_id}`}
                      className="font-medium text-ink transition-colors hover:text-brand"
                    >
                      {r.county_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-2">{r.course_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-2">{r.demand_count || "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        COUNTY_STATUS_CHIP[r.status],
                      )}
                    >
                      {COUNTY_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/societies/${templateId}/counties/${r.county_id}`}
                      className="inline-flex text-ink-3 transition-colors hover:text-ink"
                      aria-label={`Theme ${r.county_name}`}
                    >
                      <ChevronRight aria-hidden className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
