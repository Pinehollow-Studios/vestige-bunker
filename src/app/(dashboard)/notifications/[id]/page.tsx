import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { MessageFunnel } from "@/components/admin/MessageFunnel";
import { BroadcastEditor } from "./BroadcastEditor";
import type { BroadcastRow, CountyOption, UserPickRow } from "../types";

type PushFunnel = { recipients: number; accepted: number; failed: number; opened: number };

export const dynamic = "force-dynamic";

export default async function BroadcastEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: row, error: rowError } = await supabase
    .from("admin_broadcasts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (rowError) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load broadcast: {rowError.message}
        </div>
      </div>
    );
  }
  if (!row) notFound();

  const [targetRowsRes, countyRowsRes] = await Promise.all([
    supabase.from("broadcast_targets").select("user_id").eq("broadcast_id", id),
    supabase.from("counties").select("id,name").order("name"),
  ]);

  const targetIds = (targetRowsRes.data ?? []).map((r) => r.user_id as string);
  let targetUsers: UserPickRow[] = [];
  if (targetIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_photo_id")
      .in("id", targetIds);
    targetUsers = (users ?? []) as UserPickRow[];
  }

  const counties: CountyOption[] = (countyRowsRes.data ?? []).map((c) => ({ id: c.id, name: c.name }));

  // Delivery funnel — only meaningful once the broadcast has been sent.
  const funnelRes = row.status === "sent" ? await supabase.rpc("admin_broadcast_funnel", { p_broadcast_id: id }) : null;
  const f = (funnelRes?.data?.[0] ?? null) as PushFunnel | null;

  return (
    <div className={pageShell("wide")}>
      <Link
        href="/notifications"
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Notifications
      </Link>

      {f && (
        <MessageFunnel
          title="Delivery"
          subtitle="via APNs"
          stages={[
            { label: "Recipients", value: f.recipients },
            { label: "Accepted by Apple", value: f.accepted },
            { label: "Opened", value: f.opened },
          ]}
          notes={[{ label: "failed / dead token", value: f.failed, tone: "warn" }]}
          empty="Sent — per-device outcomes will appear here."
        />
      )}

      <BroadcastEditor
        row={row as BroadcastRow}
        initialTargetUsers={targetUsers}
        counties={counties}
        isSuperAdmin={admin.role === "super_admin"}
      />
    </div>
  );
}
