import { cn } from "@/lib/utils";
import { CountUp } from "@/components/admin/Motion";

export type Stat = {
  key: string;
  label: string;
  value: number | null;
  hint?: string;
  /** Visual emphasis. `attention` highlights with brand green when
   *  the value is non-zero and worth surfacing. */
  tone?: "default" | "attention" | "muted";
};

/**
 * At-a-glance numbers row. Lives directly below the page heading.
 * `null` values render as an em-dash so unbuilt sections fit the
 * grid without making the dashboard feel half-finished.
 *
 * Each tile uses the brand display font (Manrope) for the numeral
 * and an uppercase label so the dashboard reads clean and modern,
 * matching the iOS app.
 */
export function StatsStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat, idx) => {
        const isNull = stat.value === null;
        const tone = stat.tone ?? "default";
        const showAttention = !isNull && tone === "attention" && (stat.value ?? 0) > 0;
        return (
          <div
            key={stat.key}
            className={cn(
              "glass-panel adm-rise flex flex-col gap-2 rounded-2xl p-4",
              showAttention && "border-brand/30",
            )}
            style={{ animationDelay: `${idx * 70}ms` }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              {stat.label}
            </span>
            {/* Manrope numeral that counts up - mirrors the app's HeroNumeral. */}
            <CountUp
              value={isNull ? null : stat.value}
              className={cn(
                "font-display text-[32px] font-medium leading-none tabular-nums tracking-[-0.02em]",
                isNull
                  ? "text-ink-3/40"
                  : showAttention
                    ? "text-brand"
                    : tone === "muted"
                      ? "text-ink-2"
                      : "text-ink",
              )}
            />
            {stat.hint && (
              <span className="text-[11px] leading-snug text-ink-3">{stat.hint}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
