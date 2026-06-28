"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  Award, BadgeCheck, Bookmark, Camera, CheckCircle2, Flag, Mail, MapPin,
  MessageCircle, ShieldAlert, Swords, Tag, ThumbsUp, Trophy, UserPlus, Users,
  Wrench, X, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveNotificationTemplate, type NotificationTemplateRow } from "./actions";
import { previewTemplate, TEMPLATE_KINDS, type TemplateKindMeta } from "./templates-meta";
import { IOSNotification, VestigeInboxRow } from "./_components/previews";

const ICONS: Record<string, ReactNode> = {
  friend_request_received: <UserPlus className="size-4" />,
  friend_request_accepted: <Users className="size-4" />,
  friend_reacted_to_round: <ThumbsUp className="size-4" />,
  round_commented: <MessageCircle className="size-4" />,
  partner_tagged: <Tag className="size-4" />,
  partner_claimed_your_round: <Flag className="size-4" />,
  badge_earned: <Award className="size-4" />,
  your_list_verified: <BadgeCheck className="size-4" />,
  community_list_updated: <Bookmark className="size-4" />,
  course_photo_approved: <Camera className="size-4" />,
  course_photo_rejected: <Camera className="size-4" />,
  county_courses_added: <MapPin className="size-4" />,
  feedback_in_progress: <Wrench className="size-4" />,
  feedback_message_posted: <Mail className="size-4" />,
  feedback_resolved: <CheckCircle2 className="size-4" />,
  admin_outreach_received: <Mail className="size-4" />,
  account_status_changed: <ShieldAlert className="size-4" />,
  society_invite_received: <Users className="size-4" />,
  society_challenge_received: <Swords className="size-4" />,
  society_format_finished: <Trophy className="size-4" />,
};

type ResolvedCopy = { pushTitle: string; pushBody: string; inboxTitle: string; inboxBody: string };

function resolved(meta: TemplateKindMeta, o?: NotificationTemplateRow): ResolvedCopy {
  return {
    pushTitle: previewTemplate(o?.push_title || meta.defaults.pushTitle, meta.tokens),
    pushBody: previewTemplate(o?.push_body || meta.defaults.pushBody, meta.tokens),
    inboxTitle: o?.inbox_title || meta.defaults.inboxTitle,
    inboxBody: o?.inbox_body || meta.defaults.inboxBody,
  };
}

