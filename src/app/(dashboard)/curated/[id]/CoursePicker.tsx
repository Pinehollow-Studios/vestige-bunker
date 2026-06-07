"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCourseToList } from "../actions";
import type { CourseCatalogRow } from "../types";

/**
 * Course picker for adding rows to a curated list. Inline panel
 * that toggles open from a "+ Add courses" button. Search-first
 * — filters the entire catalog client-side (the catalog is
 * bounded at 2000 rows in the parent page query, well within
 * a snappy filter).
 *
 * Already-on-list rows render disabled with an "On list" badge
 * so the admin can see what's already in scope without
 * re-checking. Tapping an off-list row fires the server action
 * immediately — no batching; reordering can compose afterward.
 */
export function CoursePicker({
  listId,
  catalog,
  alreadyOnList,
}: {
  listId: string;
  catalog: CourseCatalogRow[];
  alreadyOnList: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.slice(0, 50);
    const matches = catalog.filter(
      (c) =>
        c.course_name.toLowerCase().includes(q) ||
        c.club_name?.toLowerCase().includes(q) ||
        c.county_name?.toLowerCase().includes(q),
    );
    return matches.slice(0, 100);
  }, [catalog, query]);

  function add(courseId: string) {
    setPendingId(courseId);
    startTransition(async () => {
      const result = await addCourseToList(listId, courseId);
      setPendingId(null);
      if (!result.ok) toast.error(result.message);
      else toast.success("Added");
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        + Add courses
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-rule/70 bg-paper-raised/50 p-3">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          placeholder="Search courses, clubs, counties…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 flex-1"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setQuery("");
          }}
        >
          Done
        </Button>
      </div>
      <div className="max-h-80 overflow-y-auto rounded-md border">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {query.trim() === "" ? "Type to search" : "No matches"}
          </div>
        ) : (
          <ul className="divide-y text-sm">
            {filtered.map((row) => {
              const onList = alreadyOnList.has(row.course_id);
              const pending = pendingId === row.course_id;
              return (
                <li
                  key={row.course_id}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.course_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[row.club_name, row.county_name].filter(Boolean).join(" · ") ||
                        "—"}
                    </p>
                  </div>
                  {onList ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      On list
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => add(row.course_id)}
                    >
                      {pending ? "…" : "Add"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {query.trim() === "" && catalog.length > 50 && (
        <p className="text-xs text-muted-foreground/80">
          Showing the first 50 of {catalog.length} courses — type to filter.
        </p>
      )}
    </div>
  );
}
