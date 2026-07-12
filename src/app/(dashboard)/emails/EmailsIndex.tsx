"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Mail, Settings2, Smartphone, UsersRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { WriteEmailButton } from "./WriteEmailButton";
import { STATUS_CHIP, STATUS_LABELS, type CampaignStatus } from "./campaigns/types";

export type EmailListItem = {
  id: string;
  kind: "app" | "waitlist";
  href: string;
  subject: string;
  name: string;
  status: CampaignStatus;
  audience: string;
  sentCount: number;
  failedCount: number;
  scheduledAt: string | null;
  sortAt: string;
};

type Filter = "all" | "draft" | "scheduled" | "sent";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "scheduled", label: "Scheduled" },
  { key: "sent", label: "Sent" },
];

export function EmailsIndex({ items, error }: { items: EmailListItem[]; error?: string | null }) {
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "sent") return items.filter((i) => i.status === "sent" || i.status === "sending");
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  const counts = useMemo(
    () => ({
      all: items.length,
      draft: items.filter((i) => i.status === "draft").length,
      scheduled: items.filter((i) => i.status === "scheduled").length,
      sent: items.filter((i) => i.status === "sent" || i.status === "sending").length,
    }),
    [items],
  );

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">Couldn’t load your emails: {error}</div>
        <WriteEmailButton />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key ? "border-brand/50 bg-brand/10 text-brand" : "border-border bg-surface-2 text-ink-2 hover:text-ink",
              )}
            >
              {f.label}
              <span className="ml-1 tabular-nums opacity-60">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/emails/waitlist"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:text-ink"
          >
            <UsersRound className="size-3.5" /> Waitlist subscribers
          </Link>
          <Link
            href="/emails/automatic"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:text-ink"
          >
            <Settings2 className="size-3.5" /> Automatic emails
          </Link>
          <WriteEmailButton />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-rule/60 bg-paper-sunken/30 px-4 py-10 text-center text-sm text-ink-3">
          No {filter} emails.
        </p>
      ) : (
        <div className="space-y-2">
          {shown.map((it) => (
            <EmailRow key={`${it.kind}-${it.id}`} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmailRow({ item }: { item: EmailListItem }) {
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-paper-raised/50 p-3.5 transition-colors hover:border-brand/40 hover:bg-brand/[0.02]"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          item.kind === "app" ? "bg-brand/10 text-brand" : "bg-amber/10 text-amber",
        )}
        title={item.kind === "app" ? "App members" : "Waitlist"}
      >
        {item.kind === "app" ? <Smartphone className="size-4" /> : <Users className="size-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{item.subject || "(no subject)"}</p>
        <p className="truncate text-xs text-ink-3">
          {item.kind === "app" ? "App members" : "Waitlist"} · {item.audience} · {footer(item)}
        </p>
      </div>

      <span
        className={cn(
          "hidden shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider sm:inline-flex",
          STATUS_CHIP[item.status],
        )}
      >
        {STATUS_LABELS[item.status]}
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function footer(item: EmailListItem): string {
  if (item.status === "sent") return item.failedCount > 0 ? `${item.sentCount} sent · ${item.failedCount} failed` : `${item.sentCount} sent`;
  if (item.status === "sending") return "Sending…";
  if (item.status === "scheduled" && item.scheduledAt) return new Date(item.scheduledAt).toLocaleString();
  if (item.status === "canceled") return "Canceled";
  return "Draft";
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-brand/30 bg-brand/[0.03] p-10 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Mail className="size-5" />
      </span>
      <p className="mt-3 font-display text-base font-semibold text-ink">Write your first email</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">
        Send an update to your app members or the waitlist. Start from a template, preview it, send a test to yourself,
        then send now or schedule it.
      </p>
      <div className="mt-4 flex justify-center">
        <WriteEmailButton />
      </div>
    </div>
  );
}
