"use client";

import { LayoutTemplate } from "lucide-react";
import { EMAIL_STARTERS, type EmailStarter } from "@/lib/email/starters";

/**
 * Pick a ready-made, on-brand starter to drop into the email. Jack never faces a
 * blank box — he chooses a shape (announcement, update, note…) and edits the
 * words. Replaces the current subject + content when chosen.
 */
export function StarterPicker({ onPick }: { onPick: (s: EmailStarter) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
        <LayoutTemplate className="size-3.5" /> Start from a template
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {EMAIL_STARTERS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-xl border border-rule/60 bg-paper-sunken/30 p-3 text-left transition-colors hover:border-brand/50 hover:bg-brand/[0.04]"
          >
            <p className="text-sm font-medium text-ink">{s.name}</p>
            <p className="mt-0.5 text-xs leading-snug text-ink-3">{s.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
