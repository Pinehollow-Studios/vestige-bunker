"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The dense, sortable list table that every list page inherits - the answer to
 * the fat-card walls. Built as a div-grid (not a <table>) so each row is a real
 * <Link> (clean navigation, right-click, keyboard) and columns flex cleanly.
 * Sort + filters + pagination all live in the URL, so a view is shareable and
 * the server stays authoritative.
 */

export type SortDir = "asc" | "desc";

export type Column<Row> = {
  key: string;
  header: string;
  /** When set, the header becomes a sort toggle writing ?sort=<sortKey>&dir. */
  sortKey?: string;
  /** Grid track for this column, e.g. "minmax(200px,2fr)" or "96px". */
  width: string;
  align?: "left" | "right" | "center";
  cell: (row: Row) => React.ReactNode;
  /** Hide the column below a breakpoint (the row still scrolls horizontally). */
  hideBelow?: "sm" | "md" | "lg" | "xl";
};

/** Build URLs that mutate the current query string (null deletes a key). */
export function useTableUrl() {
  const params = useSearchParams();
  const pathname = usePathname();
  return useCallback(
    (mut: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(mut)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const q = next.toString();
      return q ? `${pathname}?${q}` : pathname;
    },
    [params, pathname],
  );
}

const hideClass: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:flex",
  md: "hidden md:flex",
  lg: "hidden lg:flex",
  xl: "hidden xl:flex",
};

const alignClass: Record<NonNullable<Column<unknown>["align"]>, string> = {
  left: "justify-start text-left",
  right: "justify-end text-right",
  center: "justify-center text-center",
};

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  rowHref,
  sort,
  dir,
  empty,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  rowHref: (row: Row) => string;
  sort?: string;
  dir?: SortDir;
  empty?: React.ReactNode;
}) {
  const gridTemplate = columns.map((c) => c.width).join(" ");
  const minWidth = columns.length * 80;

  return (
    <div className="overflow-hidden rounded-xl glass-panel">
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          {/* Header */}
          <div
            role="row"
            className="grid items-center gap-3 border-b border-rule/60 bg-paper-sunken/40 px-3 py-2"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {columns.map((col) => (
              <HeaderCell key={col.key} col={col} sort={sort} dir={dir} />
            ))}
          </div>

          {/* Rows */}
          {rows.length === 0 ? (
            <div className="px-3 py-12 text-center">{empty ?? <DefaultEmpty />}</div>
          ) : (
            <ol>
              {rows.map((row) => (
                <li key={rowKey(row)}>
                  <Link
                    href={rowHref(row)}
                    role="row"
                    className="grid items-center gap-3 border-b border-rule/40 px-3 py-2 text-sm transition-colors last:border-0 hover:bg-paper-raised/50"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {columns.map((col) => (
                      <div
                        key={col.key}
                        role="cell"
                        className={cn(
                          "flex min-w-0 items-center",
                          col.align && alignClass[col.align],
                          col.hideBelow && hideClass[col.hideBelow],
                        )}
                      >
                        {col.cell(row)}
                      </div>
                    ))}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function HeaderCell<Row>({
  col,
  sort,
  dir,
}: {
  col: Column<Row>;
  sort?: string;
  dir?: SortDir;
}) {
  const url = useTableUrl();
  const base = cn(
    "flex min-w-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3",
    col.align && alignClass[col.align],
    col.hideBelow && hideClass[col.hideBelow],
  );

  if (!col.sortKey) {
    return (
      <div role="columnheader" className={base}>
        {col.header}
      </div>
    );
  }

  const active = sort === col.sortKey;
  const nextDir: SortDir = active && dir === "asc" ? "desc" : "asc";
  return (
    <Link
      role="columnheader"
      href={url({ sort: col.sortKey, dir: nextDir, offset: null })}
      className={cn(base, "transition-colors hover:text-ink-2", active && "text-brand")}
      scroll={false}
    >
      {col.header}
      {active ? (
        dir === "asc" ? (
          <ArrowUp aria-hidden className="size-3" />
        ) : (
          <ArrowDown aria-hidden className="size-3" />
        )
      ) : (
        <ChevronsUpDown aria-hidden className="size-3 opacity-40" />
      )}
    </Link>
  );
}

function DefaultEmpty() {
  return <p className="text-sm text-ink-3">Nothing matches.</p>;
}

/** A muted ✓ / ✗ data-quality cell (e.g. "has a photo"). */
export function PresenceFlag({ present, label }: { present: boolean; label: string }) {
  return (
    <span
      title={label}
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold",
        present ? "bg-brand/15 text-brand" : "bg-paper-sunken text-ink-3/50",
      )}
      aria-label={present ? `Has ${label}` : `Missing ${label}`}
    >
      {present ? "✓" : "·"}
    </span>
  );
}
