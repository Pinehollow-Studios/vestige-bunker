"use client";

import { Column, DataTable, PresenceFlag, type SortDir } from "@/components/admin/table/DataTable";
import { LAYOUT_LABELS, TIER_LABELS, type CourseLayout, type CourseTier } from "./types";

/** Serializable row the server page passes down (no functions cross the line). */
export type CourseTableRow = {
  id: string;
  name: string;
  club_name: string | null;
  county_name: string | null;
  tier: CourseTier;
  layout: CourseLayout;
  par: number | null;
  yards: number | null;
  hasPhoto: boolean;
  hasDescription: boolean;
  hasStats: boolean;
  lastEditedByName: string | null;
  updatedAt: string;
};

export function CoursesTable({
  rows,
  sort,
  dir,
}: {
  rows: CourseTableRow[];
  sort: string;
  dir: SortDir;
}) {
  const columns: Column<CourseTableRow>[] = [
    {
      key: "name",
      header: "Course",
      sortKey: "name",
      width: "minmax(200px,2.4fr)",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{r.name}</p>
          <p className="truncate text-xs text-ink-3">{r.club_name ?? "-"}</p>
        </div>
      ),
    },
    {
      key: "county",
      header: "County",
      width: "minmax(110px,1fr)",
      hideBelow: "md",
      cell: (r) => <span className="truncate text-ink-2">{r.county_name ?? "-"}</span>,
    },
    {
      key: "tier",
      header: "Tier",
      sortKey: "tier",
      width: "104px",
      cell: (r) => (
        <span className="inline-flex items-center rounded-full border border-rule/70 bg-paper-sunken/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-2">
          {TIER_LABELS[r.tier]}
        </span>
      ),
    },
    {
      key: "layout",
      header: "Layout",
      width: "116px",
      hideBelow: "lg",
      cell: (r) => <span className="text-xs text-ink-2">{LAYOUT_LABELS[r.layout]}</span>,
    },
    {
      key: "stats",
      header: "Par · Yds",
      width: "104px",
      hideBelow: "lg",
      cell: (r) => (
        <span className="text-xs tabular-nums text-ink-2">
          {r.par ?? "-"}
          {r.yards ? ` · ${r.yards.toLocaleString()}` : ""}
        </span>
      ),
    },
    {
      key: "quality",
      header: "Editorial",
      width: "112px",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <PresenceFlag present={r.hasPhoto} label="photo" />
          <PresenceFlag present={r.hasDescription} label="description" />
          <PresenceFlag present={r.hasStats} label="par & yards" />
        </div>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      sortKey: "updated",
      width: "minmax(120px,1fr)",
      align: "right",
      hideBelow: "xl",
      cell: (r) => (
        <span className="truncate text-xs text-ink-3">
          {r.lastEditedByName ? `${r.lastEditedByName} · ` : ""}
          {relativeTime(r.updatedAt)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/courses/${r.id}`}
      sort={sort}
      dir={dir}
      empty={<p className="text-sm text-ink-3">No courses match these filters.</p>}
    />
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
