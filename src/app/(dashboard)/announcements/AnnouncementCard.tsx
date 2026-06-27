import Link from "next/link";
import { ChevronRight } from "lucide-react";
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

/**
 * One announcement as a glass-panel card (replaces the old DataTable row).
 * Kind + status-dot lead, status chip trails; title can wrap two lines; the
 * footer carries the seen/dismissed/acted receipts + priority. Links to the
 * editor at `/announcements/[id]`.
 */
export function AnnouncementCard({ row }: { row: AnnouncementOverviewRow }) {
  const status = statusFor(row);
  return (
    <Link
      href={`/announcements/${row.id}`}
      className="group flex flex-col gap-3 rounded-xl glass-panel p-4 transition-colors hover:border-brand/40"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])} />
          {KIND_LABELS[row.kind]}
        </p>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            STATUS_CHIP[status],
          )}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        {row.eyebrow && <p className="truncate text-xs text-ink-3">{row.eyebrow}</p>}
        <p className="line-clamp-2 font-medium text-ink">{row.title}</p>
        <p className="mt-1 truncate text-xs text-ink-3">{audienceSummary(row)}</p>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-rule/40 pt-2.5 text-xs text-ink-3">
        <span className="tabular-nums">
          <span className="text-ink-2">{row.seen_count}</span> seen · {row.dismissed_count} dis · {row.acted_count} act
        </span>
        <span className="flex items-center gap-1">
          <span className="tabular-nums">P{row.priority}</span>
          <ChevronRight aria-hidden className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
      </div>
    </Link>
  );
}
