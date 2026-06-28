// Types + vocabulary for the version changelog surface. Mirrors the shape of
// the `app_versions` / `app_version_changes` tables (Vestige-ios migration
// 20260609100000_app_version_changelog.sql). Internal admin surface only.

// ── Change-line kinds (the "Keep a Changelog" categories) ───────────────

export type ChangeKind = "added" | "changed" | "improved" | "fixed" | "removed";

/** Display + grouping order. Versions render their lines grouped in this order. */
export const CHANGE_KINDS: readonly ChangeKind[] = [
  "added",
  "changed",
  "improved",
  "fixed",
  "removed",
];

export const CHANGE_KIND_LABELS: Record<ChangeKind, string> = {
  added: "Added",
  changed: "Changed",
  improved: "Improved",
  fixed: "Fixed",
  removed: "Removed",
};

export type ChipTone = "brand" | "amber" | "alert" | "neutral";

/** Calm single-tone keying, matching the feedback queue's chip palette. */
export const CHANGE_KIND_TONE: Record<ChangeKind, ChipTone> = {
  added: "brand",
  changed: "neutral",
  improved: "brand",
  fixed: "amber",
  removed: "alert",
};

// ── Version lifecycle ───────────────────────────────────────────────────

export type AppVersionStatus = "draft" | "released";

export const VERSION_STATUS_LABELS: Record<AppVersionStatus, string> = {
  draft: "In development",
  released: "Released",
};

/**
 * Badge classes for a version's lifecycle pill. A draft ("In development")
 * wears a filled amber/orange treatment so an unreleased version reads as
 * actively being worked on; a released version stays calm brand. Shared by the
 * list, detail view, and any other surface that renders the status pill.
 */
export function versionStatusBadgeClasses(status: AppVersionStatus): string {
  return status === "released"
    ? "border-brand/35 text-brand"
    : "border-amber/40 bg-amber/15 text-amber";
}

// ── Rows ────────────────────────────────────────────────────────────────

export type AppVersion = {
  id: string;
  version: string;
  major: number;
  minor: number;
  patch: number;
  title: string | null;
  summary: string | null;
  status: AppVersionStatus;
  released_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AppVersionChange = {
  id: string;
  version_id: string;
  kind: ChangeKind;
  summary: string;
  feedback_report_id: string | null;
  sort_index: number;
  created_at: string;
  updated_at: string;
};

/** Minimal feedback-report summary, hydrated to label a linked change line. */
export type LinkedFeedback = {
  id: string;
  kind: string;
  status: string;
  body: string;
};

/** Index-row counts overlaid on a version for the list page. */
export type AppVersionWithCounts = AppVersion & {
  change_count: number;
  linked_count: number;
};

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Parse a semver-ish display string into its numeric parts. Accepts two- or
 * three-segment versions ("0.1" → patch 0). Returns null for anything that
 * isn't `N.N` or `N.N.N`, so the create/update actions can reject it.
 */
export function parseVersion(
  input: string,
): { version: string; major: number; minor: number; patch: number } | null {
  const trimmed = input.trim().replace(/^v/i, "");
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = match[3] !== undefined ? Number(match[3]) : 0;
  return { version: trimmed, major, minor, patch };
}

/** Sort comparator: newest version first (descending semver). */
export function compareVersionsDesc(a: AppVersion, b: AppVersion): number {
  return b.major - a.major || b.minor - a.minor || b.patch - a.patch;
}

// ── Grouped change lines (umbrella heading + sub-items) ──────────────────
//
// A change line can be a flat one-liner OR an umbrella heading with a bullet
// list beneath it (e.g. "Activity feed bug fixes" → "Fixed comments on rounds",
// "Fixed likes not working"). To avoid a schema change in this repo (migrations
// live in Vestige-ios), the sub-items are encoded inside the existing `summary`
// column as newline-separated lines: line 1 is the heading, every following
// line is a bullet. A summary with no newline is exactly a flat line - fully
// backward compatible with every existing row.

export type ParsedChangeSummary = { heading: string; items: string[] };

/** Strip a single leading bullet marker ("- ", "* ", "• ") from a line. */
function stripBullet(line: string): string {
  return line.replace(/^\s*[-*•]\s+/, "").trim();
}

/**
 * Split a stored summary into its heading + optional bullet items. Forgiving on
 * read (any line after the first becomes an item, dash or not); canonical on
 * write (see {@link serializeChangeSummary}).
 */
export function parseChangeSummary(summary: string): ParsedChangeSummary {
  const lines = summary.split("\n");
  const heading = stripBullet(lines[0] ?? "");
  const items = lines
    .slice(1)
    .map((l) => stripBullet(l))
    .filter((l) => l.length > 0);
  return { heading, items };
}

/** True when a summary carries a sub-list (heading + ≥1 item). */
export function hasChangeItems(summary: string): boolean {
  return parseChangeSummary(summary).items.length > 0;
}

/**
 * Re-encode a heading + items back into the storage convention. Items are
 * trimmed + emptied-dropped; a list with no items collapses to just the
 * heading, so toggling a line back to flat stores a clean one-liner.
 */
export function serializeChangeSummary(heading: string, items: string[]): string {
  const cleanHeading = heading.trim();
  const cleanItems = items.map((i) => i.trim()).filter((i) => i.length > 0);
  if (cleanItems.length === 0) return cleanHeading;
  return [cleanHeading, ...cleanItems.map((i) => `- ${i}`)].join("\n");
}

/** The current shipped version = highest released. Null when none released. */
export function currentVersion(versions: AppVersion[]): AppVersion | null {
  const released = versions
    .filter((v) => v.status === "released")
    .sort(compareVersionsDesc);
  return released[0] ?? null;
}
