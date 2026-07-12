"use client";

import { useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSegment } from "./actions";

export function NewSegmentButton({ label = "New segment", variant = "primary" }: { label?: string; variant?: "primary" | "outline" }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      onClick={() => startTransition(async () => {
        const r = await createSegment();
        if (r && !r.ok) toast.error(r.message);
      })}
      disabled={pending}
      variant={variant === "outline" ? "outline" : "default"}
      className={cn(variant === "primary" && "bg-brand text-brand-fg hover:bg-brand-deep")}
    >
      <Plus className="size-4" /> {pending ? "Creating…" : label}
    </Button>
  );
}
