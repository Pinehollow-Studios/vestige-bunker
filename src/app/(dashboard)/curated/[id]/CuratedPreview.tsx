"use client";

import { ChevronRight } from "lucide-react";
import type { CuratedCourseRow, CuratedListTier } from "../types";

/**
 * App-accurate preview of the iOS curated-list detail screen, rebuilt to mirror
 * `CuratedListDetailView`: a full-bleed cover hero fading to paper with a tier
 * pill and serif title, an editorial kicker (region · tags), a mint-ruled bio
 * pull-quote, a glass stat strip, then the course rows — each with a cover tile,
 * a position stamp on ordered lists, and the editor's note. Rendered from live
 * editor values; sits inside a {@link PreviewFrame}.
 */
export function CuratedPreviewContent({
  name,
  summary,
  bio,
  tier,
  isOrdered,
  coverURL,
  courses,
  region,
  tags,
}: {
  name: string;
  summary: string;
  bio: string;
  tier: CuratedListTier | null;
  isOrdered: boolean;
  coverURL: string | null;
  courses: CuratedCourseRow[];
  region?: string;
  tags?: string[];
}) {
  const shown = courses.slice(0, 6);
  const kicker = [region?.trim() || null, ...(tags ?? [])].filter(Boolean);

  return (
    <div className="bg-paper pb-6 text-ink">
      {/* Full-bleed hero, fading to paper */}
      <div className="relative h-52 w-full overflow-hidden">
        {coverURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverURL} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-brand/25 via-paper-raised to-paper" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/55 to-transparent" />
        {tier && (
          <span className="absolute right-3 top-3 inline-flex items-center rounded-full border border-white/20 bg-black/30 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-brand backdrop-blur-sm">
            {tier}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-4">
          <h2 className="font-display text-[26px] font-medium leading-[1.05] tracking-tight text-ink">
            {name || "Untitled list"}
          </h2>
          {summary && (
            <p className="line-clamp-2 font-display text-[12.5px] italic leading-snug text-ink-2">
              {summary}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4">
        {/* Editorial kicker — region · tags */}
        {kicker.length > 0 && (
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            {kicker.map((part, i) => (
              <span key={i}>
                {i > 0 && <span className="text-ink-3/50"> · </span>}
                <span className={i === 0 && region?.trim() ? "text-brand" : "text-ink-2"}>{part}</span>
              </span>
            ))}
          </p>
        )}

        {/* Bio pull-quote */}
        {bio.trim() && (
          <div className="border-l-2 border-brand/80 pl-3">
            <p className="whitespace-pre-wrap font-display text-[12px] italic leading-relaxed text-ink">
              {bio}
            </p>
          </div>
        )}

        {/* Stat strip */}
        <div className="flex items-center gap-3 rounded-[1.1rem] border border-white/10 bg-white/[0.035] px-4 py-3">
          <span className="font-display text-2xl font-semibold leading-none tabular-nums text-brand">
            {courses.length}
          </span>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
            <p className="text-ink-2">{courses.length === 1 ? "course" : "courses"}</p>
            <p>{isOrdered ? "Ranked" : "Collection"}</p>
          </div>
        </div>

        {/* Course rows */}
        {courses.length === 0 ? (
          <p className="rounded-[1.1rem] border border-dashed border-white/12 px-3 py-6 text-center text-[11px] text-ink-3">
            No courses yet
          </p>
        ) : (
          <ul className="overflow-hidden rounded-[1.1rem] border border-white/10 bg-white/[0.025]">
            {shown.map((c, i) => (
              <li
                key={c.course_id}
                className="flex items-start gap-3 border-b border-white/8 px-3 py-2.5 last:border-b-0"
              >
                <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand/25 via-paper-raised to-paper-sunken ring-1 ring-white/10">
                  <span className="flex h-full w-full items-center justify-center font-display text-base font-semibold text-ink-2/70">
                    {c.course_name.trim().charAt(0).toUpperCase() || "·"}
                  </span>
                  {isOrdered && (
                    <span className="absolute left-0 top-0 inline-flex items-center rounded-br-lg bg-black/55 px-1.5 py-0.5 font-display text-[10px] font-semibold tabular-nums leading-none text-ink backdrop-blur-sm">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="truncate font-display text-[14px] font-medium leading-tight text-ink">
                    {c.course_name}
                  </p>
                  <p className="mt-0.5 truncate text-[10.5px] text-ink-3">
                    {[c.club_name, c.county_name].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {c.editor_note?.trim() && (
                    <p className="mt-1 border-l border-brand/60 pl-2 text-[10.5px] italic leading-snug text-ink-2">
                      {c.editor_note}
                    </p>
                  )}
                </div>
                <ChevronRight aria-hidden className="mt-1 size-3.5 shrink-0 text-ink-3/60" />
              </li>
            ))}
            {courses.length > shown.length && (
              <li className="px-3 py-2 text-center text-[10px] uppercase tracking-[0.14em] text-ink-3">
                +{courses.length - shown.length} more
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
