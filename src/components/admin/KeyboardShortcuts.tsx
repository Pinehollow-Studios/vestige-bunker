"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command, X } from "lucide-react";
import { Kbd, KbdChord } from "@/components/ui/kbd";
import { GO_TO, pushRecent } from "@/lib/nav-shortcuts";

/**
 * The global keyboard layer, mounted once in the dashboard shell. Gives The
 * Bunker its keyboard-first spine:
 *   • `g` then a key  → jump to a section (Linear-style go-to).
 *   • `?`             → open the shortcuts overlay.
 *   • Esc             → dismiss the overlay / cancel a pending go-to.
 * ⌘K (the command palette) is owned by CommandPalette. Also records the visited
 * section into the recent-pages list the palette reads.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const [pendingGo, setPendingGo] = useState(false);
  const goTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Record top-level visits so the palette can surface "Recent".
  useEffect(() => {
    const seg = pathname.split("/").filter(Boolean)[0];
    pushRecent(seg ? `/${seg}` : "/");
  }, [pathname]);

  const clearGo = useCallback(() => {
    if (goTimer.current) clearTimeout(goTimer.current);
    goTimer.current = null;
    setPendingGo(false);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Never hijack typing or modified chords (⌘K etc. are handled elsewhere).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.isContentEditable ||
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT")
      ) {
        return;
      }

      if (e.key === "Escape") {
        if (helpOpen) setHelpOpen(false);
        clearGo();
        return;
      }

      // `?` — the shortcuts overlay.
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
        clearGo();
        return;
      }

      // Second key of a `g _` go-to.
      if (pendingGo) {
        const match = GO_TO.find((g) => g.key === e.key.toLowerCase());
        clearGo();
        if (match) {
          e.preventDefault();
          router.push(match.href);
        }
        return;
      }

      // First key — arm go-to.
      if (e.key.toLowerCase() === "g") {
        setPendingGo(true);
        goTimer.current = setTimeout(() => setPendingGo(false), 1400);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingGo, helpOpen, router, clearGo]);

  return (
    <>
      {pendingGo && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-paper-raised/95 px-3 py-1.5 text-xs text-ink-2 shadow-lg backdrop-blur">
            <Kbd>g</Kbd> then a key… <span className="text-ink-3">(o f e n c l b a p s u)</span>
          </span>
        </div>
      )}
      {helpOpen && <ShortcutsOverlay onClose={() => setHelpOpen(false)} />}
    </>
  );
}

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-paper-sunken/70 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-rule bg-paper-raised shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Command className="size-4 text-brand" /> Keyboard shortcuts
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-ink-3 hover:bg-sidebar-accent/40 hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[62vh] space-y-5 overflow-y-auto p-4">
          <ShortcutSection title="Global">
            <ShortcutRow label="Command palette"><KbdChord keys={["⌘", "K"]} /></ShortcutRow>
            <ShortcutRow label="This menu"><Kbd>?</Kbd></ShortcutRow>
            <ShortcutRow label="Dismiss / close"><Kbd>Esc</Kbd></ShortcutRow>
          </ShortcutSection>

          <ShortcutSection title="Go to">
            {GO_TO.map((g) => (
              <ShortcutRow key={g.key} label={g.label}>
                <KbdChord keys={["g", g.key]} />
              </ShortcutRow>
            ))}
          </ShortcutSection>

          <p className="text-center text-xs text-ink-3">
            Everything else lives in the command palette — <KbdChord keys={["⌘", "K"]} />.
          </p>
        </div>
      </div>
    </div>
  );
}

function ShortcutSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ShortcutRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-sidebar-accent/30">
      <span className="text-sm text-ink-2">{label}</span>
      {children}
    </div>
  );
}
