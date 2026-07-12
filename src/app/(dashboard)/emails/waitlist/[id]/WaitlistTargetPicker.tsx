"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { loadWaitlistSubscribers, setWaitlistCampaignTargets } from "../actions";
import type { WaitlistSubscriberRow } from "../types";

/**
 * Hand-pick which subscribers a waitlist email goes to. Search the list, tick
 * people in; the selection persists server-side (`admin_set_waitlist_campaign_targets`)
 * on every change so it survives a reload. Selected emails show as chips.
 */
export function WaitlistTargetPicker({
  campaignId,
  initialSelected,
  disabled,
  onCountChange,
}: {
  campaignId: string;
  initialSelected: string[];
  disabled?: boolean;
  onCountChange?: (n: number) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected.map((e) => e.toLowerCase())));
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<WaitlistSubscriberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    const r = await loadWaitlistSubscribers(q, 50, 0);
    setLoading(false);
    if (r.ok) setResults((r.data ?? []).filter((s) => s.status === "subscribed"));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void runSearch(search), 300);
    return () => clearTimeout(t);
  }, [search, runSearch]);

  function persist(next: Set<string>) {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(async () => {
      const r = await setWaitlistCampaignTargets(campaignId, Array.from(next));
      if (!r.ok) toast.error(r.message);
    }, 400);
  }

  function toggle(email: string) {
    if (disabled) return;
    const e = email.toLowerCase();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      onCountChange?.(next.size);
      persist(next);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from(selected).map((e) => (
            <span key={e} className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-xs text-brand">
              {e}
              {!disabled && (
                <button onClick={() => toggle(e)} className="text-brand/70 hover:text-brand" aria-label={`Remove ${e}`}>
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!disabled && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subscribers by email…"
              className="h-9 w-full rounded-lg border border-input bg-paper-sunken/40 pl-9 pr-3 text-sm placeholder:text-ink-3 focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
            />
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto">
            {loading && results.length === 0 ? (
              <p className="px-1 py-3 text-sm text-ink-3">Searching…</p>
            ) : results.length === 0 ? (
              <p className="px-1 py-3 text-sm text-ink-3">{search ? "No matches." : "Type to search subscribers."}</p>
            ) : (
              results.map((s) => {
                const on = selected.has(s.email.toLowerCase());
                return (
                  <button
                    key={s.email}
                    onClick={() => toggle(s.email)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors",
                      on ? "border-brand/40 bg-brand/5" : "border-rule/50 bg-paper-sunken/30 hover:bg-surface-2",
                    )}
                  >
                    <span className="min-w-0 truncate text-ink">{s.email}</span>
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border",
                        on ? "border-brand bg-brand text-brand-fg" : "border-ink-3/40",
                      )}
                    >
                      {on && <Check className="size-3" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {selected.size === 0 && (
        <p className="text-xs text-ink-3">No one selected yet — search above and tick people in.</p>
      )}
    </div>
  );
}
