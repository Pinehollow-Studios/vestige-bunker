"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send, Wrench } from "lucide-react";
import type { AdminOption } from "@/lib/feedback/owners";
import {
  type FeedbackPriority,
  type FeedbackSeverity,
  type FeedbackStatus,
  type FeedbackWorkStage,
  FEEDBACK_INTERNAL_WORK_STAGES,
  FEEDBACK_PRIORITIES,
  priorityLabel,
  priorityTone,
  severityLabel,
  statusLabel,
  workStageLabel,
  workStageTone,
} from "@/lib/feedback/types";
import {
  blockReporter,
  deleteReport,
  markDuplicateOf,
  setOwner,
  setPriority,
  setSeverity,
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
 * Right-side panel bundling every admin control on a single report.
 *
 * 2026-06-09 external/internal split: the controls are now grouped so the
 * line between what the reporter sees and what stays internal is obvious.
 *   • "Update the reporter" - the only two actions that notify (In progress
 *     / Fixed), each with an optional attached message.
 *   • "Internal" - stage (New / Triaged / Won't fix), priority, owner,
 *     severity, duplicate-of. None of these reach the reporter.
 *   • "Danger zone" - block reporter, delete.
 */
export function SidePanelControls({
  reportId,
  reporterUserId,
  initialWorkStage,
  initialReporterStatus,
  initialPriority,
  initialOwnerUserId,
  initialSeverity,
  initialDuplicateOf,
  owners,
  currentAdminId,
  isSuperAdmin,
}: {
  reportId: string;
  reporterUserId: string | null;
  initialWorkStage: FeedbackWorkStage;
  initialReporterStatus: FeedbackStatus;
  initialPriority: FeedbackPriority | null;
  initialOwnerUserId: string | null;
  initialSeverity: FeedbackSeverity | null;
  initialDuplicateOf: string | null;
  owners: AdminOption[];
  currentAdminId: string;
  isSuperAdmin: boolean;
}) {
  return (
    <div className="space-y-5 rounded-xl glass-panel p-4">
      <ExternalControls
        reportId={reportId}
        currentStage={initialWorkStage}
        reporterStatus={initialReporterStatus}
      />
      <Divider />
      <section className="space-y-4">
        <div>
          <FieldLabel>Internal</FieldLabel>
          <p className="mt-1 text-[10px] text-ink-3">
            Operator-only. None of this reaches the reporter.
          </p>
        </div>
        <InternalStageControl reportId={reportId} initial={initialWorkStage} />
        <PriorityControl reportId={reportId} initial={initialPriority} />
        <OwnerControl
          reportId={reportId}
          initial={initialOwnerUserId}
          owners={owners}
          currentAdminId={currentAdminId}
        />
        <SeverityControl reportId={reportId} initial={initialSeverity} />
        <DuplicateOfControl reportId={reportId} initial={initialDuplicateOf} />
      </section>
      {(reporterUserId || isSuperAdmin) && (
        <>
          <Divider />
          <section className="space-y-4">
            <FieldLabel>Danger zone</FieldLabel>
            {reporterUserId && <BlockReporterControl userId={reporterUserId} />}
            {isSuperAdmin && <DeleteReportControl reportId={reportId} />}
          </section>
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
// External - the two reporter-facing actions. Each opens an inline
// composer (optional message + send). In progress posts the message as
// a reply; Fixed stores it as the resolution note. Both notify the
// reporter; nothing else does.
// --------------------------------------------------------------

type ExternalStage = "inProgress" | "fixed";

function ExternalControls({
  reportId,
  currentStage,
  reporterStatus,
}: {
  reportId: string;
  currentStage: FeedbackWorkStage;
  reporterStatus: FeedbackStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<ExternalStage | null>(null);
  const [note, setNote] = useState("");

  const fire = (stage: ExternalStage) => {
    startTransition(async () => {
      const result = await setWorkStage(reportId, stage, note.trim() || null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        stage === "fixed"
          ? "Marked fixed - reporter notified"
          : "Marked in progress - reporter notified",
      );
      setOpen(null);
      setNote("");
    });
  };

  const toggle = (stage: ExternalStage) => {
    setNote("");
    setOpen((cur) => (cur === stage ? null : stage));
  };

  return (
    <section className="space-y-3">
      <div>
        <FieldLabel>Update the reporter</FieldLabel>
        <p className="mt-1 text-[10px] text-ink-3">
          Sends a notification. The only two states the reporter ever sees.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ExternalButton
          icon={<Wrench className="size-3.5" />}
          label="In progress"
          tone="amber"
          active={currentStage === "inProgress"}
          disabled={pending}
          onClick={() => toggle("inProgress")}
        />
        <ExternalButton
          icon={<Send className="size-3.5" />}
          label="Fixed (hotfix)"
          tone="brand"
          active={currentStage === "fixed"}
          disabled={pending}
          onClick={() => toggle("fixed")}
        />
      </div>
      <p className="text-[10px] text-ink-3">
        Marking fixed here is for one-off hotfixes not tracked in the changelog.
        Normally, releasing a version closes its linked reports for you.
      </p>

      {open && (
        <div className="space-y-2 rounded-lg border border-rule/70 bg-paper-sunken/40 p-3">
          <FieldLabel>
            {open === "fixed"
              ? "Resolution note - optional, shown to the reporter"
              : "Message - optional, shown to the reporter"}
          </FieldLabel>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            autoFocus
            placeholder={
              open === "fixed"
                ? "e.g. Fixed in 0.1.3 - please update the app."
                : "e.g. We've reproduced this and are on it."
            }
            className="block w-full resize-y rounded-lg border border-rule/70 bg-paper-raised/60 p-2 text-xs text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-ink-3">
              Leave blank to update without a message.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(null)}
                disabled={pending}
                className="rounded-md border border-rule/70 px-2.5 py-1 text-[11px] font-semibold text-ink-2 transition-colors hover:text-ink disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => fire(open)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-brand-fg transition-opacity disabled:opacity-60"
              >
                {pending && <Loader2 className="size-3 animate-spin" />}
                {sendLabel(open, note, pending)}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-ink-3">
        Reporter sees:{" "}
        <span className="text-ink-2">{statusLabel(reporterStatus)}</span>
      </p>
    </section>
  );
}

function sendLabel(stage: ExternalStage, note: string, pending: boolean): string {
  if (pending) return "Sending…";
  const verb = stage === "fixed" ? "mark fixed" : "mark in progress";
  return note.trim() ? `Send & ${verb}` : `Confirm - ${verb}`;
}

function ExternalButton({
  icon,
  label,
  tone,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "amber" | "brand";
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const activeClasses =
    tone === "brand"
      ? "border-brand bg-brand/15 text-brand"
      : "border-amber bg-amber/15 text-amber";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? activeClasses
          : "border-rule/70 text-ink-2 hover:border-brand/40 hover:text-ink"
      }`}
    >
      {icon}
      {label}
      {active && <span className="text-[9px] uppercase tracking-wider">· now</span>}
    </button>
  );
}

// --------------------------------------------------------------
// Internal stage - New / Triaged / Won't fix. Pure operator state:
// never notifies, never moves the reporter-facing status.
// --------------------------------------------------------------

function InternalStageControl({
  reportId,
  initial,
}: {
  reportId: string;
  initial: FeedbackWorkStage;
}) {
  const [pending, startTransition] = useTransition();
  const fire = (stage: FeedbackWorkStage) => {
    startTransition(async () => {
      const result = await setWorkStage(reportId, stage, null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Stage → ${workStageLabel(stage)}`);
    });
  };

  // The two external stages can also be the current stage; show them as a
  // read-only marker so the operator isn't confused about where it sits.
  const externalActive =
    initial === "inProgress" || initial === "fixed" ? initial : null;

  return (
    <div className="space-y-2">
      <FieldLabel>Stage</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {FEEDBACK_INTERNAL_WORK_STAGES.map((stage) => {
          const isActive = stage === initial;
          return (
            <button
              key={stage}
              type="button"
              disabled={pending || isActive}
              onClick={() => fire(stage)}
              className={`${PILL_BASE} ${pillToneClasses(workStageTone(stage), isActive)}`}
            >
              {workStageLabel(stage)}
            </button>
          );
        })}
        {externalActive && (
          <span
            className={`${PILL_BASE} ${pillToneClasses(workStageTone(externalActive), true)} cursor-default opacity-90`}
            title="Set from 'Update the reporter' above"
          >
            {workStageLabel(externalActive)}
          </span>
        )}
      </div>
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
// Owner (assignee - admins only)
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
      // delete redirects on success - only land here on error.
      if (result && "error" in result) {
        toast.error(result.error);
      }
    });
  };
  return (
    <div className="space-y-2">
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
