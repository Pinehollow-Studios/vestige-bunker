"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Calendar, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AdvancedSection,
  EditorSection,
  EditorShell,
  Field,
  fieldInputClass,
} from "@/components/admin/editor/EditorShell";
import { PreviewFrame } from "@/components/admin/editor/PreviewFrame";
import { Readiness, type ReadinessCheck } from "@/components/admin/editor/Readiness";
import { CuratedPreviewContent } from "./CuratedPreview";
import { useFormAutosave } from "@/lib/hooks/useFormAutosave";
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
import { CoursePicker } from "./CoursePicker";
import { CourseRowList } from "./CourseRowList";
import {
  STATUS_CHIP,
  STATUS_LABELS,
  statusFor,
  type CuratedCourseRow,
  type CuratedListRow,
  type CuratedListTier,
} from "../types";
import { cn } from "@/lib/utils";

type CuratedForm = {
  name: string;
  slug: string;
  description: string;
  bio: string;
  region: string;
  tier: CuratedListTier | null;
  tags: string[];
  display_priority: number | null;
  is_ordered: boolean;
};

export function CuratedEditor({
  row,
  courses,
  coverURL,
}: {
  row: CuratedListRow;
  courses: CuratedCourseRow[];
  coverURL: string | null;
}) {
  const status = statusFor(row);
  const { values, setField, state } = useFormAutosave<CuratedForm>(
    {
      name: row.name,
      slug: row.slug,
      description: row.description ?? "",
      bio: row.bio ?? "",
      region: row.region ?? "",
      tier: row.tier,
      tags: row.tags ?? [],
      display_priority: row.display_priority,
      is_ordered: row.is_ordered,
    },
    (patch) => updateCuratedList(row.id, patch),
  );

  const checks: ReadinessCheck[] = [
    coverURL
      ? { state: "ok", label: "Cover image" }
      : { state: "warn", label: "No cover image", hint: "Lists look far better with a 16:9 cover." },
    courses.length === 0
      ? { state: "missing", label: "No courses", hint: "Add courses from the picker below." }
      : courses.length < 5
        ? { state: "warn", label: `Only ${courses.length} course${courses.length === 1 ? "" : "s"}`, hint: "Curated lists usually have 10+." }
        : { state: "ok", label: `${courses.length} courses` },
    values.description.trim()
      ? { state: "ok", label: "Summary set" }
      : { state: "warn", label: "No summary", hint: "The one-line subtitle in the hero." },
    values.bio.trim() ? { state: "ok", label: "Bio set" } : { state: "info", label: "No bio (optional)" },
    status === "live"
      ? { state: "ok", label: "Published — live on iOS" }
      : { state: "info", label: `${STATUS_LABELS[status]} — not visible to users yet` },
  ];

  const aside = (
    <>
      <Readiness checks={checks} />
      <PreviewFrame caption="Curated list · iOS">
        <CuratedPreviewContent
          name={values.name}
          summary={values.description}
          bio={values.bio}
          tier={values.tier}
          isOrdered={values.is_ordered}
          coverURL={coverURL}
          courses={courses}
          region={values.region}
          tags={values.tags}
        />
      </PreviewFrame>
    </>
  );

  return (
    <EditorShell
      backHref="/curated"
      backLabel="All curated lists"
      eyebrow={`Editorial · ${STATUS_LABELS[status].toLowerCase()}`}
      title={values.name || "Untitled list"}
      saveState={state}
      aside={aside}
      meta={
        <>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              STATUS_CHIP[status],
            )}
          >
            {STATUS_LABELS[status]}
          </span>
          <span className="inline-flex items-center gap-1 text-ink-2">
            <Hash aria-hidden className="size-3" />
            {courses.length} {courses.length === 1 ? "course" : "courses"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-ink-3">
            <Calendar aria-hidden className="size-3" />
            Updated {new Date(row.updated_at).toLocaleDateString()}
          </span>
        </>
      }
    >
      <PublishSection row={row} />

      <EditorSection title="Cover image" hint="16:9 — pick any photo, the cropper opens to frame it.">
        <CoverEditor row={row} coverURL={coverURL} />
      </EditorSection>

      <EditorSection title="Editorial" hint="Title, summary and the long-form intro users read.">
        <Field label="Name" hint="Hero title in the iOS detail view.">
          <input value={values.name} onChange={(e) => setField("name", e.target.value)} className={fieldInputClass} />
        </Field>
        <Field label="Summary" hint="One-line subtitle in the hero. Keep it tight.">
          <input
            value={values.description}
            onChange={(e) => setField("description", e.target.value)}
            maxLength={140}
            className={fieldInputClass}
          />
        </Field>
        <Field label="Bio" hint="Long-form editorial intro. Plain text.">
          <textarea
            value={values.bio}
            onChange={(e) => setField("bio", e.target.value)}
            rows={5}
            className={fieldInputClass.replace("h-9", "min-h-24 py-2")}
          />
        </Field>
      </EditorSection>

      <CourseSection row={row} courses={courses} />

      <AdvancedSection title="Classification & ordering" hint="Slug, region, tier, tags, priority, ordering — rarely changes.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Slug" hint="URL-safe identifier.">
            <input value={values.slug} onChange={(e) => setField("slug", e.target.value)} className={fieldInputClass} />
          </Field>
          <Field label="Region" hint="South East, Heathlands…">
            <input value={values.region} onChange={(e) => setField("region", e.target.value)} className={fieldInputClass} />
          </Field>
          <Field label="Tier" hint="Flagship sorts first.">
            <select
              value={values.tier ?? ""}
              onChange={(e) => setField("tier", (e.target.value || null) as CuratedListTier | null)}
              className={fieldInputClass}
            >
              <option value="">Unclassified</option>
              <option value="flagship">Flagship</option>
              <option value="standard">Standard</option>
            </select>
          </Field>
          <Field label="Display priority" hint="Lower sorts earlier. Blank = default.">
            <input
              type="number"
              value={values.display_priority ?? ""}
              onChange={(e) => setField("display_priority", e.target.value.trim() === "" ? null : Number(e.target.value))}
              className={fieldInputClass}
            />
          </Field>
          <Field label="Ordered list?" hint="Top 100 = yes; collection = no.">
            <select
              value={values.is_ordered ? "yes" : "no"}
              onChange={(e) => setField("is_ordered", e.target.value === "yes")}
              className={fieldInputClass}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
        </div>
        <TagsField tags={values.tags} onChange={(t) => setField("tags", t)} />
      </AdvancedSection>

      <DangerSection row={row} status={status} />
    </EditorShell>
  );
}

