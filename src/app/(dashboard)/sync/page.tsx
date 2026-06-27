import { ShieldAlert } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { isEnvConfigured } from "@/lib/supabase/env";
import { syncConfigStatus } from "@/lib/sync/clients";
import { migrationStatus } from "@/lib/sync/migrations";
import { githubConfigured, latestProdDeployRun } from "@/lib/github/dispatch";
import { SyncRunner } from "./SyncRunner";
import { SchemaDeploy } from "./SchemaDeploy";

export const dynamic = "force-dynamic";

/**
 * Dev→prod promotion console. Dev is the workshop; prod is the live app.
 * Review + push the *built product* — schema migrations, editorial content,
 * and (next) config/seed — from dev up to prod. Never touches live user data.
 * Super_admin only; schema applies via the prod-deploy GitHub Action, editorial
 * via the service-role mirror.
 */
export default async function SyncPage() {
  const admin = await requireAdmin();

  if (admin.role !== "super_admin") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <SectionHeader eyebrow="Promotion" title="Deploy to prod" />
        <div className="flex items-start gap-3 rounded-2xl border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-alert">
          <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>This surface is restricted to super_admins.</p>
        </div>
      </div>
    );
  }

  const syncStatus = syncConfigStatus();
  const prodConfigured = isEnvConfigured("prod");
  const [schema, latestRun] = await Promise.all([migrationStatus(), latestProdDeployRun()]);
  const githubReady = githubConfigured();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <SectionHeader
        eyebrow="Promotion"
        title="Deploy to prod"
      />

      <Section title="Schema & functions">
        <SchemaDeploy initial={{ status: schema, githubReady, latestRun }} />
      </Section>

      <Section title="Editorial &amp; config">
        <SyncRunner status={syncStatus} prodConfigured={prodConfigured} />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
