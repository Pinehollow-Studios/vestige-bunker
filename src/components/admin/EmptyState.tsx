import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The canonical empty state — icon medallion + title + one line + optional
 * action. Replaces the ad-hoc dashed-border blocks scattered across pages so
 * "nothing here yet" always looks the same.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-rule/70 bg-paper-sunken/30 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Icon className="size-5" />
        </span>
      )}
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
