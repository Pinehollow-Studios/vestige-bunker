"use client";

import { useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { setProdView } from "@/app/(dashboard)/actions";
import { cn } from "@/lib/utils";

/** Toggles read-only PROD VIEW. No relogin — it just flips a cookie. */
export function ProdViewToggle({ active }: { active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => void setProdView(!active))}
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-60",
        active
          ? "border-alert/50 bg-alert text-white hover:bg-alert/90"
          : "border-border bg-paper-sunken/60 text-ink-3 hover:text-ink",
      )}
    >
      {active ? <EyeOff aria-hidden className="size-3" /> : <Eye aria-hidden className="size-3" />}
      {active ? "Exit prod view" : "View prod"}
    </button>
  );
}
