"use client";

import { useTransition } from "react";
import { FlaskConical } from "lucide-react";
import { setEnv } from "@/app/(dashboard)/actions";
import type { AdminEnvKey } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

/**
 * Hidden developer-only environment switch. Only rendered when the dev switch
 * is enabled (`enabled` — local + Preview, never production), so Jack never
 * sees it. Flips the dashboard (data + auth) between prod and dev. When on dev,
 * it shows a loud amber badge so a developer can never forget they're off prod.
 */
export function EnvToggle({
  current,
  enabled,
}: {
  current: AdminEnvKey;
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  if (!enabled) return null;
  const onDev = current === "dev";
  return (
    <button
      type="button"
      onClick={() => startTransition(() => void setEnv(onDev ? "prod" : "dev"))}
      disabled={pending}
      title={onDev ? "On DEV — click to return to prod" : "Switch to dev (developer only)"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-60",
        onDev
          ? "border-amber/60 bg-amber text-white hover:bg-amber/90"
          : "border-border bg-paper-sunken/60 text-ink-3 hover:text-ink",
      )}
    >
      <FlaskConical aria-hidden className="size-3" />
      {onDev ? "DEV — switch to prod" : "Dev"}
    </button>
  );
}
