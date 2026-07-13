"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { backfillCampaignEvents } from "../actions";

/**
 * Reconcile delivery events from Resend's API for an already-sent campaign —
 * for campaigns sent before the webhook was live, or to catch a missed webhook.
 * Only terminal states are recoverable (Resend's API exposes `last_event`, not
 * the full history), so live-campaign tracking still comes from the webhook.
 */
export function BackfillButton({ campaignId }: { campaignId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  function run() {
    setMsg(null);
    start(async () => {
      const res = await backfillCampaignEvents(campaignId);
      if (res.ok) {
        setMsg({ tone: "ok", text: `Reconciled ${res.data?.recorded ?? 0} of ${res.data?.scanned ?? 0} from Resend.` });
      } else {
        setMsg({ tone: "err", text: res.message });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-rule/60 px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:text-ink disabled:opacity-60"
      >
        <RefreshCw aria-hidden className={cn("size-3.5", pending && "animate-spin")} />
        {pending ? "Reconciling…" : "Reconcile from Resend"}
      </button>
      {msg && <span className={cn("text-xs", msg.tone === "ok" ? "text-ink-3" : "text-alert")}>{msg.text}</span>}
    </div>
  );
}
