"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A small dropdown menu - a trigger button + an absolutely-positioned glass
 * panel that closes on outside-click / Escape. Used by the top bar's
 * quick-create, attention bell, and account menu. Children get a `close`
 * callback so items can dismiss after acting.
 */
export function AdminMenu({
  trigger,
  align = "right",
  width = "w-64",
  label,
  children,
}: {
  trigger: React.ReactNode;
  align?: "left" | "right";
  width?: string;
  label?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-2 overflow-hidden rounded-xl border border-rule bg-paper-raised p-1 shadow-2xl",
            width,
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** A standard menu item - link or button. */
export function MenuItem({
  icon,
  children,
  onClick,
  href,
  tone = "default",
  hint,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "danger";
  hint?: string;
}) {
  const cls = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
    tone === "danger" ? "text-alert hover:bg-alert/10" : "text-ink-2 hover:bg-paper-sunken/60 hover:text-ink",
  );
  const body = (
    <>
      {icon && <span className="shrink-0 text-ink-3">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-[11px] tabular-nums text-ink-3">{hint}</span>}
    </>
  );
  if (href) {
    return (
      <Link href={href} role="menuitem" className={cls} onClick={onClick}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" role="menuitem" className={cls} onClick={onClick}>
      {body}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
      {children}
    </p>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-rule/60" />;
}
