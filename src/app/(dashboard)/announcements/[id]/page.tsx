import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { announcementMediaURL } from "@/lib/storage";
import { AnnouncementEditor } from "./AnnouncementEditor";
import type {
  AnnouncementRecipient,
  AnnouncementRow,
  AnnouncementStats,
  CountyOption,
  UserPickRow,
} from "../types";

export const dynamic = "force-dynamic";

const RECIPIENTS_PAGE_SIZE = 50;

export default async function AnnouncementEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: row, error: rowError } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (rowError) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load announcement: {rowError.message}
        </div>
      </div>
    );
  }
  if (!row) notFound();

  // Stats, the first page of recipients, the current individual targets, and
  // the counties picker — all in parallel. Each is best-effort (the recipients
  // / stats RPCs aggregate; the targets + counties are direct reads).
  const [statsRes, recipientsRes, targetRowsRes, countyRowsRes] = await Promise.all([
    supabase.rpc("admin_announcement_stats", { p_id: id }),
    supabase.rpc("admin_announcement_recipients", {
      p_id: id,
      p_state: "all",
      p_limit: RECIPIENTS_PAGE_SIZE,
      p_offset: 0,
    }),
    supabase.from("announcement_targets").select("user_id").eq("announcement_id", id),
    supabase.from("counties").select("id,name").order("name"),
  ]);

  const statsRows = statsRes.data as AnnouncementStats[] | null;
  const stats: AnnouncementStats | null = statsRows?.[0] ?? null;

  const recipients = (recipientsRes.data as AnnouncementRecipient[] | null) ?? [];

  // Hydrate the individual targets to minimal user profiles for the picker.
  const targetIds = (targetRowsRes.data ?? []).map((r) => r.user_id as string);
  let targetUsers: UserPickRow[] = [];
  if (targetIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_photo_id")
      .in("id", targetIds);
    targetUsers = (users ?? []) as UserPickRow[];
  }

  const counties: CountyOption[] = (countyRowsRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href="/announcements"
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Announcements
      </Link>
      <AnnouncementEditor
        row={row as AnnouncementRow}
        stats={stats}
        initialRecipients={recipients}
        recipientsPageSize={RECIPIENTS_PAGE_SIZE}
        initialTargetUsers={targetUsers}
        counties={counties}
        heroURL={announcementMediaURL((row as AnnouncementRow).image_storage_key)}
        isSuperAdmin={admin.role === "super_admin"}
      />
    </div>
  );
}
