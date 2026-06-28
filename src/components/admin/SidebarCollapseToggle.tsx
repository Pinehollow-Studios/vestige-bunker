"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

/**
 * Collapses / expands the sidebar rail. Toggles a `.sidebar-collapsed` class on
 * <html> (all the visual work is CSS off that class) and persists the choice to
 * localStorage; an inline script in the root layout restores it pre-paint. The
 * icon swaps via CSS too, so this component needs no state.
 */
export function SidebarCollapseToggle() {
  const toggle = () => {
    const collapsed = document.documentElement.classList.toggle("sidebar-collapsed");
    try {
      localStorage.setItem("vestige.sidebar", collapsed ? "collapsed" : "expanded");
    } catch {
      /* private mode - ignore */
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Collapse or expand the sidebar"
      title="Collapse / expand"
      className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-paper-sunken/60 hover:text-ink-2"
    >
      <PanelLeftClose aria-hidden className="collapse-icon-expanded size-4" />
      <PanelLeftOpen aria-hidden className="collapse-icon-collapsed size-4" />
    </button>
  );
}
