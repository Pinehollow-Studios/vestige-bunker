"use client";

import { Column, DataTable, type SortDir } from "@/components/admin/table/DataTable";
import { BadgeMedallion } from "@/components/badges/BadgeMedallion";
import { cn } from "@/lib/utils";
import {
  STATUS_CHIP,
  STATUS_DOT,
  STATUS_LABELS,
  type BadgeStatus,
  type BadgeTier,
  type BadgeCategory,
} from "./types";

export type BadgeTableRow = {
  id: string;
  name: string;
  tagline: string | null;
  glyph: string;
  tint_hex: string | null;
  tier: BadgeTier;
  category: BadgeCategory;
  is_secret: boolean;
  status: BadgeStatus;
  criteriaText: string;
};

export function BadgesTable({ rows, sort, dir }: { rows: BadgeTableRow[]; sort: string; dir: SortDir }) {
  const columns: Column<BadgeTableRow>[] = [
    {
      key: "name",
      header: "Badge",
      sortKey: "name",
      width: "minmax(220px,2.4fr)",
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <BadgeMedallion spec={{ glyph: r.glyph, tint_hex: r.tint_hex, tier: r.tier }} size={34} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-medium text-ink">
              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[r.status])} />
              {r.name}
            </p>
            {r.tagline && <p className="truncate text-xs text-ink-3">{r.tagline}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      width: "100px",
      cell: (r) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            STATUS_CHIP[r.status],
          )}
        >
          {STATUS_LABELS[r.status]}
        </span>
      ),
    },
    {
      key: "tier",
      header: "Tier",
      sortKey: "tier",
      width: "100px",
      hideBelow: "md",
      cell: (r) => <span className="text-xs capitalize text-ink-2">{r.tier}</span>,
    },
    {
      key: "category",
      header: "Category",
      sortKey: "category",
      width: "108px",
      hideBelow: "md",
      cell: (r) => <span className="text-xs capitalize text-ink-2">{r.category}</span>,
    },
    {
      key: "criteria",
      header: "Earned by",
      width: "minmax(160px,1.8fr)",
      hideBelow: "lg",
      cell: (r) => <span className="truncate text-xs text-ink-3">{r.criteriaText}</span>,
    },
    {
      key: "secret",
      header: "",
      width: "64px",
      align: "center",
      cell: (r) =>
        r.is_secret ? (
          <span className="rounded-full border border-info/30 bg-info/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-info">
            Secret
          </span>
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/badges/${r.id}`}
      sort={sort}
      dir={dir}
      empty={<p className="text-sm text-ink-3">No badges match.</p>}
    />
  );
}
