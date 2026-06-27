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
  CREST_COLORS,
  DEFAULT_CREST,
  TEMPLATE_KIND_LABELS,
  TEMPLATE_STATUS_LABELS,
  TEMPLATE_TARGET_LABELS,
  crestColorHex,
  type CuratedListOption,
  type SocietyTemplateKind,
  type SocietyTemplateRow,
  type SocietyTemplateStatus,
  type SocietyTemplateTargetType,
  type TemplateCountyRow,
} from "../types";
import {
  deleteTemplate,
  setTemplateStatus,
  updateTemplate,
} from "../actions";
import { CountyWorkbench } from "./CountyWorkbench";

type TemplateForm = {
  name: string;
  name_pattern: string;
  blurb: string;
  story_template: string;
  default_duration_days: number | null;
};

const SAMPLE_COUNTY = "Surrey";

export function TemplateEditor({
  row,
  counties,
  curatedLists,
}: {
  row: SocietyTemplateRow;
  counties: TemplateCountyRow[];
  curatedLists: CuratedListOption[];
}) {
  const { values, setField, state } = useFormAutosave<TemplateForm>(
    {
      name: row.name,
      name_pattern: row.name_pattern,
      blurb: row.blurb ?? "",
      story_template: row.story_template ?? "",
      default_duration_days: row.default_duration_days,
    },
    (patch) => updateTemplate(row.id, patch),
  );

  // Format + crest save immediately (selects / pickers, not typing).
  const [kind, setKind] = useState<SocietyTemplateKind>(row.kind);
  const [targetType, setTargetType] = useState<SocietyTemplateTargetType | null>(row.target_type);
  const [fixedListId, setFixedListId] = useState(row.fixed_list_id ?? "");
  const [glyph, setGlyph] = useState(row.crest?.glyph ?? DEFAULT_CREST.glyph);
  const [color, setColor] = useState(row.crest?.color ?? DEFAULT_CREST.color);
  const [pending, startTransition] = useTransition();

  const isCountyTemplate = kind === "completion" && targetType === "county";
  const sampleCounty = counties.find((c) => c.status === "live")?.county_name ?? SAMPLE_COUNTY;
  const generatedName = values.name_pattern.replace(/\{county\}/gi, isCountyTemplate ? sampleCounty : "").trim();
  const generatedStory = values.story_template.replace(/\{county\}/gi, isCountyTemplate ? sampleCounty : "").trim();
  const liveCounties = counties.filter((c) => c.status === "live").length;

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, ok?: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.message);
      else if (ok) toast.success(ok);
    });
  }

  function saveKind(next: SocietyTemplateKind) {
    setKind(next);
    // Race has no target set; default completion back to county.
    const nextTarget = next === "race" ? null : (targetType ?? "county");
    setTargetType(nextTarget);
    run(() => updateTemplate(row.id, { kind: next, target_type: nextTarget }));
  }

  function saveTarget(next: SocietyTemplateTargetType) {
    setTargetType(next);
    run(() => updateTemplate(row.id, { target_type: next }));
  }

  function saveFixedList(next: string) {
    setFixedListId(next);
    run(() => updateTemplate(row.id, { fixed_list_id: next || null }));
  }

  function saveCrest(nextGlyph: string, nextColor: string) {
    setGlyph(nextGlyph);
    setColor(nextColor);
    run(() => updateTemplate(row.id, { crest: { glyph: nextGlyph, color: nextColor } }));
  }

  const checks: ReadinessCheck[] = [
    values.name_pattern.trim() && (!isCountyTemplate || values.name_pattern.includes("{county}"))
      ? { state: "ok", label: "Name pattern set" }
      : isCountyTemplate
        ? { state: "warn", label: "Name pattern missing {county}", hint: "Add the {county} token so each society is named for its county." }
        : { state: "warn", label: "No name pattern" },
    values.blurb.trim()
      ? { state: "ok", label: "Gallery blurb set" }
      : { state: "warn", label: "No gallery blurb", hint: "The one-liner users read when choosing it." },
    values.story_template.trim()
      ? { state: "ok", label: "Story line set" }
      : { state: "info", label: "No story line (optional)" },
    isCountyTemplate
      ? liveCounties > 0
        ? { state: "ok", label: `${liveCounties} ${liveCounties === 1 ? "county" : "counties"} live` }
        : { state: "missing", label: "No counties live", hint: "Theme + publish at least one county below." }
      : { state: "info", label: "No county theming for this target" },
    row.status === "live"
      ? { state: "ok", label: "Published — in the gallery" }
      : { state: "info", label: `${TEMPLATE_STATUS_LABELS[row.status]} — not in the gallery yet` },
  ];

  const aside = (
    <>
      <Readiness checks={checks} />
      <div className="space-y-3 rounded-xl glass-panel p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Preview</p>
        <div className="flex items-center gap-3">
          <SocietyCrest glyph={glyph} color={color} size={56} />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{generatedName || "Untitled society"}</p>
            <p className="text-xs text-ink-3">{TEMPLATE_KIND_LABELS[kind]}</p>
          </div>
        </div>
        {generatedStory && <p className="text-xs leading-relaxed text-ink-2">{generatedStory}</p>}
        {isCountyTemplate && (
          <p className="text-[11px] text-ink-3">Example for {sampleCounty}. Each county can override the copy.</p>
        )}
      </div>
    </>
  );

  return (
    <EditorShell
      backHref="/societies"
      backLabel="Society templates"
      eyebrow={`Template · ${TEMPLATE_STATUS_LABELS[row.status].toLowerCase()}`}
      title={values.name || "Untitled template"}
      saveState={state}
      aside={aside}
    >
      <EditorSection title="Format" hint="The mechanic and the set players chase. This shapes everything generated.">
        <Field label="Mechanic">
          <select className={fieldInputClass} value={kind} onChange={(e) => saveKind(e.target.value as SocietyTemplateKind)}>
            <option value="completion">{TEMPLATE_KIND_LABELS.completion} — finish a set together</option>
            <option value="race">{TEMPLATE_KIND_LABELS.race} — most new courses wins</option>
          </select>
        </Field>

        {kind === "completion" && (
          <Field label="Target set" hint="What the group is completing.">
            <select
              className={fieldInputClass}
              value={targetType ?? "county"}
              onChange={(e) => saveTarget(e.target.value as SocietyTemplateTargetType)}
            >
              {(["county", "curated_list", "custom"] as SocietyTemplateTargetType[]).map((t) => (
                <option key={t} value={t}>
                  {TEMPLATE_TARGET_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
        )}

        {kind === "completion" && targetType === "curated_list" && (
          <Field label="Curated list" hint="Optional — fix a list, or leave blank to let the player pick one.">
            <select className={fieldInputClass} value={fixedListId} onChange={(e) => saveFixedList(e.target.value)}>
              <option value="">Player picks a list</option>
              {curatedLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field
          label={kind === "race" ? "Race window (days)" : "Default duration (days)"}
          hint={kind === "race" ? "How long the race runs." : "Sets the chase deadline. Blank = no deadline."}
        >
          <input
            type="number"
            min={1}
            className={cn(fieldInputClass, "w-40")}
            value={values.default_duration_days ?? ""}
            onChange={(e) => setField("default_duration_days", e.target.value.trim() === "" ? null : Number(e.target.value))}
          />
        </Field>
      </EditorSection>

      <EditorSection title="Identity & copy" hint="The name, crest, and words a player sees — and that ride into their generated society.">
        <Field label="Template name" hint="Internal + gallery title, e.g. “County chasers”.">
          <input className={fieldInputClass} value={values.name} onChange={(e) => setField("name", e.target.value)} />
        </Field>

        <Field label="Generated name pattern" hint="Use {county} as the token, e.g. “{county} Chasers” → “Surrey Chasers”.">
          <input
            className={fieldInputClass}
            value={values.name_pattern}
            onChange={(e) => setField("name_pattern", e.target.value)}
            placeholder="{county} Chasers"
          />
        </Field>

        <Field label="Crest glyph">
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

        <Field label="Crest colour">
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

        <Field label="Gallery blurb" hint="The one-liner shown when a player is choosing a template.">
          <input
            className={fieldInputClass}
            value={values.blurb}
            onChange={(e) => setField("blurb", e.target.value)}
            maxLength={140}
            placeholder="Bag every course in your county."
          />
        </Field>

        <Field label="Story line" hint="The line inside the generated society. {county} token works here too.">
          <textarea
            className={fieldInputClass.replace("h-9", "min-h-20 py-2")}
            value={values.story_template}
            onChange={(e) => setField("story_template", e.target.value)}
            rows={3}
            placeholder="You and your group are chasing every course in {county}."
          />
        </Field>
      </EditorSection>

      {isCountyTemplate && <CountyWorkbench templateId={row.id} rows={counties} />}

      <EditorSection
        title="Publish"
        hint="Live templates appear in the player gallery. County templates also need at least one published county."
      >
        <div className="flex flex-wrap items-center gap-2">
          {(["draft", "live", "archived"] as SocietyTemplateStatus[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={row.status === s ? "default" : "outline"}
              disabled={pending || row.status === s}
              className={row.status === s ? "bg-brand text-brand-fg hover:bg-brand-deep" : undefined}
              onClick={() => run(() => setTemplateStatus(row.id, s), `Template ${TEMPLATE_STATUS_LABELS[s].toLowerCase()}`)}
            >
              {row.status === s ? `${TEMPLATE_STATUS_LABELS[s]} ✓` : TEMPLATE_STATUS_LABELS[s]}
            </Button>
          ))}
          <label className="ml-2 inline-flex items-center gap-2 text-xs text-ink-2">
            <input
              type="checkbox"
              checked={row.featured}
              disabled={pending}
              onChange={(e) => run(() => updateTemplate(row.id, { featured: e.target.checked }), "Saved")}
              className="size-4 rounded border-input"
            />
            Featured in the gallery
          </label>
        </div>
      </EditorSection>

      <AdvancedSection title="Danger zone" hint="Deleting removes the template (generated societies are unaffected).">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          className="border-alert/40 text-alert hover:bg-alert/10 hover:text-alert"
          onClick={() => {
            if (confirm(`Delete "${row.name}" permanently? Societies already generated from it are unaffected.`)) {
              run(() => deleteTemplate(row.id));
            }
          }}
        >
          Delete template
        </Button>
      </AdvancedSection>
    </EditorShell>
  );
}
