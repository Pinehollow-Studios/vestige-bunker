"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  removeCourseCover,
  updateCourse,
  uploadCourseCover,
} from "../actions";
import { CoverCropDialog } from "./CoverCropDialog";
import { PolygonPreview } from "./PolygonPreview";
import { StylePicker } from "./StylePicker";
import {
  LAYOUTS,
  LAYOUT_LABELS,
  TIERS,
  TIER_LABELS,
  type CourseDetailRow,
  type CourseLayout,
  type CourseTier,
} from "../types";

/**
 * Editor surface for a single course. Three columns visually
 * collapse into one on small screens — same shape as the curated
 * list editor:
 *
 *   • Cover + cover actions
 *   • Editorial form (description, par, yards, style, established,
 *     layout, tier, hole count)
 *   • Meta panel (audit, polygon preview, curated-list memberships)
 *
 * Name + slug are deliberately read-only in v1 — slugs are
 * referenced by `legacy_fid` import idempotency and any external
 * deep links. Adding rename in v2 is small.
 */
export function CourseEditor({
  row,
  coverURL,
  styles,
}: {
  row: CourseDetailRow;
  coverURL: string | null;
  styles: string[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr_240px]">
      <CoverEditor row={row} coverURL={coverURL} />
      <EditorialForm row={row} styles={styles} />
      <MetaPanel row={row} />
    </div>
  );
}

// ---------------------------------------------------------
// Cover
// ---------------------------------------------------------

