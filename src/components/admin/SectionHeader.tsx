type Props = {
  title: string;
  /** Optional eyebrow shown above the title (e.g. "Editorial"). */
  eyebrow?: string;
  /** Right-side actions slot (buttons, filters). */
  actions?: React.ReactNode;
};

/**
 * A page header. Instrument-calm: a small static mint eyebrow (no pulse-ring
 * theater) over a tight display-sans title - not the old 2.6rem serif. Same
 * props as before, so every page keeps working.
 */
export function SectionHeader({ title, eyebrow, actions }: Props) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1.5">
        {eyebrow && (
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
            <span aria-hidden className="size-1.5 rounded-full bg-brand" />
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-[1.75rem]">
          {title}
        </h1>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {actions}
        </div>
      )}
    </header>
  );
}

export function ComingSoon({ note }: { note: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-paper-raised/60 p-12 text-center">
      <p className="font-heading text-base font-semibold text-ink">Not yet wired</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">{note}</p>
    </div>
  );
}
