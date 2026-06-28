"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTableUrl } from "./DataTable";

/**
 * The toolbar above a DataTable: a debounced search box, a slot for filter
 * controls, a result count, and a clear-all. All URL-driven, so a filtered view
 * is shareable + the server re-queries authoritatively.
 */
export function TableToolbar({
  searchParam = "q",
  searchPlaceholder = "Search…",
  initialQuery,
  countLabel,
  hasFilters,
  children,
}: {
  searchParam?: string;
  searchPlaceholder?: string;
  initialQuery: string;
  countLabel?: string;
  hasFilters?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const url = useTableUrl();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);

  // Debounced URL write - every write inside the timer, never sync in render.
  useEffect(() => {
    if (value === initialQuery) return;
    const t = setTimeout(() => {
      router.replace(url({ [searchParam]: value || null, offset: null }), { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // initialQuery is the server's current value; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="space-y-3 rounded-xl glass-panel p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-rule/70 bg-paper-sunken/40 px-3">
          <Search aria-hidden className="size-4 shrink-0 text-ink-3" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
          />
          {value && (
            <button
              type="button"
              onClick={() => setValue("")}
              className="text-ink-3 transition-colors hover:text-ink-2"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {children}
      </div>
      {(countLabel || hasFilters) && (
        <div className="flex items-center justify-between gap-3 text-xs text-ink-3">
          <span>{countLabel}</span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setValue("");
                router.replace(pathname, { scroll: false });
              }}
              className="inline-flex items-center gap-1 transition-colors hover:text-ink-2"
            >
              <X aria-hidden className="size-3" /> Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A labelled select that writes its value to a URL param (resets pagination). */
export function TableSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const url = useTableUrl();
  return (
    <label className="inline-flex items-center gap-1.5 text-xs">
      <span className="font-semibold uppercase tracking-wider text-ink-3">{label}</span>
      <select
        value={value}
        onChange={(e) =>
          router.replace(url({ [name]: e.target.value === "all" ? null : e.target.value, offset: null }), {
            scroll: false,
          })
        }
        className="h-9 rounded-lg border border-input bg-paper-sunken/40 px-2.5 text-sm text-ink transition-colors focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A row of single-select toggle chips bound to a URL param (e.g. data gaps). */
export function FilterChips({
  name,
  value,
  options,
}: {
  name: string;
  value: string | null;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const url = useTableUrl();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() =>
              router.replace(url({ [name]: active ? null : o.value, offset: null }), { scroll: false })
            }
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              active
                ? "border-brand/50 bg-brand/10 text-brand"
                : "border-rule/70 text-ink-2 hover:border-brand/40 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
