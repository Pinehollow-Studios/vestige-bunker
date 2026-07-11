import { SectionHeader } from "@/components/admin/SectionHeader";
import { PageTabs } from "@/components/admin/PageTabs";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { ComposeBroadcastButton } from "./ComposeBroadcastButton";
import { BroadcastsSection } from "./BroadcastsSection";
import { SystemNotificationsSection } from "./SystemNotificationsSection";
import type { NotificationTemplateRow } from "./actions";
import { type BroadcastOverviewRow } from "./types";

export const dynamic = "force-dynamic";

/**
 * Notifications — two jobs, two tabs:
 *   1. "Notifications you send"  — compose/queue/send one-off pushes to users.
 *   2. "Automatic notifications" — edit the wording of the system notifications
 *      that fire themselves (friend requests, badges, feedback, …).
 */
export default async function NotificationsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [bRes, tRes] = await Promise.all([
    supabase.rpc("admin_broadcasts_overview"),
    supabase.rpc("admin_notification_templates"),
  ]);

  const broadcasts = (bRes.data as BroadcastOverviewRow[] | null) ?? [];
  const broadcastsError =
    bRes.error && isMissingRelation(bRes.error.message)
      ? "The broadcast tables aren’t on this database yet."
      : bRes.error?.message ?? null;

  const overrides: Record<string, NotificationTemplateRow> = {};
  for (const r of (tRes.data as NotificationTemplateRow[] | null) ?? []) overrides[r.kind] = r;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <SectionHeader eyebrow="Editorial" title="Notifications" />

      <PageTabs
        tabs={[
          {
            key: "send",
            label: "Notifications you send",
            action: <ComposeBroadcastButton />,
            content: <BroadcastsSection broadcasts={broadcasts} error={broadcastsError} />,
          },
          {
            key: "auto",
            label: "Automatic notifications",
            content: <SystemNotificationsSection overrides={overrides} />,
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
    m.includes("not found")
  );
}
