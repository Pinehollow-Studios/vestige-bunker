import { pageShell } from "@/components/admin/PageShell";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { listPickerUsers } from "@/lib/users/roster";
import type { CountyOption } from "@/app/(dashboard)/notifications/types";
import { FlagsBoard } from "./FlagsBoard";
import type { FlagRow } from "./types";

export const dynamic = "force-dynamic";

/**
 * Feature flags & remote config (Vestige-ios docs/admin-growth-tooling-roadmap.md
 * Phase 1.1). Flip a feature, roll it out gradually, target a cohort, or tune a
 * config value WITHOUT an app release. Reads/writes go through the service-role
 * client (the `feature_flags` table is is_admin-only), gated by the layout's
 * `requireAdmin()`. Targeting reuses the shared broadcast AudiencePicker.
 */
export default async function FlagsPage() {
  const supabase = await tryCreateServiceClient();

  if (!supabase) {
    return (
      <div className={pageShell("wide")}>
        <SectionHeader eyebrow="Operations" title="Feature flags" />
        <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-ink-2">
          Needs the service-role key for the active environment to read/write flags.
        </div>
      </div>
    );
  }

  const [flagsRes, countiesRes, targetsRes, allUsers] = await Promise.all([
    supabase.rpc("admin_feature_flags_overview"),
    supabase.from("counties").select("id, name").order("name"),
    supabase.from("feature_flag_targets").select("flag_key, user_id"),
    listPickerUsers(),
  ]);

  const targetsByFlag: Record<string, string[]> = {};
  for (const t of (targetsRes.data ?? []) as { flag_key: string; user_id: string }[]) {
    (targetsByFlag[t.flag_key] ??= []).push(t.user_id);
  }

  return (
    <div className={pageShell("wide")}>
      <SectionHeader eyebrow="Operations" title="Feature flags" />
      <FlagsBoard
        flags={(flagsRes.data ?? []) as FlagRow[]}
        counties={(countiesRes.data ?? []) as CountyOption[]}
        allUsers={allUsers}
        targetsByFlag={targetsByFlag}
      />
    </div>
  );
}
