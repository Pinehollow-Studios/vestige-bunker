import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { listPickerUsers } from "@/lib/users/roster";
import { MessageFunnel } from "@/components/admin/MessageFunnel";
import { EmailComposer } from "../../EmailComposer";
import type { CountyOption, EmailCampaignRow } from "../types";

type EmailFunnel = {
  recipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
};

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

  const [targetRowsRes, countyRowsRes, allUsers] = await Promise.all([
    supabase.from("email_campaign_targets").select("user_id").eq("campaign_id", id),
    supabase.from("counties").select("id,name").order("name"),
    listPickerUsers({ withEmail: true }),
  ]);

  const targetIds = (targetRowsRes.data ?? []).map((r) => r.user_id as string);

  // Delivery funnel — only meaningful once the campaign has gone out.
  const sentOut = row.status === "sent" || row.status === "sending";
  const funnelRes = sentOut ? await supabase.rpc("admin_email_campaign_funnel", { p_campaign_id: id }) : null;
  const f = (funnelRes?.data?.[0] ?? null) as EmailFunnel | null;

  const counties: CountyOption[] = (countyRowsRes.data ?? []).map((c) => ({ id: c.id, name: c.name }));
  const r = row as EmailCampaignRow;

  return (
    <div className={pageShell("wide")}>
      <Link
        href="/emails"
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Emails
      </Link>

      {f && (
        <MessageFunnel
          title="Delivery"
          subtitle="via Resend"
          stages={[
            { label: "Recipients", value: f.recipients },
            { label: "Sent", value: f.sent },
            { label: "Delivered", value: f.delivered },
            { label: "Opened", value: f.opened },
            { label: "Clicked", value: f.clicked },
          ]}
          notes={[
            { label: "bounced", value: f.bounced, tone: "alert" },
            { label: "complained", value: f.complained, tone: "alert" },
          ]}
          empty="Sent — delivery events will appear once Resend's webhook reports back."
        />
      )}

      <EmailComposer
        id={r.id}
        name={r.name}
        subject={r.subject}
        preheader={r.preheader}
        html={r.html}
        status={r.status}
        scheduledAt={r.scheduled_at}
        sentAt={r.sent_at}
        sentCount={r.sent_count}
        failedCount={r.failed_count}
        recipientCount={r.recipient_count}
        isSuperAdmin={admin.role === "super_admin"}
        audience={{
          kind: "app",
          audienceKind: r.audience_kind,
          target: r.target,
          minVersion: r.min_app_version,
          maxVersion: r.max_app_version,
          bypass: r.bypass_marketing_consent,
          allUsers,
          initialSelectedIds: targetIds,
          counties,
        }}
      />
    </div>
  );
}
