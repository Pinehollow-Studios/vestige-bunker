type Props = {
  title: string;
  /** Optional eyebrow shown above the title (e.g. "Editorial"). */
  eyebrow?: string;
  /** Right-side actions slot (buttons, filters). */
  actions?: React.ReactNode;
};

export function SectionHeader({ title, eyebrow, actions }: Props) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {eyebrow && (
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
            <span aria-hidden className="relative inline-flex size-1.5 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full border border-brand"
                style={{ animation: "adm-pulse-ring 2.2s ease-out infinite" }}
              />
              <span
                className="size-1.5 rounded-full bg-brand"
                style={{ animation: "adm-pulse-dot 1.8s ease-in-out infinite" }}
              />
            </span>
            {eyebrow}
          </p>
        )}
        <h1 className="display-serif text-[2rem] font-semibold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[2.6rem]">
          {title}
        </h1>
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
