"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  archiveList,
  deleteCuratedList,
  removeCuratedCover,
  setPublishState,
  unarchiveList,
  updateCuratedList,
  uploadCuratedCover,
} from "../actions";
import { CoverCropDialog } from "./CoverCropDialog";
import {
  type CourseCatalogRow,
  type CuratedCourseRow,
  type CuratedListRow,
  type CuratedListTier,
  STATUS_LABELS,
  statusFor,
} from "../types";
import { CoursePicker } from "./CoursePicker";
import { CourseRowList } from "./CourseRowList";

/**
 * Editor surface for a single curated list. Three columns visually
 * collapse into one on small screens:
 *
 *   • Cover + cover actions
 *   • Editorial form (name, slug, summary, bio, region, tier,
 *     tags, display priority, ordered toggle)
 *   • Publish controls + danger zone (archive/restore/delete)
 *
 * Below all three sits the course list — read-only summary plus
 * the course-picker sheet that drives add/remove/reorder via
 * server actions.
 */
export function CuratedEditor({
  row,
  courses,
  catalog,
  coverURL,
}: {
  row: CuratedListRow;
  courses: CuratedCourseRow[];
  catalog: CourseCatalogRow[];
  coverURL: string | null;
}) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr_240px]">
        <CoverEditor row={row} coverURL={coverURL} />
        <EditorialForm row={row} />
        <PublishControls row={row} />
      </div>
      <CourseSection row={row} courses={courses} catalog={catalog} />
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
  row: CuratedListRow;
  coverURL: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function onCropConfirm(blob: Blob) {
    setPickedFile(null);
    startTransition(async () => {
      // The cropper renders a 1600×900 JPEG (~150 KB typical),
      // which sits well inside the bucket's 2 MB cap. We hand
      // the bytes to the existing `uploadCuratedCover` action via
      // FormData with a stable filename — Storage uses the
      // upload path, not the file name, so the name is mostly
      // for the server's content-disposition.
      const formData = new FormData();
      formData.append("cover", new File([blob], "cover.jpg", { type: "image/jpeg" }));
      const result = await uploadCuratedCover(row.id, formData);
      if (!result.ok) toast.error(result.message);
      else toast.success("Cover uploaded");
    });
  }

  function onRemove() {
    startTransition(async () => {
      const result = await removeCuratedCover(row.id);
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
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Cover image</h3>
        <p className="text-xs text-ink-3">
          16:9 JPEG. Pick any photo — the cropper opens so you
          can frame it (drag to reframe, scroll / pinch to zoom).
        </p>
      </header>
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-rule/70 bg-paper-sunken/40">
        {coverURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverURL}
            alt={`Cover for ${row.name}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wider text-muted-foreground">
            No cover
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
            // Reset the input so picking the same file again
            // re-opens the cropper (browsers suppress `change`
            // on identical re-selection without this).
            e.target.value = "";
            if (file) setPickedFile(file);
          }}
        />
        <Button size="sm" disabled={pending} onClick={openPicker}>
          {pending ? "Working…" : coverURL ? "Replace" : "Upload"}
        </Button>
        {coverURL && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={onRemove}
          >
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

function EditorialForm({ row }: { row: CuratedListRow }) {
  const [name, setName] = useState(row.name);
  const [slug, setSlug] = useState(row.slug);
  const [description, setDescription] = useState(row.description ?? "");
  const [bio, setBio] = useState(row.bio ?? "");
  const [region, setRegion] = useState(row.region ?? "");
  const [tier, setTier] = useState<CuratedListTier | "">(row.tier ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(row.tags ?? []);
  const [displayPriority, setDisplayPriority] = useState<string>(
    row.display_priority?.toString() ?? "",
  );
  const [isOrdered, setIsOrdered] = useState(row.is_ordered);
  const [pending, startTransition] = useTransition();

  function commit() {
    startTransition(async () => {
      const result = await updateCuratedList(row.id, {
        name,
        slug,
        description,
        bio,
        region,
        tier: tier || null,
        tags,
        display_priority: displayPriority.trim() === "" ? null : Number(displayPriority),
        is_ordered: isOrdered,
      });
      if (!result.ok) toast.error(result.message);
      else toast.success("Saved");
    });
  }

  function addTag() {
    // Strip any leading `#` characters — admins type either
    // "heathland" or "#heathland" interchangeably; we always
    // store the bare label so the iOS render doesn't double-up
    // (#heathland → ## on iOS) and so the index card's `#`
    // prefix display stays a styling concern, not data.
    const cleaned = tagInput.trim().toLowerCase().replace(/^#+/, "").trim();
    if (!cleaned) return;
    if (tags.includes(cleaned)) {
      setTagInput("");
      return;
    }
    setTags([...tags, cleaned]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  const hasChanges =
    name !== row.name ||
    slug !== row.slug ||
    (description || "") !== (row.description ?? "") ||
    (bio || "") !== (row.bio ?? "") ||
    (region || "") !== (row.region ?? "") ||
    (tier || null) !== (row.tier ?? null) ||
    JSON.stringify(tags) !== JSON.stringify(row.tags ?? []) ||
    (displayPriority.trim() === ""
      ? row.display_priority !== null
      : Number(displayPriority) !== row.display_priority) ||
    isOrdered !== row.is_ordered;

  return (
    <section className="space-y-4 rounded-xl border border-rule/70 bg-paper-raised/50 p-5">
      <header className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Editorial</h3>
        <p className="text-xs text-ink-3">
          Everything users see in the app — title, summary, bio,
          tags, region, tier.
        </p>
      </header>

      <Field label="Name" hint="Hero title in the iOS detail view.">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field
        label="Slug"
        hint="URL-safe identifier. Auto-derived from the name on create; rename here if needed."
      >
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
      </Field>

      <Field
        label="Summary"
        hint="One-line subtitle in the iOS hero. Keep it tight (≤100 chars)."
      >
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={140}
        />
      </Field>

      <Field
        label="Bio"
        hint="Long-form editorial intro. Plain text in v1; Markdown rendering coming."
      >
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          className="flex min-h-20 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-2 text-sm transition-colors placeholder:text-ink-3 focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Region" hint="Optional: South East, Heathlands…">
          <Input value={region} onChange={(e) => setRegion(e.target.value)} />
        </Field>
        <Field label="Tier" hint="Flagship sorts first.">
          <select
            className="flex h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-1 text-sm transition-colors focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
            value={tier}
            onChange={(e) => setTier(e.target.value as CuratedListTier | "")}
          >
            <option value="">Unclassified</option>
            <option value="flagship">Flagship</option>
            <option value="standard">Standard</option>
          </select>
        </Field>
      </div>

      <Field label="Tags" hint="Press Enter to add. Lowercased on save.">
        <div className="space-y-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="heathland"
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-xs text-brand transition-colors hover:border-alert/40 hover:bg-alert/10 hover:text-alert"
                >
                  {tag}
                  <span aria-hidden>×</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Display priority"
          hint="Lower = sorts earlier. Leave blank for default."
        >
          <Input
            type="number"
            value={displayPriority}
            onChange={(e) => setDisplayPriority(e.target.value)}
          />
        </Field>
        <Field label="Ordered list?" hint="Top 100 = yes; collection = no.">
          <select
            className="flex h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 py-1 text-sm transition-colors focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
            value={isOrdered ? "yes" : "no"}
            onChange={(e) => setIsOrdered(e.target.value === "yes")}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
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

// ---------------------------------------------------------
// Publish controls
// ---------------------------------------------------------

function PublishControls({ row }: { row: CuratedListRow }) {
  const [pending, startTransition] = useTransition();
  const status = statusFor(row);
  const [scheduleAt, setScheduleAt] = useState<string>(
    row.published_at ? toLocalInput(row.published_at) : "",
  );
  const [unpublishAt, setUnpublishAt] = useState<string>(
    row.unpublished_at ? toLocalInput(row.unpublished_at) : "",
  );

  function publishNow() {
    startTransition(async () => {
      const result = await setPublishState(
        row.id,
        new Date().toISOString(),
        unpublishAt ? new Date(unpublishAt).toISOString() : null,
      );
      if (!result.ok) toast.error(result.message);
      else toast.success("Published — live on iOS");
    });
  }

  function schedule() {
    if (!scheduleAt) {
      toast.error("Pick a date + time first.");
      return;
    }
    startTransition(async () => {
      const result = await setPublishState(
        row.id,
        new Date(scheduleAt).toISOString(),
        unpublishAt ? new Date(unpublishAt).toISOString() : null,
      );
      if (!result.ok) toast.error(result.message);
      else toast.success("Scheduled");
    });
  }

  function revertToDraft() {
    startTransition(async () => {
      const result = await setPublishState(row.id, null, null);
      if (!result.ok) toast.error(result.message);
      else toast.success("Back to draft");
    });
  }

  function archive() {
    startTransition(async () => {
      const result = await archiveList(row.id);
      if (!result.ok) toast.error(result.message);
      else toast.success("Archived");
    });
  }

  function unarchive() {
    startTransition(async () => {
      const result = await unarchiveList(row.id);
      if (!result.ok) toast.error(result.message);
      else toast.success("Restored");
    });
  }

  function destroy() {
    if (
      !confirm(
        `Delete "${row.name}" permanently? This removes the list from Supabase. This can't be undone.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteCuratedList(row.id);
      if (!result.ok) toast.error(result.message);
      // On success the action redirects.
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-rule/70 bg-paper-raised/50 p-5">
      <header className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Publish</h3>
        <p className="text-xs text-ink-3">
          Currently <span className="font-medium text-ink-2">{STATUS_LABELS[status]}</span>.
          {status === "live" && row.unpublished_at && (
            <>
              {" "}
              Sunsets {new Date(row.unpublished_at).toLocaleString()}.
            </>
          )}
        </p>
      </header>

      <div className="space-y-2">
        <Button
          onClick={publishNow}
          disabled={pending || status === "live"}
          className="w-full bg-brand text-brand-fg hover:bg-brand-deep"
        >
          {status === "live" ? "Already live" : "Publish now"}
        </Button>
      </div>

      <div className="space-y-2 border-t pt-3">
        <Label className="text-xs">Schedule</Label>
        <Input
          type="datetime-local"
          value={scheduleAt}
          onChange={(e) => setScheduleAt(e.target.value)}
          disabled={pending}
        />
        <Button
          onClick={schedule}
          disabled={pending || !scheduleAt}
          variant="outline"
          className="w-full"
        >
          {status === "scheduled" ? "Update schedule" : "Schedule"}
        </Button>
      </div>

      <div className="space-y-2 border-t pt-3">
        <Label className="text-xs">Sunset (optional)</Label>
        <Input
          type="datetime-local"
          value={unpublishAt}
          onChange={(e) => setUnpublishAt(e.target.value)}
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground/80">
          Hides from app when this passes. Leave blank for no sunset.
        </p>
      </div>

      {(status === "live" || status === "scheduled" || status === "expired") && (
        <Button
          onClick={revertToDraft}
          variant="ghost"
          disabled={pending}
          className="w-full"
        >
          Revert to draft
        </Button>
      )}

      <div className="space-y-2 border-t pt-3">
        <Label className="text-xs text-destructive">Danger zone</Label>
        {status === "archived" ? (
          <Button
            onClick={unarchive}
            variant="outline"
            disabled={pending}
            className="w-full"
          >
            Restore from archive
          </Button>
        ) : (
          <Button
            onClick={archive}
            variant="outline"
            disabled={pending}
            className="w-full"
          >
            Archive
          </Button>
        )}
        <Button
          onClick={destroy}
          variant="destructive"
          disabled={pending}
          className="w-full"
        >
          Delete permanently
        </Button>
      </div>
    </section>
  );
}

function toLocalInput(iso: string): string {
  // <input type="datetime-local"> wants `YYYY-MM-DDTHH:mm` in
  // local time; Supabase serves ISO UTC. Convert here so the
  // displayed value matches what the editor sees on screen.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------------------
// Course section
// ---------------------------------------------------------

function CourseSection({
  row,
  courses,
  catalog,
}: {
  row: CuratedListRow;
  courses: CuratedCourseRow[];
  catalog: CourseCatalogRow[];
}) {
  const onListIds = useMemo(() => new Set(courses.map((c) => c.course_id)), [courses]);
  return (
    <section className="space-y-4 rounded-xl border border-rule/70 bg-paper-raised/50 p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Courses</h3>
          <p className="text-xs text-ink-3">
            Reorder with the row arrows. Add courses from the picker.
          </p>
        </div>
        <CoursePicker listId={row.id} catalog={catalog} alreadyOnList={onListIds} />
      </header>
      {courses.length === 0 ? (
        <div className="rounded-lg border border-rule/70 bg-paper-sunken/30 p-6 text-center text-sm text-ink-3">
          No courses on this list yet — add some from the picker.
        </div>
      ) : (
        <CourseRowList listId={row.id} courses={courses} />
      )}
    </section>
  );
}

// Re-export status label so the `STATUS_LABELS` import survives
// tree-shaking even though the file uses it inside JSX strings.
export { STATUS_LABELS };
