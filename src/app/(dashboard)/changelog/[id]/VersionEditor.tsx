"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  CornerDownRight,
  ExternalLink,
  Link2,
  ListPlus,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  addChange,
  deleteChange,
  deleteVersion,
  linkFeedback,
  setReleased,
  setReleasedAt,
  unlinkFeedback,
  updateChange,
  updateVersion,
  type FeedbackSearchRow,
} from "../actions";
import {
  type AppVersion,
  type AppVersionChange,
  type ChangeKind,
  CHANGE_KIND_LABELS,
  CHANGE_KIND_TONE,
  CHANGE_KINDS,
  type ChipTone,
  type LinkedFeedback,
  parseChangeSummary,
  serializeChangeSummary,
} from "../types";
import { FeedbackLinkPicker } from "./FeedbackLinkPicker";
import { ReleaseDialog } from "./ReleaseDialog";

function toneClasses(tone: ChipTone): string {
  switch (tone) {
    case "brand":
      return "border-brand/35 text-brand";
    case "amber":
      return "border-amber/40 text-amber";
    case "alert":
      return "border-alert/40 text-alert";
    case "neutral":
      return "border-rule/70 text-ink-3";
  }
}

const SELECT_CLASS =
  "h-8 rounded-md border border-rule/70 bg-paper-sunken/60 px-2 text-xs text-ink outline-none focus-visible:border-brand";

