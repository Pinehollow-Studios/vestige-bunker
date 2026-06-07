"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  removeCourseFromList,
  reorderCourses,
  setEditorNote,
} from "../actions";
import type { CuratedCourseRow } from "../types";

/**
 * Editable course rows for a curated list. Each row carries:
 *   • position number + course name + club / county subtitle
 *   • Up / Down nudge buttons (no HTML5 drag — overkill for v1
 *     and breaks on touch; nudge buttons are unambiguous)
 *   • Editor note inline (collapsed by default; click "Note" to
 *     expand and edit)
 *   • Remove button (with a confirm)
 *
 * Optimistic local state mirrors every server action so the
 * page doesn't snap-flicker between mutations.
 */
export function CourseRowList({
  listId,
  courses: initial,
}: {
  listId: string;
  courses: CuratedCourseRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [pendingReorder, startReorder] = useTransition();

  function move(index: number, delta: -1 | 1) {
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= rows.length) return;
    const next = [...rows];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    // Renumber positions for display while the reorder server
    // action runs in the background.
    const renumbered = next.map((r, i) => ({ ...r, position: i + 1 }));
    setRows(renumbered);
    startReorder(async () => {
      const result = await reorderCourses(
        listId,
        renumbered.map((r) => r.course_id),
      );
      if (!result.ok) {
        toast.error(result.message);
        setRows(initial); // rollback to initial server state
      }
    });
  }

  function remove(courseId: string) {
    if (!confirm("Remove this course from the list?")) return;
    const previous = rows;
    setRows(rows.filter((r) => r.course_id !== courseId));
    (async () => {
      const result = await removeCourseFromList(listId, courseId);
      if (!result.ok) {
        toast.error(result.message);
        setRows(previous);
      }
    })();
  }

  function patchNote(courseId: string, note: string | null) {
    setRows(
      rows.map((r) =>
        r.course_id === courseId ? { ...r, editor_note: note } : r,
      ),
    );
  }

  return (
    <ol className="divide-y divide-rule/60 rounded-lg border border-rule/70 bg-paper-sunken/20">
      {rows.map((row, index) => (
        <CourseRow
          key={row.course_id}
          row={row}
          index={index}
          isFirst={index === 0}
          isLast={index === rows.length - 1}
          isMoving={pendingReorder}
          onMoveUp={() => move(index, -1)}
          onMoveDown={() => move(index, 1)}
          onRemove={() => remove(row.course_id)}
          onPatchNote={(note) => patchNote(row.course_id, note)}
          listId={listId}
        />
      ))}
    </ol>
  );
}

function CourseRow({
  row,
  index,
  isFirst,
  isLast,
  isMoving,
  onMoveUp,
  onMoveDown,
  onRemove,
  onPatchNote,
  listId,
}: {
  row: CuratedCourseRow;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isMoving: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onPatchNote: (note: string | null) => void;
  listId: string;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(row.editor_note ?? "");
  const [pending, startTransition] = useTransition();

  function commitNote() {
    const trimmed = noteDraft.trim();
    const next = trimmed === "" ? null : trimmed;
    startTransition(async () => {
      const result = await setEditorNote(listId, row.course_id, next);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      onPatchNote(next);
      setEditingNote(false);
      toast.success("Note saved");
    });
  }

  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex items-center gap-3">
        <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{row.course_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[row.club_name, row.county_name].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={isFirst || isMoving}
            onClick={onMoveUp}
            aria-label="Move up"
          >
            ↑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isLast || isMoving}
            onClick={onMoveDown}
            aria-label="Move down"
          >
            ↓
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditingNote((v) => !v)}
          >
            {row.editor_note ? "Edit note" : "+ Note"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove}>
            ✕
          </Button>
        </div>
      </div>
      {row.editor_note && !editingNote && (
        <p className="ml-9 rounded-md bg-paper-sunken/40 px-3 py-1.5 text-xs italic text-ink-2">
          “{row.editor_note}”
        </p>
      )}
      {editingNote && (
        <div className="ml-9 flex items-center gap-2">
          <Input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Best back nine in Surrey…"
            className="h-9"
            disabled={pending}
          />
          <Button size="sm" onClick={commitNote} disabled={pending}>
            {pending ? "…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setNoteDraft(row.editor_note ?? "");
              setEditingNote(false);
            }}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      )}
    </li>
  );
}
