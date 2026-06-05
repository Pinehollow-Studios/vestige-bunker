"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBadge } from "./actions";

/**
 * Create-badge trigger. Tap → inline name prompt → creates a draft row and
 * the action redirects into the editor (where the visual + criteria live).
 */
export function NewBadgeButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim() || pending) return;
    const value = name.trim();
    startTransition(async () => {
      const result = await createBadge(value);
      if (!result.ok) toast.error(result.message);
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" className="bg-brand text-brand-fg hover:bg-brand-deep">
        + New badge
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        placeholder="Centurion"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setOpen(false); setName(""); }
        }}
        className="h-9 w-56"
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
      <Button onClick={() => { setOpen(false); setName(""); }} size="sm" variant="ghost" disabled={pending}>
        Cancel
      </Button>
    </div>
  );
}
