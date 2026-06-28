import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Layers,
  ListChecks,
  MapPin,
  Milestone,
  Sparkles,
  Flag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { TableToolbar, TableSelect } from "@/components/admin/table/TableToolbar";
import type { SortDir } from "@/components/admin/table/DataTable";
import { BadgeMedallion } from "@/components/badges/BadgeMedallion";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { NewBadgeButton } from "./NewBadgeButton";
import { BadgesTable, type BadgeTableRow } from "./BadgesTable";
import {
  CATEGORIES,
  criteriaSummary,
  statusFor,
  STATUS_DOT,
  STATUS_LABELS,
  TIER_ORDER,
  TIERS,
  type BadgeCategory,
  type BadgeDefinitionRow,
  type BadgeStatus,
} from "./types";

export const dynamic = "force-dynamic";

const STATUS_ORDER: BadgeStatus[] = ["live", "draft", "archived"];
const STATUS_RANK: Record<BadgeStatus, number> = { live: 0, draft: 1, archived: 2 };

/** Group metadata - mirrors how badges are grouped on the iOS Badges wall. */
const CATEGORY_META: Record<BadgeCategory, { label: string; blurb: string; icon: LucideIcon }> = {
  collection: { label: "Collection", blurb: "Courses played", icon: Layers },
  counties: { label: "Counties", blurb: "County completion", icon: MapPin },
  lists: { label: "Lists", blurb: "Curated lists finished", icon: ListChecks },
  social: { label: "Social", blurb: "Friends & feed", icon: Users },
  rounds: { label: "Rounds", blurb: "Rounds logged", icon: Flag },
  milestones: { label: "Milestones", blurb: "Career landmarks", icon: Milestone },
  special: { label: "Special", blurb: "One-offs & secret", icon: Sparkles },
};

type SearchParams = Promise<{
  q?: string;
  status?: string;
  tier?: string;
  category?: string;
  sort?: string;
  dir?: string;
}>;

export default async function BadgesPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const statusFilter = sp.status ?? "all";
  const tierFilter = sp.tier ?? "all";
  const categoryFilter = sp.category ?? "all";
  const sort = sp.sort ?? "name";
  const dir: SortDir = sp.dir === "desc" ? "desc" : "asc";

  const supabase = await createClient();
  const { data, error } = await supabase.from("badge_definitions").select("*");
  const defs = (data ?? []) as BadgeDefinitionRow[];

  const buckets: Record<BadgeStatus, number> = { live: 0, draft: 0, archived: 0 };
  for (const d of defs) buckets[statusFor(d)] += 1;

  // Landing on no selection → the group grid; otherwise the scoped table.
  const showTable =
    categoryFilter !== "all" || Boolean(q) || statusFilter !== "all" || tierFilter !== "all";

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <SectionHeader eyebrow="Editorial" title="Badges" actions={<NewBadgeButton />} />
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load badges: {error.message}
        </div>
      </div>
    );
  }

  if (!showTable) {
    return <GroupLanding defs={defs} buckets={buckets} />;
  }

  return (
    <TableView
      supabase={supabase}
      defs={defs}
      buckets={buckets}
      sp={sp}
      q={q}
      statusFilter={statusFilter}
      tierFilter={tierFilter}
      categoryFilter={categoryFilter}
      sort={sort}
      dir={dir}
    />
  );
}

// ── Landing: group grid ────────────────────────────────────────────────
function GroupLanding({
  defs,
  buckets,
}: {
  defs: BadgeDefinitionRow[];
  buckets: Record<BadgeStatus, number>;
}) {
  const byCategory = new Map<BadgeCategory, BadgeDefinitionRow[]>();
  for (const d of defs) {
    const list = byCategory.get(d.category) ?? [];
    list.push(d);
    byCategory.set(d.category, list);
  }
  const groups = CATEGORIES.filter((c) => (byCategory.get(c)?.length ?? 0) > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <SectionHeader eyebrow="Editorial" title="Badges" actions={<NewBadgeButton />} />

      <StatusPills buckets={buckets} show={defs.length > 0} />

      <TableToolbar
        initialQuery=""
        searchPlaceholder="Search every badge…"
        countLabel={`${defs.length} ${defs.length === 1 ? "badge" : "badges"} across ${groups.length} groups - pick a group or search`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((category) => (
          <GroupCard key={category} category={category} badges={byCategory.get(category) ?? []} />
        ))}
      </div>
    </div>
  );
}

