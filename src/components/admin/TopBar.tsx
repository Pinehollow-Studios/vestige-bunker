import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/admin/ModeToggle";
import { signOut } from "@/app/(dashboard)/actions";
import type { AdminRole } from "@/lib/auth/requireAdmin";
import { cn } from "@/lib/utils";

type Props = {
  email: string | null;
  role?: AdminRole | null;
};

export function TopBar({ email, role }: Props) {
  const isProd = process.env.NODE_ENV === "production";
  const initials = (email ?? "?").trim().slice(0, 2).toUpperCase();
  const sha = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);
  const branch = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border/70 bg-paper-raised/75 px-6 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <EnvBadge isProd={isProd} />
        {(sha || branch) && (
          <span className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-paper-sunken/60 px-2.5 py-1 text-[10px] font-medium text-ink-3 md:inline-flex">
            {branch && (
              <span className="font-mono">
                {branch.length > 14 ? branch.slice(0, 14) + "…" : branch}
              </span>
            )}
            {sha && (
              <span className="font-mono text-ink-3/80">{sha}</span>
            )}
          </span>
        )}
        <span className="hidden truncate text-xs text-ink-3 lg:inline">
          Editorial &amp; operations dashboard
        </span>
      </div>
      <div className="flex items-center gap-2">
        <QuickTools />
        {role && <RoleBadge role={role} />}
        {email && (
          <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-paper-sunken/60 py-1 pr-3 pl-1 sm:flex">
            <span
              aria-hidden
              className="flex size-6 items-center justify-center rounded-full bg-brand text-[10px] font-semibold uppercase tracking-wider text-brand-fg"
            >
              {initials}
            </span>
            <span className="max-w-[180px] truncate text-xs font-medium text-ink-2">
              {email}
            </span>
          </div>
        )}
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

function EnvBadge({ isProd }: { isProd: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
        isProd
          ? "border-alert/40 bg-alert/15 text-alert"
          : "border-brand/30 bg-brand/10 text-brand",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full pulse-dot",
          isProd ? "bg-alert" : "bg-brand",
        )}
      />
      {isProd ? "Production" : "Dev"}
    </span>
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
 * list lives in the sidebar's Tools group; this is the
 * fast-path for the two we open daily.
 */
function QuickTools() {
  const links = [
    {
      href: "https://supabase.com/dashboard/project/_/editor",
      label: "Supabase",
    },
    {
      href: "https://sentry.io/organizations/fairways/issues/",
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
