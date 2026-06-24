import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { BadgeMedallion } from "@/components/badges/BadgeMedallion";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { NewBadgeButton } from "./NewBadgeButton";
import {
  criteriaSummary,
  statusFor,
  STATUS_CHIP,
  STATUS_DOT,
  STATUS_LABELS,
  TIER_LABELS,
  TIER_ORDER,
  TIER_RING,
  type BadgeDefinitionRow,
  type BadgeStatus,
  type BadgeTier,
} from "./types";

export const dynamic = "force-dynamic";

/**
 * Badge catalogue index. Admin RLS sees every definition (draft / live /
 * archived); the iOS catalogue RPC only exposes published, non-archived ones.
 * Each card links to `/badges/[id]` for the full visual + criteria editor.
 */
export default async function BadgesPage() {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("badge_definitions")
    .select("*")
    .order("is_archived", { ascending: true })
    .order("is_published", { ascending: false })
    .order("category", { ascending: true })
    .order("display_priority", { ascending: false })
    .order("name", { ascending: true });

  const defs = (rows ?? []) as BadgeDefinitionRow[];
  const lookups = await loadLookups(supabase, defs);

  const buckets = bucketRows(defs);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SectionHeader
        eyebrow="Editorial"
        title="Badges"
        actions={<NewBadgeButton />}
      />

      {defs.length > 0 && <Summary buckets={buckets} total={defs.length} />}

      {error && (
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load badges: {error.message}
        </div>
      )}

      {!error && defs.length === 0 && <EmptyState />}

      {defs.length > 0 && (
        <div className="space-y-8">
          {TIER_ORDER.map((tier) => {
            const rows = defs.filter((row) => row.tier === tier);
            if (rows.length === 0) return null;
            return (
              <TierSection key={tier} tier={tier} rows={rows} lookups={lookups} />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** One rarity bucket — a tier header (label + count + ring swatch) over the
 *  badge grid for that tier. Tiers iterate rarest-first per `TIER_ORDER`. */
function TierSection({
  tier,
  rows,
  lookups,
}: {
  tier: BadgeTier;
  rows: BadgeDefinitionRow[];
  lookups: Lookups;
}) {
  return (
    <section className="space-y-3">
      <header className="flex items-center gap-3">
        <TierSwatch tier={tier} />
        <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-ink">
          {TIER_LABELS[tier]}
        </h2>
        <span className="text-xs tabular-nums text-ink-3">{rows.length}</span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <BadgeCard key={row.id} row={row} lookups={lookups} />
        ))}
      </div>
    </section>
  );
}

/** Small metallic disc using the tier's ring gradient — anchors the rarity
 *  of each section visually (matches the medallion frame colours). */
function TierSwatch({ tier }: { tier: BadgeTier }) {
  const ring = TIER_RING[tier];
  const stops = ring
    .map((c, i) => `${c} ${(i / (ring.length - 1)) * 100}%`)
    .join(", ");
  return (
    <span
      aria-hidden
      className="size-4 shrink-0 rounded-full ring-1 ring-inset ring-white/25"
      style={{ background: `linear-gradient(135deg, ${stops})` }}
    />
  );
}

function BadgeCard({
  row,
  lookups,
}: {
  row: BadgeDefinitionRow;
  lookups: Lookups;
}) {
  const status = statusFor(row);
  return (
    <Link
      href={`/badges/${row.id}`}
      className="group/card flex gap-4 rounded-xl glass-panel p-4 transition-colors hover:border-brand/40"
    >
      <div className="shrink-0">
        <BadgeMedallion
          spec={{ glyph: row.glyph, tint_hex: row.tint_hex, tier: row.tier }}
          size={72}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="flex min-w-0 items-center gap-2 truncate font-heading text-base font-semibold leading-snug text-ink">
              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])} />
              <span className="truncate">{row.name}</span>
            </h2>
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                STATUS_CHIP[status],
              )}
            >
              {STATUS_LABELS[status]}
            </span>
          </div>
          {row.tagline && <p className="line-clamp-1 text-xs text-ink-2">{row.tagline}</p>}
          <p className="line-clamp-2 text-xs text-ink-3">
            {criteriaSummary(row.criteria, lookups)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
          <Chip>{row.tier}</Chip>
          <Chip>{row.category}</Chip>
          {row.is_secret && <Chip tone="info">Secret</Chip>}
          <span className="ml-auto inline-flex items-center gap-1 text-brand opacity-0 transition-opacity group-hover/card:opacity-100">
            Edit <ArrowUpRight aria-hidden className="size-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "info" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5",
        tone === "info"
          ? "border-info/30 bg-info/10 text-info"
          : "border-border bg-paper-sunken/50 text-ink-2",
      )}
    >
      {children}
    </span>
  );
}

function Summary({ buckets, total }: { buckets: Record<BadgeStatus, number>; total: number }) {
  const order: BadgeStatus[] = ["live", "draft", "archived"];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full glass-panel px-3 py-1 text-xs font-medium text-ink-2">
        {total} total
      </span>
      {order.map((key) => (
        <span
          key={key}
          className="inline-flex items-center gap-2 rounded-full glass-panel px-3 py-1 text-xs"
        >
          <span aria-hidden className={cn("size-2 rounded-full", STATUS_DOT[key])} />
          <span className="text-ink-2">{STATUS_LABELS[key]}</span>
          <span className="font-semibold tabular-nums text-ink">{buckets[key]}</span>
        </span>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl glass-panel p-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Sparkles className="size-5" />
        </span>
        <p className="font-display text-base font-semibold text-ink">No badges yet</p>
        <p className="text-sm text-ink-2">Design your first badge to start the catalogue.</p>
      </div>
    </div>
  );
}

function bucketRows(rows: BadgeDefinitionRow[]): Record<BadgeStatus, number> {
  const out: Record<BadgeStatus, number> = { live: 0, draft: 0, archived: 0 };
  for (const row of rows) out[statusFor(row)] += 1;
  return out;
}

type Lookups = {
  counties: Record<string, string>;
  courses: Record<string, string>;
  lists: Record<string, string>;
};

async function loadLookups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  defs: BadgeDefinitionRow[],
): Promise<Lookups> {
  const counties: Record<string, string> = {};
  const courses: Record<string, string> = {};
  const lists: Record<string, string> = {};

  const { data: countyRows } = await supabase.from("counties").select("id,name");
  for (const c of countyRows ?? []) counties[c.id] = c.name;

  const { data: listRows } = await supabase.from("curated_lists").select("id,name");
  for (const l of listRows ?? []) lists[l.id] = l.name;

  const courseIds = defs
    .map((d) => (d.criteria.type === "specific_course" ? d.criteria.course_id : null))
    .filter((x): x is string => !!x);
  if (courseIds.length > 0) {
    const { data: courseRows } = await supabase.from("courses").select("id,name").in("id", courseIds);
    for (const c of courseRows ?? []) courses[c.id] = c.name;
  }

  return { counties, courses, lists };
}
