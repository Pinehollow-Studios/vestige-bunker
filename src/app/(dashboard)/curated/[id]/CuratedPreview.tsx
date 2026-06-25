"use client";

import { MapPin } from "lucide-react";
import type { CuratedCourseRow, CuratedListTier } from "../types";

/**
 * An app-accurate preview of the curated-list detail screen, rendered from the
 * live editor values. The dashboard shares the iOS Atlas palette, so this reads
 * like the real thing. Sits inside a {@link PreviewFrame}.
 */
export function CuratedPreviewContent({
  name,
  summary,
  bio,
  tier,
  isOrdered,
  coverURL,
  courses,
}: {
  name: string;
  summary: string;
  bio: string;
  tier: CuratedListTier | null;
  isOrdered: boolean;
  coverURL: string | null;
  courses: CuratedCourseRow[];
}) {
  const eyebrow = tier ? `LIST · ${tier.toUpperCase()}` : "LIST";
  const shown = courses.slice(0, 6);

  return (
    <div className="pb-6 text-ink">
      {/* Hero */}
      <div className="relative h-44 w-full overflow-hidden">
        {coverURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverURL} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-brand/25 via-paper-raised to-paper" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-1 p-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
          <h2 className="font-display text-xl font-semibold leading-tight text-ink">
            {name || "Untitled list"}
          </h2>
          {summary && <p className="line-clamp-2 text-[11px] leading-snug text-ink-2">{summary}</p>}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4 px-4 pt-4">
        {bio && <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-ink-2">{bio}</p>}

        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          <span className="text-ink-2">{courses.length}</span> courses
          <span aria-hidden>·</span>
          <span>{isOrdered ? "Ranked" : "Collection"}</span>
        </div>

        {courses.length === 0 ? (
          <p className="rounded-lg border border-dashed border-rule/60 px-3 py-6 text-center text-[11px] text-ink-3">
            No courses yet
          </p>
        ) : (
          <ul className="space-y-1.5">
            {shown.map((c, i) => (
              <li
                key={c.course_id}
                className="flex items-center gap-3 rounded-lg bg-paper-raised px-2.5 py-2"
              >
                {isOrdered ? (
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand/15 font-display text-xs font-semibold text-brand">
                    {i + 1}
                  </span>
                ) : (
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink">{c.course_name}</p>
                  <p className="flex items-center gap-1 truncate text-[10px] text-ink-3">
                    <MapPin aria-hidden className="size-2.5" />
                    {[c.club_name, c.county_name].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              </li>
            ))}
            {courses.length > shown.length && (
              <li className="px-2.5 pt-1 text-[10px] text-ink-3">+{courses.length - shown.length} more</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