export function VersionEditor({
  version,
  initialChanges,
  initialLinkedFeedback,
  isSuperAdmin,
}: {
  version: AppVersion;
  initialChanges: AppVersionChange[];
  initialLinkedFeedback: Record<string, LinkedFeedback>;
  isSuperAdmin: boolean;
}) {
  const [changes, setChanges] = useState<AppVersionChange[]>(initialChanges);
  const [linkedFeedback, setLinkedFeedback] =
    useState<Record<string, LinkedFeedback>>(initialLinkedFeedback);

  const grouped = useMemo(() => {
    return CHANGE_KINDS.map((kind) => ({
      kind,
      lines: changes.filter((c) => c.kind === kind),
    })).filter((g) => g.lines.length > 0);
  }, [changes]);

  function applyUpdate(updated: AppVersionChange) {
    setChanges((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }
  function applyDelete(id: string) {
    setChanges((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-6">
      <MetaCard version={version} isSuperAdmin={isSuperAdmin} />

      <section className="space-y-4 rounded-2xl glass-panel p-5">
        <header className="flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-ink">What changed</h2>
          <span className="text-xs text-ink-3">
            {changes.length} {changes.length === 1 ? "line" : "lines"}
          </span>
        </header>

        <AddChangeRow
          versionId={version.id}
          onAdded={(row, linked) => {
            setChanges((prev) => [...prev, row]);
            if (linked) {
              setLinkedFeedback((m) => ({
                ...m,
                [linked.id]: {
                  id: linked.id,
                  kind: linked.kind,
                  status: linked.status,
                  body: linked.body_preview,
                },
              }));
            }
          }}
        />

        {changes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-rule/60 bg-paper-sunken/30 p-6 text-center text-sm text-ink-3">
            No changes recorded yet. Add the first line above.
          </p>
        ) : (
          <div className="space-y-5">
            {grouped.map((group) => (
              <div key={group.kind} className="space-y-2">
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.16em]",
                    group.kind === "fixed"
                      ? "text-amber"
                      : group.kind === "removed"
                        ? "text-alert"
                        : "text-brand",
                  )}
                >
                  {CHANGE_KIND_LABELS[group.kind]}
                </p>
                <ul className="space-y-2">
                  {group.lines.map((line) => (
                    <li key={line.id}>
                      <ChangeLine
                        versionId={version.id}
                        change={line}
                        linked={
                          line.feedback_report_id
                            ? (linkedFeedback[line.feedback_report_id] ?? null)
                            : null
                        }
                        onUpdated={applyUpdate}
                        onDeleted={applyDelete}
                        onLinked={(report) => {
                          setLinkedFeedback((m) => ({
                            ...m,
                            [report.id]: {
                              id: report.id,
                              kind: report.kind,
                              status: report.status,
                              body: report.body_preview,
                            },
                          }));
                          applyUpdate({ ...line, feedback_report_id: report.id });
                        }}
                        onUnlinked={() =>
                          applyUpdate({ ...line, feedback_report_id: null })
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Version meta + lifecycle ────────────────────────────────────────────

function MetaCard({
  version,
  isSuperAdmin,
}: {
  version: AppVersion;
  isSuperAdmin: boolean;
}) {
  const [versionStr, setVersionStr] = useState(version.version);
  const [title, setTitle] = useState(version.title ?? "");
  const [summary, setSummary] = useState(version.summary ?? "");
  const [status, setStatus] = useState(version.status);
  const [releasedAt, setReleasedAtState] = useState(version.released_at);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty =
    versionStr.trim() !== version.version ||
    title.trim() !== (version.title ?? "") ||
    summary.trim() !== (version.summary ?? "");

  function save() {
    startTransition(async () => {
      const res = await updateVersion(version.id, {
        version: versionStr,
        title,
        summary,
      });
      if (!res.ok) toast.error(res.message);
      else toast.success("Saved");
    });
  }

  // Releasing (draft → released) routes through the confirmation dialog so the
  // operator can message every linked reporter as the fix ships. Reverting
  // (released → draft) is a plain toggle - it never un-resolves a report.
  function toggleReleased(next: boolean) {
    if (next) {
      if (status === "released") return;
      if (!isSuperAdmin) {
        toast.error("Releasing a version requires super_admin.");
        return;
      }
      setReleaseDialogOpen(true);
      return;
    }
    setStatus("draft");
    startTransition(async () => {
      const res = await setReleased(version.id, false);
      if (!res.ok) {
        toast.error(res.message);
        setStatus("released");
      }
    });
  }

  function handleReleased() {
    setStatus("released");
    if (!releasedAt) setReleasedAtState(new Date().toISOString());
    setReleaseDialogOpen(false);
  }

  function changeReleasedAt(value: string) {
    const iso = value ? new Date(value).toISOString() : null;
    setReleasedAtState(iso);
    startTransition(async () => {
      const res = await setReleasedAt(version.id, iso);
      if (!res.ok) toast.error(res.message);
    });
  }

  function remove() {
    if (!confirm(`Delete v${version.version} and all its change lines? This can't be undone.`))
      return;
    startTransition(async () => {
      const res = await deleteVersion(version.id);
      if (!res.ok) toast.error(res.message);
    });
  }

  return (
    <section className="space-y-4 rounded-2xl glass-panel p-5">
      {releaseDialogOpen && (
        <ReleaseDialog
          versionId={version.id}
          version={version.version}
          onReleased={handleReleased}
          onClose={() => setReleaseDialogOpen(false)}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <Field label="Version">
          <Input
            value={versionStr}
            onChange={(e) => setVersionStr(e.target.value)}
            placeholder="0.1.3"
            className="h-9"
            disabled={pending}
          />
        </Field>
        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional headline (e.g. Beta polish)"
            className="h-9"
            disabled={pending}
          />
        </Field>
      </div>

      <Field label="Summary">
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Optional one-line summary of the release."
          rows={2}
          disabled={pending}
          className="w-full rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
        />
      </Field>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-rule/50 pt-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Status">
            <div className="inline-flex overflow-hidden rounded-lg border border-rule/70">
              {(["draft", "released"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => toggleReleased(s === "released")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                    status === s
                      ? "bg-brand text-brand-fg"
                      : "bg-paper-sunken/40 text-ink-2 hover:text-ink",
                  )}
                >
                  {s === "draft" ? "In development" : "Released"}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Release date">
            <input
              type="date"
              value={releasedAt ? releasedAt.slice(0, 10) : ""}
              onChange={(e) => changeReleasedAt(e.target.value)}
              disabled={pending}
              className="h-8 rounded-md border border-rule/70 bg-paper-sunken/60 px-2 text-xs text-ink outline-none focus-visible:border-brand disabled:opacity-50"
            />
          </Field>
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <Button
              onClick={remove}
              size="sm"
              variant="destructive"
              disabled={pending}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          )}
          <Button
            onClick={save}
            size="sm"
            disabled={pending || !dirty}
            className="bg-brand text-brand-fg hover:bg-brand-deep"
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        {label}
      </span>
      {children}
    </label>
  );
}

// ── Add a change line ───────────────────────────────────────────────────

function AddChangeRow({
  versionId,
  onAdded,
}: {
  versionId: string;
  onAdded: (row: AppVersionChange, linked?: FeedbackSearchRow) => void;
}) {
  // `kind` deliberately persists between adds - most runs of lines share a kind,
  // so remembering the last-used one keeps rapid entry to type → Enter → type.
  const [kind, setKind] = useState<ChangeKind>("added");
  const [summary, setSummary] = useState("");
  const [staged, setStaged] = useState<FeedbackSearchRow | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const text = summary.trim();
    if (!text || pending) return;
    const linked = staged;
    startTransition(async () => {
      const res = await addChange(versionId, kind, text, linked?.id ?? null);
      if (!res.ok || !res.data) {
        toast.error(res.ok ? "Could not add line." : res.message);
        return;
      }
      const now = new Date().toISOString();
      onAdded(
        {
          id: res.data,
          version_id: versionId,
          kind,
          summary: text,
          feedback_report_id: linked?.id ?? null,
          sort_index: Number.MAX_SAFE_INTEGER, // appended; regrouped on render
          created_at: now,
          updated_at: now,
        },
        linked ?? undefined,
      );
      // Rapid entry: clear the line + tag but keep the kind and the cursor here.
      setSummary("");
      setStaged(null);
      inputRef.current?.focus();
    });
  }

  function stage(report: FeedbackSearchRow) {
    setPickerOpen(false);
    setStaged(report);
    // Prefill the line from the report if the operator hasn't typed one yet.
    setSummary((cur) => (cur.trim() ? cur : report.body_preview.trim()));
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ChangeKind)}
          disabled={pending}
          className={SELECT_CLASS}
          aria-label="Change kind"
        >
          {CHANGE_KINDS.map((k) => (
            <option key={k} value={k}>
              {CHANGE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <Input
          ref={inputRef}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Describe what changed…"
          className="h-8 flex-1 text-sm"
          disabled={pending}
        />
        {!staged && !pickerOpen && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rule/60 px-2 py-1 text-[11px] text-ink-3 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
          >
            <Link2 className="size-3" />
            Tag report
          </button>
        )}
        <Button
          onClick={submit}
          size="sm"
          disabled={pending || !summary.trim()}
          className="bg-brand text-brand-fg hover:bg-brand-deep"
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      {staged && (
        <div className="flex items-center gap-2 rounded-md border border-brand/25 bg-brand/5 px-2.5 py-1.5 text-xs">
          <Tag aria-hidden className="size-3 shrink-0 text-brand" />
          <span
            className={cn(
              "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
              toneClasses(CHANGE_KIND_TONE.fixed),
            )}
          >
            {staged.kind}
          </span>
          <span className="line-clamp-1 flex-1 text-ink-2">{staged.body_preview}</span>
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-ink-3">
            will link on add
          </span>
          <button
            type="button"
            onClick={() => setStaged(null)}
            disabled={pending}
            className="shrink-0 rounded p-0.5 text-ink-3 transition-colors hover:text-alert disabled:opacity-50"
            aria-label="Clear tagged report"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {pickerOpen && (
        <FeedbackLinkPicker onPick={stage} onCancel={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

// ── A single change line ────────────────────────────────────────────────

function ChangeLine({
  versionId,
  change,
  linked,
  onUpdated,
  onDeleted,
  onLinked,
  onUnlinked,
}: {
  versionId: string;
  change: AppVersionChange;
  linked: LinkedFeedback | null;
  onUpdated: (updated: AppVersionChange) => void;
  onDeleted: (id: string) => void;
  onLinked: (report: FeedbackSearchRow) => void;
  onUnlinked: () => void;
}) {
  const parsed = parseChangeSummary(change.summary);
  const [heading, setHeading] = useState(parsed.heading);
  const [items, setItems] = useState<string[]>(parsed.items);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Persist the heading + sub-items back through the existing `summary` column
  // (serialized via the umbrella convention - see types.ts). No-ops when the
  // serialized value is unchanged so blur-without-edit costs nothing.
  function persist(nextHeading: string, nextItems: string[]) {
    const next = serializeChangeSummary(nextHeading, nextItems);
    if (next === change.summary || nextHeading.trim() === "") return;
    startTransition(async () => {
      const res = await updateChange(versionId, change.id, { summary: next });
      if (!res.ok) {
        toast.error(res.message);
        const reverted = parseChangeSummary(change.summary);
        setHeading(reverted.heading);
        setItems(reverted.items);
      } else {
        onUpdated({ ...change, summary: next });
      }
    });
  }

  function saveHeading() {
    const h = heading.trim();
    if (!h) {
      setHeading(parseChangeSummary(change.summary).heading);
      return;
    }
    persist(h, items);
  }

  function editItem(index: number, value: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? value : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, ""]);
  }

  function commitItem(index: number) {
    // Drop the row if it was left blank; otherwise persist the edited list.
    const next = items.filter((it, i) => !(i === index && it.trim() === ""));
    if (next.length !== items.length) setItems(next);
    persist(heading, next);
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index);
    setItems(next);
    persist(heading, next);
  }

  function changeKind(kind: ChangeKind) {
    startTransition(async () => {
      const res = await updateChange(versionId, change.id, { kind });
      if (!res.ok) toast.error(res.message);
      else onUpdated({ ...change, kind });
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteChange(versionId, change.id);
      if (!res.ok) toast.error(res.message);
      else onDeleted(change.id);
    });
  }

  function pick(report: FeedbackSearchRow) {
    setPickerOpen(false);
    startTransition(async () => {
      const res = await linkFeedback(versionId, change.id, report.id);
      if (!res.ok) toast.error(res.message);
      else onLinked(report);
    });
  }

  function unlink() {
    startTransition(async () => {
      const res = await unlinkFeedback(versionId, change.id);
      if (!res.ok) toast.error(res.message);
      else onUnlinked();
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-rule/50 bg-paper-sunken/30 p-2.5">
      <div className="flex items-center gap-2">
        <select
          value={change.kind}
          onChange={(e) => changeKind(e.target.value as ChangeKind)}
          disabled={pending}
          className={cn(SELECT_CLASS, "w-24")}
          aria-label="Change kind"
        >
          {CHANGE_KINDS.map((k) => (
            <option key={k} value={k}>
              {CHANGE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <Input
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          onBlur={saveHeading}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          disabled={pending}
          placeholder={items.length > 0 ? "Umbrella heading…" : "Describe what changed…"}
          className={cn(
            "h-8 flex-1 border-transparent bg-transparent text-sm hover:border-rule/50 focus-visible:border-brand",
            items.length > 0 && "font-medium",
          )}
        />
        {!linked && !pickerOpen && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rule/60 px-2 py-1 text-[11px] text-ink-3 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
          >
            <Link2 className="size-3" />
            Link report
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="shrink-0 rounded-md p-1.5 text-ink-3 transition-colors hover:text-alert disabled:opacity-50"
          aria-label="Delete line"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Sub-items - the umbrella list (e.g. "Activity feed bug fixes" → … ). */}
      <div className="ml-[104px] space-y-1.5">
          {items.length > 0 && (
            <ul className="space-y-1 border-l border-rule/50 pl-3">
              {items.map((item, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <CornerDownRight aria-hidden className="size-3 shrink-0 text-ink-3" />
                  <Input
                    value={item}
                    onChange={(e) => editItem(i, e.target.value)}
                    onBlur={() => commitItem(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    disabled={pending}
                    placeholder="Sub-item…"
                    className="h-7 flex-1 border-transparent bg-transparent text-[13px] text-ink-2 hover:border-rule/50 focus-visible:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    disabled={pending}
                    className="shrink-0 rounded p-1 text-ink-3 transition-colors hover:text-alert disabled:opacity-50"
                    aria-label="Remove sub-item"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={addItem}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-ink-3 transition-colors hover:text-brand disabled:opacity-50"
          >
            <ListPlus className="size-3" />
            {items.length > 0 ? "Add sub-item" : "Break into a list"}
          </button>
      </div>

      {linked && (
        <div className="flex items-center gap-2 rounded-md border border-brand/25 bg-brand/5 px-2.5 py-1.5 text-xs">
          <Tag aria-hidden className="size-3 shrink-0 text-brand" />
          <span
            className={cn(
              "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
              toneClasses(CHANGE_KIND_TONE.fixed),
            )}
          >
            {linked.kind}
          </span>
          <span className="line-clamp-1 flex-1 text-ink-2">{linked.body}</span>
          <Link
            href={`/feedback/${linked.id}`}
            className="inline-flex shrink-0 items-center gap-0.5 text-brand hover:underline"
          >
            view <ExternalLink className="size-3" />
          </Link>
          <button
            type="button"
            onClick={unlink}
            disabled={pending}
            className="shrink-0 rounded p-0.5 text-ink-3 transition-colors hover:text-alert disabled:opacity-50"
            aria-label="Unlink report"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {pickerOpen && (
        <FeedbackLinkPicker onPick={pick} onCancel={() => setPickerOpen(false)} />
      )}
    </div>
  );
}
