import { EyeOff } from "lucide-react";

/**
 * Inline notice for admin surfaces whose feature is shelved from the live iOS
 * build — hidden behind an `AppConfig.*Enabled = false` flag (see the app's
 * `docs/beta-1-scope-shelving.md`). The data + tooling here stay live for
 * inspection; this just makes it clear nothing on the page is user-facing yet.
 */
export function ShelvedNotice({ feature }: { feature: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-paper-raised/50 p-4 text-sm">
      <EyeOff className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
      <div className="space-y-0.5">
        <p className="font-semibold text-ink-2">Shelved from the live build</p>
        <p className="text-ink-3">
          {feature} is hidden in the current beta app. Data and tooling here stay live for
          inspection, but nothing on this page is reachable by users yet.
        </p>
      </div>
    </div>
  );
}
