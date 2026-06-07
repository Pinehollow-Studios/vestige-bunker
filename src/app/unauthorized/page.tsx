import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BrandMark } from "@/components/admin/Sidebar";
import { cn } from "@/lib/utils";

export default function UnauthorizedPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 55%)," +
            "radial-gradient(circle at 50% 100%, color-mix(in oklab, var(--alert) 8%, transparent) 0%, transparent 55%)",
        }}
      />
      <div className="relative w-full max-w-md space-y-6 rounded-3xl border border-border bg-paper-raised p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <BrandMark className="size-10" />
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-alert/10 text-alert"
          >
            <ShieldAlert className="size-6" />
          </span>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-alert">
            Access denied
          </p>
          <h1 className="display-serif text-2xl font-semibold leading-tight text-ink">
            Not an admin
          </h1>
          <p className="text-sm text-ink-2">
            Your account isn&rsquo;t in the{" "}
            <span className="font-semibold">admins</span> table. Ask Tom or
            Jack to grant access.
          </p>
        </div>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-10 w-full justify-center",
          )}
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
