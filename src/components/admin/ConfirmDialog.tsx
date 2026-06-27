"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A double-check modal for larger / harder-to-reverse actions. Controlled:
 * the parent owns `open` and the busy state. Escape + backdrop cancel (unless
 * busy). Mirrors the app's hand-rolled portal modals (no shadcn dialog dep).
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "brand",
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "brand" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open || typeof document === "undefined") return null;

  const body = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        disabled={busy}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-sm"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-rule/70 bg-paper-raised shadow-2xl"
      >
        <div className="flex items-start gap-3 p-5">
          <span
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
              tone === "danger" ? "bg-alert/15 text-alert" : "bg-amber/15 text-amber",
            )}
          >
            <AlertTriangle aria-hidden className="size-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="font-heading text-base font-semibold text-ink">{title}</h2>
            {children && <div className="text-sm leading-relaxed text-ink-2">{children}</div>}
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md p-1 text-ink-3 transition-colors hover:text-ink disabled:opacity-50"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
        <div className="flex justify-end gap-2 border-t border-rule/60 bg-paper-sunken/30 px-5 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md border border-rule/70 px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:text-ink disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-60",
              tone === "danger"
                ? "bg-alert text-white hover:opacity-90"
                : "bg-brand text-brand-fg hover:bg-brand-deep",
            )}
          >
            {busy && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