// ── Tags ───────────────────────────────────────────────────────────────
function TagsField({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");
  function add() {
    const cleaned = input.trim().toLowerCase().replace(/^#+/, "").trim();
    setInput("");
    if (!cleaned || tags.includes(cleaned)) return;
    onChange([...tags, cleaned]);
  }
  return (
    <Field label="Tags" hint="Press Enter to add. Lowercased on save.">
      <div className="space-y-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="heathland"
          className={fieldInputClass}
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
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
  );
}

// ── Cover ──────────────────────────────────────────────────────────────
function CoverEditor({ row, coverURL }: { row: CuratedListRow; coverURL: string | null }) {
  const [pending, startTransition] = useTransition();
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function onCropConfirm(blob: Blob) {
    setPickedFile(null);
    startTransition(async () => {
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

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-rule/70 bg-paper-sunken/40 sm:w-72">
        {coverURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverURL} alt={`Cover for ${row.name}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wider text-ink-3">
            No cover
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

// ── Publish ────────────────────────────────────────────────────────────
function PublishSection({ row }: { row: CuratedListRow }) {
  const [pending, startTransition] = useTransition();
  const status = statusFor(row);
  const [scheduleAt, setScheduleAt] = useState(row.published_at ? toLocalInput(row.published_at) : "");
  const [unpublishAt, setUnpublishAt] = useState(row.unpublished_at ? toLocalInput(row.unpublished_at) : "");

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, ok: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.message);
      else toast.success(ok);
    });

  return (
    <EditorSection
      title="Publish"
      hint={`Currently ${STATUS_LABELS[status].toLowerCase()}${status === "live" && row.unpublished_at ? ` · sunsets ${new Date(row.unpublished_at).toLocaleDateString()}` : ""}.`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Button
          onClick={() => run(() => setPublishState(row.id, new Date().toISOString(), unpublishAt ? new Date(unpublishAt).toISOString() : null), "Published — live on iOS")}
          disabled={pending || status === "live"}
          className="bg-brand text-brand-fg hover:bg-brand-deep"
        >
          {status === "live" ? "Already live" : "Publish now"}
        </Button>
        <Field label="Schedule for">
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className={cn(fieldInputClass, "w-auto")}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !scheduleAt}
              onClick={() => run(() => setPublishState(row.id, new Date(scheduleAt).toISOString(), unpublishAt ? new Date(unpublishAt).toISOString() : null), "Scheduled")}
            >
              {status === "scheduled" ? "Update" : "Schedule"}
            </Button>
          </div>
        </Field>
        <Field label="Sunset (optional)" hint="Hides from the app when it passes.">
          <input
            type="datetime-local"
            value={unpublishAt}
            onChange={(e) => setUnpublishAt(e.target.value)}
            className={cn(fieldInputClass, "w-auto")}
          />
        </Field>
        {(status === "live" || status === "scheduled" || status === "expired") && (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setPublishState(row.id, null, null), "Back to draft")}>
            Revert to draft
          </Button>
        )}
      </div>
    </EditorSection>
  );
}

// ── Danger ─────────────────────────────────────────────────────────────
function DangerSection({ row, status }: { row: CuratedListRow; status: string }) {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, ok?: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.message);
      else if (ok) toast.success(ok);
    });

  return (
    <AdvancedSection title="Danger zone" hint="Archive removes it from the app; delete is permanent.">
      <div className="flex flex-wrap gap-2">
        {status === "archived" ? (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => unarchiveList(row.id), "Restored")}>
            Restore from archive
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => archiveList(row.id), "Archived")}>
            Archive
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          className="border-alert/40 text-alert hover:bg-alert/10 hover:text-alert"
          onClick={() => {
            if (confirm(`Delete "${row.name}" permanently? This can't be undone.`)) run(() => deleteCuratedList(row.id));
          }}
        >
          Delete permanently
        </Button>
      </div>
    </AdvancedSection>
  );
}

// ── Courses ────────────────────────────────────────────────────────────
function CourseSection({ row, courses }: { row: CuratedListRow; courses: CuratedCourseRow[] }) {
  const onListIds = useMemo(() => new Set(courses.map((c) => c.course_id)), [courses]);
  return (
    <EditorSection
      title="Courses"
      hint="Reorder with the row arrows. Add from the picker."
      actions={<CoursePicker listId={row.id} alreadyOnList={onListIds} />}
    >
      {courses.length === 0 ? (
        <div className="rounded-lg border border-rule/70 bg-paper-sunken/30 p-6 text-center text-sm text-ink-3">
          No courses on this list yet — add some from the picker.
        </div>
      ) : (
        <CourseRowList listId={row.id} courses={courses} />
      )}
    </EditorSection>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
