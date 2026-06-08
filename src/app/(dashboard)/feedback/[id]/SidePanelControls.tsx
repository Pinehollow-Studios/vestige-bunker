"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { AdminOption } from "@/lib/feedback/owners";
import {
  type FeedbackPriority,
  type FeedbackSeverity,
  type FeedbackWorkStage,
  FEEDBACK_PRIORITIES,
  FEEDBACK_WORK_STAGES,
  priorityLabel,
  priorityTone,
  severityLabel,
  statusLabel,
  workStageLabel,
  workStageDerivedStatus,
  workStageNeedsResolutionNote,
  workStageTone,
} from "@/lib/feedback/types";
import {
  blockReporter,
  deleteReport,
  markDuplicateOf,
  setOwner,
  setPriority,
  setSeverity,
  setTags,
  setWorkStage,
  unblockReporter,
} from "../actions";

const SEVERITIES: FeedbackSeverity[] = ["low", "medium", "high", "critical"];

// Calm single-tone pill styling, matching the queue + detail pages.
const PILL_BASE =
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed";

function severityPillTone(severity: FeedbackSeverity, active: boolean): string {
  const tone =
    severity === "critical"
      ? "alert"
      : severity === "high"
        ? "amber"
        : severity === "medium"
          ? "brand"
          : "neutral";
  return pillToneClasses(tone, active);
}

function pillToneClasses(
  tone: "brand" | "amber" | "alert" | "neutral",
  active: boolean,
): string {
  if (active) {
    switch (tone) {
      case "brand":
        return "border-brand bg-brand/15 text-brand";
      case "amber":
        return "border-amber bg-amber/15 text-amber";
      case "alert":
        return "border-alert bg-alert/15 text-alert";
      case "neutral":
        return "border-ink-3 bg-paper-sunken/60 text-ink-2";
    }
  }
  return "border-rule/70 text-ink-3 hover:border-brand/40 hover:text-ink-2";
}

/**
 * Right-side panel that bundles every admin control on a single
 * report (slice 4). Status, severity, tags, duplicate-of,
 * block-reporter, delete. Each control owns its own pending state
 * and toasts on success / failure.
 */
export function SidePanelControls({
  reportId,
  reporterUserId,
  initialWorkStage,
  initialPriority,
  initialOwnerUserId,
  initialSeverity,
  initialTags,
  initialDuplicateOf,
  owners,
  currentAdminId,
  isSuperAdmin,
}: {
  reportId: string;
  reporterUserId: string | null;
  initialWorkStage: FeedbackWorkStage;
  initialPriority: FeedbackPriority | null;
  initialOwnerUserId: string | null;
  initialSeverity: FeedbackSeverity | null;
  initialTags: string[];
  initialDuplicateOf: string | null;
  owners: AdminOption[];
  currentAdminId: string;
  isSuperAdmin: boolean;
}) {
  return (
    <div className="space-y-4 rounded-xl glass-panel p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        Triage
      </p>
      <StageControl reportId={reportId} initial={initialWorkStage} />
      <Divider />
      <PriorityControl reportId={reportId} initial={initialPriority} />
      <Divider />
      <OwnerControl
        reportId={reportId}
        initial={initialOwnerUserId}
        owners={owners}
        currentAdminId={currentAdminId}
      />
      <Divider />
      <SeverityControl reportId={reportId} initial={initialSeverity} />
      <Divider />
      <TagsControl reportId={reportId} initial={initialTags} />
      <Divider />
      <DuplicateOfControl reportId={reportId} initial={initialDuplicateOf} />
      {reporterUserId && (
        <>
          <Divider />
          <BlockReporterControl userId={reporterUserId} />
        </>
      )}
      {isSuperAdmin && (
        <>
          <Divider />
          <DeleteReportControl reportId={reportId} />
        </>
      )}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-rule/60" />;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
      {children}
    </p>
  );
}

// --------------------------------------------------------------
// Work stage — the operator pipeline. Drives the reporter-facing
// status under the hood (see set_work_stage). A caption shows what
// the reporter will see.
// --------------------------------------------------------------

