"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ANNOUNCEMENT_KINDS,
  AUDIENCE_KINDS,
  AUDIENCE_LABELS,
  KIND_LABELS,
  STATUS_CHIP,
  STATUS_LABELS,
  type AnnouncementAudienceKind,
  type AnnouncementKind,
  type AnnouncementStatus,
} from "./types";

const STATUSES: AnnouncementStatus[] = [
  "live",
  "scheduled",
  "draft",
  "expired",
  "archived",
];

/**
 * URL-param-driven filter bar above the announcements index. Status, kind, and
 * audience pills each toggle a `searchParams` entry via
 * `router.replace(url, { scroll: false })` so triage views are deep-linkable.
 * The host page reads the params and filters the overview rows client-side.
 * Mirrors the feedback QueueFilters idiom.
 */
export function AnnouncementFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const selectedStatuses = (params.getAll("status") as AnnouncementStatus[]) ?? [];
  const selectedKinds = (params.getAll("kind") as AnnouncementKind[]) ?? [];
  const selectedAudiences = (params.getAll("audience") as AnnouncementAudienceKind[]) ?? [];

  const updateParam = (key: string, value: string, present: boolean) => {
    const next = new URLSearchParams(params.toString());
    const all = next.getAll(key);
    next.delete(key);
    if (present) {
      for (const v of all) next.append(key, v);
      if (!all.includes(value)) next.append(key, value);
    } else {
      for (const v of all) {
        if (v !== value) next.append(key, v);
      }
    }
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  const clearAll = () => {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  const hasFilters =
    selectedStatuses.length > 0 ||
    selectedKinds.length > 0 ||
    selectedAudiences.length > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-paper-raised p-4 ring-1 ring-foreground/5">
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          <Filter aria-hidden className="size-3" />
          Filter
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            disabled={pending}
            className="inline-flex items-center gap-1 text-[11px] text-ink-3 hover:text-ink-2"
          >
            <X aria-hidden className="size-3" />
            Clear
          </button>
        )}
      </header>

      <FilterRow label="Status">
        {STATUSES.map((status) => {
          const isActive = selectedStatuses.includes(status);
          return (
            <button
              key={status}
              type="button"
              disabled={pending}
              onClick={() => updateParam("status", status, !isActive)}
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition",
                STATUS_CHIP[status],
                isActive ? "ring-2 ring-brand/40" : "opacity-60 hover:opacity-100",
              )}
            >
              {STATUS_LABELS[status]}
            </button>
          );
        })}
      </FilterRow>

      <FilterRow label="Kind">
        {ANNOUNCEMENT_KINDS.map((kind) => {
          const isActive = selectedKinds.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              disabled={pending}
              onClick={() => updateParam("kind", kind, !isActive)}
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition",
                isActive
                  ? "border-brand/40 bg-brand/10 text-brand-deep ring-2 ring-brand/40 dark:text-brand-soft"
                  : "border-border bg-paper-sunken/60 text-ink-2 hover:border-brand/30",
              )}
            >
              {KIND_LABELS[kind]}
            </button>
          );
        })}
      </FilterRow>

      <FilterRow label="Audience">
        {AUDIENCE_KINDS.map((audience) => {
          const isActive = selectedAudiences.includes(audience);
          return (
            <button
              key={audience}
              type="button"
              disabled={pending}
              onClick={() => updateParam("audience", audience, !isActive)}
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition",
                isActive
                  ? "border-brand/40 bg-brand/10 text-brand-deep ring-2 ring-brand/40 dark:text-brand-soft"
                  : "border-border bg-paper-sunken/60 text-ink-2 hover:border-brand/30",
              )}
            >
              {AUDIENCE_LABELS[audience]}
            </button>
          );
        })}
      </FilterRow>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        {label}
      </span>
      {children}
    </div>
  );
}
