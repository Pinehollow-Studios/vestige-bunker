"use client";

import { useTransition } from "react";
import { Bell, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createDraftBroadcast } from "./actions";

/**
 * One-click "New notification" — creates a draft and drops you straight into the
 * editor. No title prompt: composing a push should be a single, obvious click.
 */
export function ComposeBroadcastButton({
  label = "New notification",
  variant = "primary",
  className,
}: {
  label?: string;
  variant?: "primary" | "outline";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function compose() {
    if (pending) return;
    startTransition(async () => {
      const result = await createDraftBroadcast();
      // A success redirects; only an error returns here.
      if (result && !result.ok) toast.error(result.message);
    });
  }

  return (
    <Button
      onClick={compose}
      disabled={pending}
      variant={variant === "outline" ? "outline" : "default"}
      className={cn(
        variant === "primary" && "bg-brand text-brand-fg hover:bg-brand-deep",
        className,
      )}
    >
      {variant === "primary" ? <Plus className="size-4" /> : <Bell className="size-4" />}
      {pending ? "Creating…" : label}
    </Button>
  );
}