function CoverEditor({
  row,
  coverURL,
}: {
  row: CourseDetailRow;
  coverURL: string | null;
}) {
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

  function openPicker() {
    fileInputRef.current?.click();
  }

  return (
    <section className="space-y-3 rounded-xl border border-rule/70 bg-paper-raised/50 p-5">
      <header className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          Hero photo
        </h3>
        <p className="text-xs text-ink-3">
          16:9 JPEG. Pick any photo — the cropper opens so you can
          frame it.
        </p>
      </header>
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-rule/70 bg-paper-sunken/40">
        {coverURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverURL}
            alt={`Hero photo for ${row.name}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wider text-muted-foreground">
            No hero
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
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
        <Button size="sm" disabled={pending} onClick={openPicker}>
          {pending ? "Working…" : coverURL ? "Replace" : "Upload"}
        </Button>
        {coverURL && (
          <Button size="sm" variant="outline" disabled={pending} onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
      <CoverCropDialog
        file={pickedFile}
        onClose={() => setPickedFile(null)}
        onConfirm={onCropConfirm}
      />
    </section>
  );
}

// ---------------------------------------------------------
// Editorial form
// ---------------------------------------------------------

function EditorialForm({
  row,
  styles,
}: {
  row: CourseDetailRow;
  styles: string[];
}) {
  const [description, setDescription] = useState(row.description ?? "");
  const [par, setPar] = useState<string>(row.par?.toString() ?? "");
  const [yards, setYards] = useState<string>(row.yards?.toString() ?? "");
  const [style, setStyle] = useState<string>(row.style ?? "");
  const [established, setEstablished] = useState<string>(
    row.established?.toString() ?? "",
  );
  const [layout, setLayout] = useState<CourseLayout>(row.layout);
  const [tier, setTier] = useState<CourseTier>(row.tier);
  const [holeCount, setHoleCount] = useState<string>(row.hole_count.toString());
  const [pending, startTransition] = useTransition();

  function commit() {
    startTransition(async () => {
      const result = await updateCourse(row.id, {
        description,
        par: par.trim() === "" ? null : Number(par),
        yards: yards.trim() === "" ? null : Number(yards),
        style: style.trim() === "" ? null : style,
        established: established.trim() === "" ? null : Number(established),
        layout,
        tier,
        hole_count: Number(holeCount),
      });
      if (!result.ok) toast.error(result.message);
      else toast.success("Saved");
    });
  }

  const hasChanges =
    (description || "") !== (row.description ?? "") ||
    parseNullableInt(par) !== row.par ||
    parseNullableInt(yards) !== row.yards ||
    (style.trim() || null) !== (row.style ?? null) ||
    parseNullableInt(established) !== row.established ||
    layout !== row.layout ||
    tier !== row.tier ||
    Number(holeCount) !== row.hole_count;

  return (
    <section className="space-y-4 rounded-xl border border-rule/70 bg-paper-raised/50 p-5">
      <header className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          Editorial
        </h3>
        <p className="text-xs text-ink-3">
          Everything users see in the iOS course detail sheet — par,
          yards, style, established, the long-form description.
        </p>
      </header>

      <ReadOnlyField label="Name" value={row.name} hint="Read-only — slug is referenced by import idempotency. Rename support is a v2 feature." />
      <ReadOnlyField label="Slug" value={row.slug} />
      <ReadOnlyField
        label="Club · County"
        value={`${row.club_name ?? "—"} · ${row.county_name ?? "no county"}`}
      />

      <Field
        label="Description"
        hint="Long-form prose surfaced under About. Plain text in v1."
      >
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="flex min-h-20 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-2 text-sm transition-colors placeholder:text-ink-3 focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Par" hint="Total course par.">
          <Input
            type="number"
            inputMode="numeric"
            value={par}
            onChange={(e) => setPar(e.target.value)}
            placeholder="71"
          />
        </Field>
        <Field label="Yards" hint="Total course yardage.">
          <Input
            type="number"
            inputMode="numeric"
            value={yards}
            onChange={(e) => setYards(e.target.value)}
            placeholder="6800"
          />
        </Field>
      </div>

      <Field
        label="Style"
        hint="Editorial vocabulary — Heathland, Parkland, Links, Pitch & Putt. Title-cased on save."
      >
        <StylePicker value={style} onChange={setStyle} suggestions={styles} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Established" hint="Year founded.">
          <Input
            type="number"
            inputMode="numeric"
            value={established}
            onChange={(e) => setEstablished(e.target.value)}
            placeholder="1898"
            min={1700}
            max={2100}
          />
        </Field>
        <Field label="Hole count" hint="9, 18 — sometimes other.">
          <Input
            type="number"
            inputMode="numeric"
            value={holeCount}
            onChange={(e) => setHoleCount(e.target.value)}
            min={1}
            max={72}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Layout" hint="Physical shape — 18-hole, 9-hole, short.">
          <select
            className="flex h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-1 text-sm transition-colors focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
            value={layout}
            onChange={(e) => setLayout(e.target.value as CourseLayout)}
          >
            {LAYOUTS.map((value) => (
              <option key={value} value={value}>
                {LAYOUT_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tier" hint="Editorial weighting per CLAUDE.md §6.4.">
          <select
            className="flex h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-1 text-sm transition-colors focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
            value={tier}
            onChange={(e) => setTier(e.target.value as CourseTier)}
          >
            {TIERS.map((value) => (
              <option key={value} value={value}>
                {TIER_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Button
        onClick={commit}
        disabled={!hasChanges || pending}
        className="w-full"
      >
        {pending ? "Saving…" : hasChanges ? "Save changes" : "No changes"}
      </Button>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex h-9 w-full items-center rounded-lg border border-input bg-paper-sunken/30 px-3 text-sm text-ink-2">
        {value}
      </div>
      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  );
}

function parseNullableInt(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

// ---------------------------------------------------------
// Meta panel
// ---------------------------------------------------------

function MetaPanel({ row }: { row: CourseDetailRow }) {
  return (
    <section className="space-y-4 rounded-xl border border-rule/70 bg-paper-raised/50 p-5">
      <header className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          Meta
        </h3>
        <p className="text-xs text-ink-3">
          Audit, polygon preview, and curated-list memberships.
        </p>
      </header>

      <div className="space-y-2 border-t pt-3">
        <Label className="text-xs">Last edited</Label>
        {row.last_edited_at ? (
          <p className="text-sm text-ink">
            {row.last_edited_by_name ?? "Admin"} · {new Date(row.last_edited_at).toLocaleString()}
          </p>
        ) : (
          <p className="text-xs text-ink-3">Not yet edited via the dashboard.</p>
        )}
      </div>

      <div className="space-y-2 border-t pt-3">
        <Label className="text-xs">Polygon</Label>
        <PolygonPreview
          polygon={row.polygon}
          centerLat={row.center_lat}
          centerLng={row.center_lng}
        />
        <p className="text-xs text-muted-foreground/80">
          Read-only — edits via Supabase Studio or the import script.
        </p>
      </div>

      <div className="space-y-2 border-t pt-3">
        <Label className="text-xs">Curated list memberships</Label>
        {row.curated_lists.length === 0 ? (
          <p className="text-xs text-ink-3">Not on any curated list.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {row.curated_lists.map((list) => (
              <li key={list.id}>
                <Link
                  href={`/curated/${list.id}`}
                  className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-xs text-brand transition-colors hover:bg-brand/15"
                >
                  {list.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t pt-3">
        <Label className="text-xs">Created</Label>
        <p className="text-sm text-ink">
          {new Date(row.created_at).toLocaleString()}
        </p>
      </div>
    </section>
  );
}
