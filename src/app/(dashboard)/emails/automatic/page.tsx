import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { EmailsSection } from "../EmailsSection";
import type { EmailTemplateRow } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Automatic emails — the wording of the system emails that send themselves
 * (welcome, password reset…). You can't send these by hand; you edit what they
 * say. Kept off the main Emails list so writing an email stays one clear action.
 */
export default async function AutomaticEmailsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const tplRes = await supabase.rpc("admin_email_templates");
  const templates = (tplRes.data as EmailTemplateRow[] | null) ?? [];
  const notConfigured = !!tplRes.error && isMissingRelation(tplRes.error.message);

  return (
    <div className={pageShell("wide")}>
      <Link href="/emails" className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
        <ArrowLeft className="size-4" /> Emails
      </Link>

      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold text-ink">Automatic emails</h1>
        <p className="max-w-2xl text-sm text-ink-2">
          These send <strong className="font-medium text-ink">automatically</strong> when something happens (a new
          member, a password reset). You can’t send them by hand — edit their wording here. To send your own email, go
          back and <strong className="font-medium text-ink">Write an email</strong>.
        </p>
      </div>

      {notConfigured ? (
        <div className="rounded-xl border border-border bg-surface-1 p-6 text-sm text-ink-3">
          The email templates table isn’t on this database yet. Apply the <code>email_templates</code> migration, then reload.
        </div>
      ) : tplRes.error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">Failed to load: {tplRes.error.message}</div>
      ) : (
        <EmailsSection templates={templates} />
      )}
    </div>
  );
}

function isMissingRelation(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache") || m.includes("relation");
}
