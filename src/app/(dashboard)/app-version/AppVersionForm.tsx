"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setAppVersionConfig } from "./actions";

type Initial = { min: string; recommended: string; updateUrl: string };

export function AppVersionForm({ initial }: { initial: Initial }) {
  const [min, setMin] = useState(initial.min);
  const [recommended, setRecommended] = useState(initial.recommended);
  const [updateUrl, setUpdateUrl] = useState(initial.updateUrl);
  const [pending, startTransition] = useTransition();

  const dirty =
    min !== initial.min || recommended !== initial.recommended || updateUrl !== initial.updateUrl;

  function save() {
    startTransition(async () => {
      const result = await setAppVersionConfig(min, recommended || null, updateUrl || null);
      if (result.ok) toast.success("Saved — applies on next app launch");
      else toast.error(result.message);
    });
  }

  return (
    <div className="space-y-4 rounded-xl glass-panel p-5">
      <Field
        label="Minimum supported version"
        hint="Hard floor. Apps below this hit a blocking “update required” wall. Keep at 0.0.0 to gate nobody."
        value={min}
        onChange={setMin}
        placeholder="0.0.0"
      />
      <Field
        label="Recommended version"
        hint="Soft nudge. Apps below this (but at/above the floor) see a dismissible “update available” banner. Leave blank for none."
        value={recommended}
        onChange={setRecommended}
        placeholder="(none)"
      />
      <Field
        label="Update link"
        hint="Where both “Update” buttons point — the TestFlight or App Store URL. Leave blank to fall back to the App Store app."
        value={updateUrl}
        onChange={setUpdateUrl}
        placeholder="https://…"
      />
      <div className="flex justify-end pt-1">
        <Button onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-2">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-rule/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
      />
    </label>
  );
}
