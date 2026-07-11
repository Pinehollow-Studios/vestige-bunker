import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The one tab visual. Underline tabs — the canonical look for both the
 * state-driven `PageTabs` and the URL-driven tab bars (feedback queue,
 * analytics sub-nav), so every tabbed surface reads the same regardless of
 * whether it flips client state or navigates.
 */
export const TAB_LIST_CLASS = "flex flex-wrap gap-1 border-b border-rule/60";

export function tabItemClass(active: boolean): string {
  return cn(
    "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
    active ? "border-brand text-ink" : "border-transparent text-ink-3 hover:text-ink-2",
  );
}

/** A link-based tab (URL-driven surfaces). */
export function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} role="tab" aria-selected={active} className={tabItemClass(active)}>
      {children}
    </Link>
  );
}
