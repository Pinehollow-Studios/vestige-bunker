import { Bell } from "lucide-react";
import { ComposeBroadcastButton } from "./ComposeBroadcastButton";
import { BroadcastCard } from "./BroadcastCard";
import type { BroadcastOverviewRow } from "./types";

/**
 * "Notifications you send" — the one-off + scheduled pushes you compose and send
 * to users (a heads-up to everyone, a note to a cohort, a message to one person),
 * delivered via APNs. Distinct from the automatic system notifications on the
 * other tab. The primary "New notification" action lives in the tab bar; this
 * renders the list / empty state.
 */
export function BroadcastsSection({
  broadcasts,
  error,
}: {
  broadcasts: BroadcastOverviewRow[];
  error?: string | null;
}) {
  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Couldn’t load your notifications: {error}
        </div>
        <ComposeBroadcastButton />
      </div>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-brand/30 bg-brand/[0.03] p-10 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Bell className="size-5" />
        </span>
        <p className="mt-3 font-display text-base font-semibold text-ink">Send your first notification</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">
          Compose a one-off push — a heads-up to everyone, a note to a cohort, or a message to one
          person. Write it now, then send straight away or schedule it for later.
        </p>
        <div className="mt-4 flex justify-center">
          <ComposeBroadcastButton label="Write a notification" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {broadcasts.map((r) => (
        <BroadcastCard key={r.id} row={r} />
      ))}
    </div>
  );
}
