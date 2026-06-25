"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EyeOff, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  messageUser,
  setAccountStatus,
  setLeaderboardHidden,
  type AccountStatus,
} from "../actions";

/**
 * Inline admin actions on a user — set account status, hide/unhide from public
 * leaderboards, message via the outreach thread. Sensitive moves confirm first;
 * everything reflects on the next refresh (the RPCs revalidate the hub).
 */
export function UserActions({
  userId,
  status,
  hidden,
  isSuperAdmin,
}: {
  userId: string;
  status: AccountStatus;
  hidden: boolean;
  isSuperAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.message);
      else toast.success(ok);
    });

  const changeStatus = (next: AccountStatus) => {
    if (next === status) return;
    if (next === "suspended" && !confirm("Suspend this account? They'll be blocked from signing in.")) return;
    if (next === "restricted" && !confirm("Restrict this account? They keep access but can't log new rounds.")) return;
    run(() => setAccountStatus(userId, next), `Account → ${next}`);
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    run(() => messageUser(userId, message), "Message sent — opens their feedback thread");
    setMessage("");
  };

  const STATUSES: { value: AccountStatus; label: string; tone: "brand" | "amber" | "alert" }[] = [
    { value: "active", label: "Active", tone: "brand" },
    { value: "restricted", label: "Restricted", tone: "amber" },
    { value: "suspended", label: "Suspended", tone: "alert" },
  ];

  return (
    <section className="space-y-4 rounded-xl glass-panel p-5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Admin actions</h2>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Account status</p>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => {
            const active = s.value === status;
            const disabled = pending || (s.value === "suspended" && !isSuperAdmin);
            return (
              <button
                key={s.value}
                type="button"
                disabled={disabled}
                onClick={() => changeStatus(s.value)}
                title={s.value === "suspended" && !isSuperAdmin ? "Suspend requires super admin" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  active ? activeTone(s.tone) : "border-rule/70 text-ink-2 hover:border-brand/40 hover:text-ink",
                )}
              >
                {s.label}
                {active && " · now"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Public leaderboards</p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => setLeaderboardHidden(userId, !hidden), hidden ? "Restored to leaderboards" : "Hidden from leaderboards")
          }
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
            hidden
              ? "border-rule/70 text-ink-2 hover:border-brand/40 hover:text-ink"
              : "border-amber/40 text-amber hover:bg-amber/10",
          )}
        >
          <EyeOff aria-hidden className="size-3.5" />
          {hidden ? "Restore to leaderboards" : "Hide from leaderboards"}
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Message the user</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Opens an outreach thread in their in-app feedback…"
          disabled={pending}
          className="block w-full resize-y rounded-lg border border-rule/70 bg-paper-sunken/40 p-2.5 text-xs text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={sendMessage}
            disabled={pending || !message.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg transition-opacity disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Send
          </button>
        </div>
      </div>
    </section>
  );
}

function activeTone(tone: "brand" | "amber" | "alert"): string {
  return tone === "brand"
    ? "border-brand bg-brand/15 text-brand"
    : tone === "amber"
      ? "border-amber bg-amber/15 text-amber"
      : "border-alert bg-alert/15 text-alert";
}
