"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Bug,
  Camera,
  Crown,
  Gauge,
  HelpCircle,
  Image as ImageIcon,
  Lightbulb,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Paintbrush,
  Repeat,
  Rocket,
  UserRound,
  Zap,
} from "lucide-react";
import type { AdminOption } from "@/lib/feedback/owners";
import type { ShipVersionOption } from "./[id]/ShipInVersionControl";
import { useLiveRefresh } from "@/lib/hooks/useLiveRefresh";
import { avatarURL } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  type FeedbackKind,
  type FeedbackQueueRow,
  type FeedbackSeverity,
  type FeedbackStatus,
  type FeedbackWorkStage,
  kindLabel,
  priorityLabel,
  priorityTone,
  reproducibilityLabel,
  severityLabel,
  statusLabel,
  workStageLabel,
  workStageTone,
} from "@/lib/feedback/types";
import { bulkSetPriority, bulkSetWorkStage } from "./actions";
import { FeedbackThreadPane } from "./FeedbackThreadPane";

type Props = {
  rows: FeedbackQueueRow[];
  shipped: Record<string, string>;
  hasMore: boolean;
  initialSelectedId: string | null;
  owners: AdminOption[];
  currentAdminId: string;
  isSuperAdmin: boolean;
  draftVersions: ShipVersionOption[];
  storageBaseUrl: string;
  pageSize: number;
};

/**
 * The feedback inbox — a live two-pane master/detail. The list renders straight
 * from props (always fresh after a server refresh — mutations revalidate, and
 * Realtime / tab-focus call router.refresh), so picking a report and acting on
 * it never reloads the page or loses your filters. Keyboard: J/K move + select,
 * X toggles the focused row's checkbox.
 */
