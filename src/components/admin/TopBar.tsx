import Link from "next/link";
import { ArrowUpRight, Check, Eye, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/admin/ModeToggle";
import { ProdViewToggle } from "@/components/admin/ProdViewToggle";
import { signOut } from "@/app/(dashboard)/actions";
import {
  type AdminRole,
  type AdminUser,
  adminDisplayLabel,
  adminInitials,
} from "@/lib/auth/requireAdmin";
import { syncSummary, type SyncSummary } from "@/lib/sync/status";
import { cn } from "@/lib/utils";

type Props = {
  admin: AdminUser;
  prodView: boolean;
};

export async function TopBar({ admin, prodView }: Props) {
  // In prod-view the sync chip is hidden, so skip its (dev+prod) reads.
  const sync = prodView ? null : await syncSummary();
  const sha = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);
  const branch = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;

  const label = adminDisplayLabel(admin);
  const initials = adminInitials(admin);
  const secondary =
    admin.username && admin.displayName
      ? `@${admin.username}`
      : admin.email ?? null;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border/70 bg-paper-raised/75 px-6 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        {prodView ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-alert/50 bg-alert/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-alert">
            <Eye aria-hidden className="size-3" />
            Prod view · read-only
          </span>
        ) : (
          sync && <SyncChip sync={sync} canSync={admin.role === "super_admin"} />
        )}
        <ProdViewToggle active={prodView} />
        {(sha || branch) && (
          <span className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-paper-sunken/60 px-2.5 py-1 text-[10px] font-medium text-ink-3 md:inline-flex">
            {branch && (
              <span className="font-mono">
                {branch.length > 14 ? branch.slice(0, 14) + "…" : branch}
              </span>
            )}
            {sha && <span className="font-mono text-ink-3/80">{sha}</span>}
          </span>
        )}
        <span className="hidden truncate text-xs text-ink-3 lg:inline">
          Editorial &amp; operations dashboard
        </span>
      </div>
      <div className="flex items-center gap-2">
        <QuickTools />
        <RoleBadge role={admin.role} />
        <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-paper-sunken/60 py-1 pr-3 pl-1 sm:flex">
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-full bg-brand text-[10px] font-semibold uppercase tracking-wider text-brand-fg"
          >
            {initials}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="max-w-[160px] truncate text-xs font-semibold text-ink">
              {label}
            </span>
            {secondary && (
              <span className="max-w-[160px] truncate text-[10px] text-ink-3">
                {secondary}
              </span>
            )}
          </span>
        </div>
        <ModeToggle />
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}

/**
 * Dev-only context badge + dev↔prod sync state. The dashboard always edits
 * dev; this shows whether prod is in sync and links to the push console.
 * Only super_admins can push, so non-admins just see the state.
 */
function SyncChip({ sync, canSync }: { sync: SyncSummary; canSync: boolean }) {
  let tone: "brand" | "amber" | "muted";
  let label: string;
  let Icon = RefreshCw;

  if (!sync.configured || !sync.prodLedgerReady) {
    tone = "muted";
    label = "sync not ready";
  } else if (sync.inSync) {
    tone = "brand";
    label = "in sync";
    Icon = Check;
  } else {
    tone = "amber";
    label = `${sync.schemaPushable} to push`;
    Icon = ArrowUpRight;
  }

  const body = (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
        tone === "brand"
          ? "border-brand/30 bg-brand/10 text-brand"
          : tone === "amber"
            ? "border-amber/40 bg-amber/10 text-amber"
            : "border-border bg-paper-sunken/60 text-ink-3",
      )}
    >
      <span className="text-ink-3">DEV</span>
      <span aria-hidden className="size-1 rounded-full bg-current opacity-60" />
      <Icon aria-hidden className="size-3" />
      {label}
    </span>
  );

  // Only super_admins reach /sync; others see the state without a link.
  return canSync ? (
    <Link href="/sync" title="Dev → prod sync">
      {body}
    </Link>
  ) : (
    body
  );
}

function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <span className="hidden rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand sm:inline-flex">
      {roleLabel(role)}
    </span>
  );
}

function roleLabel(role: AdminRole): string {
  switch (role) {
    case "super_admin":
      return "Super admin";
    case "moderator":
      return "Moderator";
    case "editor":
      return "Editor";
    default:
      return String(role);
  }
}

/**
 * Top-right cluster of external operator destinations. The full
 * library lives in the sidebar's Tools shelf and on the overview;
 * this is the fast-path for the two we open daily.
 */
function QuickTools() {
  const links = [
    {
      href: "https://supabase.com/dashboard/project/_/editor",
      label: "Supabase",
    },
    {
      href: "https://sentry.io/organizations/pinehollow-studios/issues/",
      label: "Sentry",
    },
  ];
  return (
    <div className="hidden items-center gap-1 rounded-full border border-border/60 bg-paper-sunken/40 px-1 py-0.5 md:flex">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:bg-paper-raised hover:text-ink"
        >
          {link.label}
          <ExternalLink aria-hidden className="size-3 text-ink-3" />
        </a>
      ))}
    </div>
  );
}
