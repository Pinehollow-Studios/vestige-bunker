"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCampaign } from "./actions";

/**
 * Create-campaign trigger. Tap → inline name prompt → creates a draft row and
 * the action redirects into the editor (compose + targeting + send/schedule).
 */
export function NewCampaignButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim() || pending) return;
    const value = name.trim();
    startTransition(async () => {
      const result = await createCampaign(value);
      if (!result.ok) toast.error(result.message);
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" className="bg-brand text-brand-fg hover:bg-brand-deep">
        + New campaign
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        placeholder="Internal name — e.g. July course drop"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setOpen(false);
            setName("");
          }
        }}
        className="h-9 w-72"
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
