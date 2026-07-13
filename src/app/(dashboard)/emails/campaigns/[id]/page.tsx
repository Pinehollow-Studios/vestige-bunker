import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { listPickerUsers } from "@/lib/users/roster";
import { MessageFunnel } from "@/components/admin/MessageFunnel";
import { EmailComposer } from "../../EmailComposer";
import { RecipientTable } from "./RecipientTable";
import { BackfillButton } from "./BackfillButton";
import type { CampaignRecipientRow, CountyOption, EmailCampaignRow } from "../types";

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

  // Delivery funnel + per-recipient log — only meaningful once it's gone out.
  const sentOut = row.status === "sent" || row.status === "sending";
  const [funnelRes, recipientsRes] = sentOut
    ? await Promise.all([
        supabase.rpc("admin_email_campaign_funnel", { p_campaign_id: id }),
        supabase.rpc("admin_email_campaign_recipients", { p_id: id }),
      ])
    : [null, null];
  const f = (funnelRes?.data?.[0] ?? null) as EmailFunnel | null;
  const recipients = (recipientsRes?.data ?? []) as CampaignRecipientRow[];
  const rates = f ? computeRates(f) : null;

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
        <div className="space-y-4">
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

          {rates && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <RateStat label="Delivery" pct={rates.delivery} />
              <RateStat label="Open rate" pct={rates.open} />
              <RateStat label="Click rate" pct={rates.click} />
              <RateStat label="Bounce rate" pct={rates.bounce} alert />
              <RateStat label="Complaint" pct={rates.complaint} alert />
            </div>
          )}

          <section className="rounded-2xl border border-border bg-paper-raised/50 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                Recipients
              </p>
              <BackfillButton campaignId={id} />
            </div>
            <RecipientTable recipients={recipients} />
          </section>
        </div>
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

/**
 * Standard email KPIs. Open/click are rated against DELIVERED (the industry
 * convention — you can't open what didn't land); bounce against SENT; complaint
 * against delivered. Guards divide-by-zero to 0.
 */
function computeRates(f: EmailFunnel) {
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  return {
    delivery: pct(f.delivered, f.sent),
    open: pct(f.opened, f.delivered),
    click: pct(f.clicked, f.delivered),
    bounce: pct(f.bounced, f.sent),
    complaint: pct(f.complained, f.delivered),
  };
}

function RateStat({ label, pct, alert }: { label: string; pct: number; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-paper-raised/40 p-3 text-center">
      <p
        className={
          "font-display text-2xl font-semibold tabular-nums " +
          (alert && pct > 0 ? "text-alert" : "text-ink")
        }
      >
        {pct}%
      </p>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</p>
    </div>
  );
}
