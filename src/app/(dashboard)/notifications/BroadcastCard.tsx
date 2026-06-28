import Link from "next/link";
import { ChevronRight, Send, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  audienceSummary,
  STATUS_CHIP,
  STATUS_LABELS,
  type BroadcastOverviewRow,
} from "./types";
import { IOSNotification } from "./_components/previews";

/** One team broadcast as a card - with a realistic iOS preview + a TEAM tag. */
export function BroadcastCard({ row }: { row: BroadcastOverviewRow }) {
  const count = row.audience_kind === "individuals" ? row.target_user_count : undefined;
  return (
    <Link
      href={`/notifications/${row.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-brand/25 bg-brand/[0.04] p-3.5 transition-colors hover:border-brand/50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
          {row.is_critical ? <Zap className="size-3" /> : <Send className="size-3" />}
          {row.is_critical ? "Critical" : "From your team"}
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            STATUS_CHIP[row.status],
          )}
        >
          {STATUS_LABELS[row.status]}
        </span>
      </div>

      <IOSNotification title={row.title} body={row.body} />

      <div className="flex items-center justify-between gap-2 border-t border-rule/40 pt-2.5 text-xs text-ink-3">
        <span className="truncate">{audienceSummary(row, count)} · {footerLabel(row)}</span>
        <ChevronRight aria-hidden className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}

function footerLabel(row: BroadcastOverviewRow): string {
  if (row.status === "sent") {
    const n = row.recipient_count ?? 0;
    return `${n} reached`;
  }
  if (row.status === "scheduled" && row.scheduled_at) {
    return new Date(row.scheduled_at).toLocaleString();
  }
  if (row.status === "canceled") return "Canceled";
  return "Not sent yet";
}
