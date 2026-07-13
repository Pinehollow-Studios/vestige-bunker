"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Resend-style content tabs for a single email — Preview (rendered in a
 * sandboxed iframe), HTML (source), and Raw (the message + event JSON). Tokens
 * are substituted the same way the send function does ({{first_name}} →
 * recipient, {{unsubscribe_url}} → a placeholder), then any leftover stripped.
 */

type Tab = "preview" | "html" | "raw";

export function EmailContentTabs({
  html,
  firstName,
  raw,
}: {
  html: string;
  firstName: string;
  raw: unknown;
}) {
  const [tab, setTab] = useState<Tab>("preview");
  const rendered = render(html, { first_name: firstName, unsubscribe_url: "#" });

  return (
    <section className="rounded-2xl border border-border bg-paper-raised/50 p-5">
      <div className="mb-3 flex items-center gap-1">
        {(["preview", "html", "raw"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors",
              tab === t ? "bg-brand/10 text-brand" : "text-ink-3 hover:text-ink",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "preview" &&
        (rendered.trim() ? (
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={rendered}
            className="h-[520px] w-full rounded-lg border border-rule/50 bg-white"
          />
        ) : (
          <p className="py-8 text-center text-sm text-ink-3">This email has no HTML body.</p>
        ))}

      {tab === "html" && (
        <pre className="max-h-[520px] overflow-auto rounded-lg border border-rule/50 bg-paper-sunken/40 p-3 text-[11px] leading-relaxed text-ink-2">
          {rendered || "(empty)"}
        </pre>
      )}

      {tab === "raw" && (
        <pre className="max-h-[520px] overflow-auto rounded-lg border border-rule/50 bg-paper-sunken/40 p-3 font-mono text-[11px] leading-relaxed text-ink-2">
          {JSON.stringify(raw, null, 2)}
        </pre>
      )}
    </section>
  );
}

function render(template: string, tokens: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(tokens)) out = out.split(`{{${k}}}`).join(v ?? "");
  return out.replace(/\{\{[a-zA-Z_]+\}\}/g, "");
}
