"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadRecipientEvents } from "../actions";
import type { CampaignRecipientRow, EmailEventRow } from "../types";

/**
 * The per-recipient delivery + engagement table for a sent campaign — the
 * Resend-parity view: who was delivered / opened (×N) / clicked / bounced (with
 * reason) / complained / failed, filterable, with an expandable raw event
 * timeline per person (`admin_email_recipient_events`).
 */

type Filter = "all" | "opened" | "not_opened" | "clicked" | "bounced" | "complained" | "failed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "opened", label: "Opened" },
  { key: "not_opened", label: "Not opened" },
  { key: "clicked", label: "Clicked" },
  { key: "bounced", label: "Bounced" },
  { key: "complained", label: "Complained" },
  { key: "failed", label: "Failed" },
];

function matches(r: CampaignRecipientRow, f: Filter): boolean {
  switch (f) {
    case "all":
      return true;
    case "opened":
      return r.open_count > 0;
    case "not_opened":
      return r.status === "sent" && r.open_count === 0 && !r.bounced_at;
    case "clicked":
      return r.click_count > 0;
    case "bounced":
      return !!r.bounced_at;
    case "complained":
      return !!r.complained_at;
    case "failed":
      return r.status === "failed";
  }
}

export function RecipientTable({ recipients }: { recipients: CampaignRecipientRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: recipients.length,
      opened: 0,
      not_opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      failed: 0,
    };
    for (const r of recipients) {
      for (const f of FILTERS) if (f.key !== "all" && matches(r, f.key)) c[f.key] += 1;
    }
    return c;
  }, [recipients]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return recipients.filter((r) => {
      if (!matches(r, filter)) return false;
      if (!needle) return true;
      return (
        r.email.toLowerCase().includes(needle) ||
        (r.display_name ?? "").toLowerCase().includes(needle) ||
        (r.username ?? "").toLowerCase().includes(needle)
      );
    });
  }, [recipients, filter, q]);

  if (recipients.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-rule/60 bg-paper-sunken/30 px-3 py-6 text-center text-sm text-ink-3">
        No recipients logged for this campaign yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-brand/50 bg-brand/10 text-brand"
                  : "border-rule/60 text-ink-2 hover:text-ink",
              )}
            >
              {f.label}
              <span className="ml-1 tabular-nums text-ink-3">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto min-w-[180px] flex-1 sm:max-w-xs">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search recipients"
            className="w-full rounded-lg border border-rule/60 bg-paper-sunken/40 py-1.5 pl-8 pr-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-brand/50"
          />
        </div>
      </div>

      <div className="divide-y divide-rule/40 overflow-hidden rounded-xl border border-border">
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-3">No recipients match.</p>
        ) : (
          rows.map((r) => <Row key={r.user_id} r={r} />)
        )}
      </div>
    </div>
  );
}

function Row({ r }: { r: CampaignRecipientRow }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<EmailEventRow[] | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && events === null && r.resend_id) {
      start(async () => {
        const res = await loadRecipientEvents(r.resend_id!);
        setEvents(res.ok ? res.data ?? [] : []);
      });
    }
  }

  const name = r.display_name?.trim() || r.username || r.email;

  return (
    <div>
      <div className="flex items-center gap-1 px-1">
        <button
          type="button"
          onClick={toggle}
          disabled={!r.resend_id}
          className="flex flex-1 items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-paper-raised/40 disabled:cursor-default"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{name}</p>
            <p className="truncate text-[11px] text-ink-3">{r.email}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <StatePills r={r} />
          </div>
          {r.resend_id && (
            <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
          )}
        </button>
        {r.resend_id && (
          <Link
            href={`/emails/message/${encodeURIComponent(r.resend_id)}`}
            title="Open full email"
            className="shrink-0 rounded-md p-1.5 text-ink-3 transition-colors hover:text-ink"
          >
            <ExternalLink aria-hidden className="size-4" />
          </Link>
        )}
      </div>

      {open && (
        <div className="border-t border-rule/40 bg-paper-sunken/20 px-3 py-3">
          {pending && events === null ? (
            <p className="text-xs text-ink-3">Loading timeline…</p>
          ) : !events || events.length === 0 ? (
            <p className="text-xs text-ink-3">No events recorded from Resend yet.</p>
          ) : (
            <ol className="space-y-1.5">
              {events.map((e, i) => (
                <li key={i} className="flex items-baseline gap-2 text-xs">
                  <EventDot type={e.event_type} />
                  <span className="w-24 shrink-0 font-medium capitalize text-ink">{e.event_type.replace(/_/g, " ")}</span>
                  <span className="tabular-nums text-ink-3">{fullTime(e.occurred_at)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-2">{eventDetail(e)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function StatePills({ r }: { r: CampaignRecipientRow }) {
  const pills: React.ReactNode[] = [];
  if (r.status === "pending") pills.push(<Pill key="p" tone="neutral">Pending</Pill>);
  if (r.status === "failed") pills.push(<Pill key="f" tone="alert" title={r.error ?? undefined}>Failed</Pill>);
  if (r.complained_at) pills.push(<Pill key="c" tone="alert">Complained</Pill>);
  if (r.bounced_at) pills.push(<Pill key="b" tone="alert" title={r.bounce_reason ?? undefined}>Bounced</Pill>);
  if (r.click_count > 0) pills.push(<Pill key="cl" tone="brand">Clicked{r.click_count > 1 ? ` ×${r.click_count}` : ""}</Pill>);
  if (r.open_count > 0) pills.push(<Pill key="o" tone="brand">Opened{r.open_count > 1 ? ` ×${r.open_count}` : ""}</Pill>);
  if (r.delivered_at && r.open_count === 0 && !r.bounced_at) pills.push(<Pill key="d" tone="muted">Delivered</Pill>);
  if (pills.length === 0 && r.status === "sent") pills.push(<Pill key="s" tone="muted">Sent</Pill>);
  return <>{pills}</>;
}

function Pill({
  tone,
  title,
  children,
}: {
  tone: "brand" | "alert" | "muted" | "neutral";
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
        tone === "brand" && "border-brand/30 bg-brand/10 text-brand",
        tone === "alert" && "border-alert/30 bg-alert/10 text-alert",
        tone === "muted" && "border-rule/60 text-ink-3",
        tone === "neutral" && "border-amber/30 bg-amber/10 text-amber",
      )}
    >
      {children}
    </span>
  );
}

function EventDot({ type }: { type: EmailEventRow["event_type"] }) {
  const alert = type === "bounced" || type === "complained" || type === "failed";
  const engage = type === "opened" || type === "clicked";
  return (
    <span
      aria-hidden
      className={cn(
        "mt-1 size-1.5 shrink-0 rounded-full",
        alert ? "bg-alert" : engage ? "bg-brand" : "bg-ink-3",
      )}
    />
  );
}

function eventDetail(e: EmailEventRow): string {
  const m = (e.meta ?? {}) as Record<string, unknown>;
  if (e.event_type === "bounced") {
    const b = (m.bounce ?? {}) as Record<string, unknown>;
    return [b.type, b.message].filter(Boolean).join(" · ");
  }
  if (e.event_type === "clicked") {
    const c = (m.click ?? {}) as Record<string, unknown>;
    return typeof c.link === "string" ? c.link : "";
  }
  if (e.event_type === "opened") {
    const o = (m.open ?? {}) as Record<string, unknown>;
    return typeof o.userAgent === "string" ? o.userAgent : "";
  }
  return "";
}

function fullTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
