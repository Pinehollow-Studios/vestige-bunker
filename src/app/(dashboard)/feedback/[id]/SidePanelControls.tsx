"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type FeedbackSeverity,
  type FeedbackStatus,
  severityLabel,
  statusLabel,
} from "@/lib/feedback/types";
import {
  blockReporter,
  deleteReport,
  markDuplicateOf,
  setSeverity,
  setTags,
  transitionStatus,
  unblockReporter,
} from "../actions";

const STATUSES: FeedbackStatus[] = [
  "new",
  "triaged",
  "inProgress",
  "resolved",
  "wontFix",
];
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

function statusPillTone(status: FeedbackStatus, active: boolean): string {
  const tone =
    status === "new" || status === "resolved"
      ? "brand"
      : status === "inProgress"
        ? "amber"
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
  initialStatus,
  initialSeverity,
  initialTags,
  initialDuplicateOf,
  isSuperAdmin,
}: {
  reportId: string;
  reporterUserId: string | null;
  initialStatus: FeedbackStatus;
  initialSeverity: FeedbackSeverity | null;
  initialTags: string[];
  initialDuplicateOf: string | null;
  isSuperAdmin: boolean;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-rule/70 bg-paper-raised/50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
        Triage
      </p>
      <StatusControl reportId={reportId} initial={initialStatus} />
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
// Status
// --------------------------------------------------------------

function StatusControl({
  reportId,
  initial,
}: {
  reportId: string;
  initial: FeedbackStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [showResolutionFor, setShowResolutionFor] =
    useState<FeedbackStatus | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const fire = (next: FeedbackStatus, note: string | null) => {
    startTransition(async () => {
      const result = await transitionStatus(reportId, next, note);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Status → ${statusLabel(next)}`);
      setShowResolutionFor(null);
      setResolutionNote("");
    });
  };

  return (
    <div className="space-y-2">
      <FieldLabel>Status</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((status) => {
          const isActive = status === initial;
          const isTerminal = status === "resolved" || status === "wontFix";
          return (
            <button
              key={status}
              type="button"
              disabled={pending || isActive}
              onClick={() => {
                if (isTerminal) {
                  setShowResolutionFor(status);
                } else {
                  fire(status, null);
                }
              }}
              className={`${PILL_BASE} ${statusPillTone(status, isActive)}`}
            >
              {statusLabel(status)}
            </button>
          );
        })}
      </div>
      {showResolutionFor && (
        <div className="mt-2 space-y-2 rounded-lg border border-rule/70 bg-paper-sunken/40 p-3">
          <FieldLabel>Resolution note — shown to the reporter</FieldLabel>
          <textarea
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            rows={3}
            placeholder="e.g. Fixed in 1.3.2 — please update the app."
            className="block w-full resize-y rounded-lg border border-rule/70 bg-paper-raised/60 p-2 text-xs text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowResolutionFor(null)}
              className="rounded-md border border-rule/70 px-2.5 py-1 text-[11px] font-semibold text-ink-2 transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending || !resolutionNote.trim()}
              onClick={() => fire(showResolutionFor, resolutionNote)}
              className="rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-brand-fg transition-opacity disabled:opacity-60"
            >
              {pending ? "Saving…" : `Mark ${statusLabel(showResolutionFor)}`}
            </button>
          </div>
        </div>
      )}
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
