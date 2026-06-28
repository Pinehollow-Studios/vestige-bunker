import {
  Activity,
  BookOpen,
  Bug,
  Code2,
  Database,
  Gauge,
  Globe,
  HardDrive,
  KeyRound,
  LineChart,
  type LucideIcon,
  Mail,
  Map as MapIcon,
  Rocket,
  ScrollText,
  Smartphone,
  Terminal,
  Zap,
} from "lucide-react";

export type ToolLink = {
  href: string;
  label: string;
  /** Long-form copy for the overview card. Omit for sidebar-only items. */
  description?: string;
  icon: LucideIcon;
};

export type ToolGroup = {
  key: string;
  label: string;
  /** Long-form copy for the overview group header. */
  description: string;
  /** Lucide accent icon used on the overview group header. */
  icon: LucideIcon;
  links: ToolLink[];
};

/**
 * Centralised registry of external operator destinations.
 *
 * The dashboard surfaces these in two places:
 *
 * - Sidebar - compact, label-only, grouped at the bottom of the
 *   nav. Always in reach.
 * - Overview "Operator console" - expanded grid with descriptions.
 *   The full library; this is where new admins learn what tools
 *   even exist.
 *
 * Keep this list in sync with the dashboards / consoles the team
 * actually opens. If you add a new tool to the team's day-to-day,
 * add it here, not in a one-off component.
 *
 * Supabase URLs use `_` as the project ref so they resolve to the
 * "pick a project" picker for new admins; once you've opened a
 * project once the dashboard remembers it. Cheap workaround for not
 * baking the ref into a public-bundled env var.
 */
export const TOOL_GROUPS: ToolGroup[] = [
  {
    key: "data",
    label: "Data",
    description: "Supabase surfaces. Schema lives in Vestige-ios; queries live here.",
    icon: Database,
    links: [
      {
        href: "https://supabase.com/dashboard/project/_/sql/new",
        label: "SQL editor",
        description: "Author + save ad-hoc queries. Saved queries live in the project's shared library.",
        icon: Terminal,
      },
      {
        href: "https://supabase.com/dashboard/project/_/editor",
        label: "Table editor",
        description: "Browse rows, inspect indexes, check RLS policies per table.",
        icon: Database,
      },
      {
        href: "https://supabase.com/dashboard/project/_/auth/users",
        label: "Auth users",
        description: "auth.users table - the canonical identity source. Reset passwords, view providers.",
        icon: KeyRound,
      },
      {
        href: "https://supabase.com/dashboard/project/_/storage/buckets",
        label: "Storage buckets",
        description: "course-covers, list-covers, avatars, feedback-screenshots. Inspect + replace bytes.",
        icon: HardDrive,
      },
      {
        href: "https://supabase.com/dashboard/project/_/functions",
        label: "Edge functions",
        description: "process_photo, sentry-webhook, notify_user fan-out - runtime + logs.",
        icon: Zap,
      },
      {
        href: "https://supabase.com/dashboard/project/_/logs/explorer",
        label: "Logs explorer",
        description: "Postgres + API + edge function logs. Filter by service + level.",
        icon: Activity,
      },
    ],
  },
  {
    key: "observability",
    label: "Observability",
    description: "Crash + performance + deploy telemetry.",
    icon: Bug,
    links: [
      {
        href: "https://sentry.io/organizations/pinehollow-studios/issues/",
        label: "Sentry issues",
        description: "Stack traces, breadcrumbs, release health. Webhook ingests the local index at /crashes.",
        icon: Bug,
      },
      {
        href: "https://sentry.io/organizations/pinehollow-studios/releases/",
        label: "Sentry releases",
        description: "Per-build crash-free %, regression tracking. Tie issues to commits.",
        icon: Rocket,
      },
      {
        href: "https://sentry.io/organizations/pinehollow-studios/performance/",
        label: "Sentry performance",
        description: "Transactions, slow queries, app-launch traces.",
        icon: Gauge,
      },
      {
        href: "https://vercel.com/pinehollow-studios/vestige-bunker/deployments",
        label: "Vercel deployments",
        description: "This dashboard's deploy history. Inspect a build, roll back if needed.",
        icon: LineChart,
      },
      {
        href: "https://vercel.com/pinehollow-studios/vestige-bunker/logs",
        label: "Vercel logs",
        description: "Edge runtime logs - server actions, route handlers, middleware.",
        icon: ScrollText,
      },
    ],
  },
  {
    key: "code",
    label: "Code & docs",
    description: "Source-of-truth repos and the canonical runbook.",
    icon: Code2,
    links: [
      {
        href: "https://github.com/Pinehollow-Studios/Vestige-ios",
        label: "iOS repo",
        description: "Schema lives here - every admin RPC / column starts as a migration in this tree.",
        icon: Code2,
      },
      {
        href: "https://github.com/Pinehollow-Studios/Vestige-bunker",
        label: "Bunker repo",
        description: "This dashboard. Branch off main, open a PR; Vercel ships a preview per branch.",
        icon: Code2,
      },
      {
        href: "https://github.com/Pinehollow-Studios/Vestige-marketing",
        label: "Marketing repo",
        description: "vestige.golf - landing page + waitlist server actions + design experiments.",
        icon: Code2,
      },
      {
        href: "https://github.com/Pinehollow-Studios/Vestige-ios/blob/main/docs/admin-runbook.md",
        label: "Admin runbook",
        description: "Bootstrap, curated-list CRUD, polygon ingest, common queries. The on-call manual.",
        icon: BookOpen,
      },
      {
        href: "https://github.com/Pinehollow-Studios/Vestige-ios/blob/main/CHANGELOG.md",
        label: "iOS changelog",
        description: "Decision history with rationale. The 'why did we do X' answer lives here.",
        icon: ScrollText,
      },
    ],
  },
  {
    key: "external",
    label: "External",
    description: "Public-facing destinations and third-party consoles.",
    icon: Globe,
    links: [
      {
        href: "https://vestige.golf",
        label: "Marketing site",
        description: "Live landing page. Waitlist signups go through this; counts surface in Resend.",
        icon: Globe,
      },
      {
        href: "https://account.mapbox.com/",
        label: "Mapbox account",
        description: "Style + token management. iOS Atlas map fetches tiles from these styles.",
        icon: MapIcon,
      },
      {
        href: "https://appstoreconnect.apple.com/",
        label: "App Store Connect",
        description: "Builds, TestFlight cohorts, App Store listing copy, review responses.",
        icon: Smartphone,
      },
      {
        href: "https://resend.com/emails",
        label: "Resend",
        description: "Outbound transactional + marketing email. Waitlist confirmations dispatch here.",
        icon: Mail,
      },
    ],
  },
];

/**
 * Convenience flat view - used wherever you want to render every
 * link without thinking about groups (e.g. command-palette later).
 */
export const ALL_TOOLS: ToolLink[] = TOOL_GROUPS.flatMap((group) => group.links);
