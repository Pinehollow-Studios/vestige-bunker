import { pageShell } from "@/components/admin/PageShell";
import { SectionHeader } from "@/components/admin/SectionHeader";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { EmailsIndex, type EmailListItem } from "./EmailsIndex";
import { audienceSummary } from "./campaigns/types";
import type { EmailCampaignOverviewRow } from "./campaigns/types";
import type { WaitlistCampaignOverviewRow } from "./waitlist/types";

export const dynamic = "force-dynamic";

/**
 * Emails — one surface. A single list of every email you've written (to app
 * members or the waitlist), and one "Write an email" button. Click a row to
 * edit it. Automatic (system) emails live one click away.
 */
export default async function EmailsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [appRes, wlRes] = await Promise.all([
    supabase.rpc("admin_email_campaigns_overview"),
    supabase.rpc("admin_waitlist_campaigns_overview"),
  ]);

  const appRows = (appRes.data as EmailCampaignOverviewRow[] | null) ?? [];
  const wlRows = (wlRes.data as WaitlistCampaignOverviewRow[] | null) ?? [];

  const items: EmailListItem[] = [
    ...appRows.map((c): EmailListItem => ({
      id: c.id,
      kind: "app",
      href: `/emails/campaigns/${c.id}`,
      subject: c.subject,
      name: c.name,
      status: c.status,
      audience: audienceSummary(c, c.audience_kind === "individuals" ? c.target_user_count : undefined),
      sentCount: c.sent_count,
      failedCount: c.failed_count,
      scheduledAt: c.scheduled_at,
      sortAt: c.sent_at ?? c.scheduled_at ?? c.created_at,
    })),
    ...wlRows.map((c): EmailListItem => ({
      id: c.id,
      kind: "waitlist",
      href: `/emails/waitlist/${c.id}`,
      subject: c.subject,
      name: c.name,
      status: c.status,
      audience:
        c.audience_kind === "individuals"
          ? `${c.target_count} ${c.target_count === 1 ? "person" : "people"}`
          : "Whole waitlist",
      sentCount: c.sent_count,
      failedCount: c.failed_count,
      scheduledAt: c.scheduled_at,
      sortAt: c.sent_at ?? c.scheduled_at ?? c.created_at,
    })),
  ].sort((a, b) => (a.sortAt < b.sortAt ? 1 : -1));

  const loadError =
    appRes.error && isMissingRelation(appRes.error.message)
      ? "The email tables aren’t on this database yet."
      : appRes.error?.message ?? wlRes.error?.message ?? null;

  return (
    <div className={pageShell("wide")}>
      <SectionHeader
        eyebrow="Editorial"
        title="Emails"
        actions={
          <Link
            href="/emails/suppressions"
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule/60 px-2.5 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:text-ink"
          >
            <ShieldX aria-hidden className="size-3.5" /> Suppressions
          </Link>
        }
      />
      <EmailsIndex items={items} error={loadError} />
    </div>
  );
}

function isMissingRelation(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache") || m.includes("relation");
}
