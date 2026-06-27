"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTemplate } from "./actions";

/**
 * Create-template trigger. Tap "New template" → inline name prompt →
 * the action inserts a draft `society_templates` row and redirects into
 * the editor (where mechanic, target, copy + county theming are set).
 */
export function NewTemplateButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim() || pending) return;
    const value = name.trim();
    startTransition(async () => {
      const result = await createTemplate(value);
      if (!result.ok) toast.error(result.message);
      // On success the action redirects.
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" className="bg-brand text-brand-fg hover:bg-brand-deep">
        + New template
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        placeholder="County chasers"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setOpen(false);
            setName("");
          }
        }}
        className="h-9 w-64"
        disabled={pending}
      />
      <Button
        onClick={submit}
        size="sm"
        disabled={pending || !name.trim()}
        className="bg-brand text-brand-fg hover:bg-brand-deep"
      >
        {pending ? "Creating…" : "Create"}
      </Button>
      <Button
        onClick={() => {
          setOpen(false);
          setName("");
        }}
        size="sm"
        variant="ghost"
        disabled={pending}
      >
        Cancel
      </Button>
    </div>
  );
}
