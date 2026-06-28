"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

type SaveResult = { ok: boolean; message?: string };

/**
 * Form-level autosave. Holds the form's values; whenever a field changes it
 * debounces, diffs against the last saved snapshot, and persists ONLY the
 * changed fields via `save(patch)`. One page-level {@link SaveState} drives the
 * "Saved / Saving…" indicator. The editor model the whole admin uses - type and
 * it saves, no Save button.
 *
 * Refs are read only inside effects (never during render) to satisfy the
 * react-compiler rules; `save` is captured in a ref so an inline closure
 * doesn't re-arm the debounce every render.
 */
export function useFormAutosave<V extends Record<string, unknown>>(
  initial: V,
  save: (patch: Partial<V>) => Promise<SaveResult>,
  debounceMs = 700,
): { values: V; setField: <K extends keyof V>(key: K, value: V[K]) => void; state: SaveState } {
  const [values, setValues] = useState<V>(initial);
  const [state, setState] = useState<SaveState>("idle");
  const saved = useRef<V>(initial);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const setField = useCallback(<K extends keyof V>(key: K, value: V[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setState("idle");
  }, []);

  useEffect(() => {
    // Diff against the last saved snapshot - primitives, so Object.is is right.
    const patch: Partial<V> = {};
    let changed = false;
    for (const k in values) {
      if (!Object.is(values[k], saved.current[k])) {
        patch[k] = values[k];
        changed = true;
      }
    }
    if (!changed) return;

    const handle = setTimeout(() => {
      void (async () => {
        setState("saving");
        const res = await saveRef.current(patch);
        if (res.ok) {
          saved.current = { ...saved.current, ...patch };
          setState("saved");
        } else {
          setState("error");
        }
      })();
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [values, debounceMs]);

  return { values, setField, state };
}
