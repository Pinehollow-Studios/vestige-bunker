import { cn } from "@/lib/utils";

/**
 * A single shimmering placeholder block. Used to build per-surface loading
 * skeletons so navigation paints instantly (the page streams its real data in
 * behind a Suspense / loading.tsx boundary). Calm, fast, reduced-motion-safe.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-paper-sunken/80", className)}
    />
  );
}

/** A generic queue/list page skeleton - header + filter bar + a stack of rows. */
export function PageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
