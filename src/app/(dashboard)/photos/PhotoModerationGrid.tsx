"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Check, ExternalLink, Flag, Image as ImageIcon, MapPin, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { useLiveRefresh } from "@/lib/hooks/useLiveRefresh";
import { cn } from "@/lib/utils";
import { setPhotoModeration, setPhotoModerationBulk, type ModerationState } from "./actions";

export type PhotoKind = "roundPhoto" | "avatar" | "coursePhoto";

/** Fully server-resolved photo - the grid is pure presentation. */
export type GridPhoto = {
  id: string;
  kind: PhotoKind;
  state: ModerationState;
  uploaderName: string | null;
  contextLabel: string | null;
  isCourse: boolean;
  thumbUrl: string | null;
  fullUrl: string | null;
  geotagged: boolean;
  dims: string | null;
  takenAt: string | null;
  createdAt: string;
};

/**
 * The photo moderation grid - a fast, keyboard-first triage surface. Big
 * thumbnails; click a tile to select; bulk approve/reject/flag/reset; or fly
 * solo with the keyboard. Optimistic: an acted photo leaves the bucket instantly
 * (hidden until the server refresh confirms), so triaging 30 photos never waits
 * on a round-trip. Reads + writes go through the existing service-role actions.
 *
 * Keyboard: ←/→ (or J/K) move focus · X / Space select · A approve · R reject ·
 * F flag · U reset to pending · Enter open full.
 */
export function PhotoModerationGrid({
  photos,
  activeState,
}: {
  photos: GridPhoto[];
  activeState: ModerationState;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // id → optimistic new state. A photo whose acted state ≠ the current bucket
  // is hidden (it has moved out). Compared to the live `activeState` prop, so it
  // re-appears correctly when you navigate to the bucket it moved into.
  const [acted, setActed] = useState<Map<string, ModerationState>>(new Map());
  const [, startTransition] = useTransition();
  const focusRef = useRef<string | null>(null);
  const { live } = useLiveRefresh("photos");

  const visible = photos.filter((p) => !(acted.has(p.id) && acted.get(p.id) !== activeState));

  const act = useCallback((ids: string[], next: ModerationState, verb: string) => {
    if (ids.length === 0) return;
    setActed((prev) => {
      const m = new Map(prev);
      for (const id of ids) m.set(id, next);
      return m;
    });
    setSelected((prev) => {
      const s = new Set(prev);
      for (const id of ids) s.delete(id);
      return s;
    });
    startTransition(async () => {
      const res =
        ids.length === 1
          ? await setPhotoModeration(ids[0], next)
          : await setPhotoModerationBulk(ids, next);
      if (!res.ok) {
        setActed((prev) => {
          const m = new Map(prev);
          for (const id of ids) m.delete(id);
          return m;
        });
        toast.error(res.message);
      } else {
        toast.success(ids.length > 1 ? `${ids.length} ${verb}` : verb);
      }
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }, []);

  // Keyboard triage.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)) return;
      if (visible.length === 0) return;

      const key = e.key.toLowerCase();
      const dir = key === "arrowright" || key === "j" ? 1 : key === "arrowleft" || key === "k" ? -1 : 0;
      const curIndex = focusRef.current ? visible.findIndex((p) => p.id === focusRef.current) : -1;

      if (dir !== 0) {
        e.preventDefault();
        const next = Math.max(0, Math.min(visible.length - 1, (curIndex < 0 ? 0 : curIndex) + dir));
        const id = visible[next]?.id;
        if (id) document.getElementById(`photo-${id}`)?.focus();
        return;
      }

      // Action keys operate on the selection, or the focused tile when none.
      const targets = selected.size > 0 ? Array.from(selected) : focusRef.current ? [focusRef.current] : [];
      if (key === "x" || key === " ") {
        if (focusRef.current) {
          e.preventDefault();
          toggleSelect(focusRef.current);
        }
      } else if (key === "enter") {
        const p = visible.find((v) => v.id === focusRef.current);
        if (p?.fullUrl) window.open(p.fullUrl, "_blank", "noreferrer");
      } else if (key === "a") {
        act(targets, "approved", "Approved");
      } else if (key === "r") {
        act(targets, "rejected", "Rejected");
      } else if (key === "f") {
        act(targets, "flagged", "Flagged");
      } else if (key === "u") {
        act(targets, "pending", "Reset to pending");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, selected, act, toggleSelect]);

  const allSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visible.map((p) => p.id)));

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl glass-panel px-4 py-14 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
          <ImageIcon className="size-5" aria-hidden />
        </span>
        <p className="font-display text-base font-semibold text-ink">
          {activeState === "pending" ? "Nothing to moderate" : "Empty bucket"}
        </p>
        <p className="max-w-sm text-sm text-ink-3">
          {activeState === "pending"
            ? "No photos are awaiting review."
            : "No photos in this bucket."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="size-3.5 accent-[var(--brand)]"
          />
          Select all ({visible.length})
        </label>
        <span className="inline-flex items-center gap-2">
          {live && <span aria-hidden className="size-1.5 rounded-full bg-brand pulse-dot" />}
          <span className="hidden sm:inline">
            <kbd className="kbd">←</kbd> <kbd className="kbd">→</kbd> move · <kbd className="kbd">A</kbd>/
            <kbd className="kbd">R</kbd>/<kbd className="kbd">F</kbd> act · <kbd className="kbd">X</kbd> select
          </span>
        </span>
      </div>

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          activeState={activeState}
          onApprove={() => act(Array.from(selected), "approved", "approved")}
          onReject={() => act(Array.from(selected), "rejected", "rejected")}
          onFlag={() => act(Array.from(selected), "flagged", "flagged")}
          onReset={() => act(Array.from(selected), "pending", "reset to pending")}
          onClear={() => setSelected(new Set())}
        />
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visible.map((p) => (
          <Tile
            key={p.id}
            photo={p}
            selected={selected.has(p.id)}
            onToggle={() => toggleSelect(p.id)}
            onFocus={() => {
              focusRef.current = p.id;
            }}
            onAct={(next, verb) => act([p.id], next, verb)}
          />
        ))}
      </ul>
    </div>
  );
}

