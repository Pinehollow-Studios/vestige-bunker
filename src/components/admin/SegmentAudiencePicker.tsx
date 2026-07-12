"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { listSegmentsForPicker } from "@/app/(dashboard)/segments/actions";
import type { BroadcastTarget } from "@/app/(dashboard)/notifications/types";

/**
 * Audience = a saved segment (audience_kind "segment"). Picks one saved segment;
 * its id is stored in the message/flag `target` jsonb ({ segment_id }) and the
 * membership is resolved LIVE at send/eval time by the server (`segment_targets`
 * → `_segment_contains_user`). Shows the segment's current member count as the
 * reach. Shared by every targeted surface — emails, broadcasts, announcements,
 * feature flags — so a segment means the same thing everywhere.
 */
export function SegmentAudiencePicker({
  target,
  setTarget,
}: {
  target: BroadcastTarget;
  setTarget: (t: BroadcastTarget) => void;
}) {
  const [segments, setSegments] = useState<{ id: string; name: string; member_count: number | null }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    listSegmentsForPicker().then((r) => {
      if (r.ok) setSegments(r.data ?? []);
      setLoaded(true);
    });
  }, []);

  const selectedId = target.segment_id ?? "";
  const selected = segments.find((s) => s.id === selectedId);

  if (loaded && segments.length === 0) {
    return (
      <div className="rounded-lg border border-rule/70 bg-paper-sunken/30 p-3 text-sm text-ink-2">
        No saved segments yet.{" "}
        <Link href="/segments" className="text-brand hover:underline">Create one</Link> to target a saved audience.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-brand/25 bg-brand/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
        <Target className="size-3.5 text-brand" /> Saved segment
      </div>
      <select
        className={cn(
          "h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-2.5 text-sm transition-colors",
          "focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
        )}
        value={selectedId}
        onChange={(e) => setTarget({ ...target, segment_id: e.target.value || undefined })}
      >
        <option value="">Choose a segment…</option>
        {segments.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}{s.member_count !== null ? ` (${s.member_count})` : ""}
          </option>
        ))}
      </select>
      {selected && (
        <p className="flex items-center gap-1.5 text-xs text-ink-2">
          <Users className="size-3.5 text-ink-3" />
          <span className="font-semibold tabular-nums text-ink">{(selected.member_count ?? 0).toLocaleString()}</span>
          members match right now — resolved live when this sends.
        </p>
      )}
      {!selectedId && loaded && <p className="text-xs text-ink-3">Pick a segment to target.</p>}
      <Link href="/segments" className="inline-block text-xs text-brand hover:underline">Manage segments →</Link>
    </div>
  );
}
