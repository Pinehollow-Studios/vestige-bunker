import { Smartphone } from "lucide-react";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { NewBroadcastButton } from "./NewBroadcastButton";
import { BroadcastCard } from "./BroadcastCard";
import {
  STATUS_DOT,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_RANK,
  type BroadcastOverviewRow,
  type BroadcastStatus,
} from "./types";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_broadcasts_overview");
  const all = (data as BroadcastOverviewRow[] | null) ?? [];
  const notConfigured = !!error && isMissingRelation(error.message);

  const buckets: Record<BroadcastStatus, number> = {
    draft: 0, scheduled: 0, sending: 0, sent: 0, canceled: 0,
  };
  for (const r of all) buckets[r.status] += 1;

  const rows = [...all].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <SectionHeader eyebrow="Editorial" title="Notifications" actions={<NewBroadcastButton />} />

      {notConfigured ? (
        <NotConfigured />
      ) : error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load broadcasts: {error.message}
        </div>
      ) : all.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_ORDER.filter((k) => buckets[k] > 0).map((key) => (
              <span key={key} className="inline-flex items-center gap-2 rounded-full glass-panel px-3 py-1 text-xs">
                <span aria-hidden className={cn("size-2 rounded-full", STATUS_DOT[key])} />
                <span className="text-ink-2">{STATUS_LABELS[key]}</span>
                <span className="font-semibold tabular-nums text-ink">{buckets[key]}</span>
              </span>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <BroadcastCard key={r.id} row={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl glass-panel p-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Smartphone className="size-5" />
        </span>
        <p className="font-display text-base font-semibold text-ink">No notifications yet</p>
        <p className="text-sm text-ink-2">
          Compose a push — a heads-up to everyone, a note to a cohort, or a message to one person.
        </p>
      </div>
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
          <span className="font-mono text-xs">20260628100000_admin_broadcasts.sql</span> migration to enable this surface.
        </p>
      </div>
    </div>
  );
}

function isMissingRelation(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache") || m.includes("not found");
}
