"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { removeSuppression } from "./actions";

/** Remove one suppressed address (re-allows future sends). */
export function RemoveSuppressionButton({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-[11px] text-alert">{err}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setErr(null);
          start(async () => {
            const res = await removeSuppression(email);
            if (!res.ok) setErr(res.message);
          });
        }}
        title="Remove from suppression list"
        className="inline-flex items-center gap-1 rounded-lg border border-rule/60 px-2 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:border-alert/40 hover:text-alert disabled:opacity-60"
      >
        <X aria-hidden className="size-3.5" />
        {pending ? "Removing…" : "Remove"}
      </button>
    </div>
  );
}
