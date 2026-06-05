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
  type BadgeDefinitionRow,
  type BadgeStatus,
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
    <div className="mx-auto max-w-6xl space-y-8">
      <SectionHeader
        eyebrow="Editorial"
        title="Badges"
        description="Design the badges users chase — artwork, rarity, and exactly what it takes to earn each one. Published badges appear in the app as earned or locked-with-progress."
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {defs.map((row) => (
            <BadgeCard key={row.id} row={row} lookups={lookups} />
          ))}
        </div>
      )}
    </div>
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
      className="group/card relative flex gap-4 overflow-hidden rounded-2xl border border-border bg-paper-raised p-4 ring-1 ring-foreground/5 transition-all hover:-translate-y-px hover:border-brand/40 hover:shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--brand)_30%,transparent)] hover:ring-brand/15"
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", STATUS_DOT[status])} />
      <div className="shrink-0">
        <BadgeMedallion
          spec={{
            glyph: row.glyph,
            theme: row.theme,
            tint_hex: row.tint_hex,
            tier: row.tier,
            shape: row.shape,
            effect: row.effect,
          }}
          size={72}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="truncate font-heading text-base font-semibold leading-snug text-ink">
              {row.name}
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
          <span className="ml-auto inline-flex items-center gap-1 text-brand-deep opacity-0 transition-opacity group-hover/card:opacity-100 dark:text-brand-soft">
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
      <span className="rounded-full border border-border bg-paper-raised px-3 py-1 text-xs font-medium text-ink-2">
        {total} total
      </span>
      {order.map((key) => (
        <span
          key={key}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-paper-raised px-3 py-1 text-xs"
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
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/70 bg-paper-raised/60 p-12 text-center">
      <div className="relative flex flex-col items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand-deep dark:text-brand-soft">
          <Sparkles className="size-5" />
        </span>
        <p className="font-heading text-base font-semibold text-ink">No badges yet</p>
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
