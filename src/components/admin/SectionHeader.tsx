type Props = {
  title: string;
  description?: string;
  /** Optional eyebrow shown above the title (e.g. "Editorial"). */
  eyebrow?: string;
  /** Right-side actions slot (buttons, filters). */
  actions?: React.ReactNode;
};

export function SectionHeader({ title, description, eyebrow, actions }: Props) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
            {eyebrow}
          </p>
        )}
        <h1 className="display-serif text-3xl font-semibold leading-tight text-ink sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-prose text-sm leading-relaxed text-ink-2">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 self-start sm:self-end">
          {actions}
        </div>
      )}
    </header>
  );
}

export function ComingSoon({ note }: { note: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-paper-raised/60 p-12 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, color-mix(in oklab, var(--brand) 8%, transparent) 0%, transparent 50%)," +
            "radial-gradient(circle at 80% 70%, color-mix(in oklab, var(--info) 6%, transparent) 0%, transparent 50%)",
        }}
      />
      <div className="relative space-y-2">
        <p className="font-heading text-base font-semibold text-ink">Not yet wired</p>
        <p className="mx-auto max-w-md text-sm text-ink-2">{note}</p>
      </div>
    </div>
  );
}
