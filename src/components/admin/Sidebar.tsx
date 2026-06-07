"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Award,
  BarChart3,
  ChevronDown,
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
import type { AdminRole } from "@/lib/auth/requireAdmin";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Optional dynamic count rendered in the right-side pill. */
  countKey?: string;
};

/** Jack's day-to-day — the surfaces he actually touches, in priority order. */
const EVERYDAY: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/feedback", label: "Feedback", icon: MessageSquareWarning, countKey: "feedback" },
  { href: "/announcements", label: "Announcements", icon: Megaphone, countKey: "announcements" },
  { href: "/curated", label: "Curated lists", icon: Sparkles, countKey: "curated" },
  { href: "/badges", label: "Badges", icon: Award },
  { href: "/courses", label: "Courses", icon: MapPin, countKey: "courses" },
  { href: "/photos", label: "Photos", icon: Images, countKey: "photos" },
  { href: "/users", label: "Users", icon: Users, countKey: "users" },
];

/** Developer / ops surfaces — tucked behind a collapsed group so Jack isn't
 *  faced with them. */
const ADVANCED: NavItem[] = [
  { href: "/lists", label: "List verification", icon: ListChecks, countKey: "verification" },
  { href: "/crashes", label: "Crashes", icon: AlertTriangle, countKey: "crashes" },
  { href: "/safeguarding", label: "Safeguarding", icon: Shield, countKey: "safeguarding" },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function Sidebar({
  counts,
}: {
  counts?: Record<string, number | undefined>;
  /** Accepted for call-site compatibility; nav no longer gates on role. */
  adminRole?: AdminRole;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const advancedActive = ADVANCED.some((n) => isActive(n.href));

  return (
    <aside className="hidden flex-col border-r border-border/70 bg-sidebar text-sidebar-foreground lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64">
      <BrandHeader />
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <ul className="space-y-0.5">
          {EVERYDAY.map((item) => (
            <NavRow
              key={item.href}
              item={item}
              active={isActive(item.href)}
              count={item.countKey ? counts?.[item.countKey] : undefined}
            />
          ))}
        </ul>

        <details open={advancedActive} className="group/adv">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-ink-2 [&::-webkit-details-marker]:hidden">
            Advanced
            <ChevronDown
              aria-hidden
              className="size-3 transition-transform group-open/adv:rotate-180"
            />
          </summary>
          <ul className="mt-1 space-y-0.5">
            {ADVANCED.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                active={isActive(item.href)}
                count={item.countKey ? counts?.[item.countKey] : undefined}
              />
            ))}
          </ul>
        </details>
      </nav>
      <SidebarFooter />
    </aside>
  );
}

function NavRow({
  item,
  active,
  count,
}: {
  item: NavItem;
  active: boolean;
  count: number | undefined;
}) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "group/nav relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          active
            ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
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
        "min-w-[20px] rounded-full px-1.5 py-px text-center text-[10px] font-semibold tabular-nums",
        active ? "bg-brand text-brand-fg" : "bg-brand/15 text-brand",
      )}
    >
      {count}
    </span>
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
        <p className="font-display text-base font-semibold tracking-tight text-ink">Vestige</p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3">Admin</p>
      </div>
    </Link>
  );
}

/**
 * The Vestige flag mark — pin/flag silhouette in brand mint with a deep ocean
 * fill. Mirrors the iOS splash + the marketing `FwMark` lockup.
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

function SidebarFooter() {
  const sha = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);
  return (
    <div className="shrink-0 border-t border-border/70 px-5 py-4">
      <p className="flex items-center gap-2 text-[11px] leading-snug text-ink-3">
        <span aria-hidden className="size-1.5 rounded-full bg-brand" />
        Vestige Admin
        {sha && <span className="font-mono text-ink-3/70">· {sha}</span>}
      </p>
    </div>
  );
}
