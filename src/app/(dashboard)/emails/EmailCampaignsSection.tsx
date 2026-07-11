import { Send } from "lucide-react";
import { EmailCampaignCard } from "./campaigns/EmailCampaignCard";
import { NewCampaignButton } from "./campaigns/NewCampaignButton";
import type { EmailCampaignOverviewRow } from "./campaigns/types";

/**
 * "Campaigns you send" — the one-off + scheduled emails Jack composes and sends
 * to users. Mirrors the "Messages you send" block on /notifications, one layer
 * down (Resend instead of push). Sits above the transactional template editor.
 */
export function EmailCampaignsSection({ campaigns }: { campaigns: EmailCampaignOverviewRow[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand">
          <Send className="size-3" /> Your team
        </span>
        <h2 className="font-display text-lg font-semibold text-ink">Campaigns you send</h2>
        <span className="text-sm text-ink-3">- one-off emails to everyone, a cohort, or a person</span>
        <div className="ml-auto">
          <NewCampaignButton />
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand/30 bg-brand/[0.03] p-8 text-center">
          <p className="text-sm text-ink-2">No campaigns yet.</p>
          <p className="mt-0.5 text-sm text-ink-3">Compose an email - a note to everyone, a cohort, or one person.</p>
          <div className="mt-3 flex justify-center">
            <NewCampaignButton />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {campaigns.map((c) => (
            <EmailCampaignCard key={c.id} row={c} />
          ))}
        </div>
      )}
    </section>
  );
}
