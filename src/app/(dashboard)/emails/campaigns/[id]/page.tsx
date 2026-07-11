import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { listPickerUsers } from "@/lib/users/roster";
import { EmailCampaignEditor, type TemplateSeed } from "./EmailCampaignEditor";
import type { CountyOption, EmailCampaignRow } from "../types";

export const dynamic = "force-dynamic";

export default async function EmailCampaignEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: row, error: rowError } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (rowError) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load campaign: {rowError.message}
        </div>
      </div>
    );
  }
  if (!row) notFound();

  const [targetRowsRes, countyRowsRes, templatesRes, allUsers] = await Promise.all([
    supabase.from("email_campaign_targets").select("user_id").eq("campaign_id", id),
    supabase.from("counties").select("id,name").order("name"),
    supabase.rpc("admin_email_templates"),
    listPickerUsers({ withEmail: true }),
  ]);

  const targetIds = (targetRowsRes.data ?? []).map((r) => r.user_id as string);

  const counties: CountyOption[] = (countyRowsRes.data ?? []).map((c) => ({ id: c.id, name: c.name }));
  const templates: TemplateSeed[] = ((templatesRes.data as TemplateSeed[] | null) ?? []).map((t) => ({
    key: t.key,
    name: t.name,
    subject: t.subject,
    html: t.html,
  }));

  return (
    <div className={pageShell("wide")}>
      <Link
        href="/emails"
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Emails
      </Link>
      <EmailCampaignEditor
        row={row as EmailCampaignRow}
        allUsers={allUsers}
        initialSelectedIds={targetIds}
        counties={counties}
        templates={templates}
        isSuperAdmin={admin.role === "super_admin"}
      />
    </div>
  );
}
