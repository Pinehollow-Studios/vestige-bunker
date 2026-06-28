import Link from "next/link";
import { ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  audienceSummary,
  STATUS_CHIP,
  STATUS_DOT,
  STATUS_LABELS,
  type BroadcastOverviewRow,
} from "./types";

/** One broadcast as a glass-panel card. Links to the editor. */
export function BroadcastCard({ row }: { row: BroadcastOverviewRow }) {
  const count = row.audience_kind === "individuals" ? row.target_user_count : undefined;
  return (
    <Link
      href={`/notifications/${row.id}`}
      className="group flex flex-col gap-3 rounded-xl glass-panel p-4 transition-colors hover:border-brand/40"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[row.status])} />
          {row.is_critical ? (
            <span className="inline-flex items-center gap-1 text-alert">
              <Zap aria-hidden className="size-3" /> Critical
            </span>
          ) : (
            "Push"
          )}
        </p>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            STATUS_CHIP[row.status],
          )}
        >
          {STATUS_LABELS[row.status]}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-medium text-ink">{row.title}</p>
        {row.body && <p className="mt-0.5 line-clamp-2 text-xs text-ink-2">{row.body}</p>}
        <p className="mt-1 truncate text-xs text-ink-3">{audienceSummary(row, count)}</p>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-rule/40 pt-2.5 text-xs text-ink-3">
        <span className="tabular-nums">{footerLabel(row)}</span>
        <ChevronRight aria-hidden className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}

function footerLabel(row: BroadcastOverviewRow): string {
  if (row.status === "sent") {
    const n = row.recipient_count ?? 0;
    return `${n} ${n === 1 ? "person" : "people"} reached`;
  }
  if (row.status === "scheduled" && row.scheduled_at) {
    return `For ${new Date(row.scheduled_at).toLocaleString()}`;
  }
  if (row.status === "canceled") return "Canceled";
  return "Not sent yet";
}
