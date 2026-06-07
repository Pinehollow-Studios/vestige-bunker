"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Award,
  BarChart3,
  ExternalLink,
  Images,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  MapPin,
  Megaphone,
  MessageSquareWarning,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOL_GROUPS } from "@/lib/admin/tools";
import type { AdminRole } from "@/lib/auth/requireAdmin";

type NavItem = {
  href: string;
  label: string;
  group: "queues" | "editorial" | "people" | "insights";
  ready: boolean;
  icon: LucideIcon;
  /** Optional dynamic count rendered in the right-side pill. */
  countKey?: string;
  /** When true, only render for super_admin (e.g. the prod sync). */
  superAdminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Overview", group: "queues", ready: true, icon: LayoutDashboard },
  {
    href: "/lists",
    label: "List verification",
    group: "queues",
    ready: true,
    icon: ListChecks,
    countKey: "verification",
  },
  {
    href: "/photos",
    label: "Photo moderation",
    group: "queues",
    ready: true,
    icon: Images,
    countKey: "photos",
  },
  {
    href: "/feedback",
    label: "Feedback triage",
    group: "queues",
    ready: true,
    icon: MessageSquareWarning,
    countKey: "feedback",
  },
  {
    href: "/crashes",
    label: "Crashes",
    group: "queues",
    ready: true,
    icon: AlertTriangle,
    countKey: "crashes",
  },
  {
    href: "/safeguarding",
    label: "Safeguarding",
    group: "people",
    ready: true,
    icon: Shield,
    countKey: "safeguarding",
  },
  {
    href: "/users",
    label: "Users",
    group: "people",
    ready: true,
    icon: Users,
    countKey: "users",
  },
  { href: "/curated", label: "Curated lists", group: "editorial", ready: true, icon: Sparkles, countKey: "curated" },
  { href: "/badges", label: "Badges", group: "editorial", ready: true, icon: Award },
  {
    href: "/announcements",
    label: "Announcements",
    group: "editorial",
    ready: true,
    icon: Megaphone,
    countKey: "announcements",
  },
  { href: "/courses", label: "Courses", group: "editorial", ready: true, icon: MapPin, countKey: "courses" },
  { href: "/analytics", label: "Analytics", group: "insights", ready: true, icon: BarChart3 },
];

const GROUPS: Array<{ key: NavItem["group"]; label: string }> = [
  { key: "queues", label: "Queues" },
  { key: "people", label: "People & safety" },
  { key: "editorial", label: "Editorial" },
  { key: "insights", label: "Insights" },
];

export function Sidebar({
  counts,
  adminRole,
}: {
  counts?: Record<string, number | undefined>;
  adminRole?: AdminRole;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden flex-col border-r border-border/70 bg-sidebar text-sidebar-foreground lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64">
      <BrandHeader />
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {GROUPS.map((group) => (
          <div key={group.key}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3/90">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {NAV.filter((n) => n.group === group.key)
                .filter((n) => !n.superAdminOnly || adminRole === "super_admin")
                .map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const count = item.countKey ? counts?.[item.countKey] : undefined;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group/nav relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-brand"
                        />
                      )}
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-brand" : "text-ink-3 group-hover/nav:text-ink-2",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <NavTrailing ready={item.ready} count={count} active={active} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Bottom Tools shelf — categorised. Mirrors the rich
            "Operator console" on the overview page; this is the
            in-reach version. */}
        <div className="space-y-5 border-t border-border/70 pt-5">
          {TOOL_GROUPS.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.key}>
                <p className="flex items-center gap-1.5 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3/90">
                  <GroupIcon className="size-3" aria-hidden />
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.links.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <li key={tool.href}>
                        <a
                          href={tool.href}
                          target="_blank"
                          rel="noreferrer"
                          className="group/nav flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                        >
                          <Icon className="size-3.5 shrink-0 text-ink-3 group-hover/nav:text-ink-2" />
                          <span className="min-w-0 flex-1 truncate">{tool.label}</span>
                          <ExternalLink
                            aria-hidden
                            className="size-3 shrink-0 text-ink-3/60 transition-colors group-hover/nav:text-ink-2"
                          />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>
      <SidebarFooter />
    </aside>
  );
}

function BrandHeader() {
  return (
    <Link
      href="/"
      className="flex h-16 shrink-0 items-center gap-3 border-b border-border/70 px-5"
    >
      <BrandMark className="size-9" />
      <div className="min-w-0 leading-tight">
        <p className="font-heading text-base font-semibold tracking-tight text-ink">
          Vestige
        </p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3">
          Atlas · Admin
        </p>
      </div>
    </Link>
  );
}

/**
 * The Vestige flag mark — pin/flag silhouette in brand mint
 * with a deep ocean fill. Mirrors the iOS splash + the marketing
 * `FwMark` lockup. Square so it works at favicon size.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-white/10",
        className,
      )}
      style={{
        background:
          "linear-gradient(135deg, #0E1822 0%, #1A2F3F 60%, color-mix(in oklab, var(--brand) 60%, #1A2F3F) 100%)",
      }}
    >
      <svg
        viewBox="0 0 28 28"
        className="size-3/5"
        fill="none"
        stroke="var(--brand)"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="9" y1="4" x2="9" y2="24" />
        <path d="M9 5 L21 8 L17 11 L21 14 L9 14 Z" fill="var(--brand)" stroke="none" />
      </svg>
    </span>
  );
}

function NavTrailing({
  ready,
  count,
  active,
}: {
  ready: boolean;
  count: number | undefined;
  active: boolean;
}) {
  if (!ready) {
    return (
      <span className="rounded-full border border-border bg-paper-raised/60 px-1.5 py-px text-[9px] font-medium uppercase tracking-wider text-ink-3">
        Soon
      </span>
    );
  }
  if (count === undefined) return null;
  if (count === 0) {
    return (
      <span className="text-[10px] tabular-nums text-ink-3">0</span>
    );
  }
  return (
    <span
      className={cn(
        "min-w-[20px] rounded-full px-1.5 py-px text-center text-[10px] font-semibold tabular-nums",
        active
          ? "bg-brand text-brand-fg"
          : "bg-brand/15 text-brand",
      )}
    >
      {count}
    </span>
  );
}

function SidebarFooter() {
  const sha = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);
  return (
    <div className="shrink-0 border-t border-border/70 px-5 py-4">
      <p className="flex items-center gap-2 text-[11px] leading-snug text-ink-3">
        <span aria-hidden className="size-1.5 rounded-full bg-brand" />
        Vestige Admin
        {sha && <span className="font-mono text-ink-3/70">· {sha}</span>}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-ink-3/70">
        Editorial &amp; ops surface for the Vestige iOS app.
      </p>
    </div>
  );
}
