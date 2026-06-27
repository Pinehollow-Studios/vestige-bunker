import Link from "next/link";
import { ChevronRight, Clock, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { SocietyCrest } from "./SocietyCrest";
import {
  TEMPLATE_KIND_LABELS,
  TEMPLATE_STATUS_CHIP,
  TEMPLATE_STATUS_DOT,
  TEMPLATE_STATUS_LABELS,
  TEMPLATE_TARGET_LABELS,
  type SocietyTemplateRow,
} from "./types";

/**
 * One society template as a glass-panel card. Leads with the crest tile,
 * then name + status dot, the gallery blurb, and a footer of mechanic ·
 * target. Links to the template editor + county workbench.
 */
export function TemplateCard({ row }: { row: SocietyTemplateRow }) {
  return (
    <Link
      href={`/societies/${row.id}`}
      className="group flex flex-col gap-3 rounded-xl glass-panel p-4 transition-colors hover:border-brand/40"
    >
      <div className="flex items-start justify-between gap-2">
        <SocietyCrest glyph={row.crest?.glyph} color={row.crest?.color} size={44} />
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            TEMPLATE_STATUS_CHIP[row.status],
          )}
        >
          {TEMPLATE_STATUS_LABELS[row.status]}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-medium text-ink">
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TEMPLATE_STATUS_DOT[row.status])} />
          <span className="truncate">{row.name}</span>
          {row.featured && <Star aria-hidden className="size-3 shrink-0 fill-amber text-amber" />}
        </p>
        {row.blurb && <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">{row.blurb}</p>}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-ink-3">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-ink-2">{TEMPLATE_KIND_LABELS[row.kind]}</span>
          {row.kind === "completion" && row.target_type && (
            <span>· {TEMPLATE_TARGET_LABELS[row.target_type]}</span>
          )}
          {row.default_duration_days != null && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock aria-hidden className="size-3" />
              {row.default_duration_days}d
            </span>
          )}
        </span>
        <ChevronRight aria-hidden className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}
