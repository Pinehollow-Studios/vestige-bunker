import Link from "next/link";
import { ChevronRight, Hash, Images } from "lucide-react";
import { listCoverURL } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { STATUS_CHIP, STATUS_DOT, STATUS_LABELS, statusFor, type CuratedListRow } from "./types";

/**
 * One curated list as a glass-panel card (replaces the old DataTable row).
 * Leads with the cover banner (or a tinted placeholder), then name + status
 * dot, description, and a footer of tier · course count. Links to the editor.
 */
export function CuratedCard({ row }: { row: CuratedListRow }) {
  const status = statusFor(row);
  const cover = listCoverURL(row.cover_storage_key);
  return (
    <Link
      href={`/curated/${row.id}`}
      className="group flex flex-col overflow-hidden rounded-xl glass-panel transition-colors hover:border-brand/40"
    >
      <div className="relative aspect-[16/9] w-full bg-paper-sunken">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-ink-3">
            <Images aria-hidden className="size-6" />
          </span>
        )}
        <span
          className={cn(
            "absolute right-2 top-2 inline-flex items-center rounded-full border bg-paper-raised/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur",
            STATUS_CHIP[status],
          )}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-medium text-ink">
            <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])} />
            <span className="truncate">{row.name}</span>
          </p>
          {row.description && <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">{row.description}</p>}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-ink-3">
          <span className="flex items-center gap-2">
            {row.tier && <span className="capitalize text-ink-2">{row.tier}</span>}
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Hash aria-hidden className="size-3" />
              {row.course_count}
            </span>
          </span>
          <ChevronRight aria-hidden className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
    </Link>
  );
}