function BulkBar({
  count,
  activeState,
  onApprove,
  onReject,
  onFlag,
  onReset,
  onClear,
}: {
  count: number;
  activeState: ModerationState;
  onApprove: () => void;
  onReject: () => void;
  onFlag: () => void;
  onReset: () => void;
  onClear: () => void;
}) {
  return (
    <div className="sticky top-20 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-paper-raised/95 px-3 py-2 text-xs backdrop-blur">
      <span className="font-semibold text-brand">{count} selected</span>
      <span aria-hidden className="text-ink-3">·</span>
      {activeState !== "approved" && (
        <BulkBtn tone="brand" onClick={onApprove} icon={<Check className="size-3.5" />}>
          Approve
        </BulkBtn>
      )}
      {activeState !== "rejected" && (
        <BulkBtn tone="alert" onClick={onReject} icon={<X className="size-3.5" />}>
          Reject
        </BulkBtn>
      )}
      {activeState !== "flagged" && (
        <BulkBtn tone="amber" onClick={onFlag} icon={<Flag className="size-3.5" />}>
          Flag
        </BulkBtn>
      )}
      {activeState !== "pending" && (
        <BulkBtn tone="neutral" onClick={onReset} icon={<RotateCcw className="size-3.5" />}>
          Reset
        </BulkBtn>
      )}
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

function BulkBtn({
  tone,
  onClick,
  icon,
  children,
}: {
  tone: "brand" | "alert" | "amber" | "neutral";
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "brand"
      ? "border-brand/40 text-brand hover:bg-brand/10"
      : tone === "alert"
        ? "border-alert/40 text-alert hover:bg-alert/10"
        : tone === "amber"
          ? "border-amber/40 text-amber hover:bg-amber/10"
          : "border-rule/70 text-ink-2 hover:text-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
        cls,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Tile({
  photo,
  selected,
  onToggle,
  onFocus,
  onAct,
}: {
  photo: GridPhoto;
  selected: boolean;
  onToggle: () => void;
  onFocus: () => void;
  onAct: (next: ModerationState, verb: string) => void;
}) {
  const p = photo;
  return (
    <li className="min-w-0">
      <figure
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-xl border bg-paper-raised transition-colors",
          selected ? "border-brand ring-1 ring-brand/40" : "border-rule",
        )}
      >
        <div className="relative">
          <button
            type="button"
            id={`photo-${p.id}`}
            onClick={onToggle}
            onFocus={onFocus}
            className="block aspect-square w-full bg-paper-sunken outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-pressed={selected}
            aria-label={`${p.isCourse ? "Course photo" : p.kind === "avatar" ? "Avatar" : "Round photo"} by ${p.uploaderName ?? "user"} - select`}
          >
            {p.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumbUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-ink-3">
                <ImageIcon className="size-6" aria-hidden />
              </span>
            )}
          </button>

          {/* Selection tick */}
          <span
            className={cn(
              "pointer-events-none absolute left-2 top-2 flex size-5 items-center justify-center rounded-full border text-[10px] transition-colors",
              selected ? "border-brand bg-brand text-brand-fg" : "border-white/60 bg-black/30 text-transparent",
            )}
          >
            <Check className="size-3" aria-hidden />
          </span>

          {p.geotagged && (
            <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              <MapPin className="size-2.5" aria-hidden /> Geo
            </span>
          )}
          {p.isCourse && (
            <span className="pointer-events-none absolute right-2 top-2 rounded-full border border-brand/50 bg-paper-raised/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand">
              Course
            </span>
          )}
          {p.fullUrl && (
            <a
              href={p.fullUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-2 right-2 rounded-full bg-black/45 p-1.5 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/65"
              aria-label="Open full image"
            >
              <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </div>

        <figcaption className="flex flex-1 flex-col gap-1.5 p-2.5">
          <span className="truncate text-xs font-medium text-ink">{p.uploaderName ?? "Unknown"}</span>
          <span className="truncate text-[11px] text-ink-3">
            {p.contextLabel ?? "-"}
          </span>
          <span className="text-[10px] tabular-nums text-ink-3">
            {p.dims ? `${p.dims} · ` : ""}
            {p.takenAt ? `taken ${relativeTime(p.takenAt)}` : "no exif"}
          </span>
          <div className="mt-auto flex gap-1 pt-1">
            {p.state !== "approved" && (
              <TileBtn tone="brand" onClick={() => onAct("approved", "Approved")} label="Approve">
                <Check className="size-3.5" />
              </TileBtn>
            )}
            {p.state !== "rejected" && (
              <TileBtn tone="alert" onClick={() => onAct("rejected", "Rejected")} label="Reject">
                <X className="size-3.5" />
              </TileBtn>
            )}
            {p.state !== "flagged" && (
              <TileBtn tone="amber" onClick={() => onAct("flagged", "Flagged")} label="Flag">
                <Flag className="size-3.5" />
              </TileBtn>
            )}
            {p.state !== "pending" && (
              <TileBtn tone="neutral" onClick={() => onAct("pending", "Reset")} label="Reset to pending">
                <RotateCcw className="size-3.5" />
              </TileBtn>
            )}
          </div>
        </figcaption>
      </figure>
    </li>
  );
}

function TileBtn({
  tone,
  onClick,
  label,
  children,
}: {
  tone: "brand" | "alert" | "amber" | "neutral";
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "brand"
      ? "border-brand/30 text-brand hover:bg-brand/10"
      : tone === "alert"
        ? "border-alert/30 text-alert hover:bg-alert/10"
        : tone === "amber"
          ? "border-amber/30 text-amber hover:bg-amber/10"
          : "border-rule/70 text-ink-3 hover:text-ink-2";
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex flex-1 items-center justify-center rounded-md border py-1.5 transition-colors",
        cls,
      )}
    >
      {children}
    </button>
  );
}

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.round(days / 30)}mo`;
}
