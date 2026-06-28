/**
 * Security helpers for building PostgREST filters from user input.
 *
 * PostgREST's `.or()` / `.and()` take a comma-separated filter STRING that the
 * server parses - so a raw value containing `,` `.` `(` `)` `*` `%` `\` can
 * break out of the intended filter and inject extra conditions. Any value
 * interpolated into such a string must be sanitised first. (`.eq()` / `.ilike()`
 * with a *column*+*value* pair are already parameterised and don't need this -
 * but `.or("col.ilike.%x%")` does, because the whole clause is one string.)
 */

/** Strip the characters that are significant in a PostgREST filter string. */
export function sanitizeFilterValue(raw: string): string {
  return raw.replace(/[,()*%\\]/g, " ").trim();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a canonical UUID - use to validate route params before querying. */
export function isUuid(value: string | null | undefined): boolean {
  return typeof value === "string" && UUID_RE.test(value);
}
