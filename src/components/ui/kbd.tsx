import { cn } from "@/lib/utils";

/**
 * A keyboard-key chip. The canonical way to render a shortcut hint (mono,
 * hairline, tabular) — replaces scattered raw `<kbd className="kbd">`.
 */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("kbd", className)}>{children}</kbd>;
}

/** Render a chord like ["g", "f"] or ["⌘", "K"] as separate keys. */
export function KbdChord({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((k, i) => (
        <Kbd key={i}>{k}</Kbd>
      ))}
    </span>
  );
}
