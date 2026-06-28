"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AdvancedSection,
  EditorSection,
  EditorShell,
  Field,
  fieldInputClass,
} from "@/components/admin/editor/EditorShell";
import { Readiness, type ReadinessCheck } from "@/components/admin/editor/Readiness";
import { useFormAutosave } from "@/lib/hooks/useFormAutosave";
import { cn } from "@/lib/utils";
import { CREST_GLYPHS, SocietyCrest } from "../SocietyCrest";
import {
  CHASE_TARGETS,
  CREST_COLORS,
  KNOWN_MODE_KEYS,
  crestColorHex,
  type ModeConfig,
  type SocietyModeRow,
  type WhoCanStart,
} from "../types";
import { deleteMode, updateMode } from "../actions";

type ModeForm = { name: string; tagline: string; description: string };

export function ModeEditor({ mode }: { mode: SocietyModeRow }) {
  const { values, setField, state } = useFormAutosave<ModeForm>(
    { name: mode.name, tagline: mode.tagline ?? "", description: mode.description ?? "" },
    (patch) => updateMode(mode.id, patch),
  );

  const [glyph, setGlyph] = useState(mode.glyph);
  const [color, setColor] = useState(mode.color);
  const [enabled, setEnabled] = useState(mode.enabled);
  const [whoCanStart, setWhoCanStart] = useState<WhoCanStart>(mode.who_can_start);
  const [config, setConfig] = useState<ModeConfig>(mode.config ?? {});
  const [pending, startTransition] = useTransition();

  const knownMechanic = (KNOWN_MODE_KEYS as readonly string[]).includes(mode.key);
  const isChase = mode.key === "chase";
  const isMatch = mode.key === "match";

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, ok?: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.message);
      else if (ok) toast.success(ok);
    });
  }

  function saveCrest(g: string, c: string) {
    setGlyph(g);
    setColor(c);
    run(() => updateMode(mode.id, { crest: { glyph: g, color: c } }));
  }

  function saveConfig(next: ModeConfig) {
    setConfig(next);
    run(() => updateMode(mode.id, { config: next }));
  }

  const checks: ReadinessCheck[] = [
    values.tagline.trim()
      ? { state: "ok", label: "Tagline set" }
      : { state: "warn", label: "No tagline", hint: "The one-liner in the mode picker." },
    knownMechanic
      ? { state: "ok", label: "Mechanic wired in code" }
      : { state: "missing", label: "No code mechanic for this key", hint: `Add one for "${mode.key}" before enabling.` },
    enabled
      ? { state: "ok", label: "On - shown to players" }
      : { state: "info", label: "Off - hidden from the picker" },
  ];

  const aside = (
    <>
      <Readiness checks={checks} />
      <div className="space-y-3 rounded-xl glass-panel p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Preview</p>
        <div className="flex items-center gap-3">
          <SocietyCrest glyph={glyph} color={color} size={52} />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{values.name || "Untitled mode"}</p>
            {values.tagline && <p className="text-xs text-ink-3">{values.tagline}</p>}
          </div>
        </div>
        <p className="text-[11px] text-ink-3">
          Duration: {config.default_duration_days ?? "-"}d default
          {config.min_duration_days != null && config.max_duration_days != null
            ? ` (${config.min_duration_days}-${config.max_duration_days}d)`
            : ""}
          {isMatch && config.team_count != null ? ` · ${config.team_count} teams` : ""}
        </p>
      </div>
    </>
  );

  return (
    <EditorShell
      backHref="/societies"
      backLabel="Society modes"
      eyebrow={`Mode · ${mode.key}`}
      title={values.name || "Untitled mode"}
      saveState={state}
      aside={aside}
    >
      <EditorSection title="Identity" hint="The name, icon, and words a player sees in the picker.">
        <Field label="Name">
          <input className={fieldInputClass} value={values.name} onChange={(e) => setField("name", e.target.value)} />
        </Field>
        <Field label="Tagline" hint="One line shown under the name in the picker.">
          <input
            className={fieldInputClass}
            value={values.tagline}
            onChange={(e) => setField("tagline", e.target.value)}
            maxLength={120}
            placeholder="Complete a set together"
          />
        </Field>
        <Field label="Description" hint="Longer explainer for the detail/confirm screen.">
          <textarea
            className={fieldInputClass.replace("h-9", "min-h-20 py-2")}
            value={values.description}
            onChange={(e) => setField("description", e.target.value)}
            rows={3}
          />
        </Field>

        <Field label="Icon">
          <div className="grid grid-cols-4 gap-2">
            {CREST_GLYPHS.map((g) => {
              const active = g.token === glyph;
              return (
                <button
                  key={g.token}
                  type="button"
                  aria-label={g.label}
                  onClick={() => saveCrest(g.token, color)}
                  className={cn(
                    "flex h-12 items-center justify-center rounded-lg border transition-colors",
                    active ? "border-brand/60 bg-brand/10" : "border-input bg-paper-sunken/40 text-ink-2 hover:bg-paper-sunken",
                  )}
                >
                  <g.icon className="size-5" style={active ? { color: crestColorHex(color) } : undefined} />
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Colour">
          <div className="flex flex-wrap gap-2.5">
            {CREST_COLORS.map((c) => (
              <button
                key={c.token}
                type="button"
                aria-label={c.label}
                onClick={() => saveCrest(glyph, c.token)}
                className={cn(
                  "size-8 rounded-full transition-transform hover:scale-105",
                  c.token === color && "ring-2 ring-ink ring-offset-2 ring-offset-paper",
                )}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </Field>
      </EditorSection>

      <EditorSection title="Rules" hint="Tunable knobs for this mode. The scoring itself lives in code.">
        {!knownMechanic && (
          <div className="rounded-lg border border-alert/30 bg-alert/10 p-3 text-xs text-alert">
            No code mechanic exists for the key &quot;{mode.key}&quot; yet - this mode won&apos;t do anything in the app until one
            is added. Keep it off until then.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Default duration (days)" hint="Blank = no deadline.">
            <NumberInput value={config.default_duration_days} onChange={(v) => saveConfig({ ...config, default_duration_days: v })} />
          </Field>
          <Field label="Min duration (days)">
            <NumberInput value={config.min_duration_days} onChange={(v) => saveConfig({ ...config, min_duration_days: v })} />
          </Field>
          <Field label="Max duration (days)">
            <NumberInput value={config.max_duration_days} onChange={(v) => saveConfig({ ...config, max_duration_days: v })} />
          </Field>
        </div>

        {isChase && (
          <>
            <Field label="Allowed targets" hint="What a Chase can be set to complete.">
              <div className="flex flex-wrap gap-2">
                {CHASE_TARGETS.map((t) => {
                  const current = config.allowed_targets ?? [];
                  const on = current.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() =>
                        saveConfig({
                          ...config,
                          allowed_targets: on ? current.filter((x) => x !== t.value) : [...current, t.value],
                        })
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        on ? "border-brand/50 bg-brand/10 text-brand" : "border-rule/70 text-ink-2 hover:border-brand/40",
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <label className="inline-flex items-center gap-2 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={config.allow_open_ended === true}
                onChange={(e) => saveConfig({ ...config, allow_open_ended: e.target.checked })}
                className="size-4 rounded border-input"
              />
              Allow open-ended chases (no deadline)
            </label>
          </>
        )}

        {isMatch && (
          <Field label="Number of teams">
            <NumberInput value={config.team_count} onChange={(v) => saveConfig({ ...config, team_count: v })} className="w-28" />
          </Field>
        )}
      </EditorSection>

      <EditorSection title="Availability" hint="Whether the mode is offered, and who can start one.">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={enabled}
              disabled={pending}
              onChange={(e) => {
                setEnabled(e.target.checked);
                run(() => updateMode(mode.id, { enabled: e.target.checked }), e.target.checked ? "Mode on" : "Mode off");
              }}
              className="size-4 rounded border-input"
            />
            Enabled (shown in the picker)
          </label>
          <Field label="Who can start">
            <select
              className={cn(fieldInputClass, "w-44")}
              value={whoCanStart}
              onChange={(e) => {
                const v = e.target.value as WhoCanStart;
                setWhoCanStart(v);
                run(() => updateMode(mode.id, { who_can_start: v }));
              }}
            >
              <option value="manager">Captain / co-captain</option>
              <option value="anyone">Any member</option>
            </select>
          </Field>
          <Field label="Order">
            <NumberInput
              value={mode.sort_order}
              onChange={(v) => run(() => updateMode(mode.id, { sort_order: v ?? 0 }))}
              className="w-24"
            />
          </Field>
        </div>
      </EditorSection>

      <AdvancedSection title="Danger zone" hint="Deleting removes the mode from the picker.">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          className="border-alert/40 text-alert hover:bg-alert/10 hover:text-alert"
          onClick={() => {
            if (confirm(`Delete the "${mode.name}" mode? Existing societies are unaffected.`)) {
              run(() => deleteMode(mode.id));
            }
          }}
        >
          Delete mode
        </Button>
      </AdvancedSection>
    </EditorShell>
  );
}

function NumberInput({
  value,
  onChange,
  className,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  className?: string;
}) {
  return (
    <input
      type="number"
      min={0}
      className={cn(fieldInputClass, className)}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value.trim() === "" ? null : Number(e.target.value))}
    />
  );
}
