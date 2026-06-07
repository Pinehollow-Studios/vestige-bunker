import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "live" | "soon";

type Props = {
  href: string;
  title: string;
  description: string;
  status: Status;
  /** Primary count badge in the header (live only). */
  count?: number;
  /** Optional pill rendered next to the count, e.g. "3 due today". */
  accent?: string;
  /** Rich preview body — recent rows, status breakdown, etc. */
  children?: ReactNode;
  /** Bullet list of what the section will surface once wired (soon only). */
  plannedSurfaces?: string[];
  /** Footer CTA text. Defaults match status. */
  ctaLabel?: string;
};

/**
 * Single tile on the dashboard overview.
 *
 * Live tiles get a brand-tinted top stripe, an oversized DM Sans
 * Hero numeral for the count, and the whole card becomes a Link.
 * Soon tiles get a dashed border, a "Soon" stamp, and a planned-
 * surfaces list that doubles as a spec for the next slice.
 */
export function OverviewCard({
  href,
  title,
  description,
  status,
  count,
  accent,
  children,
  plannedSurfaces,
  ctaLabel,
}: Props) {
  const isLive = status === "live";
  const showAttention = isLive && (count ?? 0) > 0;

  const body = (
    <article
      className={cn(
        "group/card relative flex h-full flex-col gap-4 rounded-2xl border bg-paper-raised/60 p-5 transition-colors",
        isLive
          ? "border-rule/70 hover:border-brand/40"
          : "border-dashed border-rule/60 bg-paper-raised/30",
        showAttention && "border-brand/30",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-base font-semibold leading-tight text-ink">
              {title}
            </h3>
            {!isLive && <SoonStamp />}
          </div>
          <p className="text-xs leading-relaxed text-ink-2">
            {description}
          </p>
        </div>
        {isLive && (count !== undefined || accent) && (
          <div className="flex flex-col items-end gap-1">
            {count !== undefined && (
              <span
                className={cn(
                  "font-hero text-3xl leading-none tabular-nums",
                  count > 0
                    ? "text-brand"
                    : "text-ink-3/50",
                )}
              >
                {count}
              </span>
            )}
            {accent && (
              <span className="text-[10px] uppercase tracking-wider text-ink-3">
                {accent}
              </span>
            )}
          </div>
        )}
      </header>

      {isLive && children && <div className="flex-1">{children}</div>}

      {!isLive && plannedSurfaces && plannedSurfaces.length > 0 && (
        <ul className="flex-1 space-y-1.5 text-xs text-ink-2">
          {plannedSurfaces.map((surface) => (
            <li key={surface} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-[7px] inline-block size-1 shrink-0 rounded-full bg-brand/50"
              />
              <span className="leading-snug">{surface}</span>
            </li>
          ))}
        </ul>
      )}

      <footer className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
        {isLive ? (
          <span className="inline-flex items-center gap-1 font-semibold text-brand">
            {ctaLabel ?? "Open"}
            <ArrowUpRight
              aria-hidden
              className="size-3.5 transition-transform group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5"
            />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-ink-3">
            <Clock aria-hidden className="size-3" />
            {ctaLabel ?? "Wires up when the iOS feature lands"}
          </span>
        )}
        {isLive && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-brand">
            <span aria-hidden className="size-1.5 rounded-full bg-brand" />
            Live
          </span>
        )}
      </footer>
    </article>
  );

  if (!isLive) return body;
  return (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  );
}

function SoonStamp() {
  return (
    <span className="rounded-full border border-border bg-paper-sunken/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-3">
      Soon
    </span>
  );
}

/**
 * Inline list rendered inside a live OverviewCard's preview slot.
 * Each row is a label + secondary line + trailing meta — generic
 * enough to render lists, photos, safeguarding flags, anything.
 */
export function PreviewList({
  items,
  emptyLabel,
}: {
  items: Array<{
    key: string;
    primary: string;
    secondary?: string;
    trailing?: string;
  }>;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/70 bg-paper-sunken/50 px-3 py-4 text-center text-xs text-ink-3">
        {emptyLabel}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-paper-sunken/40">
      {items.map((item) => (
        <li
          key={item.key}
          className="flex items-baseline gap-2 px-3 py-2 text-xs transition-colors hover:bg-paper-raised/60"
        >
          <span className="min-w-0 flex-1 truncate font-medium text-ink">
            {item.primary}
          </span>
          {item.secondary && (
            <span className="hidden truncate text-ink-3 sm:inline">
              {item.secondary}
            </span>
          )}
          {item.trailing && (
            <span className="shrink-0 tabular-nums text-ink-3">
              {item.trailing}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Horizontal status breakdown for the curated-lists card. Renders
 * a row of label + count pairs with a thin proportional bar
 * underneath so the editorial mix is readable at a glance.
 */
export function StatusBreakdown({
  segments,
}: {
  segments: Array<{
    key: string;
    label: string;
    count: number;
    tone: "live" | "draft" | "scheduled" | "expired" | "archived";
  }>;
}) {
  const total = segments.reduce((sum, seg) => sum + seg.count, 0);
  const toneClass: Record<typeof segments[number]["tone"], string> = {
    live: "bg-brand",
    scheduled: "bg-info",
    draft: "bg-ink-3/55",
    expired: "bg-alert",
    archived: "bg-ink-3/35",
  };
  return (
    <div className="space-y-2.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-paper-sunken ring-1 ring-inset ring-border/60">
        {total > 0 ? (
          segments.map((seg) =>
            seg.count === 0 ? null : (
              <div
                key={seg.key}
                className={cn(toneClass[seg.tone], "transition-all")}
                style={{ width: `${(seg.count / total) * 100}%` }}
                aria-label={`${seg.label}: ${seg.count}`}
              />
            ),
          )
        ) : null}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        {segments.map((seg) => (
          <li key={seg.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-ink-2">
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", toneClass[seg.tone])}
              />
              {seg.label}
            </span>
            <span className="font-medium tabular-nums text-ink">{seg.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
