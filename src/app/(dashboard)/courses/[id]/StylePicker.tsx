"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Style picker — free-text combobox backed by the live distinct
 * set of `courses.style` values (fetched server-side and passed in
 * as `suggestions`).
 *
 * The picker:
 *   • shows the suggestions filtered against the current input;
 *   • lets the user pick by clicking a chip or by typing a new
 *     value (including one that doesn't exist yet);
 *   • normalises Title Case on commit only — server-side
 *     `normaliseStyle` repeats the same rule defensively.
 */
export function StylePicker({
  value,
  onChange,
  suggestions,
  placeholder = "Heathland",
}: {
  value: string;
  onChange: (next: string) => void;
  suggestions: string[];
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return suggestions.slice(0, 10);
    const matches = suggestions.filter((entry) =>
      entry.toLowerCase().includes(query),
    );
    return matches.slice(0, 10);
  }, [suggestions, value]);

  return (
    <div className="space-y-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 100)}
        placeholder={placeholder}
      />
      {focused && filtered.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filtered.map((entry) => (
            <button
              key={entry}
              type="button"
              onMouseDown={(e) => {
                // mousedown fires before blur — pick the entry without
                // dropping the dropdown first.
                e.preventDefault();
                onChange(entry);
              }}
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs transition-colors",
                entry.toLowerCase() === value.trim().toLowerCase()
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "border-rule/70 bg-paper-sunken/60 text-ink-2 hover:border-brand/30 hover:bg-brand/5",
              )}
            >
              {entry}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
