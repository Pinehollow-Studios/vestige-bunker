"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NavContent } from "@/components/admin/nav";

/**
 * Mobile / tablet navigation. Below `lg` the fixed desktop {@link Sidebar} is
 * hidden, so this is the only way to move between pages — a hamburger in the
 * TopBar that opens a slide-in drawer carrying the full {@link NavContent}.
 *
 * Built so Jack can run the dashboard one-handed from his phone: taps a link
 * and the drawer closes, backdrop or Escape dismisses it, body scroll locks
 * while it's open, and any route change closes it as a safety net.
 */
export function MobileNav({
  counts,
}: {
  counts?: Record<string, number | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation — covers the back button and any programmatic routing,
  // not just link taps (which also call `onNavigate`). Adjusting state during
  // render off a changed value is the React-recommended alternative to an
  // effect here.
  const [seenPath, setSeenPath] = useState(pathname);
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    if (open) setOpen(false);
  }

  // Escape to dismiss + lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="-ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-paper-sunken/60 hover:text-ink lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="lg:hidden">
            {/* Backdrop */}
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            />
            {/* Drawer panel */}
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col border-r border-border/70 bg-sidebar text-sidebar-foreground shadow-2xl animate-in slide-in-from-left duration-200"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="absolute right-3 top-4 z-10 inline-flex size-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-paper-sunken/60 hover:text-ink"
              >
                <X className="size-4" />
              </button>
              <NavContent counts={counts} onNavigate={() => setOpen(false)} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
