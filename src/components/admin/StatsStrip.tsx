import { cn } from "@/lib/utils";

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
 * Each tile uses the brand display font for the numeral and the
 * editorial serif for the label so the dashboard reads like the
 * almanac it sits next to.
 */
export function StatsStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => {
        const isNull = stat.value === null;
        const tone = stat.tone ?? "default";
        const showAttention = !isNull && tone === "attention" && (stat.value ?? 0) > 0;
        return (
          <div
            key={stat.key}
            className={cn(
              "flex flex-col gap-2 rounded-xl border border-rule/70 bg-paper-raised/50 p-4",
              showAttention && "border-brand/30",
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              {stat.label}
            </span>
            {/* Fraunces numeral — mirrors the app's HeroNumeral. */}
            <span
              className={cn(
                "font-display text-[30px] font-medium leading-none tabular-nums tracking-[-0.01em]",
                isNull
                  ? "text-ink-3/40"
                  : showAttention
                    ? "text-brand"
                    : tone === "muted"
                      ? "text-ink-2"
                      : "text-ink",
              )}
            >
              {isNull ? "—" : stat.value}
            </span>
            {stat.hint && (
              <span className="text-[11px] leading-snug text-ink-3">{stat.hint}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
