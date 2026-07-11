import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";

/**
 * Dashboard-wide 404. A calm dead-end that points back into the tool rather
 * than a bare Next.js default.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Compass className="size-6" />
      </span>
      <div className="space-y-1.5">
        <h1 className="font-display text-xl font-semibold text-ink">Page not found</h1>
        <p className="text-sm text-ink-2">
          That screen doesn’t exist. Try the command palette (<kbd className="kbd">⌘K</kbd>) or head
          back to the overview.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-paper-sunken/60 px-3 py-2 text-sm text-ink-2 transition-colors hover:border-rule-strong hover:text-ink"
      >
        Back to overview <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
