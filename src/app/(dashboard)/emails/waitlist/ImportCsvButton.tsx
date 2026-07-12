"use client";

import { useState, useTransition } from "react";
import { FileUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importWaitlistCsv, type ImportRow } from "./actions";

/**
 * Paste a Resend contacts CSV export (Contacts → Export) and import it into the
 * waitlist. The dependable route — no full-access Resend key needed. Detects the
 * header row and maps: email, first_name, last_name→source, unsubscribed.
 */
export function ImportCsvButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function run() {
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toast.error("Couldn’t find any email rows. Paste a CSV with an ‘email’ column.");
      return;
    }
    startTransition(async () => {
      const r = await importWaitlistCsv(rows);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(`Imported ${(r.data?.imported ?? 0).toLocaleString()} of ${rows.length.toLocaleString()} contacts.`);
      setText("");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline" size="sm">
        <FileUp className="size-4" /> Import CSV
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !pending && setOpen(false)}>
      <div
        className="w-full max-w-lg space-y-3 rounded-2xl border border-border bg-paper-raised p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-ink">Import contacts from a CSV</h3>
          <button onClick={() => setOpen(false)} className="text-ink-3 hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <p className="text-sm text-ink-2">
          In Resend, go to <strong className="font-medium text-ink">Contacts → Export</strong>, then paste the CSV
          here. We read the <code className="text-xs">email</code>, <code className="text-xs">first_name</code>, and{" "}
          <code className="text-xs">unsubscribed</code> columns.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          placeholder="email,first_name,last_name,unsubscribed&#10;alex@example.com,Alex,organic,false"
          className="h-48 w-full resize-y rounded-lg border border-input bg-paper-sunken/40 px-3 py-2 font-mono text-xs leading-relaxed placeholder:text-ink-3 focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
        />
        <div className="flex justify-end gap-2">
          <Button onClick={() => setOpen(false)} variant="ghost" size="sm" disabled={pending}>
            Cancel
          </Button>
          <Button onClick={run} size="sm" disabled={pending} className="bg-brand text-brand-fg hover:bg-brand-deep">
            {pending ? "Importing…" : "Import"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Minimal quote-aware CSV parse → import rows, keyed off the header row. */
function parseCsv(raw: string): ImportRow[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const hasHeader = header.includes("email");
  const emailIdx = hasHeader ? header.indexOf("email") : 0;
  const firstIdx = hasHeader ? header.indexOf("first_name") : -1;
  // Resend stashes acquisition source in last_name (see marketing/src/lib/resend.ts).
  const sourceIdx = hasHeader ? header.indexOf("last_name") : -1;
  const unsubIdx = hasHeader ? header.indexOf("unsubscribed") : -1;

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const out: ImportRow[] = [];
  for (const line of dataLines) {
    const cols = splitCsvLine(line);
    const email = (cols[emailIdx] ?? "").trim();
    if (!email.includes("@")) continue;
    out.push({
      email,
      first_name: firstIdx >= 0 ? (cols[firstIdx] ?? "").trim() || null : null,
      source: sourceIdx >= 0 ? (cols[sourceIdx] ?? "").trim() || null : null,
      unsubscribed: unsubIdx >= 0 ? /^(true|1|yes)$/i.test((cols[unsubIdx] ?? "").trim()) : false,
    });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
