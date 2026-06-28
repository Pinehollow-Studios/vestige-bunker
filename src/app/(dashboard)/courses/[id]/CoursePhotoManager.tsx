"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Clock, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  removeCoursePhoto,
  reorderCoursePhotos,
  setCoursePhotoModeration,
} from "./photo-actions";

export type ManagedPhoto = {
  id: string;
  state: "pending" | "approved" | "rejected" | "flagged";
  thumbUrl: string | null;
  uploaderName: string | null;
  createdAt: string;
};

/**
 * Per-course community photo manager (CLAUDE.md §5.2). Curates the user-
 * contributed gallery that follows the editorial cover in the app's hero
 * carousel: approve / reject pending contributions, remove any photo, and
 * reorder the approved set (position 0 leads - the course's effective hero
 * when there's no editorial cover). All mutations hit the active env's
 * `photos` table through service-role server actions; optimistic locally.
 */
export function CoursePhotoManager({
  courseId,
  hasEditorialCover,
  initialApproved,
  initialPending,
}: {
  courseId: string;
  hasEditorialCover: boolean;
  initialApproved: ManagedPhoto[];
  initialPending: ManagedPhoto[];
}) {
  const [approved, setApproved] = useState<ManagedPhoto[]>(initialApproved);
  const [pending, setPending] = useState<ManagedPhoto[]>(initialPending);
  const [pendingOp, startTransition] = useTransition();

  function persistOrder(next: ManagedPhoto[]) {
    startTransition(async () => {
      const res = await reorderCoursePhotos(courseId, next.map((p) => p.id));
      if (!res.ok) toast.error(res.message);
    });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= approved.length) return;
    const next = [...approved];
    [next[index], next[target]] = [next[target], next[index]];
    setApproved(next);
    persistOrder(next);
  }

  function remove(photo: ManagedPhoto, from: "approved" | "pending") {
    if (from === "approved") setApproved((prev) => prev.filter((p) => p.id !== photo.id));
    else setPending((prev) => prev.filter((p) => p.id !== photo.id));
    startTransition(async () => {
      const res = await removeCoursePhoto(courseId, photo.id);
      if (!res.ok) toast.error(res.message);
    });
  }

  function moderate(photo: ManagedPhoto, approve: boolean) {
    setPending((prev) => prev.filter((p) => p.id !== photo.id));
    if (approve) setApproved((prev) => [...prev, { ...photo, state: "approved" }]);
    startTransition(async () => {
      const res = await setCoursePhotoModeration(courseId, photo.id, approve);
      if (!res.ok) toast.error(res.message);
    });
  }

  if (approved.length === 0 && pending.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-rule/60 bg-paper-sunken/30 p-6 text-center text-sm text-ink-3">
        No community photos yet. When a golfer contributes one to this course, it lands here for review.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock aria-hidden className="size-3.5 text-amber" />
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber">
              Awaiting review
            </h4>
            <span className="text-[11px] tabular-nums text-ink-3">{pending.length}</span>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {pending.map((photo) => (
              <li key={photo.id} className="flex items-center gap-3 rounded-lg border border-rule/55 bg-paper-sunken/30 p-2">
                <Thumb photo={photo} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-ink-2">{photo.uploaderName ?? "A golfer"}</p>
                  <p className="text-[11px] text-ink-3">{relativeTime(photo.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={pendingOp}
                    onClick={() => moderate(photo, true)}
                    className="inline-flex items-center gap-1 rounded-md border border-brand/40 bg-brand/10 px-2 py-1 text-[11px] font-medium text-brand transition-colors hover:bg-brand/15 disabled:opacity-50"
                  >
                    <Check className="size-3" /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={pendingOp}
                    onClick={() => moderate(photo, false)}
                    className="rounded-md border border-rule/60 p-1.5 text-ink-3 transition-colors hover:border-alert/40 hover:text-alert disabled:opacity-50"
                    aria-label="Reject"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {approved.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            In the gallery · {approved.length}
          </h4>
          <ul className="space-y-2">
            {approved.map((photo, index) => (
              <li key={photo.id} className="flex items-center gap-3 rounded-lg border border-rule/55 bg-paper-sunken/30 p-2">
                <Thumb photo={photo} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs tabular-nums text-ink-3">{index + 1}.</span>
                    <p className="truncate text-xs text-ink-2">{photo.uploaderName ?? "A golfer"}</p>
                    {index === 0 && !hasEditorialCover && (
                      <span className="rounded-full border border-brand/35 bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand">
                        Hero
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-3">{relativeTime(photo.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={pendingOp || index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded-md border border-rule/60 p-1.5 text-ink-3 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={pendingOp || index === approved.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded-md border border-rule/60 p-1.5 text-ink-3 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={pendingOp}
                    onClick={() => remove(photo, "approved")}
                    className="rounded-md border border-rule/60 p-1.5 text-ink-3 transition-colors hover:border-alert/40 hover:text-alert disabled:opacity-50"
                    aria-label="Remove"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Thumb({ photo }: { photo: ManagedPhoto }) {
  return (
    <div className="size-14 shrink-0 overflow-hidden rounded-md border border-rule/60 bg-paper-sunken/50">
      {photo.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.thumbUrl} alt="" className="h-full w-full object-cover" />
      ) : null}
    </div>
  );
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}
