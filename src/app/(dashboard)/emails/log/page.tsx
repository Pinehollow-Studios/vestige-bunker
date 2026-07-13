import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { cn } from "@/lib/utils";
import { emailStatusMeta, emailStatusChipClass } from "@/lib/email/status";
import type { EmailLogRow } from "../campaigns/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "delivered", label: "Delivered" },
  { key: "opened", label: "Opened" },
  { key: "clicked", label: "Clicked" },
  { key: "bounced", label: "Bounced" },
  { key: "complained", label: "Complained" },
  { key: "failed", label: "Failed" },
] as const;

type SearchParams = { status?: string; q?: string; page?: string };

export default async function EmailLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = FILTERS.some((f) => f.key === sp.status) ? (sp.status as string) : "all";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_email_log", {
    p_status: status,
    p_search: q || null,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  const rows = (data as EmailLogRow[] | null) ?? [];
  const total = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hrefFor = (patch: Partial<SearchParams>) => {
    const next = new URLSearchParams();
    const merged = { status, q, page: String(page), ...patch };
    if (merged.status && merged.status !== "all") next.set("status", merged.status);
    if (merged.q) next.set("q", merged.q);
    if (merged.page && merged.page !== "1") next.set("page", merged.page);
    const qs = next.toString();
    return `/emails/log${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className={pageShell("wide")}>
      <Link href="/emails" className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Campaigns
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-xl font-semibold text-ink">Emails</h1>
          <span className="rounded-full border border-rule/60 px-2 py-0.5 text-xs tabular-nums text-ink-3">
            {total.toLocaleString()}
          </span>
        </div>
        {/* Search (GET form → ?q=) */}
        <form action="/emails/log" method="get" className="relative min-w-[200px]">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search address or subject"
            className="w-full rounded-lg border border-rule/60 bg-paper-sunken/40 py-1.5 pl-8 pr-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-brand/50"
          />
        </form>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={hrefFor({ status: f.key, page: "1" })}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              status === f.key ? "border-brand/50 bg-brand/10 text-brand" : "border-rule/60 text-ink-2 hover:text-ink",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load emails: {error.message}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-rule/60 bg-paper-sunken/30 px-3 py-10 text-center text-sm text-ink-3">
          No emails match.
        </p>
      ) : (
        <div className="divide-y divide-rule/40 overflow-hidden rounded-xl border border-border">
          {rows.map((r) => {
            const meta = emailStatusMeta(r.last_event);
            const to = r.display_name?.trim() || r.username || null;
            const subjectLine = r.subject || r.campaign_name || (r.is_campaign ? "Campaign" : "Transactional email");
            const inner = (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{r.email ?? "—"}</p>
                  <p className="truncate text-[11px] text-ink-3">
                    {to ? `${to} · ` : ""}
                    {subjectLine}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {(r.open_count > 1 || r.click_count > 0) && (
                    <span className="hidden text-[11px] tabular-nums text-ink-3 sm:inline">
                      {r.click_count > 0 ? `${r.click_count} click${r.click_count > 1 ? "s" : ""}` : `${r.open_count} opens`}
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      emailStatusChipClass(meta.tone),
                    )}
                  >
                    {meta.label}
                  </span>
                  <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-ink-3">
                    {relativeTime(r.last_event_at ?? r.sent_at)}
                  </span>
                  {r.resend_id && <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />}
                </div>
              </>
            );
            return r.resend_id ? (
              <Link
                key={r.resend_id}
                href={`/emails/message/${encodeURIComponent(r.resend_id)}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-paper-raised/40"
              >
                {inner}
              </Link>
            ) : (
              <div key={`${r.campaign_id}:${r.user_id}`} className="flex items-center gap-3 px-4 py-2.5">
                {inner}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-3">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={hrefFor({ page: String(page - 1) })} className="rounded-lg border border-rule/60 px-3 py-1.5 text-ink-2 hover:text-ink">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={hrefFor({ page: String(page + 1) })} className="rounded-lg border border-rule/60 px-3 py-1.5 text-ink-2 hover:text-ink">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "-";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (Number.isNaN(mins)) return "-";
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.round(days / 30)}mo`;
}
