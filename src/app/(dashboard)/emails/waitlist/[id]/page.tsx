import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { MessageFunnel } from "@/components/admin/MessageFunnel";
import { WaitlistCampaignEditor } from "./WaitlistCampaignEditor";
import type { WaitlistCampaignRow, WaitlistFunnel, WaitlistOverview } from "../types";

export const dynamic = "force-dynamic";

export default async function WaitlistCampaignEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: row, error: rowError } = await supabase
    .from("waitlist_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (rowError) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load email: {rowError.message}
        </div>
      </div>
    );
  }
  if (!row) notFound();

  const sentOut = row.status === "sent" || row.status === "sending";
  const [overviewRes, targetsRes, funnelRes] = await Promise.all([
    supabase.rpc("admin_waitlist_overview"),
    supabase.from("waitlist_campaign_targets").select("email").eq("campaign_id", id),
    sentOut ? supabase.rpc("admin_waitlist_campaign_funnel", { p_id: id }) : Promise.resolve({ data: null }),
  ]);

  const overview = (overviewRes.data?.[0] ?? null) as WaitlistOverview | null;
  const subscribedCount = overview?.subscribed ?? 0;
  const initialTargets = (targetsRes.data ?? []).map((t) => t.email as string);
  const f = (funnelRes.data?.[0] ?? null) as WaitlistFunnel | null;

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

      <WaitlistCampaignEditor
        row={row as WaitlistCampaignRow}
        subscribedCount={subscribedCount}
        initialTargets={initialTargets}
        isSuperAdmin={admin.role === "super_admin"}
      />
    </div>
  );
}
