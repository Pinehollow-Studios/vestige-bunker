"use client";

import { Column, DataTable, type SortDir } from "@/components/admin/table/DataTable";
import { cn } from "@/lib/utils";
import {
  audienceSummary,
  KIND_LABELS,
  statusFor,
  STATUS_CHIP,
  STATUS_DOT,
  STATUS_LABELS,
  type AnnouncementOverviewRow,
} from "./types";

export function AnnouncementsTable({
  rows,
  sort,
  dir,
}: {
  rows: AnnouncementOverviewRow[];
  sort: string;
  dir: SortDir;
}) {
  const columns: Column<AnnouncementOverviewRow>[] = [
    {
      key: "title",
      header: "Announcement",
      sortKey: "title",
      width: "minmax(240px,2.6fr)",
      cell: (r) => {
        const status = statusFor(r);
        return (
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])} />
              {KIND_LABELS[r.kind]}
              {r.eyebrow && <span className="font-normal normal-case tracking-normal text-ink-3">· {r.eyebrow}</span>}
            </p>
            <p className="truncate font-medium text-ink">{r.title}</p>
            <p className="truncate text-xs text-ink-3">{audienceSummary(r)}</p>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      width: "100px",
      cell: (r) => {
        const status = statusFor(r);
        return (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              STATUS_CHIP[status],
            )}
          >
            {STATUS_LABELS[status]}
          </span>
        );
      },
    },
    {
      key: "priority",
      header: "Priority",
      sortKey: "priority",
      width: "80px",
      align: "right",
      hideBelow: "md",
      cell: (r) => <span className="text-xs tabular-nums text-ink-2">{r.priority}</span>,
    },
    {
      key: "receipts",
      header: "Seen · Dis · Act",
      width: "minmax(120px,1fr)",
      align: "right",
      hideBelow: "lg",
      cell: (r) => (
        <span className="text-xs tabular-nums text-ink-3">
          <span className="text-ink-2">{r.seen_count}</span> · {r.dismissed_count} · {r.acted_count}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => `/announcements/${r.id}`}
      sort={sort}
      dir={dir}
      empty={<p className="text-sm text-ink-3">No announcements match.</p>}
    />
  );
}
