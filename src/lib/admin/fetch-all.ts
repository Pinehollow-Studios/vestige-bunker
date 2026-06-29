import "server-only";

const PAGE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Fetch EVERY row of a select, paging past PostgREST's 1000-row ceiling.
 *
 * A plain `.select()` silently caps at 1000 rows, so any aggregate built by
 * grouping the returned rows (per-county course totals, the grand course
 * count, the Vestige Index distribution) under-reports once the table grows
 * past 1000. This loops `.range()` in 1000-row pages until a short page, so
 * the totals read correctly regardless of table size.
 *
 * `page` must build a FRESH query each call (the range differs per page) and
 * apply a deterministic `.order()` so paging can't skip or duplicate rows.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { data: all, error };
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return { data: all, error: null };
}
