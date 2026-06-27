import { Megaphone } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { TableToolbar, TableSelect } from "@/components/admin/table/TableToolbar";
import type { SortDir } from "@/components/admin/table/DataTable";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { cn } from "@/lib/utils";
import { NewAnnouncementButton } from "./NewAnnouncementButton";
import { AnnouncementCard } from "./AnnouncementCard";
import {
  ANNOUNCEMENT_KINDS,
  AUDIENCE_KINDS,
  AUDIENCE_LABELS,
  KIND_LABELS,
  statusFor,
  STATUS_DOT,
  STATUS_LABELS,
  type AnnouncementOverviewRow,
  type AnnouncementStatus,
} from "./types";

export const dynamic = "force-dynamic";

const STATUS_ORDER: AnnouncementStatus[] = ["live", "scheduled", "draft", "expired", "archived"];
const STATUS_RANK: Record<AnnouncementStatus, number> = {
  live: 0,
  scheduled: 1,
  draft: 2,
  expired: 3,
  archived: 4,
};

type SearchParams = Promise<{
  q?: string;
  status?: string;
  kind?: string;
  audience?: string;
  sort?: string;
  dir?: string;
}>;

export default async function AnnouncementsPage(props: { searchParams: SearchParams }) {
  await requireAdmin();
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const statusFilter = sp.status ?? "all";
  const kindFilter = sp.kind ?? "all";
  const audienceFilter = sp.audience ?? "all";
  const sort = sp.sort ?? "status";
  const dir: SortDir = sp.dir === "desc" ? "desc" : "asc";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_announcements_overview");
  const all = (data as AnnouncementOverviewRow[] | null) ?? [];
  const notConfigured = !!error && isMissingRelation(error.message);

  const now = new Date();
  const buckets: Record<AnnouncementStatus, number> = {
    draft: 0,
    scheduled: 0,
    live: 0,
    expired: 0,
    archived: 0,
  };
  for (const r of all) buckets[statusFor(r, now)] += 1;

  let rows = all;
  if (q) rows = rows.filter((r) => r.title.toLowerCase().includes(q) || (r.eyebrow ?? "").toLowerCase().includes(q));
  if (statusFilter !== "all") rows = rows.filter((r) => statusFor(r, now) === statusFilter);
  if (kindFilter !== "all") rows = rows.filter((r) => r.kind === kindFilter);
  if (audienceFilter !== "all") rows = rows.filter((r) => r.audience_kind === audienceFilter);
  rows = [...rows].sort((a, b) => {
    const m = dir === "asc" ? 1 : -1;
    switch (sort) {
      case "title":
        return a.title.localeCompare(b.title) * m;
      case "priority":
        return (a.priority - b.priority) * m;
      default:
        return (STATUS_RANK[statusFor(a, now)] - STATUS_RANK[statusFor(b, now)]) * m;
    }
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <SectionHeader eyebrow="Editorial" title="Announcements" actions={<NewAnnouncementButton />} />

      {notConfigured ? (
        <NotConfigured />
      ) : error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load announcements: {error.message}
        </div>
      ) : (
        <>
          {all.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_ORDER.filter((k) => buckets[k] > 0).map((key) => (
                <span key={key} className="inline-flex items-center gap-2 rounded-full glass-panel px-3 py-1 text-xs">
                  <span aria-hidden className={cn("size-2 rounded-full", STATUS_DOT[key])} />
                  <span className="text-ink-2">{STATUS_LABELS[key]}</span>
                  <span className="font-semibold tabular-nums text-ink">{buckets[key]}</span>
                </span>
              ))}
            </div>
          )}

          <TableToolbar
            initialQuery={sp.q ?? ""}
            searchPlaceholder="Search announcements…"
            countLabel={`${rows.length} of ${all.length}`}
            hasFilters={Boolean(q) || statusFilter !== "all" || kindFilter !== "all" || audienceFilter !== "all"}
          >
            <TableSelect
              name="status"
              label="Status"
              value={statusFilter}
              options={[{ value: "all", label: "All" }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
            />
            <TableSelect
              name="kind"
              label="Kind"
              value={kindFilter}
              options={[{ value: "all", label: "All" }, ...ANNOUNCEMENT_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))]}
            />
            <TableSelect
              name="audience"
              label="Audience"
              value={audienceFilter}
              options={[{ value: "all", label: "All" }, ...AUDIENCE_KINDS.map((a) => ({ value: a, label: AUDIENCE_LABELS[a] }))]}
            />
            <TableSelect
              name="sort"
              label="Sort"
              value={sort}
              options={[
                { value: "status", label: "Status" },
                { value: "title", label: "Title" },
                { value: "priority", label: "Priority" },
              ]}
            />
          </TableToolbar>

          {all.length === 0 ? (
            <EmptyState />
          ) : rows.length === 0 ? (
            <p className="rounded-xl glass-panel p-6 text-center text-sm text-ink-3">No announcements match.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <AnnouncementCard key={r.id} row={r} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl glass-panel p-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Megaphone className="size-5" />
        </span>
        <p className="font-display text-base font-semibold text-ink">No announcements yet</p>
        <p className="text-sm text-ink-2">Author your first — a what&apos;s-new card, a spotlight, a note to the beta.</p>
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="rounded-xl glass-panel p-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-full bg-paper-sunken text-ink-3">
          <Megaphone className="size-5" />
        </span>
        <p className="font-display text-base font-semibold text-ink">Announcements not wired here</p>
        <p className="mx-auto max-w-md text-sm text-ink-2">
          The announcements tables aren&apos;t in this Supabase project yet. Apply the{" "}
          <span className="font-mono text-xs">20260607100000_announcements.sql</span> migration to enable this surface.
        </p>
      </div>
    </div>
  );
}

function isMissingRelation(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache") || m.includes("not found");
}
