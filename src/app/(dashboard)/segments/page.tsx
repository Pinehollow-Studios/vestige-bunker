import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { pageShell } from "@/components/admin/PageShell";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { NewSegmentButton } from "./NewSegmentButton";
import { describeNode, type SegmentGroup } from "./fields";
import type { SegmentOverviewRow } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Segments — named, saved audiences. Define who once (rules on behaviour,
 * profile, demographics), reuse everywhere. This is the list; click one to edit.
 */
export default async function SegmentsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_segments_overview");
  const rows = (data as SegmentOverviewRow[] | null) ?? [];
  const loadError =
    error && /does not exist|could not find|schema cache|relation/i.test(error.message)
      ? "The segments tables aren’t on this database yet."
      : error?.message ?? null;

  return (
    <div className={pageShell("wide")}>
      <SectionHeader eyebrow="Operations" title="Segments" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-2">
          Save an audience once — a set of rules on who someone is and what they’ve done — then reuse it when you
          send emails or notifications. The count is always live.
        </p>
        <NewSegmentButton />
      </div>

      {loadError ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">{loadError}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand/30 bg-brand/[0.03] p-10 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Users className="size-5" />
          </span>
          <p className="mt-3 font-display text-base font-semibold text-ink">Build your first segment</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">
            For example: public members in Surrey who’ve played 5+ courses, or people who joined but haven’t logged a round.
          </p>
          <div className="mt-4 flex justify-center">
            <NewSegmentButton label="New segment" />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <Link
              key={s.id}
              href={`/segments/${s.id}`}
              className="group flex items-center gap-3 rounded-xl border border-border bg-paper-raised/50 p-3.5 transition-colors hover:border-brand/40 hover:bg-brand/[0.02]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Users className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                <p className="truncate text-xs text-ink-3">{s.description || describeNode((s.definition as SegmentGroup) ?? { op: "and", rules: [] })}</p>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-ink-2">
                {s.member_count === null ? "—" : s.member_count.toLocaleString()}
                <span className="ml-1 text-xs text-ink-3">members</span>
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
