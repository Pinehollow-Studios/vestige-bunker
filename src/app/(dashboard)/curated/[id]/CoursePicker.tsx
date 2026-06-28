"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCourseToList } from "../actions";
import type { CourseCatalogRow } from "../types";

/**
 * Course picker for adding rows to a curated list. Searches the catalogue on
 * demand via `/api/courses/search` (debounced) instead of receiving the whole
 * 2000-row catalogue as a prop - so the editor page loads fast and the picker
 * stays snappy regardless of catalogue size. Already-on-list rows render
 * disabled; an added row flips to "On list" optimistically.
 */
export function CoursePicker({
  listId,
  alreadyOnList,
}: {
  listId: string;
  alreadyOnList: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseCatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const reqRef = useRef(0);

  // Fetch matches on open + whenever the query changes (debounced). Every state
  // write lives in the async IIFE, never synchronously in the effect body.
  useEffect(() => {
    if (!open) return;
    const id = ++reqRef.current;
    const q = query.trim();
    const handle = setTimeout(
      () => {
        void (async () => {
          setLoading(true);
          try {
            const res = await fetch(`/api/courses/search?q=${encodeURIComponent(q)}`);
            const json = (await res.json()) as { courses?: CourseCatalogRow[] };
            if (id === reqRef.current) setResults(json.courses ?? []);
          } catch {
            if (id === reqRef.current) setResults([]);
          } finally {
            if (id === reqRef.current) setLoading(false);
          }
        })();
      },
      q ? 180 : 0,
    );
    return () => clearTimeout(handle);
  }, [open, query]);

  function add(courseId: string) {
    setPendingId(courseId);
    startTransition(async () => {
      const result = await addCourseToList(listId, courseId);
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setAdded((prev) => new Set(prev).add(courseId));
      toast.success("Added");
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
    <div className="space-y-2 rounded-lg glass-panel p-3">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          placeholder="Search the course catalogue…"
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
            setResults([]);
          }}
        >
          Done
        </Button>
      </div>
      <div className="max-h-80 overflow-y-auto rounded-md border">
        {loading && results.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Searching…</div>
        ) : results.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {query.trim() === "" ? "Type to search the catalogue" : "No matches"}
          </div>
        ) : (
          <ul className="divide-y text-sm">
            {results.map((row) => {
              const onList = alreadyOnList.has(row.course_id) || added.has(row.course_id);
              const pending = pendingId === row.course_id;
              return (
                <li key={row.course_id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.course_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[row.club_name, row.county_name].filter(Boolean).join(" · ") || "-"}
                    </p>
                  </div>
                  {onList ? (
                    <span className="shrink-0 text-xs text-muted-foreground">On list</span>
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
      <p className="text-xs text-muted-foreground/80">
        Searching the full catalogue · top 40 matches.
      </p>
    </div>
  );
}
