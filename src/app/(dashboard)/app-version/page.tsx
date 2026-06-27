import { SectionHeader } from "@/components/admin/SectionHeader";
import { tryCreateServiceClient } from "@/lib/supabase/admin";
import { AppVersionForm } from "./AppVersionForm";

export const dynamic = "force-dynamic";

/**
 * Minimum-version gate control (Vestige-ios CLAUDE.md §3.8.2). Sets the
 * hard floor / soft-nudge / update link the app reads at launch. Writes go
 * through the service-role client (the `app_version_config` table has no
 * authenticated policy), gated by the layout's `requireAdmin()`.
 *
 * Use sparingly: the expand/contract migration rule (§3.8.1) means the floor
 * should only be raised for a genuinely-breaking change or to kill a bad build.
 */
export default async function AppVersionPage() {
  const supabase = await tryCreateServiceClient();

  if (!supabase) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <SectionHeader eyebrow="Advanced · App version" title="App version gate" />
        <div className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-ink-2">
          Needs the service-role key for the active environment to read/write the gate config.
        </div>
      </div>
    );
  }

  const { data } = await supabase
    .from("app_version_config")
    .select("min_supported_version, recommended_version, update_url")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionHeader eyebrow="Advanced · App version" title="App version gate" />

      <AppVersionForm
        initial={{
          min: data?.min_supported_version ?? "0.0.0",
          recommended: data?.recommended_version ?? "",
          updateUrl: data?.update_url ?? "",
        }}
      />
    </div>
  );
}