export function SystemNotificationsSection({ overrides }: { overrides: Record<string, NotificationTemplateRow> }) {
  const [editing, setEditing] = useState<TemplateKindMeta | null>(null);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-rule/70 bg-paper-sunken/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-2">
          <Zap className="size-3" /> Automatic
        </span>
        <h2 className="font-display text-lg font-semibold text-ink">Sent by Vestige</h2>
        <span className="text-sm text-ink-3">- the wording of every automatic notification</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TEMPLATE_KINDS.map((meta) => {
          const o = overrides[meta.kind];
          const edited = Boolean(o?.updated_by);
          const copy = resolved(meta, o);
          return (
            <button
              key={meta.kind}
              type="button"
              onClick={() => setEditing(meta)}
              className="group flex flex-col gap-2.5 rounded-2xl glass-panel p-3 text-left transition-colors hover:border-brand/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{meta.label}</span>
                {edited && (
                  <span className="shrink-0 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                    Edited
                  </span>
                )}
              </div>
              <IOSNotification title={copy.pushTitle} body={copy.pushBody} />
            </button>
          );
        })}
      </div>

      {editing && (
        <KindEditorModal
          meta={editing}
          override={overrides[editing.kind]}
          icon={ICONS[editing.kind]}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function KindEditorModal({
  meta,
  override,
  icon,
  onClose,
}: {
  meta: TemplateKindMeta;
  override?: NotificationTemplateRow;
  icon?: ReactNode;
  onClose: () => void;
}) {
  // Pre-fill with the real copy (the saved override, else the built-in default)
  // so opening an entry shows its actual editable text, not an empty box.
  const [pushTitle, setPushTitle] = useState(override?.push_title ?? meta.defaults.pushTitle);
  const [pushBody, setPushBody] = useState(override?.push_body ?? meta.defaults.pushBody);
  const [inboxTitle, setInboxTitle] = useState(override?.inbox_title ?? meta.defaults.inboxTitle);
  const [inboxBody, setInboxBody] = useState(override?.inbox_body ?? meta.defaults.inboxBody);
  const [active, setActive] = useState<"pushTitle" | "pushBody" | "inboxTitle" | "inboxBody">("pushTitle");
  const [pending, start] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const setters = { pushTitle: setPushTitle, pushBody: setPushBody, inboxTitle: setInboxTitle, inboxBody: setInboxBody };
  const values = { pushTitle, pushBody, inboxTitle, inboxBody };
  const overridden = Boolean(override?.updated_by);

  function insertToken(tok: string) {
    const cur = values[active];
    setters[active](cur ? `${cur} {${tok}}` : `{${tok}}`);
  }
  function save() {
    // Store the full copy so the entry stays complete; `updated_by` (set by the
    // RPC) is what marks it as customised.
    start(async () => {
      const r = await saveNotificationTemplate(meta.kind, pushTitle, pushBody, inboxTitle, inboxBody, false);
      if (!r.ok) toast.error(r.message);
      else { toast.success(`Saved · ${r.data ?? 0} past notification${r.data === 1 ? "" : "s"} updated`); onClose(); }
    });
  }
  function reset() {
    const d = meta.defaults;
    start(async () => {
      // Restore the default copy + clear the customised flag (is_default).
      const r = await saveNotificationTemplate(meta.kind, d.pushTitle, d.pushBody, d.inboxTitle, d.inboxBody, true);
      if (!r.ok) toast.error(r.message);
      else { toast.success("Reset to default"); onClose(); }
    });
  }

  // Live preview copy (override draft falls back to the default per field).
  const pTitle = previewTemplate(pushTitle || meta.defaults.pushTitle, meta.tokens);
  const pBody = previewTemplate(pushBody || meta.defaults.pushBody, meta.tokens);
  const iTitle = previewTemplate(inboxTitle || meta.defaults.inboxTitle, meta.tokens);
  const iBody = previewTemplate(inboxBody || meta.defaults.inboxBody, meta.tokens);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-rule/60 bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-rule/50 px-5 py-3.5">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand/15 text-brand">{icon}</span>
            {meta.label}
          </span>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-3 transition-colors hover:text-ink">
            <X className="size-4" />
          </button>
        </header>

        <div className="grid max-h-[78vh] grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-[260px_1fr]">
          {/* Live previews */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">On the lock screen</p>
              <IOSNotification title={pTitle} body={pBody} />
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">In the app</p>
              <VestigeInboxRow title={iTitle} body={iBody} icon={icon} />
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            {meta.tokens.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ink-3">Insert:</span>
                {meta.tokens.map((t) => (
                  <button
                    key={t.token}
                    type="button"
                    onClick={() => insertToken(t.token)}
                    title={t.desc}
                    className="rounded-full border border-rule/70 bg-paper-sunken/60 px-2 py-0.5 font-mono text-[11px] text-ink-2 transition hover:border-brand/40 hover:text-brand"
                  >
                    {`{${t.token}}`}
                  </button>
                ))}
              </div>
            )}

            <Block label="Lock-screen push">
              <Field label="Title" value={pushTitle} placeholder={meta.defaults.pushTitle} onChange={setPushTitle} onFocus={() => setActive("pushTitle")} />
              <Field label="Body" value={pushBody} placeholder={meta.defaults.pushBody} onChange={setPushBody} onFocus={() => setActive("pushBody")} />
            </Block>
            <Block label="In-app inbox">
              <Field label="Headline (supports *bold*)" value={inboxTitle} placeholder={meta.defaults.inboxTitle} onChange={setInboxTitle} onFocus={() => setActive("inboxTitle")} />
              <Field label="Subline (optional)" value={inboxBody} placeholder={meta.defaults.inboxBody || "-"} onChange={setInboxBody} onFocus={() => setActive("inboxBody")} />
            </Block>

            <p className="text-xs text-ink-3">Leave a field blank to keep the built-in default. Saving also updates the in-app copy of past notifications of this kind.</p>

            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={pending} size="sm" className="bg-brand text-brand-fg hover:bg-brand-deep">
                {pending ? "Saving…" : "Save"}
              </Button>
              {overridden && (
                <Button onClick={reset} disabled={pending} size="sm" variant="ghost" className="text-ink-2">
                  Reset to default
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-rule/60 bg-paper-sunken/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      {children}
    </div>
  );
}

function Field({
  label, value, placeholder, onChange, onFocus,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (s: string) => void;
  onFocus: () => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} />
    </div>
  );
}
