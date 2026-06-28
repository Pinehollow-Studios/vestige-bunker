import { cn } from "@/lib/utils";
import { eventLabel, eventGroup, GROUP_LABEL, type EventGroup } from "@/lib/analytics/config";
import type { AppEventRow } from "@/lib/analytics/queries";
import { EmptyHint } from "./viz";

const GROUP_TONE: Record<EventGroup, string> = {
  onboarding: "border-info/40 text-info",
  discovery: "border-brand/35 text-brand",
  play: "border-brand/35 text-brand",
  social: "border-amber/40 text-amber",
  lifecycle: "border-rule/70 text-ink-3",
  other: "border-rule/70 text-ink-3",
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Compact preview of the most useful property keys for a row. */
function propsPreview(props: Record<string, unknown> | null): string {
  if (!props) return "";
  const order = [
    "discovery_source",
    "source",
    "step",
    "method",
    "course_tier",
    "is_home_club",
    "was_bucketed",
    "holes_played",
    "opted_out",
    "privacy_tier",
  ];
  const parts: string[] = [];
  for (const k of order) {
    const v = props[k];
    if (v === undefined || v === null || typeof v === "object") continue;
    parts.push(`${k}=${String(v)}`);
    if (parts.length >= 4) break;
  }
  return parts.join(" · ");
}

/** Raw event stream - newest first. The "go look at it" surface. */
export function EventFeed({ rows, emptyLabel = "No events yet." }: { rows: AppEventRow[]; emptyLabel?: string }) {
  if (rows.length === 0) return <EmptyHint>{emptyLabel}</EmptyHint>;
  return (
    <ol className="divide-y divide-rule/60 overflow-hidden rounded-xl glass-panel">
      {rows.map((r) => {
        const group = eventGroup(r.event_name);
        const preview = propsPreview(r.properties);
        return (
          <li key={r.id} className="flex items-start gap-3 px-4 py-3">
            <span
              className={cn(
                "mt-0.5 inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                GROUP_TONE[group],
              )}
            >
              {GROUP_LABEL[group]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{eventLabel(r.event_name)}</p>
              {preview && <p className="mt-0.5 truncate font-mono text-[11px] text-ink-3">{preview}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] tabular-nums text-ink-3">{relTime(r.created_at)}</p>
              <p className="text-[10px] text-ink-3/70">
                {[r.device_model, r.app_version].filter(Boolean).join(" · ")}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
