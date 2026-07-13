import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { ArrowLeft, ShieldX } from "lucide-react";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { cn } from "@/lib/utils";
import { RemoveSuppressionButton } from "./RemoveSuppressionButton";

export const dynamic = "force-dynamic";

type SuppressionRow = {
  email: string;
  reason: "hard_bounce" | "complaint" | "manual";
  user_id: string | null;
  campaign_id: string | null;
  detail: string | null;
  created_at: string;
};

const REASON_LABEL: Record<SuppressionRow["reason"], string> = {
  hard_bounce: "Hard bounce",
  complaint: "Spam complaint",
  manual: "Manual",
};

export default async function SuppressionsPage() {
  await requireAdmin();
  const supabase = await tryCreateServiceClient();

  if (!supabase) {
    return (
      <Shell>
        <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-amber">
          Service-role key not configured.
        </div>
      </Shell>
    );
  }

  const { data, error } = await supabase
    .from("email_suppressions")
    .select("email, reason, user_id, campaign_id, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    return (
      <Shell>
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load suppressions: {error.message}
        </div>
      </Shell>
    );
  }

  const rows = (data ?? []) as SuppressionRow[];

  // Resolve the linked user's handle for a clickable row (service-role read).
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v)));
  const handles: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase.from("users").select("id, username, display_name").in("id", userIds);
    for (const u of (users ?? []) as { id: string; username: string | null; display_name: string | null }[]) {
      handles[u.id] = u.display_name?.trim() || (u.username ? `@${u.username}` : u.id);
    }
  }

  return (
    <Shell>
      <div className="flex items-center gap-2">
        <ShieldX aria-hidden className="size-5 text-ink-2" />
        <h1 className="font-display text-xl font-semibold text-ink">Suppressed addresses</h1>
        <span className="rounded-full border border-rule/60 px-2 py-0.5 text-xs tabular-nums text-ink-3">
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-rule/60 bg-paper-sunken/30 px-3 py-10 text-center text-sm text-ink-3">
          No suppressed addresses. Hard bounces and spam complaints land here automatically and are skipped on future
          sends.
        </p>
      ) : (
        <div className="divide-y divide-rule/40 overflow-hidden rounded-xl border border-border">
          {rows.map((r) => (
            <div key={r.email} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{r.email}</p>
                <p className="truncate text-[11px] text-ink-3">
                  {formatDate(r.created_at)}
                  {r.detail ? ` · ${r.detail}` : ""}
                  {r.user_id && handles[r.user_id] ? (
                    <>
                      {" · "}
                      <Link href={`/users/${r.user_id}`} className="text-brand hover:underline">
                        {handles[r.user_id]}
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <ReasonChip reason={r.reason} />
              <RemoveSuppressionButton email={r.email} />
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

function ReasonChip({ reason }: { reason: SuppressionRow["reason"] }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        reason === "complaint"
          ? "border-alert/30 bg-alert/10 text-alert"
          : reason === "hard_bounce"
            ? "border-amber/30 bg-amber/10 text-amber"
            : "border-rule/60 text-ink-3",
      )}
    >
      {REASON_LABEL[reason]}
    </span>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={pageShell("content")}>
      <Link href="/emails" className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Emails
      </Link>
      {children}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
