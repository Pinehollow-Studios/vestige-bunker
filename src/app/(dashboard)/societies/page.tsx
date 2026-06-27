import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { NewModeButton } from "./NewModeButton";
import { ModeCard } from "./ModeCard";
import type { SocietyModeRow } from "./types";

export const dynamic = "force-dynamic";

export default async function SocietyModesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("society_modes")
    .select("id,key,name,tagline,description,glyph,color,enabled,sort_order,who_can_start,config,created_at,updated_at")
    .order("sort_order", { ascending: true });

  const modes = (data as SocietyModeRow[] | null) ?? [];
  const enabledCount = modes.filter((m) => m.enabled).length;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <SectionHeader eyebrow="Editorial" title="Society modes" actions={<NewModeButton />} />

      {error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load: {error.message}
        </div>
      ) : modes.length === 0 ? (
        <p className="rounded-xl glass-panel p-6 text-center text-sm text-ink-3">
          No modes yet. Add one to get started.
        </p>
      ) : (
        <>
          <p className="text-xs text-ink-3">
            <span className="font-semibold tabular-nums text-ink">{enabledCount}</span> of {modes.length} enabled
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {modes.map((m) => (
              <ModeCard key={m.id} mode={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
