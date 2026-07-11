import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { BroadcastEditor } from "./BroadcastEditor";
import type { BroadcastRow, CountyOption, UserPickRow } from "../types";

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

  return (
    <div className={pageShell("wide")}>
      <Link
        href="/notifications"
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Notifications
      </Link>
      <BroadcastEditor
        row={row as BroadcastRow}
        initialTargetUsers={targetUsers}
        counties={counties}
        isSuperAdmin={admin.role === "super_admin"}
      />
    </div>
  );
}
