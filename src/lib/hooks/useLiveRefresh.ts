"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Keep a server-rendered list live. Subscribes to a table's Supabase Realtime
 * changes (when the table is in the realtime publication) and refreshes the
 * route's server components on change, plus whenever the tab regains focus -
 * so a queue is never stale after you switch away and back. Best-effort: a
 * table not in the publication just means no push; focus-refresh still keeps
 * it fresh. Shared by the feedback inbox + the photo moderation grid.
 *
 * `router.refresh()` re-runs the server page (fresh data) while preserving the
 * calling client component's own state (selection, focus) - the key to a live
 * queue that doesn't lose your place.
 */
export function useLiveRefresh(
  table: string,
  opts?: { onInsert?: () => void; debounceMs?: number },
): { live: boolean; refresh: () => void } {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceMs = opts?.debounceMs ?? 400;

  // Keep the latest onInsert in a ref so the subscription effect stays stable
  // even when the caller passes an inline callback (ref write in an effect is
  // allowed; during render it isn't).
  const onInsertRef = useRef(opts?.onInsert);
  useEffect(() => {
    onInsertRef.current = opts?.onInsert;
  }, [opts?.onInsert]);

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), debounceMs);
  }, [router, debounceMs]);

  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel(`live-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        if (payload.eventType === "INSERT") onInsertRef.current?.();
        refresh();
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sb.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [table, refresh]);

  return { live, refresh };
}
