"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Calendar, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AdvancedSection,
  EditorSection,
  EditorShell,
  Field,
  ReadOnlyField,
  fieldInputClass,
} from "@/components/admin/editor/EditorShell";
import { PreviewFrame } from "@/components/admin/editor/PreviewFrame";
import { Readiness, type ReadinessCheck } from "@/components/admin/editor/Readiness";
import { CoursePreviewContent } from "./CoursePreview";
import { useFormAutosave } from "@/lib/hooks/useFormAutosave";
import { removeCourseCover, updateCourse, uploadCourseCover } from "../actions";
import { CoverCropDialog } from "./CoverCropDialog";
import { CoursePhotoManager, type ManagedPhoto } from "./CoursePhotoManager";
import { PolygonPreview } from "./PolygonPreview";
import { StylePicker } from "./StylePicker";
import { PrestigeEditor } from "./PrestigeEditor";
import {
  LAYOUTS,
  LAYOUT_LABELS,
  TIERS,
  TIER_LABELS,
  type CourseDetailRow,
  type CourseLayout,
  type CourseTier,
} from "../types";

type CourseForm = {
  description: string;
  par: number | null;
  yards: number | null;
  style: string;
  established: number | null;
  layout: CourseLayout;
  tier: CourseTier;
  hole_count: number;
};

