"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { saveEmailTemplate, type EmailTemplateRow } from "./actions";

/** Sample values so the live preview renders realistically as Jack edits. */
const SAMPLE: Record<string, string> = {
  first_name: "Tom",
  confirmation_url: "https://vestige.golf/confirm/sample-link",
  token: "394285",
  new_email: "new@example.com",
  email: "you@example.com",
};

/**
 * Whether each email is actually being sent to members right now, and a plain
 * explanation of what makes it send. `live: false` means the design is saved and
 * ready, but the email only starts sending if we switch that feature on — so
 * editing it changes nothing until then. (This is a product fact, not stored in
 * the database, so it lives here in the editor.)
 */
const STATUS: Record<string, { live: boolean; summary: string }> = {
  welcome: {
    live: true,
    summary: "Sending now — every new member gets this when they finish signing up.",
  },
  password_reset: {
    live: true,
    summary: "Sending now — goes out when a member taps “Forgot password?”.",
  },
  confirm_signup: {
    live: false,
    summary:
      "Not sending — this only turns on if we ask new members to confirm their email at signup. It’s off for now.",
  },
  magic_link: {
    live: false,
    summary:
      "Not sending — the app signs people in with a password or Apple/Google, not a magic link. Ready here if we ever add it.",
  },
  email_change: {
    live: false,
    summary:
      "Not sending yet — this will go out once members can change their email address in the app.",
  },
  reauthentication: {
    live: false,
    summary:
      "Not sending — only used if we add a step that double-checks it’s really you. Ready if we do.",
  },
  invite: {
    live: false,
    summary: "Not sending — there’s no invite flow in the app yet. Ready if we add one.",
  },
};

function statusOf(key: string) {
  return STATUS[key] ?? { live: false, summary: "Not sending yet." };
}

/** Substitute {{token}} placeholders, then strip any unresolved ones. Mirrors
 * the render() in the Edge Functions so the preview matches what sends. */
function render(template: string, tokens: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(tokens)) {
    out = out.split(`{{${key}}}`).join(value ?? "");
  }
  return out.replace(/\{\{[a-zA-Z_]+\}\}/g, "");
}

function StatusPill({ live, size = "md" }: { live: boolean; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        live
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
          : "border-border bg-surface-2 text-ink-3",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          live ? "bg-emerald-500" : "bg-ink-3/50",
        )}
      />
      {live ? "Sending now" : "Not sending"}
    </span>
  );
}

export function EmailsSection({ templates }: { templates: EmailTemplateRow[] }) {
  const [selectedKey, setSelectedKey] = useState(templates[0]?.key ?? "");
  // Local edit buffers keyed by template key, seeded from the server rows.
  const [edits, setEdits] = useState<Record<string, { subject: string; html: string }>>(
    () => Object.fromEntries(templates.map((t) => [t.key, { subject: t.subject, html: t.html }])),
  );
  const [pending, startTransition] = useTransition();

  const selected = templates.find((t) => t.key === selectedKey);
  const buffer = useMemo(
    () => edits[selectedKey] ?? { subject: "", html: "" },
    [edits, selectedKey],
  );

  const dirty = useMemo(() => {
    if (!selected) return false;
    return buffer.subject !== selected.subject || buffer.html !== selected.html;
  }, [selected, buffer]);

  const previewHtml = useMemo(() => render(buffer.html, SAMPLE), [buffer.html]);

  function update(key: string, patch: Partial<{ subject: string; html: string }>) {
    setEdits((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function onSave() {
    if (!selected || !dirty) return;
    startTransition(async () => {
      const res = await saveEmailTemplate(selectedKey, buffer.subject, buffer.html);
      if (res.ok) {
        // Re-baseline so the dirty flag clears without a full reload.
        selected.subject = buffer.subject;
        selected.html = buffer.html;
        toast.success(`${selected.name} saved — live on the next email.`);
      } else {
        toast.error(res.message);
      }
    });
  }

  if (!selected) return null;
  const status = statusOf(selected.key);

  return (
    <div className="space-y-5">
      {/* What's actually sending vs. ready-and-waiting. */}
      <div className="rounded-xl border border-border bg-surface-1 p-4 text-sm text-ink-2">
        <p>
          <strong className="font-medium text-ink">Two emails are sending to members right now</strong>{" "}
          — <em>Welcome</em> and <em>Password reset</em> (marked{" "}
          <span className="text-emerald-600">Sending now</span>). The rest are ready-made designs
          that only start sending if we switch that feature on — you can still edit and preview them
          so they’re good to go. Each email’s status is shown when you open it.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Email list */}
        <nav className="space-y-1">
          {templates.map((t) => {
            const st = statusOf(t.key);
            const isDirty =
              edits[t.key] &&
              (edits[t.key].subject !== t.subject || edits[t.key].html !== t.html);
            return (
              <button
                key={t.key}
                onClick={() => setSelectedKey(t.key)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  t.key === selectedKey
                    ? "border-brand/40 bg-brand/10 text-ink"
                    : "border-transparent text-ink-2 hover:bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    st.live ? "bg-emerald-500" : "bg-ink-3/30",
                  )}
                  title={st.live ? "Sending now" : "Not sending"}
                />
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                {isDirty && <span className="size-1.5 shrink-0 rounded-full bg-brand" />}
              </button>
            );
          })}
        </nav>

        {/* Editor + preview */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-medium text-ink">{selected.name}</h2>
                <StatusPill live={status.live} />
              </div>
              <p className="text-sm text-ink-3">{status.summary}</p>
            </div>
            <Button onClick={onSave} disabled={!dirty || pending}>
              {pending ? "Saving…" : dirty ? "Save" : <><Check className="size-4" /> Saved</>}
            </Button>
          </div>

          {!status.live && (
            <div className="rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-xs text-ink-3">
              This email isn’t being sent to members yet. Editing it is safe — the design is saved
              and ready, and it only starts sending if we turn this feature on.
            </div>
          )}

          {selected.available_tokens.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs text-ink-3">
              <Info className="size-3.5" />
              <span>Placeholders (filled in automatically when the email sends):</span>
              {selected.available_tokens.map((tok) => (
                <code
                  key={tok}
                  className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2"
                >{`{{${tok}}}`}</code>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={buffer.subject}
              onChange={(e) => update(selectedKey, { subject: e.target.value })}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email-html">HTML</Label>
              <textarea
                id="email-html"
                value={buffer.html}
                onChange={(e) => update(selectedKey, { html: e.target.value })}
                spellCheck={false}
                className="h-[440px] w-full resize-y rounded-lg border border-border bg-surface-1 p-3 font-mono text-xs leading-relaxed text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Preview</Label>
              <div className="h-[440px] overflow-hidden rounded-lg border border-border bg-white">
                <iframe
                  title="Email preview"
                  sandbox=""
                  srcDoc={previewHtml}
                  className="h-full w-full border-0"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-ink-3">
            The preview fills placeholders with sample values. Saving takes effect on the next email
            — no deploy.
          </p>
        </div>
      </div>
    </div>
  );
}
