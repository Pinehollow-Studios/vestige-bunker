import { Suspense } from "react";
import { cookies } from "next/headers";
import { FlaskConical } from "lucide-react";
import { Sidebar } from "@/components/admin/Sidebar";
import { TopBar } from "@/components/admin/TopBar";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { KeyboardShortcuts } from "@/components/admin/KeyboardShortcuts";
import { VaultGate } from "@/components/admin/VaultGate";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getDashboardCounts } from "@/lib/admin/counts";
import { activeEnvKey, DEV_SWITCH_ENABLED, ENV_COOKIE } from "@/lib/supabase/env";
import type { AdminEnvKey } from "@/lib/supabase/env";
import type { AdminRole, AdminUser } from "@/lib/auth/requireAdmin";

/**
 * The dashboard shell.
 *
 * The layout itself awaits only the admin gate (one fast query) so page
 * content streams the instant the page's own data resolves. The sidebar +
 * top-bar badge counts - non-critical chrome - stream in behind their own
 * Suspense boundaries via {@link getDashboardCounts}; they never block a page.
 * No animated aurora, no scroll-progress: the canvas is the static Atlas
 * atmosphere from globals.css. This is an instrument, not a landing page.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const env = activeEnvKey((await cookies()).get(ENV_COOKIE)?.value);

  return (
    <div className="relative min-h-dvh">
      {/* Vault gate - seals the dashboard on a fresh tab (forced re-login) and
          plays the unlock sequence after sign-in. Covers from first paint. */}
      <VaultGate />

      {/* Everything the gate reveals — pulled into focus behind it as it clears. */}
      <div className="vault-reveal">
        {/* ⌘K palette + the global keyboard layer (g-nav, ? help) — mounted
            once, available on every surface. */}
        <CommandPalette devSwitchEnabled={DEV_SWITCH_ENABLED} currentEnv={env} />
        <KeyboardShortcuts />

        {/* Sidebar shell paints immediately (no count pips); counts stream in. */}
        <Suspense fallback={<Sidebar adminRole={admin.role} />}>
          <SidebarWithCounts adminRole={admin.role} />
        </Suspense>

        <div className="relative z-10 flex min-h-dvh min-w-0 flex-col transition-[padding] duration-200 lg:pl-[var(--sidebar-w)]">
          <Suspense
            fallback={<TopBar admin={admin} env={env} devSwitchEnabled={DEV_SWITCH_ENABLED} />}
          >
            <TopBarWithCounts admin={admin} env={env} />
          </Suspense>

          {DEV_SWITCH_ENABLED && env === "dev" && (
            <div className="flex items-start gap-3 border-b border-amber/40 bg-amber/10 px-6 py-2.5 text-xs text-amber">
              <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
              <p className="leading-relaxed">
                <strong className="font-semibold">Developer dev view.</strong> You&apos;re on the DEV
                database, not the live app - changes here do not affect TestFlight users. Switch back
                to prod from the toggle when you&apos;re done.
              </p>
            </div>
          )}

          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

/** Streamed: resolves the badge counts, then renders the sidebar with pips. */
async function SidebarWithCounts({ adminRole }: { adminRole: AdminRole }) {
  const counts = await getDashboardCounts();
  return <Sidebar counts={counts} adminRole={adminRole} />;
}

/** Streamed: the same cached counts (deduped) feed the mobile-drawer pips. */
async function TopBarWithCounts({ admin, env }: { admin: AdminUser; env: AdminEnvKey }) {
  const counts = await getDashboardCounts();
  return (
    <TopBar admin={admin} env={env} devSwitchEnabled={DEV_SWITCH_ENABLED} counts={counts} />
  );
}
