"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTableUrl } from "./DataTable";

/**
 * URL-offset pagination for a DataTable. Renders nothing when there's a single
 * page (offset 0 and the page isn't full).
 */
export function TablePagination({
  offset,
  pageSize,
  count,
  hasMore,
}: {
  offset: number;
  pageSize: number;
  count: number;
  hasMore: boolean;
}) {
  const url = useTableUrl();
  if (offset === 0 && !hasMore) return null;

  const prevOffset = Math.max(0, offset - pageSize);
  const nextOffset = offset + pageSize;

  return (
    <nav className="flex items-center justify-between gap-3 text-xs text-ink-3">
      <PageLink href={offset > 0 ? url({ offset: prevOffset > 0 ? String(prevOffset) : null }) : null}>
        <ChevronLeft aria-hidden className="size-3.5" /> Previous
      </PageLink>
      <span className="tabular-nums">
        {count === 0 ? "0" : `${offset + 1}-${offset + count}`}
      </span>
      <PageLink href={hasMore ? url({ offset: String(nextOffset) }) : null} trailing>
        Next <ChevronRight aria-hidden className="size-3.5" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  trailing,
  children,
}: {
  href: string | null;
  trailing?: boolean;
  children: React.ReactNode;
}) {
  const cls = cn(
    "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-semibold transition-colors",
    href
      ? "border-rule/70 text-ink-2 hover:border-brand/40 hover:text-ink"
      : "cursor-not-allowed border-rule/40 text-ink-3/40",
    trailing && "flex-row",
  );
  if (!href) {
    return <span className={cls}>{children}</span>;
  }
  return (
    <Link href={href} scroll={false} className={cls}>
      {children}
    </Link>
  );
}
