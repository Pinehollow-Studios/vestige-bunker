"use client";

import { LAYOUT_LABELS, TIER_LABELS, type CourseLayout, type CourseTier } from "../types";

/**
 * App-accurate preview of the iOS course-detail sheet, rendered from the live
 * course-editor values. Sits inside a {@link PreviewFrame}.
 */
export function CoursePreviewContent({
  name,
  club,
  county,
  coverURL,
  description,
  par,
  yards,
  holeCount,
  style,
  established,
  tier,
  layout,
}: {
  name: string;
  club: string | null;
  county: string | null;
  coverURL: string | null;
  description: string;
  par: number | null;
  yards: number | null;
  holeCount: number;
  style: string;
  established: number | null;
  tier: CourseTier;
  layout: CourseLayout;
}) {
  const subtitleParts = [TIER_LABELS[tier], LAYOUT_LABELS[layout], style || null, established ? `est. ${established}` : null].filter(
    Boolean,
  );

  return (
    <div className="pb-6 text-ink">
      <div className="relative h-44 w-full overflow-hidden">
        {coverURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverURL} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-brand/25 via-paper-raised to-paper" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-1 p-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-brand">
            THE COURSE{county ? ` · ${county.toUpperCase()}` : ""}
          </p>
          <h2 className="font-display text-xl font-semibold leading-tight text-ink">{name}</h2>
          {club && <p className="text-[11px] text-ink-2">{club}</p>}
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4">
        <p className="text-[10px] font-medium text-ink-3">{subtitleParts.join(" · ")}</p>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Par" value={par != null ? String(par) : "—"} />
          <Stat label="Holes" value={String(holeCount)} />
          <Stat label="Yards" value={yards != null ? yards.toLocaleString() : "—"} />
        </div>

        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-brand">About</p>
          {description.trim() ? (
            <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-ink-2">{description}</p>
          ) : (
            <p className="text-[11px] italic text-ink-3">No description yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-paper-raised px-2 py-2 text-center">
      <p className="font-display text-base font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
    </div>
  );
}
