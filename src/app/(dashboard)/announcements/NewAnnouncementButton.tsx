"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAnnouncement } from "./actions";

/**
 * Create-announcement trigger. Tap → inline title prompt → creates a draft row
 * and the action redirects into the editor (where content + targeting +
 * lifecycle live). Mirrors NewBadgeButton.
 */
export function NewAnnouncementButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!title.trim() || pending) return;
    const value = title.trim();
    startTransition(async () => {
      const result = await createAnnouncement(value);
      if (!result.ok) toast.error(result.message);
    });
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="bg-brand text-brand-fg hover:bg-brand-deep"
      >
        + New announcement
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        placeholder="What's new in 0.1.1"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        className="h-9 w-64"
        disabled={pending}
      />
      <Button
        onClick={submit}
        size="sm"
        disabled={pending || !title.trim()}
        className="bg-brand text-brand-fg hover:bg-brand-deep"
      >
        {pending ? "Creating…" : "Create"}
      </Button>
      <Button
        onClick={() => {
          setOpen(false);
          setTitle("");
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
