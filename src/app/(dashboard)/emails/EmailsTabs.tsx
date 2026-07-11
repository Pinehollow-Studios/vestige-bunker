"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ComposeEmailButton } from "./campaigns/ComposeEmailButton";

type Tab = "send" | "auto";

/**
 * The two distinct jobs of the Emails page, split into tabs so each makes sense
 * on its own:
 *   • "Emails you send"  — compose + queue + send one-off emails to users.
 *   • "Automatic emails" — edit the wording of the system emails that send
 *                          themselves (welcome, password reset, …).
 * The primary "New email" action rides in the tab bar on the send tab, so
 * writing an email is always one obvious click. Inactive content is kept mounted
 * (hidden) so the template editor doesn't lose in-progress edits on tab switch.
 */
export function EmailsTabs({
  sendSlot,
  autoSlot,
}: {
  sendSlot: ReactNode;
  autoSlot: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("send");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule/60">
        <div className="flex gap-1" role="tablist" aria-label="Emails">
          <TabButton active={tab === "send"} onClick={() => setTab("send")}>
            Emails you send
          </TabButton>
          <TabButton active={tab === "auto"} onClick={() => setTab("auto")}>
            Automatic emails
          </TabButton>
        </div>
        {tab === "send" && <ComposeEmailButton className="mb-2" />}
      </div>

      <div className={cn(tab !== "send" && "hidden")}>{sendSlot}</div>
      <div className={cn(tab !== "auto" && "hidden")}>{autoSlot}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-brand text-ink"
          : "border-transparent text-ink-3 hover:text-ink-2",
      )}
    >
      {children}
    </button>
  );
}
