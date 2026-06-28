import { NavContent } from "@/components/admin/nav";
import type { AdminRole } from "@/lib/auth/requireAdmin";

// `BrandMark` historically lived here; login/unauthorized still import it from
// this module, so keep the re-export stable while the implementation moved to
// the shared nav module.
export { BrandMark } from "@/components/admin/nav";

/**
 * Desktop navigation rail - `position: fixed` at `lg+`, hidden below that
 * (the {@link MobileNav} drawer takes over on phones/tablets). The nav body
 * itself lives in {@link NavContent}, shared with the drawer.
 */
export function Sidebar({
  counts,
}: {
  counts?: Record<string, number | undefined>;
  /** Accepted for call-site compatibility; nav no longer gates on role. */
  adminRole?: AdminRole;
}) {
  return (
    <aside className="hidden flex-col border-r border-border/70 bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[var(--sidebar-w)]">
      <NavContent counts={counts} collapsible />
    </aside>
  );
}
