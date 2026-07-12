import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { WaitlistLive } from "./WaitlistLive";
import { ImportCsvButton } from "./ImportCsvButton";
import { ImportFromResendButton } from "./ImportFromResendButton";
import { WriteEmailButton } from "../WriteEmailButton";
import type { WaitlistOverview, WaitlistSubscriberRow } from "./types";

export const dynamic = "force-dynamic";

/**
 * Waitlist subscribers — the pre-launch list itself (not the emails). Live,
 * searchable, importable. Sending to it happens from the main Emails surface
 * (Write an email → Waitlist); this is where the list lives.
 */
export default async function WaitlistSubscribersPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [ovRes, subsRes] = await Promise.all([
    supabase.rpc("admin_waitlist_overview"),
    supabase.rpc("admin_waitlist_subscribers", { p_limit: 100, p_offset: 0, p_search: null }),
  ]);

  const overview = (ovRes.data?.[0] as WaitlistOverview | null) ?? null;
  const subscribers = (subsRes.data as WaitlistSubscriberRow[] | null) ?? [];
  const error =
    ovRes.error && isMissingRelation(ovRes.error.message) ? "The waitlist tables aren’t on this database yet." : ovRes.error?.message ?? null;

  return (
    <div className={pageShell("wide")}>
      <Link href="/emails" className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
        <ArrowLeft className="size-4" /> Emails
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold text-ink">Waitlist subscribers</h1>
          <p className="max-w-2xl text-sm text-ink-2">
            The people waiting for launch. To email them, go back and <strong className="font-medium text-ink">Write an email</strong> → Waitlist.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportCsvButton />
          <ImportFromResendButton />
          <WriteEmailButton label="Email the waitlist" variant="outline" />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">Couldn’t load the waitlist: {error}</div>
      ) : (
        <WaitlistLive initialOverview={overview} initialSubscribers={subscribers} />
      )}
    </div>
  );
}

function isMissingRelation(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache") || m.includes("relation");
}
