import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { EmailsSection } from "./EmailsSection";
import { EmailCampaignsSection } from "./EmailCampaignsSection";
import type { EmailTemplateRow } from "./actions";
import type { EmailCampaignOverviewRow } from "./campaigns/types";

export const dynamic = "force-dynamic";

/**
 * Emails — two surfaces in one home:
 *   1. "Campaigns you send" — one-off + scheduled emails to users (Resend).
 *   2. The transactional template editor (welcome + auth emails) below it.
 * Mirrors /notifications (broadcasts above the system-template editor).
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
  const campaignsConfigured = !campRes.error;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SectionHeader eyebrow="Editorial" title="Emails" />

      {campaignsConfigured && <EmailCampaignsSection campaigns={campaigns} />}

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
