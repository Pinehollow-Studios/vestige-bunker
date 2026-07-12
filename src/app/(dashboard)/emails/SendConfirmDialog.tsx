"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Send, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canSend, type ComplianceCheck } from "@/lib/email/compliance";

/**
 * A deliberate, misclick-proof send confirmation. Opened by "Send now" — it never
 * sends on a single click. It shows exactly who gets it, surfaces any legal
 * blockers (a red check disables sending entirely), and requires an explicit
 * tick before the real Send button turns on.
 */
export function SendConfirmDialog({
  open,
  onClose,
  onConfirm,
  audienceLine,
  subject,
  checks,
  sending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  audienceLine: string;
  subject: string;
  checks: ComplianceCheck[];
  sending: boolean;
}) {
  const [ack, setAck] = useState(false);
  if (!open) return null;

  const blockers = checks.filter((c) => c.level === "fail");
  const warns = checks.filter((c) => c.level === "warn");
  const sendable = canSend(checks);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !sending && onClose()}>
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-paper-raised p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">Send this email?</h3>
          <button onClick={onClose} disabled={sending} className="text-ink-3 hover:text-ink disabled:opacity-50" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="rounded-xl border border-border bg-paper-sunken/40 p-3.5">
          <p className="text-xs uppercase tracking-wider text-ink-3">Going to</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">{audienceLine}</p>
          <p className="mt-2 truncate text-sm text-ink-2">
            <span className="text-ink-3">Subject:</span> {subject || "(no subject)"}
          </p>
        </div>

        {blockers.length > 0 && (
          <div className="space-y-1.5 rounded-xl border border-alert/40 bg-alert/10 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-alert">
              <XCircle className="size-4" /> Fix {blockers.length === 1 ? "this" : "these"} before sending
            </p>
            {blockers.map((c) => (
              <p key={c.id} className="pl-5 text-xs text-alert/90">{c.label} — {c.hint}</p>
            ))}
          </div>
        )}

        {blockers.length === 0 && warns.length > 0 && (
          <div className="space-y-1.5 rounded-xl border border-amber/30 bg-amber/10 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-amber">
              <AlertTriangle className="size-4" /> Worth a look ({warns.length})
            </p>
            {warns.map((c) => (
              <p key={c.id} className="pl-5 text-xs text-amber/90">{c.label} — {c.hint}</p>
            ))}
          </div>
        )}

        {blockers.length === 0 && warns.length === 0 && (
          <p className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 className="size-4" /> All checks passed.
          </p>
        )}

        {sendable && (
          <label className="flex items-start gap-2 rounded-lg border border-rule/60 bg-paper-sunken/30 p-3 text-sm text-ink-2">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
            <span>
              I’ve reviewed this and understand it sends to <span className="font-medium text-ink">{audienceLine}</span> now.
              This can’t be undone.
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="ghost" size="sm" disabled={sending}>Cancel</Button>
          <Button
            onClick={onConfirm}
            disabled={!sendable || !ack || sending}
            size="sm"
            className="bg-brand text-brand-fg hover:bg-brand-deep"
          >
            <Send className="size-4" /> {sending ? "Sending…" : "Send now"}
          </Button>
        </div>
      </div>
    </div>
  );
}
