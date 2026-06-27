import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Loader2, TriangleAlert } from "lucide-react";
import type { SaveState } from "@/lib/hooks/useFormAutosave";
import { cn } from "@/lib/utils";

/**
 * The shared editor chrome — every editor page (course, curated, badge,
 * announcement, changelog) sits in this. A back link, an eyebrow + title, a
 * live autosave indicator, an optional meta row, and an actions slot. The body
 * is composed of {@link EditorSection}s (essentials first) + an
 * {@link AdvancedSection} (the rare stuff, collapsed). Progressive disclosure,
 * not a 40-field wall.
 */
export function EditorShell({
  backHref,
  backLabel,
  eyebrow,
  title,
  saveState,
  actions,
  meta,
  aside,
  children,
}: {
  backHref: string;
  backLabel: string;
  eyebrow?: string;
  title: string;
  saveState?: SaveState;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  /** Optional sticky right column — a live preview + readiness checklist. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto space-y-5", aside ? "max-w-6xl" : "max-w-5xl")}>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {backLabel}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">{eyebrow}</p>
          )}
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {saveState && <SaveIndicator state={saveState} />}
          {actions}
        </div>
      </header>

      {meta && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl glass-panel px-4 py-2.5 text-xs">
          {meta}
        </div>
      )}

      {aside ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">{children}</div>
          <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">{aside}</aside>
        </div>
      ) : (
        <div className="space-y-4">{children}</div>
      )}
    </div>
  );
}

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") {
    return <span className="text-xs text-ink-3">All changes saved</span>;
  }
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
        <Loader2 aria-hidden className="size-3.5 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand">
        <Check aria-hidden className="size-3.5" /> Saved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-alert">
      <TriangleAlert aria-hidden className="size-3.5" /> Couldn&rsquo;t save — keep editing to retry
    </span>
  );
}

/** A titled card section — the essentials.
 *
 *  `hint` is accepted (so existing call sites keep compiling) but intentionally
 *  not rendered: the dashboard dropped its grey helper/description text in the
 *  2026-06-27 declutter pass. Same applies to {@link AdvancedSection} +
 *  {@link Field} below. */
export function EditorSection({
  title,
  actions,
  children,
}: {
  title: string;
  hint?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl glass-panel p-5">
      <header className="flex items-start justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

/** A collapsed-by-default section for rare / structural fields. Native
 *  `<details>` — no JS. The progressive-disclosure escape valve. */
export function AdvancedSection({
  title = "Advanced",
  children,
  defaultOpen = false,
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl glass-panel">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-2">{title}</h2>
        <ChevronDown
          aria-hidden
          className="size-4 text-ink-3 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="space-y-4 px-5 pb-5">{children}</div>
    </details>
  );
}

/** A labelled field wrapper. */
export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink-2">
        {label}
      </label>
      {children}
    </div>
  );
}

/** A read-only value row (e.g. name / slug that can't be renamed in v1). */
export function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex h-9 items-center rounded-lg border border-input bg-paper-sunken/30 px-3 text-sm text-ink-2">
        {value}
      </div>
    </Field>
  );
}

export const fieldInputClass = cn(
  "flex h-9 w-full rounded-lg border border-input bg-paper-sunken/40 px-3 text-sm text-ink transition-colors",
  "placeholder:text-ink-3 focus-visible:border-brand/60 focus-visible:bg-paper-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
);
