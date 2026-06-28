"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useState } from "react";
import { ChevronDown, SlidersHorizontal, Search, X } from "lucide-react";
import type { AdminOption } from "@/lib/feedback/owners";
import {
  type FeedbackKind,
  type FeedbackPriority,
  type FeedbackSeverity,
  type FeedbackUserSeverity,
  type FeedbackWorkStage,
  FEEDBACK_AREAS,
  FEEDBACK_KINDS,
  FEEDBACK_PRIORITIES,
  FEEDBACK_UI_WORK_STAGES,
  FEEDBACK_USER_SEVERITIES,
  kindLabel,
  priorityLabel,
  severityLabel,
  userSeverityLabel,
  workStageLabel,
} from "@/lib/feedback/types";

const SEVERITIES: FeedbackSeverity[] = ["low", "medium", "high", "critical"];
const KINDS: FeedbackKind[] = FEEDBACK_KINDS;

/**
 * Filter bar above the feedback queue (slice 6 polish). Status,
 * severity, kind, and free-text search drive `searchParams` on
 * the URL - every flip rewrites the URL via
 * `router.replace(url, { scroll: false })` so deep-linkable
 * triage views are first-class.
 *
 * The host page reads `searchParams` from its props and passes
 * the parsed array filters into `admin_feedback_queue` directly.
 */
export function QueueFilters({
  initialSearch,
  owners,
}: {
  initialSearch: string;
  owners: AdminOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [open, setOpen] = useState(false);

  const selectedWorkStages =
    (params.getAll("workStage") as FeedbackWorkStage[]) ?? [];
  const selectedPriorities =
    (params.getAll("priority") as FeedbackPriority[]) ?? [];
  const selectedOwners = params.getAll("owner") ?? [];
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
      // Toggle on - keep existing + add this
      for (const v of all) next.append(key, v);
      if (!all.includes(value)) next.append(key, value);
    } else {
      // Toggle off - keep existing minus this
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

  const activeCount =
    selectedWorkStages.length +
    selectedPriorities.length +
    selectedOwners.length +
    selectedSeverities.length +
    selectedKinds.length +
    selectedAreas.length +
    selectedUserSeverities.length;
  const hasFilters = activeCount > 0 || initialSearch.length > 0;

  return (
    <div className="space-y-3 rounded-xl glass-panel p-3">
      {/* Search + the filters disclosure share one compact row. */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-rule/70 bg-paper-sunken/40 px-3 py-1.5">
          <Search aria-hidden className="size-4 text-ink-3" />
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
            className="rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-brand-fg transition-opacity disabled:opacity-60"
          >
            Search
          </button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            open || activeCount > 0
              ? "border-brand/50 bg-brand/10 text-brand"
              : "border-rule/70 text-ink-2 hover:border-brand/40 hover:text-ink"
          }`}
        >
          <SlidersHorizontal aria-hidden className="size-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold tabular-nums text-brand-fg">
              {activeCount}
            </span>
          )}
          <ChevronDown
            aria-hidden
            className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-[11px] text-ink-3 transition-colors hover:text-ink-2"
          >
            <X aria-hidden className="size-3" />
            Clear
          </button>
        )}
      </div>

      <div className={`space-y-3 border-t border-rule/50 pt-3 ${open ? "" : "hidden"}`}>
        <FilterRow label="Stage">
          {FEEDBACK_UI_WORK_STAGES.map((stage) => (
            <FilterChip
              key={stage}
              active={selectedWorkStages.includes(stage)}
              disabled={pending}
              onClick={() =>
                updateParam(
                  "workStage",
                  stage,
                  !selectedWorkStages.includes(stage),
                )
              }
            >
              {workStageLabel(stage)}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Priority">
          {FEEDBACK_PRIORITIES.map((priority) => (
            <FilterChip
              key={priority}
              active={selectedPriorities.includes(priority)}
              disabled={pending}
              onClick={() =>
                updateParam(
                  "priority",
                  priority,
                  !selectedPriorities.includes(priority),
                )
              }
            >
              {priorityLabel(priority)}
            </FilterChip>
          ))}
        </FilterRow>

        {owners.length > 0 && (
          <FilterRow label="Owner">
            {owners.map((owner) => (
              <FilterChip
                key={owner.id}
                active={selectedOwners.includes(owner.id)}
                disabled={pending}
                onClick={() =>
                  updateParam(
                    "owner",
                    owner.id,
                    !selectedOwners.includes(owner.id),
                  )
                }
              >
                {owner.label}
              </FilterChip>
            ))}
          </FilterRow>
        )}

        <FilterRow label="Severity">
          {SEVERITIES.map((severity) => (
            <FilterChip
              key={severity}
              active={selectedSeverities.includes(severity)}
              disabled={pending}
              onClick={() =>
                updateParam(
                  "severity",
                  severity,
                  !selectedSeverities.includes(severity),
                )
              }
            >
              {severityLabel(severity)}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Kind">
          {KINDS.map((kind) => (
            <FilterChip
              key={kind}
              active={selectedKinds.includes(kind)}
              disabled={pending}
              onClick={() =>
                updateParam("kind", kind, !selectedKinds.includes(kind))
              }
            >
              {kindLabel(kind)}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Area">
          {FEEDBACK_AREAS.map((area) => (
            <FilterChip
              key={area.slug}
              active={selectedAreas.includes(area.slug)}
              disabled={pending}
              onClick={() =>
                updateParam(
                  "area",
                  area.slug,
                  !selectedAreas.includes(area.slug),
                )
              }
            >
              {area.label}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Reporter impact">
          {FEEDBACK_USER_SEVERITIES.map((value) => (
            <FilterChip
              key={value}
              active={selectedUserSeverities.includes(value)}
              disabled={pending}
              onClick={() =>
                updateParam(
                  "userSeverity",
                  value,
                  !selectedUserSeverities.includes(value),
                )
              }
            >
              {userSeverityLabel(value)}
            </FilterChip>
          ))}
        </FilterRow>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
        active
          ? "border-brand bg-brand/15 text-brand"
          : "border-rule/70 text-ink-3 hover:border-brand/40 hover:text-ink-2"
      }`}
    >
      {children}
    </button>
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
      <span className="mr-1 w-28 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
        {label}
      </span>
      {children}
    </div>
  );
}
