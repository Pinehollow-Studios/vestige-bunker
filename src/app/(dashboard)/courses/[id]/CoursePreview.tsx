"use client";

import { LAYOUT_LABELS, TIER_LABELS, type CourseLayout, type CourseTier } from "../types";

/**
 * App-accurate preview of the iOS course-detail sheet, rebuilt to mirror the
 * real `CourseDetailSheet` screen: a rounded hero photo, then the "peek block"
 * (eyebrow → serif title → club → a stat row led by the mint Par hero numeral),
 * followed by the glass detail + About cards. Rendered from live editor values
 * and sits inside a {@link PreviewFrame}. The dashboard shares the iOS Atlas
 * palette (paper / ink / mint), so the colours read true to the app.
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
  const details: { label: string; value: string }[] = [
    { label: "Layout", value: LAYOUT_LABELS[layout] },
    { label: "Style", value: style.trim() || "—" },
    { label: "Established", value: established ? String(established) : "—" },
  ];

  return (
    <div className="bg-paper pb-6 text-ink">
      {/* Hero — rounded photo card, matching the sheet's gallery hero */}
      <div className="px-3 pt-3">
        <div className="relative h-40 w-full overflow-hidden rounded-[1.25rem] ring-1 ring-white/10">
          {coverURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverURL} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/25 via-paper-raised to-paper text-[10px] uppercase tracking-[0.18em] text-ink-3">
              No hero photo
            </div>
          )}
        </div>
      </div>

      {/* Peek block — eyebrow, title, club, stat row */}
      <div className="space-y-3 px-4 pt-4">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-3">
            <span aria-hidden className="size-1.5 rounded-full bg-brand" />
            THE COURSE{county ? ` · ${county.toUpperCase()}` : ""}
          </p>
          <h2 className="font-display text-2xl font-medium leading-tight tracking-tight text-ink">
            {name || "Untitled course"}
          </h2>
          {club && <p className="text-[11px] text-ink-2">{club}</p>}
        </div>

        <div className="flex items-end gap-4">
          <Stat value={par != null ? String(par) : "—"} label="Par" hero />
          <Stat value={String(holeCount)} label="Holes" />
          <Stat value={yards != null ? yards.toLocaleString() : "—"} label="Yards" />
          <span className="ml-auto inline-flex items-center self-center rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-ink-2">
            {TIER_LABELS[tier]}
          </span>
        </div>
      </div>

      {/* Course details card */}
      <div className="px-4 pt-4">
        <div className="divide-y divide-white/8 rounded-[1.1rem] border border-white/10 bg-white/[0.035] px-4">
          {details.map((d) => (
            <div key={d.label} className="flex items-center justify-between py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                {d.label}
              </span>
              <span className="text-[12px] font-medium text-ink">{d.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* About card */}
      <div className="px-4 pt-3">
        <div className="space-y-2 rounded-[1.1rem] border border-white/10 bg-white/[0.035] p-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-brand">About</p>
          {description.trim() ? (
            <p className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink-2">
              {description}
            </p>
          ) : (
            <p className="text-[11.5px] italic text-ink-3">No description yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, hero = false }: { value: string; label: string; hero?: boolean }) {
  return (
    <div>
      <p
        className={
          hero
            ? "bg-gradient-to-br from-brand to-[#8FE85B] bg-clip-text font-display text-[30px] font-semibold leading-none tabular-nums text-transparent"
            : "font-display text-xl font-semibold leading-none tabular-nums text-ink"
        }
      >
        {value}
      </p>
      <p className="mt-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-ink-3">{label}</p>
    </div>
  );
}