function StageControl({
  reportId,
  initial,
}: {
  reportId: string;
  initial: FeedbackWorkStage;
}) {
  const [pending, startTransition] = useTransition();
  const [showNoteFor, setShowNoteFor] = useState<FeedbackWorkStage | null>(
    null,
  );
  const [resolutionNote, setResolutionNote] = useState("");

  const fire = (next: FeedbackWorkStage, note: string | null) => {
    startTransition(async () => {
      const result = await setWorkStage(reportId, next, note);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Stage → ${workStageLabel(next)}`);
      setShowNoteFor(null);
      setResolutionNote("");
    });
  };

  return (
    <div className="space-y-2">
      <FieldLabel>Stage</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {FEEDBACK_WORK_STAGES.map((stage) => {
          const isActive = stage === initial;
          const needsNote = workStageNeedsResolutionNote(stage);
          return (
            <button
              key={stage}
              type="button"
              disabled={pending || isActive}
              onClick={() => {
                if (needsNote) {
                  setShowNoteFor(stage);
                } else {
                  fire(stage, null);
                }
              }}
              className={`${PILL_BASE} ${pillToneClasses(workStageTone(stage), isActive)}`}
            >
              {workStageLabel(stage)}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-ink-3">
        Reporter sees:{" "}
        <span className="text-ink-2">
          {statusLabel(workStageDerivedStatus(initial))}
        </span>
      </p>
      {showNoteFor && (
        <div className="mt-2 space-y-2 rounded-lg border border-rule/70 bg-paper-sunken/40 p-3">
          <FieldLabel>Resolution note — shown to the reporter</FieldLabel>
          <textarea
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            rows={3}
            placeholder="e.g. Fixed in 0.1.2 — please update the app."
            className="block w-full resize-y rounded-lg border border-rule/70 bg-paper-raised/60 p-2 text-xs text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNoteFor(null)}
              className="rounded-md border border-rule/70 px-2.5 py-1 text-[11px] font-semibold text-ink-2 transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending || !resolutionNote.trim()}
              onClick={() => fire(showNoteFor, resolutionNote)}
              className="rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-brand-fg transition-opacity disabled:opacity-60"
            >
              {pending ? "Saving…" : `Mark ${workStageLabel(showNoteFor)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------
// Priority
// --------------------------------------------------------------

function PriorityControl({
  reportId,
  initial,
}: {
  reportId: string;
  initial: FeedbackPriority | null;
}) {
  const [pending, startTransition] = useTransition();
  const fire = (priority: FeedbackPriority | null) => {
    startTransition(async () => {
      const result = await setPriority(reportId, priority);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Priority → ${priorityLabel(priority)}`);
    });
  };

  return (
    <div className="space-y-2">
      <FieldLabel>Priority</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {FEEDBACK_PRIORITIES.map((priority) => {
          const isActive = priority === initial;
          return (
            <button
              key={priority}
              type="button"
              disabled={pending}
              onClick={() => fire(isActive ? null : priority)}
              className={`${PILL_BASE} ${pillToneClasses(priorityTone(priority), isActive)}`}
            >
              {priorityLabel(priority)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// Owner (assignee — admins only)
// --------------------------------------------------------------

function OwnerControl({
  reportId,
  initial,
  owners,
  currentAdminId,
}: {
  reportId: string;
  initial: string | null;
  owners: AdminOption[];
  currentAdminId: string;
}) {
  const [pending, startTransition] = useTransition();
  const fire = (ownerUserId: string | null, label: string) => {
    startTransition(async () => {
      const result = await setOwner(reportId, ownerUserId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(ownerUserId ? `Owner → ${label}` : "Unassigned");
    });
  };

  // If the roster came back empty (service-role not configured), keep
  // a quick assign-to-me / unassign pair so the control still works.
  const options =
    owners.length > 0
      ? owners
      : [{ id: currentAdminId, label: "Me", username: null }];

  return (
    <div className="space-y-2">
      <FieldLabel>Owner</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {options.map((owner) => {
          const isActive = owner.id === initial;
          const label =
            owner.id === currentAdminId && owner.label !== "Me"
              ? `${owner.label} (me)`
              : owner.label;
          return (
            <button
              key={owner.id}
              type="button"
              disabled={pending}
              onClick={() => fire(isActive ? null : owner.id, owner.label)}
              className={`${PILL_BASE} normal-case tracking-normal ${pillToneClasses(
                "brand",
                isActive,
              )}`}
            >
              {label}
            </button>
          );
        })}
        {initial && (
          <button
            type="button"
            disabled={pending}
            onClick={() => fire(null, "")}
            className={`${PILL_BASE} ${pillToneClasses("neutral", false)}`}
          >
            Unassign
          </button>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// Severity
// --------------------------------------------------------------

function SeverityControl({
  reportId,
  initial,
}: {
  reportId: string;
  initial: FeedbackSeverity | null;
}) {
  const [pending, startTransition] = useTransition();
  const fire = (severity: FeedbackSeverity | null) => {
    startTransition(async () => {
      const result = await setSeverity(reportId, severity);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Severity → ${severityLabel(severity)}`);
    });
  };

  return (
    <div className="space-y-2">
      <FieldLabel>Severity</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {SEVERITIES.map((severity) => {
          const isActive = severity === initial;
          return (
            <button
              key={severity}
              type="button"
              disabled={pending}
              onClick={() => fire(isActive ? null : severity)}
              className={`${PILL_BASE} ${severityPillTone(severity, isActive)}`}
            >
              {severityLabel(severity)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// Tags
// --------------------------------------------------------------

function TagsControl({
  reportId,
  initial,
}: {
  reportId: string;
  initial: string[];
}) {
  const [tags, setTagsLocal] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const persist = (next: string[]) => {
    startTransition(async () => {
      const result = await setTags(reportId, next);
      if ("error" in result) {
        toast.error(result.error);
        setTagsLocal(initial);
        return;
      }
      toast.success("Tags saved");
    });
  };

  const addTag = (raw: string) => {
    const cleaned = raw.replace(/^#+/, "").toLowerCase().trim();
    if (!cleaned) return;
    if (tags.includes(cleaned)) return;
    const next = [...tags, cleaned];
    setTagsLocal(next);
    setDraft("");
    persist(next);
  };

  const removeTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag);
    setTagsLocal(next);
    persist(next);
  };

  return (
    <div className="space-y-2">
      <FieldLabel>Tags</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            disabled={pending}
            onClick={() => removeTag(tag)}
            className="inline-flex items-center gap-1 rounded-full border border-rule/70 px-2 py-0.5 text-[11px] text-ink-2 transition-colors hover:border-alert/40 hover:text-alert"
          >
            {tag}
            <span aria-hidden className="text-ink-3">
              ×
            </span>
          </button>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(draft);
            }
          }}
          placeholder="add tag…"
          className="min-w-24 rounded-full border border-dashed border-rule/70 bg-transparent px-2 py-0.5 text-[11px] text-ink-2 placeholder:text-ink-3 focus:border-brand focus:outline-none"
        />
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// Duplicate-of
// --------------------------------------------------------------

function DuplicateOfControl({
  reportId,
  initial,
}: {
  reportId: string;
  initial: string | null;
}) {
  const [draft, setDraft] = useState(initial ?? "");
  const [pending, startTransition] = useTransition();
  const fire = () => {
    if (!draft.trim()) return;
    startTransition(async () => {
      const result = await markDuplicateOf(reportId, draft.trim());
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Marked as duplicate");
    });
  };

  return (
    <div className="space-y-2">
      <FieldLabel>Duplicate of</FieldLabel>
      <div className="space-y-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="canonical report id (uuid)…"
          className="block w-full rounded-lg border border-rule/70 bg-paper-sunken/40 px-2 py-1.5 text-[11px] font-mono text-ink-2 placeholder:text-ink-3 focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          disabled={pending || !draft.trim()}
          onClick={fire}
          className="rounded-md border border-rule/70 px-2.5 py-1 text-[11px] font-semibold text-ink-2 transition-colors hover:border-brand/40 hover:text-ink disabled:opacity-60"
        >
          {pending ? "Linking…" : "Mark duplicate"}
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// Block reporter
// --------------------------------------------------------------

function BlockReporterControl({ userId }: { userId: string }) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const block = () => {
    startTransition(async () => {
      const result = await blockReporter(userId, reason || null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Reporter blocked");
    });
  };
  const unblock = () => {
    startTransition(async () => {
      const result = await unblockReporter(userId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Reporter unblocked");
    });
  };
  return (
    <div className="space-y-2">
      <FieldLabel>Block reporter</FieldLabel>
      <div className="space-y-2">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="reason (admin-only)…"
          className="block w-full rounded-lg border border-rule/70 bg-paper-sunken/40 px-2 py-1.5 text-[11px] text-ink-2 placeholder:text-ink-3 focus:border-brand focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={block}
            className="rounded-md border border-alert/40 px-2.5 py-1 text-[11px] font-semibold text-alert transition-colors hover:bg-alert/10 disabled:opacity-60"
          >
            Block
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={unblock}
            className="rounded-md border border-rule/70 px-2.5 py-1 text-[11px] font-semibold text-ink-2 transition-colors hover:text-ink disabled:opacity-60"
          >
            Unblock
          </button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------
// Delete (super_admin only)
// --------------------------------------------------------------

function DeleteReportControl({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();
  const fire = () => {
    if (
      !confirm(
        "Hard delete this report and every reply / screenshot? This cannot be undone.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteReport(reportId);
      // delete redirects on success — only land here on error.
      if (result && "error" in result) {
        toast.error(result.error);
      }
    });
  };
  return (
    <div className="space-y-2">
      <FieldLabel>Danger zone</FieldLabel>
      <button
        type="button"
        disabled={pending}
        onClick={fire}
        className="w-full rounded-lg border border-alert/40 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-alert transition-colors hover:bg-alert/10 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete report"}
      </button>
    </div>
  );
}
