"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  EditorSection,
  EditorShell,
  Field,
  fieldInputClass,
} from "@/components/admin/editor/EditorShell";
import { Readiness, type ReadinessCheck } from "@/components/admin/editor/Readiness";
import { useFormAutosave } from "@/lib/hooks/useFormAutosave";
import { cn } from "@/lib/utils";
import { CREST_GLYPHS, SocietyCrest } from "../../../SocietyCrest";
import {
  CREST_COLORS,
  COUNTY_STATUS_LABELS,
  DEFAULT_CREST,
  crestColorHex,
  type SocietyTemplateRow,
  type TemplateCountyStatus,
  type TemplateCountyTheme,
} from "../../../types";
import { publishCounty, saveCountyTheme, unpublishCounty } from "../../../actions";

type CountyForm = {
  name_override: string;
  story: string;
};

export function CountyThemeEditor({
  template,
  county,
  theme,
}: {
  template: SocietyTemplateRow;
  county: { id: string; name: string; course_count: number };
  theme: TemplateCountyTheme | null;
}) {
  const { values, setField, state } = useFormAutosave<CountyForm>(
    { name_override: theme?.name_override ?? "", story: theme?.story ?? "" },
    (patch) => saveCountyTheme(template.id, county.id, patch),
  );

  const [overriding, setOverriding] = useState(theme?.crest != null);
  const [glyph, setGlyph] = useState(theme?.crest?.glyph ?? template.crest?.glyph ?? DEFAULT_CREST.glyph);
  const [color, setColor] = useState(theme?.crest?.color ?? template.crest?.color ?? DEFAULT_CREST.color);
  const [pending, startTransition] = useTransition();

  const status: TemplateCountyStatus = theme?.status ?? "untouched";
  const isLive = status === "live";

  const resolvedName =
    values.name_override.trim() || template.name_pattern.replace(/\{county\}/gi, county.name).trim();
  const resolvedStory =
    values.story.trim() || (template.story_template ?? "").replace(/\{county\}/gi, county.name).trim();
  const resolvedGlyph = overriding ? glyph : template.crest?.glyph ?? DEFAULT_CREST.glyph;
  const resolvedColor = overriding ? color : template.crest?.color ?? DEFAULT_CREST.color;

  const canPublish = values.story.trim().length > 0;

  function run(fn: () => Promise<{ ok: boolean; message?: string }>, ok?: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.message);
      else if (ok) toast.success(ok);
    });
  }

  function saveCrest(nextOverriding: boolean, nextGlyph: string, nextColor: string) {
    setOverriding(nextOverriding);
    setGlyph(nextGlyph);
    setColor(nextColor);
    run(() =>
      saveCountyTheme(template.id, county.id, {
        crest: nextOverriding ? { glyph: nextGlyph, color: nextColor } : null,
      }),
    );
  }

  function onPublish() {
    // Flush the latest copy first so the publish gate sees current values.
    startTransition(async () => {
      const saved = await saveCountyTheme(template.id, county.id, {
        name_override: values.name_override,
        story: values.story,
      });
      if (!saved.ok) {
        toast.error(saved.message);
        return;
      }
      const res = await publishCounty(template.id, county.id);
      if (!res.ok) toast.error(res.message);
      else toast.success(`${county.name} is live`);
    });
  }

  const checks: ReadinessCheck[] = [
    canPublish
      ? { state: "ok", label: "Story line set" }
      : { state: "missing", label: "No story line", hint: "Required before this county can go live." },
    values.name_override.trim()
      ? { state: "ok", label: "Bespoke name set" }
      : { state: "info", label: "Using the template name pattern" },
    overriding ? { state: "ok", label: "Bespoke crest" } : { state: "info", label: "Inheriting template crest" },
    county.course_count > 0
      ? { state: "info", label: `${county.course_count} courses to chase` }
      : { state: "warn", label: "No courses in this county", hint: "The chase would be empty." },
    isLive
      ? { state: "ok", label: "Live — players can chase it" }
      : { state: "info", label: "Coming soon — not yet playable" },
  ];

  const aside = (
    <>
      <Readiness checks={checks} />
      <div className="space-y-3 rounded-xl glass-panel p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">Preview</p>
        <div className="flex items-center gap-3">
          <SocietyCrest glyph={resolvedGlyph} color={resolvedColor} size={56} />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{resolvedName || "Untitled society"}</p>
            <p className="text-xs text-ink-3">{county.course_count} courses</p>
          </div>
        </div>
        {resolvedStory && <p className="text-xs leading-relaxed text-ink-2">{resolvedStory}</p>}
      </div>
    </>
  );

  return (
    <EditorShell
      backHref={`/societies/${template.id}`}
      backLabel={template.name}
      eyebrow={`${county.name} · ${county.course_count} courses`}
      title={resolvedName || county.name}
      saveState={state}
      aside={aside}
      meta={
        <span className="text-ink-2">
          {isLive ? "Live" : status === "draft" ? "Coming soon (draft)" : "Untouched"} · {COUNTY_STATUS_LABELS[status]}
        </span>
      }
    >
      <EditorSection
        title="Publish"
        hint="A story line is required. Publishing makes this county playable; un-publishing reverts it to “coming soon”."
      >
        <div className="flex flex-wrap items-center gap-2">
          {isLive ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => unpublishCounty(template.id, county.id), `${county.name} reverted to coming soon`)}
            >
              Revert to coming soon
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={pending || !canPublish}
              className="bg-brand text-brand-fg hover:bg-brand-deep"
              onClick={onPublish}
            >
              Publish {county.name} live
            </Button>
          )}
          {!canPublish && !isLive && <span className="text-xs text-ink-3">Add a story line to enable publishing.</span>}
        </div>
      </EditorSection>

      <EditorSection title="Bespoke copy" hint="Make this county feel hand-made. Blank fields fall back to the template.">
        <Field label="Name override" hint={`Blank = “${template.name_pattern.replace(/\{county\}/gi, county.name)}”.`}>
          <input
            className={fieldInputClass}
            value={values.name_override}
            onChange={(e) => setField("name_override", e.target.value)}
            placeholder={template.name_pattern.replace(/\{county\}/gi, county.name)}
          />
        </Field>
        <Field label="Story line" hint="The line a player reads in their generated society. Sells the county.">
          <textarea
            className={fieldInputClass.replace("h-9", "min-h-24 py-2")}
            value={values.story}
            onChange={(e) => setField("story", e.target.value)}
            rows={4}
            placeholder={(template.story_template ?? "").replace(/\{county\}/gi, county.name) || "Why this county is special…"}
          />
        </Field>
      </EditorSection>

      <EditorSection title="Crest" hint="Inherit the template crest, or give this county its own tint.">
        <label className="inline-flex items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={overriding}
            disabled={pending}
            onChange={(e) => saveCrest(e.target.checked, glyph, color)}
            className="size-4 rounded border-input"
          />
          Override the template crest for {county.name}
        </label>

        {overriding && (
          <>
            <Field label="Crest glyph">
              <div className="grid grid-cols-4 gap-2">
                {CREST_GLYPHS.map((g) => {
                  const active = g.token === glyph;
                  return (
                    <button
                      key={g.token}
                      type="button"
                      aria-label={g.label}
                      onClick={() => saveCrest(true, g.token, color)}
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
                    onClick={() => saveCrest(true, glyph, c.token)}
                    className={cn(
                      "size-8 rounded-full transition-transform hover:scale-105",
                      c.token === color && "ring-2 ring-ink ring-offset-2 ring-offset-paper",
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </Field>
          </>
        )}
      </EditorSection>
    </EditorShell>
  );
}