export function CourseEditor({
  row,
  coverURL,
  effectiveCoverURL,
  approvedPhotos,
  pendingPhotos,
  styles,
}: {
  row: CourseDetailRow;
  /** The editorial cover (course-covers bucket), if uploaded. */
  coverURL: string | null;
  /** What leads the carousel in-app: editorial cover ?? top community photo. */
  effectiveCoverURL: string | null;
  approvedPhotos: ManagedPhoto[];
  pendingPhotos: ManagedPhoto[];
  styles: string[];
}) {
  const { values, setField, state } = useFormAutosave<CourseForm>(
    {
      description: row.description ?? "",
      par: row.par,
      yards: row.yards,
      style: row.style ?? "",
      established: row.established,
      layout: row.layout,
      tier: row.tier,
      hole_count: row.hole_count,
    },
    (patch) => updateCourse(row.id, patch),
  );

  const checks: ReadinessCheck[] = [
    effectiveCoverURL
      ? { state: "ok", label: coverURL ? "Hero photo" : "Hero photo (community)" }
      : { state: "warn", label: "No hero photo", hint: "Courses read better with a photo." },
    values.description.trim()
      ? { state: "ok", label: "Description set" }
      : { state: "warn", label: "No description", hint: "Shown under About in the app." },
    values.par != null && values.yards != null
      ? { state: "ok", label: "Par & yards set" }
      : { state: "warn", label: "Missing par / yards" },
    values.style.trim() ? { state: "ok", label: "Style set" } : { state: "info", label: "No style (optional)" },
  ];

  const aside = (
    <>
      <Readiness checks={checks} />
      <PreviewFrame caption="Course detail · iOS">
        <CoursePreviewContent
          name={row.name}
          club={row.club_name}
          county={row.county_name}
          coverURL={effectiveCoverURL}
          description={values.description}
          par={values.par}
          yards={values.yards}
          holeCount={values.hole_count}
          style={values.style}
          established={values.established}
          tier={values.tier}
          layout={values.layout}
        />
      </PreviewFrame>
    </>
  );

  return (
    <EditorShell
      backHref="/courses"
      backLabel="All courses"
      eyebrow={`Editorial · ${TIER_LABELS[row.tier].toLowerCase()}`}
      title={row.name}
      saveState={state}
      aside={aside}
      meta={
        <>
          <span className="inline-flex items-center rounded-full border border-rule/70 bg-paper-sunken/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-2">
            {TIER_LABELS[row.tier]}
          </span>
          <span className="inline-flex items-center gap-1 text-ink-2">
            <Hash aria-hidden className="size-3" />
            {row.curated_lists.length} {row.curated_lists.length === 1 ? "curated list" : "curated lists"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-ink-3">
            <Calendar aria-hidden className="size-3" />
            Updated {new Date(row.updated_at).toLocaleDateString()}
            {row.last_edited_by_name && <> · by {row.last_edited_by_name}</>}
          </span>
        </>
      }
    >
      {/* Essentials: photo + the editorial content users actually see */}
      <EditorSection
        title="Hero photo"
        hint="The official cover. 16:9 — pick any photo, the cropper opens to frame it. Leads the app carousel."
      >
        <CoverEditor row={row} coverURL={coverURL} />
      </EditorSection>

      <EditorSection
        title="Community photos"
        hint="Golfer-contributed photos that follow the cover in the app. Approve, remove, or reorder — the top one is the hero when there's no cover."
      >
        <CoursePhotoManager
          courseId={row.id}
          hasEditorialCover={Boolean(coverURL)}
          initialApproved={approvedPhotos}
          initialPending={pendingPhotos}
        />
      </EditorSection>

      <EditorSection title="Editorial" hint="What users see on the course detail sheet.">
        <Field label="Description" hint="Long-form prose under About. Plain text.">
          <textarea
            value={values.description}
            onChange={(e) => setField("description", e.target.value)}
            rows={5}
            placeholder="A few sentences on what makes this course worth playing…"
            className={fieldInputClass.replace("h-9", "min-h-24 py-2")}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Par" hint="Total course par.">
            <input
              type="number"
              inputMode="numeric"
              value={values.par ?? ""}
              onChange={(e) => setField("par", num(e.target.value))}
              placeholder="71"
              className={fieldInputClass}
            />
          </Field>
          <Field label="Yards" hint="Total yardage.">
            <input
              type="number"
              inputMode="numeric"
              value={values.yards ?? ""}
              onChange={(e) => setField("yards", num(e.target.value))}
              placeholder="6800"
              className={fieldInputClass}
            />
          </Field>
        </div>
        <Field label="Style" hint="Heathland, Parkland, Links… title-cased on save.">
          <StylePicker value={values.style} onChange={(v) => setField("style", v)} suggestions={styles} />
        </Field>
      </EditorSection>

      <EditorSection
        title="Vestige Index"
        hint="The flagship 0–100 metric. Set prestige; the Index recomputes (prestige × live rarity)."
      >
        <PrestigeEditor row={row} />
      </EditorSection>

      {/* Advanced: structural / classification — rarely touched */}
      <AdvancedSection title="Structure & classification" hint="Layout, tier, hole count, year founded — rarely changes.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Layout" hint="Physical shape.">
            <select
              value={values.layout}
              onChange={(e) => setField("layout", e.target.value as CourseLayout)}
              className={fieldInputClass}
            >
              {LAYOUTS.map((v) => (
                <option key={v} value={v}>
                  {LAYOUT_LABELS[v]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tier" hint="Editorial weighting (§6.4).">
            <select
              value={values.tier}
              onChange={(e) => setField("tier", e.target.value as CourseTier)}
              className={fieldInputClass}
            >
              {TIERS.map((v) => (
                <option key={v} value={v}>
                  {TIER_LABELS[v]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hole count" hint="9, 18 — sometimes other.">
            <input
              type="number"
              inputMode="numeric"
              value={values.hole_count}
              onChange={(e) => setField("hole_count", num(e.target.value) ?? values.hole_count)}
              min={1}
              max={72}
              className={fieldInputClass}
            />
          </Field>
          <Field label="Established" hint="Year founded.">
            <input
              type="number"
              inputMode="numeric"
              value={values.established ?? ""}
              onChange={(e) => setField("established", num(e.target.value))}
              placeholder="1898"
              min={1700}
              max={2100}
              className={fieldInputClass}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReadOnlyField label="Slug" value={row.slug} hint="Referenced by import idempotency — rename is a v2 feature." />
          <ReadOnlyField label="Club · County" value={`${row.club_name ?? "—"} · ${row.county_name ?? "no county"}`} />
        </div>
      </AdvancedSection>

      {/* Meta: read-only context */}
      <EditorSection title="Reference" hint="Audit, polygon, curated-list memberships.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <Field label="Polygon">
              <PolygonPreview polygon={row.polygon} centerLat={row.center_lat} centerLng={row.center_lng} />
              <p className="mt-1 text-[11px] text-ink-3">Read-only — edited via Supabase Studio or the import script.</p>
            </Field>
          </div>
          <div className="space-y-3">
            <Field label="Curated list memberships">
              {row.curated_lists.length === 0 ? (
                <p className="text-xs text-ink-3">Not on any curated list.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {row.curated_lists.map((list) => (
                    <li key={list.id}>
                      <Link
                        href={`/curated/${list.id}`}
                        className="inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-xs text-brand transition-colors hover:bg-brand/15"
                      >
                        {list.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
            <Field label="Created">
              <p className="text-sm text-ink-2">{new Date(row.created_at).toLocaleString()}</p>
            </Field>
          </div>
        </div>
      </EditorSection>
    </EditorShell>
  );
}

function num(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ── Cover ──────────────────────────────────────────────────────────────
function CoverEditor({ row, coverURL }: { row: CourseDetailRow; coverURL: string | null }) {
  const [pending, startTransition] = useTransition();
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function onCropConfirm(blob: Blob) {
    setPickedFile(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("cover", new File([blob], "cover.jpg", { type: "image/jpeg" }));
      const result = await uploadCourseCover(row.id, formData);
      if (!result.ok) toast.error(result.message);
      else toast.success("Cover uploaded");
    });
  }

  function onRemove() {
    startTransition(async () => {
      const result = await removeCourseCover(row.id);
      if (!result.ok) toast.error(result.message);
      else toast.success("Cover removed");
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-rule/70 bg-paper-sunken/40 sm:w-72">
        {coverURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverURL} alt={`Hero for ${row.name}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wider text-ink-3">
            No hero photo
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 sm:flex-col sm:items-stretch">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (file) setPickedFile(file);
          }}
        />
        <Button size="sm" disabled={pending} onClick={() => fileInputRef.current?.click()}>
          {pending ? "Working…" : coverURL ? "Replace" : "Upload"}
        </Button>
        {coverURL && (
          <Button size="sm" variant="outline" disabled={pending} onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
      <CoverCropDialog file={pickedFile} onClose={() => setPickedFile(null)} onConfirm={onCropConfirm} />
    </div>
  );
}
