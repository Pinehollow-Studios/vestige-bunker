"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Lightweight motion primitives. CSS-driven - no animation library. All
 * respect prefers-reduced-motion (via the CSS layer + the reveal hook
 * short-circuit). The old animated-aurora backdrop + scroll-progress sliver
 * were removed in the instrument rebuild - calm + fast over decorated.
 */

/* ── Scroll-reveal hook - true once the element scrolls into view. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const noMotion =
      typeof IntersectionObserver === "undefined" ||
      Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    if (noMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }),
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, shown] as const;
}

/* ── Reveal - fade + lift a block as it enters the viewport. Wrap sections
   or grid items; it's a plain block so it doesn't disturb layout. */
export function Reveal({
  children,
  delay = 0,
  offset = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  offset?: number;
  className?: string;
}) {
  const [ref, shown] = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        transform: shown ? "translateY(0)" : `translateY(${offset}px)`,
        opacity: shown ? 1 : 0,
        transition: `transform 700ms cubic-bezier(0.2,0.8,0.2,1) ${delay}ms, opacity 700ms ease ${delay}ms`,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}

/* ── CountUp - animates a number up to its value when it scrolls into view.
   Renders an em-dash for null (so unbuilt stats fit the grid). */
export function CountUp({
  value,
  duration = 1400,
  className,
}: {
  value: number | null;
  duration?: number;
  className?: string;
}) {
  const [ref, shown] = useReveal<HTMLSpanElement>();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!shown || value == null) return;
    let raf = 0;
    let startTs = 0;
    const tick = (ts: number) => {
      if (!startTs) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, value, duration]);
  return (
    <span ref={ref} className={className}>
      {value == null ? "-" : n.toLocaleString("en-GB")}
    </span>
  );
}
