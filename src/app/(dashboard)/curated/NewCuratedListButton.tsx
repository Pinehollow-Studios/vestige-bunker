"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCuratedList } from "./actions";

/**
 * Client-side trigger for the create-curated-list flow.
 *
 * Two-step: tap "New curated list" → small inline form prompts
 * for the name → submit creates the row in Supabase and the
 * action redirects into the editor. Kept inline (not a separate
 * dialog) because the only required field at create-time is the
 * name; everything else is editable on the next page.
 */
export function NewCuratedListButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim() || pending) return;
    const value = name.trim();
    startTransition(async () => {
      const result = await createCuratedList(value);
      if (!result.ok) {
        toast.error(result.message);
      }
      // On success the action redirects - no further UI work.
    });
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="bg-brand text-brand-fg hover:bg-brand-deep"
      >
        + New curated list
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        placeholder="Top 100 England"
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
