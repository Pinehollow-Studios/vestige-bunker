import { AlertTriangle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReadinessState = "ok" | "warn" | "missing" | "info";

export type ReadinessCheck = {
  state: ReadinessState;
  label: string;
  hint?: string;
};

/**
 * A compact readiness checklist beside an editor - tells the author what's done
 * and what's missing before publishing, so editorial is a confident act, not a
 * guess. `warn` / `missing` items are the things to fix; `ok` is green; `info`
 * is neutral context.
 */
export function Readiness({ checks, title = "Readiness" }: { checks: ReadinessCheck[]; title?: string }) {
  const blocking = checks.filter((c) => c.state === "missing").length;
  const warnings = checks.filter((c) => c.state === "warn").length;
  const summary =
    blocking > 0
      ? `${blocking} to fix`
      : warnings > 0
        ? `${warnings} to review`
        : "Ready";

  return (
    <div className="space-y-3 rounded-xl glass-panel p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">{title}</p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            blocking > 0 ? "bg-alert/15 text-alert" : warnings > 0 ? "bg-amber/15 text-amber" : "bg-brand/15 text-brand",
          )}
        >
          {summary}
        </span>
      </div>
      <ul className="space-y-2">
        {checks.map((c, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <Glyph state={c.state} />
            <div className="min-w-0">
              <p className={cn(c.state === "missing" ? "text-ink" : "text-ink-2")}>{c.label}</p>
              {c.hint && <p className="text-[11px] text-ink-3">{c.hint}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Glyph({ state }: { state: ReadinessState }) {
  const base = "mt-0.5 size-3.5 shrink-0";
  if (state === "ok") return <Check aria-hidden className={cn(base, "text-brand")} />;
  if (state === "warn") return <AlertTriangle aria-hidden className={cn(base, "text-amber")} />;
  if (state === "missing") return <X aria-hidden className={cn(base, "text-alert")} />;
  return <Info aria-hidden className={cn(base, "text-ink-3")} />;
}
