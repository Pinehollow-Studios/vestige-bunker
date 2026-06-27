import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { SocietyCrest } from "./SocietyCrest";
import type { SocietyRow } from "./types";

/**
 * One society as a glass-panel card (replaces the old DataTable row). Crest +
 * editorial/member chip lead; the footer carries the member count. Links to the
 * editor at `/societies/[id]`.
 */
export function SocietyCard({ row }: { row: SocietyRow }) {
  return (
    <Link
      href={`/societies/${row.society_id}`}
      className="group flex flex-col gap-3 rounded-xl glass-panel p-4 transition-colors hover:border-brand/40"
    >
      <div className="flex items-start justify-between gap-2">
        <SocietyCrest glyph={row.crest?.glyph} color={row.crest?.color} size={36} />
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            row.is_editorial ? "border-brand/40 bg-brand/10 text-brand" : "border-ink-3/30 bg-ink-3/10 text-ink-3",
          )}
        >
          {row.is_editorial ? "Editorial" : "Member"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{row.name}</p>
        <p className="truncate text-xs text-ink-3">
          {row.is_editorial ? "Editorial" : "Member-created"}
          {row.county_name ? ` · ${row.county_name}` : ""}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-ink-3">
        <span className="inline-flex items-center gap-1 tabular-nums text-ink-2">
          <Users aria-hidden className="size-3 text-ink-3" />
          {row.member_count} {row.member_count === 1 ? "member" : "members"}
        </span>
        <ChevronRight aria-hidden className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}
