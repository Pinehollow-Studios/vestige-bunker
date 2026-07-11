import Link from "next/link";
import { ChevronRight, Mail, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  audienceSummary,
  STATUS_CHIP,
  STATUS_LABELS,
  type EmailCampaignOverviewRow,
} from "./types";

/** One email campaign as a card — subject + audience + delivery state. */
export function EmailCampaignCard({ row }: { row: EmailCampaignOverviewRow }) {
  const count = row.audience_kind === "individuals" ? row.target_user_count : undefined;
  return (
    <Link
      href={`/emails/campaigns/${row.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-brand/25 bg-brand/[0.04] p-3.5 transition-colors hover:border-brand/50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
          {row.bypass_marketing_consent ? <ShieldCheck className="size-3" /> : <Mail className="size-3" />}
          {row.bypass_marketing_consent ? "Service" : "Email"}
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
        <span className="truncate">{audienceSummary(row, count)} · {footerLabel(row)}</span>
        <ChevronRight aria-hidden className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}

function footerLabel(row: EmailCampaignOverviewRow): string {
  if (row.status === "sent") {
    const n = row.sent_count ?? 0;
    const failed = row.failed_count ?? 0;
    return failed > 0 ? `${n} sent · ${failed} failed` : `${n} sent`;
  }
  if (row.status === "sending") return "Sending…";
  if (row.status === "scheduled" && row.scheduled_at) {
    return new Date(row.scheduled_at).toLocaleString();
  }
  if (row.status === "canceled") return "Canceled";
  return "Not sent yet";
}
