import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { cn } from "@/lib/utils";
import { emailStatusMeta, emailStatusChipClass } from "@/lib/email/status";
import type { EmailMessage, EmailEventRow } from "../../campaigns/types";
import { EmailContentTabs } from "./EmailContentTabs";

export const dynamic = "force-dynamic";

const FROM = "Vestige <no-reply@vestige.golf>";

export default async function EmailMessagePage({ params }: { params: Promise<{ resendId: string }> }) {
  const { resendId: raw } = await params;
  const resendId = decodeURIComponent(raw);
  await requireAdmin();
  const supabase = await createClient();

  const [msgRes, eventsRes] = await Promise.all([
    supabase.rpc("admin_email_message", { p_resend_id: resendId }),
    supabase.rpc("admin_email_recipient_events", { p_resend_id: resendId }),
  ]);

  const m = (msgRes.data?.[0] ?? null) as EmailMessage | null;
  if (msgRes.error) {
    return (
      <Shell>
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load email: {msgRes.error.message}
        </div>
      </Shell>
    );
  }
  if (!m) notFound();

  const events = (eventsRes.data as EmailEventRow[] | null) ?? [];
  const meta = emailStatusMeta(m.last_event);
  const toName = m.display_name?.trim() || m.username || null;
  const firstName = (m.display_name ?? "").trim().split(/\s+/)[0] || "there";

  return (
    <Shell>
      {/* Header */}
      <div className="space-y-3 rounded-2xl border border-border bg-paper-raised/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 font-display text-xl font-semibold text-ink">
            {m.subject || m.campaign_name || "Email"}
          </h1>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
              emailStatusChipClass(meta.tone),
            )}
          >
            {meta.label}
          </span>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
          <MetaRow label="From" value={m.from_address || FROM} />
          <MetaRow
            label="To"
            value={
              m.email ? (
                m.user_id ? (
                  <Link href={`/users/${m.user_id}`} className="text-brand hover:underline">
                    {m.email}
                  </Link>
                ) : (
                  m.email
                )
              ) : (
                "—"
              )
            }
            sub={toName ?? undefined}
          />
          <MetaRow
            label="Source"
            value={
              m.campaign_id ? (
                <Link href={`/emails/campaigns/${m.campaign_id}`} className="text-brand hover:underline">
                  {m.campaign_name ?? "Campaign"}
                </Link>
              ) : (
                "Transactional"
              )
            }
          />
          <MetaRow label="Sent" value={m.sent_at ? fullTime(m.sent_at) : "-"} />
          <MetaRow label="Email ID" value={m.resend_id} mono />
          {m.error && <MetaRow label="Error" value={m.error} alert />}
        </dl>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Content */}
        <div className="min-w-0">
          <EmailContentTabs
            html={m.html ?? ""}
            firstName={firstName}
            raw={{ message: m, events }}
          />
        </div>

        {/* Timeline */}
        <section className="rounded-2xl border border-border bg-paper-raised/50 p-5">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Timeline</p>
          {events.length === 0 ? (
            <p className="text-sm text-ink-3">
              No delivery events yet{m.recipient_status === "failed" ? " — send failed." : "."}
            </p>
          ) : (
            <ol className="relative space-y-4 border-l border-rule/50 pl-4">
              {events.map((e, i) => {
                const em = emailStatusMeta(e.event_type);
                return (
                  <li key={i} className="relative">
                    <span
                      aria-hidden
                      className={cn(
                        "absolute -left-[21px] top-1 size-2.5 rounded-full ring-4 ring-paper-raised",
                        em.tone === "alert" ? "bg-alert" : em.tone === "brand" ? "bg-brand" : "bg-ink-3",
                      )}
                    />
                    <p className="text-sm font-medium text-ink">{em.label}</p>
                    <p className="text-[11px] tabular-nums text-ink-3">{fullTime(e.occurred_at)}</p>
                    {eventDetail(e) && <p className="mt-0.5 break-words text-[11px] text-ink-2">{eventDetail(e)}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={pageShell("wide")}>
      <Link href="/emails/log" className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Emails
      </Link>
      {children}
    </div>
  );
}

function MetaRow({
  label,
  value,
  sub,
  mono,
  alert,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  mono?: boolean;
  alert?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-rule/30 pb-1.5">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className={cn("min-w-0 text-right", mono && "break-all font-mono text-[10px]", alert ? "text-alert" : "text-ink-2")}>
        {value}
        {sub && <span className="block text-[10px] text-ink-3">{sub}</span>}
      </dd>
    </div>
  );
}

function eventDetail(e: EmailEventRow): string {
  const meta = (e.meta ?? {}) as Record<string, unknown>;
  if (e.event_type === "bounced") {
    const b = (meta.bounce ?? {}) as Record<string, unknown>;
    return [b.type, b.message].filter(Boolean).join(" · ");
  }
  if (e.event_type === "clicked") {
    const c = (meta.click ?? {}) as Record<string, unknown>;
    return typeof c.link === "string" ? c.link : "";
  }
  if (e.event_type === "opened") {
    const o = (meta.open ?? {}) as Record<string, unknown>;
    return typeof o.userAgent === "string" ? o.userAgent : "";
  }
  return "";
}

function fullTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
