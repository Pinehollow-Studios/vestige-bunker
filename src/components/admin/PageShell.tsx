import { cn } from "@/lib/utils";

/**
 * The one page container. Every screen centers its content and spaces its
 * top-level sections through this, so width + vertical rhythm are consistent
 * across the whole tool instead of the per-page `mx-auto max-w-{2..6}xl
 * space-y-{4..8}` drift they used to hand-roll.
 *
 * Width vocabulary (small on purpose):
 *   • narrow  — focused editors / forms / detail pages (max-w-3xl).
 *   • content — most list + read screens (max-w-5xl, the default).
 *   • wide    — dense, data-rich screens: overview, tables, editors w/ preview (max-w-6xl).
 *   • full    — full-bleed, very wide tables (no max-width).
 * Rhythm is a single `space-y-6` for every screen.
 *
 * Use `<PageShell>` for new screens; `pageShell(width)` is the same recipe as a
 * className for screens that manage their own root element.
 */
const WIDTHS = {
  narrow: "max-w-3xl",
  content: "max-w-5xl",
  wide: "max-w-6xl",
  full: "max-w-none",
} as const;

export type PageWidth = keyof typeof WIDTHS;

/** The canonical page-container classes (centered, width-bounded, one rhythm). */
export function pageShell(width: PageWidth = "content", className?: string): string {
  return cn("mx-auto w-full space-y-6", WIDTHS[width], className);
}

export function PageShell({
  children,
  width = "content",
  className,
}: {
  children: React.ReactNode;
  width?: PageWidth;
  className?: string;
}) {
  return <div className={pageShell(width, className)}>{children}</div>;
}
