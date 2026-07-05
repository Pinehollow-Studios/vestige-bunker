import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { EmailsSection } from "./EmailsSection";
import type { EmailTemplateRow } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Emails — one editable home for every email the app sends (welcome + all auth
 * emails). Jack edits subject + HTML with a live preview; the senders read the
 * live row, so a save takes effect on the next email with no deploy.
 */
export default async function EmailsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_email_templates");
  const templates = (data as EmailTemplateRow[] | null) ?? [];
  const notConfigured = !!error && isMissingRelation(error.message);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <SectionHeader eyebrow="Editorial" title="Emails" />

      {notConfigured ? (
        <div className="rounded-xl border border-border bg-surface-1 p-6 text-sm text-ink-3">
          The email templates table isn’t on this database yet. Apply the{" "}
          <code>email_templates</code> migration, then reload.
        </div>
      ) : error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load: {error.message}
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
