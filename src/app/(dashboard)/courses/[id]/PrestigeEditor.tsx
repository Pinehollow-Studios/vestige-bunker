"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Field, fieldInputClass } from "@/components/admin/editor/EditorShell";
import { setCoursePrestige } from "../actions";
import type { CourseDetailRow } from "../types";

/**
 * Per-course Vestige Index editor. Prestige is the one editorial input
 * (0–100); the Index + rarity are computed server-side and shown read-only.
 * Saving prestige fires `admin_set_course_prestige`, which recomputes the
 * whole Index — so the rest of the ranking shifts too (visible on the Index
 * tab). Debounced autosave to match the rest of the course editor.
 */
export function PrestigeEditor({ row }: { row: CourseDetailRow }) {
  const [prestige, setPrestige] = useState<number | "">(row.prestige);
  const [source, setSource] = useState(row.prestige_source ?? "");
  const [index, setIndex] = useState<number | null>(row.vestige_index);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef({ p: row.prestige, s: row.prestige_source ?? "" });

  function schedule(nextP: number | "", nextS: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(nextP, nextS), 700);
  }

  async function save(nextP: number | "", nextS: string) {
    if (nextP === "" || !Number.isFinite(nextP) || nextP < 0 || nextP > 100) {
      setSaveState("error");
      return;
    }
    if (nextP === lastSaved.current.p && nextS === lastSaved.current.s) return;
    setSaveState("saving");
    const res = await setCoursePrestige(row.id, nextP, nextS || null);
    if (res.ok) {
      lastSaved.current = { p: nextP, s: nextS };
      setIndex(res.data ?? null);
      setSaveState("saved");
    } else {
      setSaveState("error");
      toast.error(res.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prestige" hint="Editorial 0–100. Rankings + your sources.">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={prestige}
            onChange={(e) => {
              const v = e.target.value.trim();
              const n = v === "" ? "" : Number(v);
              setPrestige(n);
              schedule(n, source);
            }}
            className={fieldInputClass}
          />
        </Field>
        <Field label="Vestige Index" hint="Computed — prestige blended with live rarity.">
          <div className="flex h-9 items-center gap-2">
            <span className="font-display text-2xl font-semibold tabular-nums text-brand">
              {index ?? "—"}
            </span>
            <SaveBadge state={saveState} />
          </div>
        </Field>
      </div>

      <Field label="Source / justification" hint="Which ranking or basis — for provenance + re-calibration.">
        <input
          type="text"
          value={source}
          placeholder="e.g. Top100GolfCourses #42, NCG 2025"
          onChange={(e) => {
            setSource(e.target.value);
            schedule(prestige, e.target.value);
          }}
          className={fieldInputClass}
        />
      </Field>

      <div className="rounded-lg border border-rule/60 bg-paper-sunken/40 px-3 py-2 text-xs text-ink-2">
        <span className="tabular-nums">prestige {typeof prestige === "number" ? prestige : "—"}</span>
        {" · "}
        <span className="tabular-nums">rarity {row.vestige_rarity ?? "—"}</span>
        {" → "}
        <span className="font-medium tabular-nums text-ink">index {index ?? "—"}</span>
        <span className="ml-2 text-ink-3">
          ({row.play_count} {row.play_count === 1 ? "player" : "players"})
        </span>
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  const label = state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "0–100 only";
  const tone =
    state === "error" ? "text-alert" : state === "saved" ? "text-brand" : "text-ink-3";
  return <span className={`text-[11px] ${tone}`}>{label}</span>;
}
