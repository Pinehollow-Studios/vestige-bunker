import { Send, Smartphone } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { NewBroadcastButton } from "./NewBroadcastButton";
import { BroadcastCard } from "./BroadcastCard";
import { SystemNotificationsSection } from "./SystemNotificationsSection";
import type { NotificationTemplateRow } from "./actions";
import { type BroadcastOverviewRow } from "./types";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [bRes, tRes] = await Promise.all([
    supabase.rpc("admin_broadcasts_overview"),
    supabase.rpc("admin_notification_templates"),
  ]);

  const broadcasts = (bRes.data as BroadcastOverviewRow[] | null) ?? [];
  const overrides: Record<string, NotificationTemplateRow> = {};
  for (const r of (tRes.data as NotificationTemplateRow[] | null) ?? []) overrides[r.kind] = r;

  const notConfigured = !!bRes.error && isMissingRelation(bRes.error.message);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <SectionHeader eyebrow="Editorial" title="Notifications" actions={<NewBroadcastButton />} />

      {notConfigured ? (
        <NotConfigured />
      ) : bRes.error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load: {bRes.error.message}
        </div>
      ) : (
        <>
          {/* Team messages - broadcasts we compose + send. */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand">
                <Send className="size-3" /> Your team
              </span>
              <h2 className="font-display text-lg font-semibold text-ink">Messages you send</h2>
              <span className="text-sm text-ink-3">- one-off pushes to everyone, a cohort, or a person</span>
            </div>

            {broadcasts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-brand/30 bg-brand/[0.03] p-8 text-center">
                <p className="text-sm text-ink-2">No messages yet.</p>
                <p className="mt-0.5 text-sm text-ink-3">Compose a push - a heads-up to everyone, a note to a cohort, or a message to one person.</p>
                <div className="mt-3 flex justify-center">
                  <NewBroadcastButton />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {broadcasts.map((r) => (
                  <BroadcastCard key={r.id} row={r} />
                ))}
              </div>
            )}
          </section>

          {/* Automatic notifications - the wording of every system kind. */}
          <SystemNotificationsSection overrides={overrides} />
        </>
      )}
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="rounded-xl glass-panel p-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-full bg-paper-sunken text-ink-3">
          <Smartphone className="size-5" />
        </span>
        <p className="font-display text-base font-semibold text-ink">Notifications not wired here</p>
        <p className="mx-auto max-w-md text-sm text-ink-2">
          The broadcast tables aren&apos;t in this Supabase project yet. Apply the{" "}
          <span className="font-mono text-xs">20260628100000_admin_broadcasts.sql</span> +{" "}
          <span className="font-mono text-xs">20260628110000_notification_templates.sql</span> migrations.
        </p>
      </div>
    </div>
  );
}

function isMissingRelation(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache") || m.includes("not found");
}
