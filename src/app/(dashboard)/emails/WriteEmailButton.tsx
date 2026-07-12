"use client";

import { useState, useTransition } from "react";
import { Plus, Smartphone, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createDraftEmail } from "./campaigns/actions";
import { createDraftWaitlistEmail } from "./waitlist/actions";

/**
 * "Write an email" → first pick who it's for (app members or the waitlist), then
 * you drop straight into the composer. The one entry point for every email.
 */
export function WriteEmailButton({ label = "Write an email", variant = "primary" }: { label?: string; variant?: "primary" | "outline" }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function choose(kind: "app" | "waitlist") {
    if (pending) return;
    startTransition(async () => {
      const r = kind === "app" ? await createDraftEmail() : await createDraftWaitlistEmail();
      if (r && !r.ok) toast.error(r.message);
      // success redirects into the composer
    });
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant={variant === "outline" ? "outline" : "default"}
        className={cn(variant === "primary" && "bg-brand text-brand-fg hover:bg-brand-deep")}
      >
        <Plus className="size-4" /> {label}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !pending && setOpen(false)}>
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-paper-raised p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-ink">Who&apos;s this email for?</h3>
              <button onClick={() => setOpen(false)} className="text-ink-3 hover:text-ink" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ChoiceCard
                icon={<Smartphone className="size-5" />}
                title="App members"
                detail="People using Vestige"
                onClick={() => choose("app")}
                disabled={pending}
              />
              <ChoiceCard
                icon={<Users className="size-5" />}
                title="Waitlist"
                detail="People waiting for launch"
                onClick={() => choose("waitlist")}
                disabled={pending}
              />
            </div>
            <p className="text-xs text-ink-3">You can narrow it down to specific people once you’re writing.</p>
          </div>
        </div>
      )}
    </>
  );
}

function ChoiceCard({ icon, title, detail, onClick, disabled }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-start gap-2 rounded-xl border border-rule/60 bg-paper-sunken/30 p-4 text-left transition-colors hover:border-brand/50 hover:bg-brand/[0.04] disabled:opacity-50"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-brand/10 text-brand">{icon}</span>
      <span className="text-sm font-semibold text-ink">{title}</span>
      <span className="text-xs text-ink-3">{detail}</span>
    </button>
  );
}
