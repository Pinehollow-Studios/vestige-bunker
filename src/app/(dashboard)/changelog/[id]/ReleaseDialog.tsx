"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Loader2, Rocket, Sparkles, UserX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listReportsForRelease,
  releaseVersion,
  type ReleaseReportRow,
} from "../actions";

/**
 * Release-confirmation modal. Opening flips a version In development → Released,
 * but first surfaces every linked-and-still-open feedback report so the operator
 * can attach a per-report message that ships to the reporter as the resolution
 * note. Confirming marks each included report Fixed (notifying its reporter) and
 * releases the version - the changelog↔feedback loop closed at the one moment a
 * fix actually reaches users.
 */
export function ReleaseDialog({
  versionId,
  version,
  onReleased,
  onClose,
}: {
  versionId: string;
  version: string;
  onReleased: () => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ReleaseReportRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Per-report editable state, keyed by reportId.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    listReportsForRelease(versionId).then((res) => {
      if (!active) return;
      if (!res.ok) {
        setLoadError(res.message);
        setRows([]);
        return;
      }
      setRows(res.data ?? []);
      // Default: include every report (anonymous ones still resolve, just
      // without a notification).
      setIncluded(Object.fromEntries((res.data ?? []).map((r) => [r.reportId, true])));
    });
    return () => {
      active = false;
    };
  }, [versionId]);

  // Esc to dismiss.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  const includeCount = rows
    ? rows.filter((r) => included[r.reportId]).length
    : 0;

  function confirm() {
    if (!rows) return;
    startTransition(async () => {
      const res = await releaseVersion(
        versionId,
        rows.map((r) => ({
          reportId: r.reportId,
          note: notes[r.reportId]?.trim() || null,
          include: included[r.reportId] ?? false,
        })),
      );
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const { fixed, failed } = res.data ?? { fixed: 0, failed: 0 };
      toast.success(
        fixed > 0
          ? `Released v${version} - ${fixed} report${fixed === 1 ? "" : "s"} marked fixed`
          : `Released v${version}`,
      );
      if (failed > 0) toast.error(`${failed} report${failed === 1 ? "" : "s"} failed to update`);
      onReleased();
    });
  }

  const body = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={() => !pending && onClose()}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-rule/70 bg-paper-raised shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-rule/60 p-5">
          <div className="space-y-1">
            <p className="flex items-center gap-2 font-heading text-base font-semibold text-ink">
              <Rocket aria-hidden className="size-4 text-brand" />
              Release v{version}
            </p>
            <p className="text-xs text-ink-3">
              {rows === null
                ? "Loading linked reports…"
                : rows.length === 0
                  ? "No open reports are linked to this version - releasing won't notify anyone."
                  : `${includeCount} of ${rows.length} reporter${rows.length === 1 ? "" : "s"} will be told their issue is fixed.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !pending && onClose()}
            className="rounded-md p-1 text-ink-3 transition-colors hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {loadError && (
            <p className="rounded-lg border border-alert/40 bg-alert/10 p-3 text-xs text-alert">
              {loadError}
            </p>
          )}
          {rows?.map((row) => (
            <ReportCard
              key={row.reportId}
              row={row}
              version={version}
              note={notes[row.reportId] ?? ""}
              included={included[row.reportId] ?? false}
              disabled={pending}
              onNote={(v) => setNotes((m) => ({ ...m, [row.reportId]: v }))}
              onToggle={(v) => setIncluded((m) => ({ ...m, [row.reportId]: v }))}
            />
          ))}
          {rows && rows.length === 0 && !loadError && (
            <p className="rounded-lg border border-dashed border-rule/60 bg-paper-sunken/30 p-6 text-center text-sm text-ink-3">
              Nothing to send. Confirm to mark v{version} released.
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-rule/60 p-4">
          <button
            type="button"
            onClick={() => !pending && onClose()}
            disabled={pending}
            className="rounded-md border border-rule/70 px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:text-ink disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending || rows === null}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg transition-opacity hover:bg-brand-deep disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Rocket className="size-3.5" />
            )}
            {pending
              ? "Releasing…"
              : includeCount > 0
                ? `Release & notify ${includeCount}`
                : `Release v${version}`}
          </button>
        </footer>
      </div>
    </div>
  );

  // Portal so the overlay escapes the editor's stacking/overflow context.
  if (typeof document === "undefined") return null;
  return createPortal(body, document.body);
}

// ── A single report row in the dialog ─────────────────────────────────────

function ReportCard({
  row,
  version,
  note,
  included,
  disabled,
  onNote,
  onToggle,
}: {
  row: ReleaseReportRow;
  version: string;
  note: string;
  included: boolean;
  disabled: boolean;
  onNote: (v: string) => void;
  onToggle: (v: boolean) => void;
}) {
  const snippets = snippetsFor(row.reportKind, version);

  return (
    <div
      className={cn(
        "space-y-2.5 rounded-xl border p-3 transition-colors",
        included
          ? "border-brand/30 bg-brand/5"
          : "border-rule/60 bg-paper-sunken/30 opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="line-clamp-1 text-xs font-semibold text-ink">
            {row.changeSummary}
          </p>
          <p className="line-clamp-2 text-[11px] text-ink-3">{row.reportBody}</p>
        </div>
        {row.hasReporter ? (
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-ink-2">
            <input
              type="checkbox"
              checked={included}
              disabled={disabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="size-3.5 accent-brand"
            />
            Notify
          </label>
        ) : (
          <span
            className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3"
            title="Reporter's account was deleted - the report is still marked fixed, but no notification is sent."
          >
            <UserX aria-hidden className="size-3" />
            Anonymous
          </span>
        )}
      </div>

      {included && (
        <>
          <textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            rows={2}
            disabled={disabled}
            placeholder={
              row.hasReporter
                ? "Optional message to the reporter…"
                : "Optional resolution note (no reporter to notify)…"
            }
            className="block w-full resize-y rounded-lg border border-rule/70 bg-paper-raised/70 p-2 text-xs text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30 disabled:opacity-60"
          />
          <div className="flex flex-wrap gap-1.5">
            {snippets.map((snippet) => (
              <button
                key={snippet}
                type="button"
                disabled={disabled}
                onClick={() => onNote(snippet)}
                className="inline-flex items-center gap-1 rounded-md border border-rule/60 px-2 py-1 text-[10px] text-ink-3 transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-60"
              >
                <Sparkles aria-hidden className="size-2.5" />
                {snippet.length > 48 ? snippet.slice(0, 46) + "…" : snippet}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Clickable pre-written resolution lines. Feature requests lead with "shipped"
 * phrasing (the 2026-06-12 smart-copy decision); everything else with "fixed".
 * One line always carries the version number.
 */
function snippetsFor(reportKind: string, version: string): string[] {
  const base = [
    `This is fixed in v${version} - please update to the latest version of Vestige.`,
    "Thanks for flagging this - it's fixed in the latest update.",
    "Fixed. Thanks for your patience, and for helping make Vestige better.",
  ];
  if (reportKind === "featureRequest") {
    return [
      `The feature you asked for just shipped in v${version} 🎉`,
      `Good news - this is live as of v${version}. Thanks for the suggestion!`,
      ...base,
    ];
  }
  return base;
}