function GroupCard({ category, badges }: { category: BadgeCategory; badges: BadgeDefinitionRow[] }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const live = badges.filter((b) => statusFor(b) === "live").length;
  // Representative seals: live first, then rarest tier first.
  const sample = [...badges]
    .sort((a, b) => {
      const liveDelta = (statusFor(a) === "live" ? 0 : 1) - (statusFor(b) === "live" ? 0 : 1);
      if (liveDelta !== 0) return liveDelta;
      return TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
    })
    .slice(0, 4);

  return (
    <Link
      href={`/badges?category=${category}`}
      className="group flex flex-col gap-3 rounded-xl glass-panel p-4 transition-colors hover:border-brand/40"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
          <Icon aria-hidden className="size-4" />
        </span>
        <ChevronRight aria-hidden className="size-4 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="min-w-0">
        <p className="font-medium text-ink">{meta.label}</p>
        <p className="text-xs text-ink-3">{meta.blurb}</p>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="flex items-center">
          {sample.map((b, i) => (
            <span key={b.id} className={cn(i > 0 && "-ml-2")} style={{ zIndex: sample.length - i }}>
              <BadgeMedallion
                spec={{ glyph: b.glyph, tint_hex: b.tint_hex, tier: b.tier }}
                size={30}
                earned={statusFor(b) === "live"}
                progress={0.45}
              />
            </span>
          ))}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-ink">{badges.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-ink-3">
            {live > 0 ? `${live} live` : "none live"}
          </p>
        </div>
      </div>
    </Link>
  );
}

function StatusPills({ buckets, show }: { buckets: Record<BadgeStatus, number>; show: boolean }) {
  if (!show) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUS_ORDER.map((key) => (
        <span key={key} className="inline-flex items-center gap-2 rounded-full glass-panel px-3 py-1 text-xs">
          <span aria-hidden className={cn("size-2 rounded-full", STATUS_DOT[key])} />
          <span className="text-ink-2">{STATUS_LABELS[key]}</span>
          <span className="font-semibold tabular-nums text-ink">{buckets[key]}</span>
        </span>
      ))}
    </div>
  );
}

// ── Scoped table view ──────────────────────────────────────────────────
async function TableView({
  supabase,
  defs,
  buckets,
  sp,
  q,
  statusFilter,
  tierFilter,
  categoryFilter,
  sort,
  dir,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  defs: BadgeDefinitionRow[];
  buckets: Record<BadgeStatus, number>;
  sp: Awaited<SearchParams>;
  q: string;
  statusFilter: string;
  tierFilter: string;
  categoryFilter: string;
  sort: string;
  dir: SortDir;
}) {
  const lookups = await loadLookups(supabase, defs);

  let rows: BadgeTableRow[] = defs.map((d) => ({
    id: d.id,
    name: d.name,
    tagline: d.tagline,
    glyph: d.glyph,
    tint_hex: d.tint_hex,
    tier: d.tier,
    category: d.category,
    is_secret: d.is_secret,
    status: statusFor(d),
    criteriaText: criteriaSummary(d.criteria, lookups),
  }));

  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || (r.tagline ?? "").toLowerCase().includes(q));
  if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
  if (tierFilter !== "all") rows = rows.filter((r) => r.tier === tierFilter);
  if (categoryFilter !== "all") rows = rows.filter((r) => r.category === categoryFilter);

  const tierRank = (t: BadgeTableRow["tier"]) => TIER_ORDER.indexOf(t);
  rows = [...rows].sort((a, b) => {
    const m = dir === "asc" ? 1 : -1;
    switch (sort) {
      case "status":
        return (STATUS_RANK[a.status] - STATUS_RANK[b.status]) * m;
      case "tier":
        return (tierRank(a.tier) - tierRank(b.tier)) * m;
      case "category":
        return a.category.localeCompare(b.category) * m;
      default:
        return a.name.localeCompare(b.name) * m;
    }
  });

  const groupLabel = categoryFilter !== "all" ? CATEGORY_META[categoryFilter as BadgeCategory]?.label : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link href="/badges" className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> All groups
      </Link>

      <SectionHeader
        eyebrow={groupLabel ? `Editorial · ${groupLabel}` : "Editorial · search"}
        title={groupLabel ?? "Badges"}
        actions={<NewBadgeButton />}
      />

      <StatusPills buckets={buckets} show={defs.length > 0} />

      <TableToolbar
        initialQuery={sp.q ?? ""}
        searchPlaceholder="Search badges…"
        countLabel={`${rows.length} of ${defs.length} ${defs.length === 1 ? "badge" : "badges"}`}
        hasFilters={Boolean(q) || statusFilter !== "all" || tierFilter !== "all" || categoryFilter !== "all"}
      >
        <TableSelect
          name="category"
          label="Group"
          value={categoryFilter}
          options={[{ value: "all", label: "All groups" }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].label }))]}
        />
        <TableSelect
          name="status"
          label="Status"
          value={statusFilter}
          options={[{ value: "all", label: "All" }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
        />
        <TableSelect
          name="tier"
          label="Tier"
          value={tierFilter}
          options={[{ value: "all", label: "All tiers" }, ...TIERS.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))]}
        />
      </TableToolbar>

      <BadgesTable rows={rows} sort={sort} dir={dir} />
    </div>
  );
}

type Lookups = { counties: Record<string, string>; courses: Record<string, string>; lists: Record<string, string> };

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
