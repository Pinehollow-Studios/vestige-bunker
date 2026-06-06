"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import {
  type FeedbackKind,
  type FeedbackSeverity,
  type FeedbackStatus,
  type FeedbackUserSeverity,
  FEEDBACK_AREAS,
  FEEDBACK_KINDS,
  FEEDBACK_USER_SEVERITIES,
  kindLabel,
  severityChipClasses,
  severityLabel,
  statusChipClasses,
  statusLabel,
  userSeverityChipClasses,
  userSeverityLabel,
} from "@/lib/feedback/types";

const STATUSES: FeedbackStatus[] = [
  "new",
  "triaged",
  "inProgress",
  "resolved",
  "wontFix",
];
const SEVERITIES: FeedbackSeverity[] = ["low", "medium", "high", "critical"];
const KINDS: FeedbackKind[] = FEEDBACK_KINDS;

/**
 * Filter bar above the feedback queue (slice 6 polish). Status,
 * severity, kind, and free-text search drive `searchParams` on
 * the URL — every flip rewrites the URL via
 * `router.replace(url, { scroll: false })` so deep-linkable
 * triage views are first-class.
 *
 * The host page reads `searchParams` from its props and passes
 * the parsed array filters into `admin_feedback_queue` directly.
 */
export function QueueFilters({
  initialSearch,
}: {
  initialSearch: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);

  const selectedStatuses = (params.getAll("status") as FeedbackStatus[]) ?? [];
  const selectedSeverities =
    (params.getAll("severity") as FeedbackSeverity[]) ?? [];
  const selectedKinds = (params.getAll("kind") as FeedbackKind[]) ?? [];
  const selectedAreas = params.getAll("area") ?? [];
  const selectedUserSeverities =
    (params.getAll("userSeverity") as FeedbackUserSeverity[]) ?? [];

  const updateParam = (key: string, value: string, present: boolean) => {
    const next = new URLSearchParams(params.toString());
    const all = next.getAll(key);
    next.delete(key);
    if (present) {
      // Toggle on — keep existing + add this
      for (const v of all) next.append(key, v);
      if (!all.includes(value)) next.append(key, value);
    } else {
      // Toggle off — keep existing minus this
      for (const v of all) {
        if (v !== value) next.append(key, v);
      }
    }
    next.delete("offset");
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  const submitSearch = () => {
    const next = new URLSearchParams(params.toString());
    if (search.trim()) {
      next.set("q", search.trim());
    } else {
      next.delete("q");
    }
    next.delete("offset");
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  const clearAll = () => {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
      setSearch("");
    });
  };

  const hasFilters =
    selectedStatuses.length > 0 ||
    selectedSeverities.length > 0 ||
    selectedKinds.length > 0 ||
    selectedAreas.length > 0 ||
    selectedUserSeverities.length > 0 ||
    initialSearch.length > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-paper-raised p-4 ring-1 ring-foreground/5">
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          <Filter aria-hidden className="size-3" />
          Filter & search
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
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition ${statusChipClasses(status)} ${isActive ? "ring-2 ring-brand/40" : "opacity-60 hover:opacity-100"}`}
            >
              {statusLabel(status)}
            </button>
          );
        })}
      </FilterRow>

      <FilterRow label="Severity">
        {SEVERITIES.map((severity) => {
          const isActive = selectedSeverities.includes(severity);
          return (
            <button
              key={severity}
              type="button"
              disabled={pending}
              onClick={() => updateParam("severity", severity, !isActive)}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition ${severityChipClasses(severity)} ${isActive ? "ring-2 ring-brand/40" : "opacity-60 hover:opacity-100"}`}
            >
              {severityLabel(severity)}
            </button>
          );
        })}
      </FilterRow>

      <FilterRow label="Kind">
        {KINDS.map((kind) => {
          const isActive = selectedKinds.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              disabled={pending}
              onClick={() => updateParam("kind", kind, !isActive)}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${isActive ? "border-brand/40 bg-brand/10 text-brand-deep dark:text-brand-soft ring-2 ring-brand/40" : "border-border bg-paper-sunken/60 text-ink-2 hover:border-brand/30"}`}
            >
              {kindLabel(kind)}
            </button>
          );
        })}
      </FilterRow>

      <FilterRow label="Area">
        {FEEDBACK_AREAS.map((area) => {
          const isActive = selectedAreas.includes(area.slug);
          return (
            <button
              key={area.slug}
              type="button"
              disabled={pending}
              onClick={() => updateParam("area", area.slug, !isActive)}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${isActive ? "border-brand/40 bg-brand/10 text-brand-deep dark:text-brand-soft ring-2 ring-brand/40" : "border-border bg-paper-sunken/60 text-ink-2 hover:border-brand/30"}`}
            >
              {area.label}
            </button>
          );
        })}
      </FilterRow>

      <FilterRow label="Reporter impact">
        {FEEDBACK_USER_SEVERITIES.map((value) => {
          const isActive = selectedUserSeverities.includes(value);
          return (
            <button
              key={value}
              type="button"
              disabled={pending}
              onClick={() => updateParam("userSeverity", value, !isActive)}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition ${userSeverityChipClasses(value)} ${isActive ? "ring-2 ring-brand/40" : "opacity-60 hover:opacity-100"}`}
            >
              {userSeverityLabel(value)}
            </button>
          );
        })}
      </FilterRow>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-paper-sunken/40 px-3 py-1.5">
        <Search aria-hidden className="size-3.5 text-ink-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitSearch();
          }}
          placeholder="Search body, expected, steps, or @username…"
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <button
          type="button"
          onClick={submitSearch}
          disabled={pending}
          className="rounded-md bg-brand-deep px-2.5 py-1 text-[11px] font-semibold text-paper-raised disabled:opacity-60"
        >
          Search
        </button>
      </div>
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        {label}
      </span>
      {children}
    </div>
  );
}
