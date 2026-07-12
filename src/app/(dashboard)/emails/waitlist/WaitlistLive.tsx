"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadWaitlistOverview, loadWaitlistSubscribers } from "./actions";
import type { WaitlistOverview, WaitlistSubscriberRow } from "./types";

const PAGE = 100;
const OVERVIEW_POLL_MS = 12_000;
const LIST_POLL_MS = 15_000;

/**
 * The live half of the Waitlist tab — headline counts + the full, searchable,
 * paginated subscriber list, both auto-refreshing so the page reflects new
 * signups without a reload. Seeded from the server render, then keeps itself
 * fresh: counts every 12s, page-1 of the list every 15s (paused while you've
 * paginated or are typing, so it never yanks your place).
 */
export function WaitlistLive({
  initialOverview,
  initialSubscribers,
}: {
  initialOverview: WaitlistOverview | null;
  initialSubscribers: WaitlistSubscriberRow[];
}) {
  const [overview, setOverview] = useState<WaitlistOverview>(
    initialOverview ?? { total: 0, subscribed: 0, unsubscribed: 0, bounced: 0, new_7d: 0, new_30d: 0 },
  );
  const [rows, setRows] = useState<WaitlistSubscriberRow[]>(initialSubscribers);
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(initialSubscribers.length >= PAGE);
  const [loading, setLoading] = useState(false);
  const [paginated, setPaginated] = useState(false);

  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  // Overview counts — always live.
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await loadWaitlistOverview();
      if (r.ok && r.data) setOverview((o) => ({ ...o, ...r.data }));
    }, OVERVIEW_POLL_MS);
    return () => clearInterval(t);
  }, []);

  const loadPage1 = useCallback(async (q: string) => {
    setLoading(true);
    const r = await loadWaitlistSubscribers(q, PAGE, 0);
    setLoading(false);
    if (r.ok) {
      setRows(r.data ?? []);
      setHasMore((r.data ?? []).length >= PAGE);
      setPaginated(false);
    }
  }, []);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => void loadPage1(search), 350);
    return () => clearTimeout(t);
  }, [search, loadPage1]);

  // Auto-refresh page 1 — only when the user hasn't paginated or is mid-search.
  useEffect(() => {
    const t = setInterval(() => {
      if (!paginated && searchRef.current === "") void loadPage1("");
    }, LIST_POLL_MS);
    return () => clearInterval(t);
  }, [paginated, loadPage1]);

  async function loadMore() {
    setLoading(true);
    const r = await loadWaitlistSubscribers(search, PAGE, rows.length);
    setLoading(false);
    if (r.ok) {
      const next = r.data ?? [];
      setRows((prev) => [...prev, ...next]);
      setHasMore(next.length >= PAGE);
      setPaginated(true);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile icon={<Users className="size-4" />} label="Subscribed" value={overview.subscribed} tone="brand" />
        <StatTile icon={<UserPlus className="size-4" />} label="New · 7 days" value={overview.new_7d} />
        <StatTile icon={<Clock className="size-4" />} label="New · 30 days" value={overview.new_30d} />
        <StatTile icon={<UserMinus className="size-4" />} label="Unsubscribed" value={overview.unsubscribed} tone="muted" />
      </div>

      <section className="rounded-2xl border border-border bg-paper-raised/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Subscribers</p>
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          </div>
          <span className="text-xs text-ink-3">{overview.total.toLocaleString()} total</span>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email…"
            className="h-9 w-full rounded-lg border border-input bg-paper-sunken/40 pl-9 pr-3 text-sm placeholder:text-ink-3 focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          />
        </div>

        {rows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-rule/60 bg-paper-sunken/30 px-3 py-6 text-center text-sm text-ink-3">
            {search ? "No subscribers match that search." : "No subscribers yet. Import from Resend to bring your list in."}
          </p>
        ) : (
          <>
            <div className="mt-3 max-h-[32rem] space-y-1 overflow-y-auto">
              {rows.map((s) => (
                <div
                  key={s.email}
                  className="flex items-center justify-between gap-2 rounded-md border border-rule/50 bg-paper-sunken/30 px-2.5 py-1.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-ink">{s.email}</p>
                    <p className="truncate text-xs text-ink-3">
                      {new Date(s.subscribed_at).toLocaleDateString()}
                      {s.source ? ` · ${s.source}` : ""}
                    </p>
                  </div>
                  <StatusChip status={s.status} />
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="mt-3 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-50"
                >
                  {loading ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function StatusChip({ status }: { status: WaitlistSubscriberRow["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        status === "subscribed"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
          : status === "unsubscribed"
            ? "border-border bg-surface-2 text-ink-3"
            : "border-alert/40 bg-alert/10 text-alert",
      )}
    >
      {status}
    </span>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "default" | "brand" | "muted";
}) {
  const display = useMemo(() => value.toLocaleString(), [value]);
  return (
    <div className="rounded-xl border border-border bg-paper-raised/50 p-3">
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full",
          tone === "brand" ? "bg-brand/10 text-brand" : tone === "muted" ? "bg-surface-2 text-ink-3" : "bg-surface-2 text-ink-2",
        )}
      >
        {icon}
      </span>
      <p className="mt-2 font-display text-xl font-semibold tabular-nums text-ink">{display}</p>
      <p className="text-[11px] uppercase tracking-wider text-ink-3">{label}</p>
    </div>
  );
}
