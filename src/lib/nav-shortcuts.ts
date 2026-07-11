import { NAV_GROUPS } from "@/components/admin/nav";

/**
 * Keyboard-first navigation vocabulary — shared by the global shortcut handler,
 * the shortcuts overlay, and the command palette. `g` then one of these keys
 * jumps straight there (Linear-style go-to); everything else lives in ⌘K.
 */
export type GoTo = { key: string; href: string; label: string };

export const GO_TO: GoTo[] = [
  { key: "o", href: "/", label: "Overview" },
  { key: "f", href: "/feedback", label: "Feedback" },
  { key: "e", href: "/emails", label: "Emails" },
  { key: "n", href: "/notifications", label: "Notifications" },
  { key: "c", href: "/courses", label: "Courses" },
  { key: "l", href: "/curated", label: "Curated lists" },
  { key: "b", href: "/badges", label: "Badges" },
  { key: "a", href: "/analytics", label: "Analytics" },
  { key: "p", href: "/photos", label: "Photos" },
  { key: "s", href: "/safeguarding", label: "Safeguarding" },
  { key: "u", href: "/users", label: "Users" },
];

/** href → nav label, derived from the sidebar groups so it never goes stale. */
const LABEL_BY_HREF: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items).map((i) => [i.href, i.label]),
);

/** The section label for a pathname's first segment. */
export function sectionLabel(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg) return "Overview";
  return LABEL_BY_HREF[`/${seg}`] ?? titleCase(seg);
}

/** A friendly label for a detail sub-segment (New / Import / Editing / …). */
export function detailLabel(segment: string): string {
  const map: Record<string, string> = {
    new: "New",
    import: "Import",
    campaigns: "Campaigns",
    b2b: "B2B",
    events: "Events",
  };
  if (map[segment]) return map[segment];
  if (isUuidish(segment)) return "Detail";
  return titleCase(segment);
}

function titleCase(s: string): string {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isUuidish(s: string): boolean {
  return /^[0-9a-f]{8}-/i.test(s) || s.length >= 20;
}

// ── Recent pages (localStorage) ─────────────────────────────────────────

const RECENT_KEY = "vestige.recent";
const RECENT_MAX = 6;

export type RecentPage = { href: string; label: string };

export function pushRecent(href: string): void {
  if (typeof window === "undefined") return;
  // Only track top-level sidebar destinations (skip detail/editor churn).
  const label = LABEL_BY_HREF[href];
  if (!label) return;
  try {
    const prev = readRecent().filter((r) => r.href !== href);
    const next = [{ href, label }, ...prev].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function readRecent(): RecentPage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentPage[]) : [];
  } catch {
    return [];
  }
}
