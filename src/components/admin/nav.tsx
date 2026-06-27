"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Award,
  BarChart3,
  Flag,
  Gauge,
  Images,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Map as MapIcon,
  Megaphone,
  MessageSquareWarning,
  RefreshCw,
  Rocket,
  Shield,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import { SidebarCollapseToggle } from "@/components/admin/SidebarCollapseToggle";
import { cn } from "@/lib/utils";

/**
 * Shared navigation surface for the desktop {@link Sidebar} and the
 * {@link MobileNav} drawer. Grouped by domain — the way the team actually works
 * (Editorial, Operations, …) rather than a flat list. Collapse-aware: every
 * label / count / group heading carries a class the `.sidebar-collapsed` CSS
 * hides, leaving an icon rail.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  countKey?: string;
};

type NavGroup = { label?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  { items: [{ href: "/", label: "Overview", icon: LayoutDashboard }] },
  {
    label: "Editorial",
    items: [
      { href: "/curated", label: "Curated lists", icon: Sparkles, countKey: "curated" },
      { href: "/courses", label: "Courses", icon: MapIcon, countKey: "courses" },
      { href: "/vestige-index", label: "Index", icon: Gauge },
      { href: "/badges", label: "Badges", icon: Award },
      { href: "/announcements", label: "Announcements", icon: Megaphone, countKey: "announcements" },
      { href: "/societies", label: "Societies", icon: Flag },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/feedback", label: "Feedback", icon: MessageSquareWarning, countKey: "feedback" },
      { href: "/photos", label: "Photos", icon: Images, countKey: "photos" },
      { href: "/safeguarding", label: "Safeguarding", icon: Shield, countKey: "safeguarding" },
      { href: "/crashes", label: "Crashes", icon: AlertTriangle, countKey: "crashes" },
      { href: "/lists", label: "List verification", icon: ListChecks, countKey: "verification" },
      { href: "/changelog", label: "Changelog", icon: Rocket, countKey: "changelog" },
    ],
  },
  { label: "People", items: [{ href: "/users", label: "Users", icon: Users, countKey: "users" }] },
  { label: "Insight", items: [{ href: "/analytics", label: "Analytics", icon: BarChart3 }] },
  {
    label: "System",
    items: [
      { href: "/app-version", label: "App version", icon: Smartphone },
      { href: "/sync", label: "Sync", icon: RefreshCw },
    ],
  },
];

export function NavContent({
  counts,
  onNavigate,
  collapsible = false,
}: {
  counts?: Record<string, number | undefined>;
  onNavigate?: () => void;
  /** Show the collapse toggle (desktop sidebar only — not the mobile drawer). */
  collapsible?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <BrandHeader onNavigate={onNavigate} collapsible={collapsible} />
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {group.label && (
              <p className="nav-group-label px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  active={isActive(item.href)}
                  count={item.countKey ? counts?.[item.countKey] : undefined}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

function NavRow({
  item,
  active,
  count,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  count: number | undefined;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        title={item.label}
        onClick={onNavigate}
        className={cn(
          "nav-row group/nav relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
          active
            ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
        )}
      >
        {active && (
          <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-brand" />
        )}
        <Icon
          className={cn("size-4 shrink-0", active ? "text-brand" : "text-ink-3 group-hover/nav:text-ink-2")}
        />
        <span className="nav-label min-w-0 flex-1 truncate">{item.label}</span>
        <NavCount count={count} active={active} />
      </Link>
    </li>
  );
}

function NavCount({ count, active }: { count: number | undefined; active: boolean }) {
  if (count === undefined || count === 0) return null;
  return (
    <span
      className={cn(
        "nav-count min-w-[20px] rounded-full px-1.5 py-px text-center text-[10px] font-semibold tabular-nums",
        active ? "bg-brand text-brand-fg" : "bg-brand/15 text-brand",
      )}
    >
      {count}
    </span>
  );
}

function BrandHeader({ onNavigate, collapsible }: { onNavigate?: () => void; collapsible?: boolean }) {
  return (
    <div className="nav-brand flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/70 px-4">
      <Link href="/" onClick={onNavigate} className="brand-wordmark min-w-0 leading-tight">
        <p className="font-display text-base font-semibold tracking-tight text-ink">Vestige</p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3">Admin</p>
      </Link>
      {collapsible && <SidebarCollapseToggle />}
    </div>
  );
}

/**
 * The Vestige flag mark — kept for the login + unauthorized screens (the
 * dashboard sidebar no longer uses it). Pin/flag silhouette in brand mint.
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
