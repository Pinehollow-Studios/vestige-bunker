import { Mail } from "lucide-react";
import { ComposeEmailButton } from "./campaigns/ComposeEmailButton";
import { EmailCampaignCard } from "./campaigns/EmailCampaignCard";
import type { EmailCampaignOverviewRow } from "./campaigns/types";

/**
 * "Emails you send" — the one-off + scheduled emails you compose and send to
 * users (marketing notes, announcements, product updates), delivered via Resend.
 * Distinct from the automatic system emails on the other tab. The primary
 * "New email" action lives in the page header; this renders the list / empty
 * state.
 */
export function EmailCampaignsSection({
  campaigns,
  error,
}: {
  campaigns: EmailCampaignOverviewRow[];
  error?: string | null;
}) {
  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Couldn’t load your emails: {error}
        </div>
        <ComposeEmailButton />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-brand/30 bg-brand/[0.03] p-10 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Mail className="size-5" />
        </span>
        <p className="mt-3 font-display text-base font-semibold text-ink">Write your first email</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">
          Compose a one-off email and send it to everyone, a specific cohort, or a hand-picked
          few. Write it now, then send straight away or schedule it for later.
        </p>
        <div className="mt-4 flex justify-center">
          <ComposeEmailButton label="Write an email" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {campaigns.map((c) => (
        <EmailCampaignCard key={c.id} row={c} />
      ))}
    </div>
  );
}
