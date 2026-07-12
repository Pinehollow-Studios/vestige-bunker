import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_CHIP, STATUS_LABELS, type WaitlistCampaignOverviewRow } from "./types";

/** One waitlist email as a card — subject + delivery state. */
export function WaitlistCampaignCard({ row }: { row: WaitlistCampaignOverviewRow }) {
  return (
    <Link
      href={`/emails/waitlist/${row.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-amber/25 bg-amber/[0.04] p-3.5 transition-colors hover:border-amber/50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber">
          <Users className="size-3" /> Waitlist
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

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{row.subject || "(no subject)"}</p>
        <p className="truncate text-xs text-ink-3">{row.name}</p>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-rule/40 pt-2.5 text-xs text-ink-3">
        <span className="truncate">{audienceLabel(row)} · {footerLabel(row)}</span>
        <ChevronRight aria-hidden className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}

function audienceLabel(row: WaitlistCampaignOverviewRow): string {
  if (row.audience_kind === "individuals") {
    return `${row.target_count} ${row.target_count === 1 ? "person" : "people"}`;
  }
  return "Everyone";
}

function footerLabel(row: WaitlistCampaignOverviewRow): string {
  if (row.status === "sent") {
    const n = row.sent_count ?? 0;
    const failed = row.failed_count ?? 0;
    return failed > 0 ? `${n} sent · ${failed} failed` : `${n} sent`;
  }
  if (row.status === "sending") return "Sending…";
  if (row.status === "scheduled" && row.scheduled_at) return new Date(row.scheduled_at).toLocaleString();
  if (row.status === "canceled") return "Canceled";
  return "Not sent yet";
}