export function FeedbackInbox({
  rows,
  shipped,
  hasMore,
  initialSelectedId,
  owners,
  currentAdminId,
  isSuperAdmin,
  draftVersions,
  storageBaseUrl,
  pageSize,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const { live } = useLiveRefresh("feedback_reports", {
    onInsert: () => toast("New feedback arrived", { icon: "📨" }),
  });
  // Keyboard focus index — only ever read/written inside handlers, never render.
  const focusRef = useRef<number>(
    initialSelectedId ? rows.findIndex((r) => r.report_id === initialSelectedId) : -1,
  );

  const setURLSelected = useCallback((id: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("selected", id);
    else url.searchParams.delete("selected");
    window.history.replaceState(null, "", url.toString());
  }, []);

  const select = useCallback(
    (id: string, index: number) => {
      focusRef.current = index;
      setSelectedId(id);
      setURLSelected(id);
    },
    [setURLSelected],
  );

  const closeThread = useCallback(() => {
    setSelectedId(null);
    setURLSelected(null);
  }, [setURLSelected]);

  const toggleCheck = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Keyboard navigation (J/K to move + select, X to check the focused row).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === "j" || key === "k") {
        e.preventDefault();
        const next =
          key === "j"
            ? Math.min(rows.length - 1, focusRef.current + 1)
            : Math.max(0, focusRef.current - 1);
        const row = rows[next];
        if (row) {
          focusRef.current = next;
          setSelectedId(row.report_id);
          setURLSelected(row.report_id);
          document.getElementById(`fb-row-${row.report_id}`)?.scrollIntoView({ block: "nearest" });
        }
      } else if (key === "x") {
        const row = rows[focusRef.current];
        if (row) toggleCheck(row.report_id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, setURLSelected, toggleCheck]);

  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.report_id));
  const toggleAll = () =>
    setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.report_id)));

  const runBulkStage = (stage: FeedbackWorkStage) => {
    const ids = Array.from(checked);
    startTransition(async () => {
      const res = await bulkSetWorkStage(ids, stage);
      if ("error" in res) return void toast.error(res.error);
      toast.success(`${ids.length} → ${workStageLabel(stage)}`);
      setChecked(new Set());
    });
  };
  const runBulkPriority = (priority: "high" | "normal" | "low") => {
    const ids = Array.from(checked);
    startTransition(async () => {
      const res = await bulkSetPriority(ids, priority);
      if ("error" in res) return void toast.error(res.error);
      toast.success(`${ids.length} → ${priorityLabel(priority)} priority`);
      setChecked(new Set());
    });
  };

  const selectedRow = rows.find((r) => r.report_id === selectedId) ?? null;
  const signature = selectedRow
    ? `${selectedRow.updated_at}|${selectedRow.last_admin_message_at ?? ""}`
    : (selectedId ?? "");

  return (
    <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      <div className="flex items-center justify-between gap-3 text-xs text-ink-3">
        <span className="inline-flex items-center gap-2">
          {live && <span aria-hidden className="size-1.5 rounded-full bg-brand pulse-dot" />}
          {rows.length}
          {hasMore ? "+" : ""} shown{live ? " · live" : ""}
        </span>
        <span className="hidden sm:inline">priority ↓ · latest activity ↓</span>
      </div>

      {checked.size > 0 && (
        <BulkBar
          count={checked.size}
          onStage={runBulkStage}
          onPriority={runBulkPriority}
          onClear={() => setChecked(new Set())}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(300px,380px)_1fr] lg:grid-rows-[minmax(0,1fr)]">
        {/* List */}
        <div className={cn("min-w-0 lg:min-h-0 lg:flex-col", selectedId ? "hidden lg:flex" : "flex flex-col")}>
          {rows.length === 0 ? (
            <EmptyQueue />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl glass-panel">
              <div className="flex items-center gap-2 border-b border-rule/60 px-3 py-2 text-[10px] uppercase tracking-wider text-ink-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="size-3.5 accent-[var(--brand)]"
                  aria-label="Select all"
                />
                Select all
              </div>
              <ol className="max-h-[70vh] min-h-0 flex-1 divide-y divide-rule/50 overflow-y-auto lg:max-h-none">
                {rows.map((row, i) => (
                  <li key={row.report_id} id={`fb-row-${row.report_id}`}>
                    <Row
                      row={row}
                      shippedVersion={shipped[row.report_id]}
                      storageBaseUrl={storageBaseUrl}
                      selected={row.report_id === selectedId}
                      checked={checked.has(row.report_id)}
                      onToggleCheck={() => toggleCheck(row.report_id)}
                      onSelect={() => select(row.report_id, i)}
                    />
                  </li>
                ))}
              </ol>
              {hasMore && (
                <p className="border-t border-rule/60 px-3 py-2.5 text-center text-[11px] text-ink-3">
                  Showing the first {pageSize}. Narrow with the filters or search above.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Thread */}
        <div className={cn("min-w-0 lg:min-h-0 lg:flex-col", selectedId ? "flex flex-col" : "hidden lg:flex")}>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-xl glass-panel">
            <FeedbackThreadPane
              reportId={selectedId}
              signature={signature}
              owners={owners}
              currentAdminId={currentAdminId}
              isSuperAdmin={isSuperAdmin}
              draftVersions={draftVersions}
              onClose={closeThread}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bulk bar ──────────────────────────────────────────────────────────
function BulkBar({
  count,
  onStage,
  onPriority,
  onClear,
}: {
  count: number;
  onStage: (s: FeedbackWorkStage) => void;
  onPriority: (p: "high" | "normal" | "low") => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2 text-xs">
      <span className="font-semibold text-brand">{count} selected</span>
      <span aria-hidden className="text-ink-3">·</span>
      <span className="text-ink-3">Stage</span>
      {(["triaged", "wontFix"] as FeedbackWorkStage[]).map((s) => (
        <BulkChip key={s} onClick={() => onStage(s)}>
          {workStageLabel(s)}
        </BulkChip>
      ))}
      <span aria-hidden className="text-ink-3">·</span>
      <span className="text-ink-3">Priority</span>
      {(["high", "normal", "low"] as const).map((p) => (
        <BulkChip key={p} onClick={() => onPriority(p)}>
          {priorityLabel(p)}
        </BulkChip>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-[11px] text-ink-3 transition-colors hover:text-ink-2"
      >
        Clear
      </button>
    </div>
  );
}

function BulkChip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-rule/70 px-2.5 py-0.5 text-[11px] font-semibold text-ink-2 transition-colors hover:border-brand/40 hover:text-ink"
    >
      {children}
    </button>
  );
}

// ── Row ───────────────────────────────────────────────────────────────
const CHIP =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider";
type Tone = "brand" | "amber" | "alert" | "neutral";
function toneCls(t: Tone): string {
  return t === "brand"
    ? "border-brand/35 text-brand"
    : t === "amber"
      ? "border-amber/40 text-amber"
      : t === "alert"
        ? "border-alert/40 text-alert"
        : "border-rule/70 text-ink-3";
}
function sevTone(s: FeedbackSeverity | null): Tone {
  return s === "critical" ? "alert" : s === "high" ? "amber" : s === "medium" ? "brand" : "neutral";
}
function statusTone(s: FeedbackStatus): Tone {
  return s === "new" || s === "resolved" ? "brand" : s === "inProgress" ? "amber" : "neutral";
}

function Row({
  row,
  shippedVersion,
  storageBaseUrl,
  selected,
  checked,
  onToggleCheck,
  onSelect,
}: {
  row: FeedbackQueueRow;
  shippedVersion?: string;
  storageBaseUrl: string;
  selected: boolean;
  checked: boolean;
  onToggleCheck: () => void;
  onSelect: () => void;
}) {
  const avatar = avatarURL(row.user_id, row.reporter_avatar_photo_id, storageBaseUrl);
  const display = row.reporter_display_name ?? row.reporter_username ?? "anonymous";
  const areaName = row.area_label ?? (row.area ? areaSlugName(row.area) : null);

  return (
    <div
      className={cn(
        "flex items-start gap-2 px-3 py-3 transition-colors",
        selected ? "bg-brand/10" : "hover:bg-paper-raised/40",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggleCheck}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 size-3.5 shrink-0 accent-[var(--brand)]"
        aria-label="Select report"
      />
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <KindGlyph kind={row.kind} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            <span className="font-semibold uppercase tracking-[0.12em] text-brand">{kindLabel(row.kind)}</span>
            {row.is_founder && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber">
                <Crown aria-hidden className="size-2.5" /> Founder
              </span>
            )}
            <span className="text-ink-3">{formatRelative(row.created_at)}</span>
          </div>
          <p className={cn("line-clamp-2 text-sm leading-snug", selected ? "text-ink" : "text-ink-2")}>
            {row.body_preview}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-3">
            <span className="inline-flex items-center gap-1">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="size-4 rounded-full bg-paper-sunken object-cover" />
              ) : (
                <span className="flex size-4 items-center justify-center rounded-full bg-paper-sunken text-[8px] font-semibold uppercase text-ink-3">
                  {row.user_id ? display.slice(0, 2) : "—"}
                </span>
              )}
              {row.user_id ? display : "Anon"}
            </span>
            {areaName && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin aria-hidden className="size-2.5" /> {areaName}
              </span>
            )}
            {row.screenshot_count > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Camera aria-hidden className="size-2.5" /> {row.screenshot_count}
              </span>
            )}
            {row.reproducibility && (
              <span className="inline-flex items-center gap-0.5">
                <Repeat aria-hidden className="size-2.5" /> {reproducibilityLabel(row.reproducibility)}
              </span>
            )}
            {row.owner_user_id && (
              <span className="inline-flex items-center gap-0.5 text-ink-2">
                <UserRound aria-hidden className="size-2.5" />
                {row.owner_display_name ?? (row.owner_username ? `@${row.owner_username}` : "assigned")}
              </span>
            )}
            {shippedVersion && (
              <span className="inline-flex items-center gap-0.5 font-medium text-brand">
                <Rocket aria-hidden className="size-2.5" /> v{shippedVersion}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`${CHIP} ${toneCls(row.work_stage ? workStageTone(row.work_stage) : statusTone(row.status))}`}>
            {row.work_stage ? workStageLabel(row.work_stage) : statusLabel(row.status)}
          </span>
          {row.priority && (
            <span className={`${CHIP} ${toneCls(priorityTone(row.priority))}`}>{priorityLabel(row.priority)}</span>
          )}
          {row.severity && (
            <span className={`${CHIP} ${toneCls(sevTone(row.severity))}`}>{severityLabel(row.severity)}</span>
          )}
        </div>
      </button>
    </div>
  );
}

function KindGlyph({ kind }: { kind: FeedbackKind }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg border",
        kind === "bug" || kind === "crash"
          ? "border-alert/30 bg-alert/5 text-alert"
          : kind === "dataError" || kind === "visualGlitch" || kind === "performance"
            ? "border-amber/30 bg-amber/5 text-amber"
            : kind === "featureRequest" || kind === "confusingUX"
              ? "border-brand/30 bg-brand/5 text-brand"
              : "border-rule/70 bg-paper-sunken/40 text-ink-2",
      )}
    >
      {kindIcon(kind)}
    </span>
  );
}

