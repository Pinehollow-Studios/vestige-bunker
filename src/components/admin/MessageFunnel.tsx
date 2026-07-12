import { cn } from "@/lib/utils";

/**
 * A compact delivery funnel — stages as proportional bars (each with its % of
 * the top stage) plus negative-signal chips (bounced / complained / failed).
 * Used on the email-campaign + push-broadcast detail pages (Phase 1.3).
 */

export type FunnelStage = { label: string; value: number };
export type FunnelNote = { label: string; value: number; tone?: "warn" | "alert" };

export function MessageFunnel({
  title,
  subtitle,
  stages,
  notes,
  empty,
}: {
  title: string;
  subtitle?: string;
  stages: FunnelStage[];
  notes?: FunnelNote[];
  empty?: string;
}) {
  const top = Math.max(1, stages[0]?.value ?? 0);
  const hasData = stages.some((s) => s.value > 0) || (notes ?? []).some((n) => n.value > 0);

  return (
    <div className="rounded-2xl border border-border bg-paper-raised/50 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{title}</p>
        {subtitle && <span className="text-xs text-ink-3">{subtitle}</span>}
      </div>

      {!hasData ? (
        <p className="mt-3 rounded-xl border border-dashed border-rule/60 bg-paper-sunken/30 px-3 py-6 text-center text-sm text-ink-3">
          {empty ?? "No delivery data yet."}
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {stages.map((s, i) => {
            const pct = Math.round((s.value / top) * 100);
            return (
              <div key={s.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">{s.label}</span>
                  <span className="tabular-nums text-ink-2">
                    {s.value.toLocaleString()}
                    {i > 0 && <span className="text-ink-3"> · {pct}%</span>}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper-sunken/60">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${s.value > 0 ? Math.max(pct, 3) : 0}%` }}
                  />
                </div>
              </div>
            );
          })}

          {notes && notes.some((n) => n.value > 0) && (
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {notes
                .filter((n) => n.value > 0)
                .map((n) => (
                  <span
                    key={n.label}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      n.tone === "alert"
                        ? "border-alert/30 bg-alert/10 text-alert"
                        : "border-amber/30 bg-amber/10 text-amber",
                    )}
                  >
                    {n.value.toLocaleString()} {n.label}
                  </span>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
