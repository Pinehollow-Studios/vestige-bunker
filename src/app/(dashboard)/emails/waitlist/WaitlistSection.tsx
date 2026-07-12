import { Users } from "lucide-react";
import { WaitlistComposeButton } from "./WaitlistComposeButton";
import { ImportFromResendButton } from "./ImportFromResendButton";
import { ImportCsvButton } from "./ImportCsvButton";
import { WaitlistCampaignCard } from "./WaitlistCampaignCard";
import { WaitlistLive } from "./WaitlistLive";
import type {
  WaitlistOverview,
  WaitlistSubscriberRow,
  WaitlistCampaignOverviewRow,
} from "./types";

/**
 * "Waitlist" — the pre-launch email list. Its own corner of /emails: the emails
 * you send to it, then the live (auto-refreshing) subscriber list + counts.
 */
export function WaitlistSection({
  overview,
  subscribers,
  campaigns,
  error,
}: {
  overview: WaitlistOverview | null;
  subscribers: WaitlistSubscriberRow[];
  campaigns: WaitlistCampaignOverviewRow[];
  error?: string | null;
}) {
  if (error) {
    return (
      <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
        Couldn’t load the waitlist: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-2">
          Email your whole list, or hand-pick specific members. Opens, clicks and bounces are tracked per email.
        </p>
        <div className="flex items-center gap-2">
          <ImportCsvButton />
          <ImportFromResendButton />
          <WaitlistComposeButton />
        </div>
      </div>

      {/* Emails sent to the waitlist */}
      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber/30 bg-amber/[0.03] p-10 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-amber/10 text-amber">
            <Users className="size-5" />
          </span>
          <p className="mt-3 font-display text-base font-semibold text-ink">Email your waitlist</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">
            Write an update and send it to everyone waiting for launch — or just a few people. Send now or
            schedule it for later; opens, clicks and bounces are tracked here.
          </p>
          <div className="mt-4 flex justify-center">
            <WaitlistComposeButton label="Write an email" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {campaigns.map((c) => (
            <WaitlistCampaignCard key={c.id} row={c} />
          ))}
        </div>
      )}

      {/* Live counts + full subscriber list */}
      <WaitlistLive initialOverview={overview} initialSubscribers={subscribers} />
    </div>
  );
}
