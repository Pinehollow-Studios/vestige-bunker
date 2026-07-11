import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * One at-a-glance stat tile — label + big tabular numeral. The shared version
 * of the near-identical tiles the list pages hand-rolled (users, safeguarding).
 * Optionally a link (filter tiles) with an `active` state. Tone colours the
 * numeral only when it's a positive number, so a zero never shouts.
 *
 * (`StatsStrip` remains the animated count-up strip for the overview; this is
 * the static tile for filter/summary grids.)
 */
type Tone = "default" | "brand" | "amber" | "alert" | "muted";

const TONE: Record<Tone, string> = {
  default: "text-ink",
  brand: "text-brand",
  amber: "text-amber",
  alert: "text-alert",
  muted: "text-ink-2",
};

export function StatTile({
  label,
  value,
  tone = "default",
  hint,
  href,
  active,
}: {
  label: string;
  value: number | string | null;
  tone?: Tone;
  hint?: string;
  href?: string;
  active?: boolean;
}) {
  const isNull = value === null || value === undefined;
  const emphasised = tone !== "default" && typeof value === "number" && value > 0;
  const numClass = cn(
    "mt-2 font-hero text-3xl leading-none tabular-nums",
    isNull ? "text-ink-3/40" : emphasised ? TONE[tone] : "text-ink",
  );
  const shell = cn(
    "block rounded-xl glass-panel p-4 transition-colors",
    href && "hover:border-rule-strong hover:bg-paper-raised/40",
    active && "border-brand",
  );

  const body = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">{label}</p>
      <p className={numClass}>
        {isNull ? "—" : typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-ink-3">{hint}</p>}
    </>
  );

  return href ? (
    <Link href={href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
