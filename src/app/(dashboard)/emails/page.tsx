import { pageShell } from "@/components/admin/PageShell";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { PageTabs } from "@/components/admin/PageTabs";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { EmailsSection } from "./EmailsSection";
import { EmailCampaignsSection } from "./EmailCampaignsSection";
import { ComposeEmailButton } from "./campaigns/ComposeEmailButton";
import type { EmailTemplateRow } from "./actions";
import type { EmailCampaignOverviewRow } from "./campaigns/types";

export const dynamic = "force-dynamic";

/**
 * Emails — two jobs, two tabs:
 *   1. "Emails you send"  — compose/queue/send one-off emails to users (Resend).
 *   2. "Automatic emails" — edit the wording of the system emails (welcome,
 *      password reset, …) that send themselves.
 */
export default async function EmailsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [tplRes, campRes] = await Promise.all([
    supabase.rpc("admin_email_templates"),
    supabase.rpc("admin_email_campaigns_overview"),
  ]);

  const templates = (tplRes.data as EmailTemplateRow[] | null) ?? [];
  const notConfigured = !!tplRes.error && isMissingRelation(tplRes.error.message);

  const campaigns = (campRes.data as EmailCampaignOverviewRow[] | null) ?? [];
  const campaignsError =
    campRes.error && isMissingRelation(campRes.error.message)
      ? "The email campaigns tables aren’t on this database yet."
      : campRes.error?.message ?? null;

  return (
    <div className={pageShell("wide")}>
      <SectionHeader eyebrow="Editorial" title="Emails" />

      <PageTabs
        tabs={[
          {
            key: "send",
            label: "Emails you send",
            action: <ComposeEmailButton />,
            content: <EmailCampaignsSection campaigns={campaigns} error={campaignsError} />,
          },
          {
            key: "auto",
            label: "Automatic emails",
            content: (
              <div className="space-y-4">
                <p className="text-sm text-ink-2">
                  These emails send <strong className="font-medium text-ink">automatically</strong>{" "}
                  when something happens (a new member, a password reset). You can’t send these by
                  hand — edit their wording here. To send your own email, use{" "}
                  <strong className="font-medium text-ink">Emails you send</strong>.
                </p>
                {notConfigured ? (
                  <div className="rounded-xl border border-border bg-surface-1 p-6 text-sm text-ink-3">
                    The email templates table isn’t on this database yet. Apply the{" "}
                    <code>email_templates</code> migration, then reload.
                  </div>
                ) : tplRes.error ? (
                  <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
                    Failed to load: {tplRes.error.message}
                  </div>
                ) : (
                  <EmailsSection templates={templates} />
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

function isMissingRelation(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("schema cache") ||
    m.includes("relation")
  );
}