function kindIcon(kind: FeedbackKind) {
  const c = "size-4";
  switch (kind) {
    case "bug":
      return <Bug aria-hidden className={c} />;
    case "dataError":
      return <MapIcon aria-hidden className={c} />;
    case "featureRequest":
      return <Lightbulb aria-hidden className={c} />;
    case "general":
      return <ImageIcon aria-hidden className={c} />;
    case "crash":
      return <Zap aria-hidden className={c} />;
    case "visualGlitch":
      return <Paintbrush aria-hidden className={c} />;
    case "performance":
      return <Gauge aria-hidden className={c} />;
    case "confusingUX":
      return <HelpCircle aria-hidden className={c} />;
    default:
      return <MessageSquare aria-hidden className={c} />;
  }
}

function EmptyQueue() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl glass-panel px-6 py-14 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
        <MessageSquare className="size-5" />
      </span>
      <p className="font-display text-base font-semibold text-ink">Nothing here</p>
      <p className="max-w-sm text-sm text-ink-3">
        No reports match. When users tap Send feedback in the app, they land here.
      </p>
    </div>
  );
}

function areaSlugName(slug: string): string {
  return (
    {
      home: "Home",
      atlas: "Atlas / map",
      club: "Club",
      you: "You / profile",
      round: "Logging a round",
      onboarding: "Sign in & onboarding",
      settings: "Settings",
      notifications: "Notifications",
      other: "Other",
    }[slug] ?? slug
  );
}

function formatRelative(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
