"use client";

import { useTransition } from "react";
import { Mail, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createDraftWaitlistEmail } from "./actions";

/** One-click "New waitlist email" — creates a draft and opens the editor. */
export function WaitlistComposeButton({
  label = "New waitlist email",
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
      const result = await createDraftWaitlistEmail();
      if (result && !result.ok) toast.error(result.message);
    });
  }

  return (
    <Button
      onClick={compose}
      disabled={pending}
      variant={variant === "outline" ? "outline" : "default"}
      className={cn(variant === "primary" && "bg-brand text-brand-fg hover:bg-brand-deep", className)}
    >
      {variant === "primary" ? <Plus className="size-4" /> : <Mail className="size-4" />}
      {pending ? "Creating…" : label}
    </Button>
  );
}
