import { SectionHeader } from "@/components/admin/SectionHeader";
import { AnalyticsNav } from "@/components/admin/analytics/AnalyticsNav";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { PathsExplorer } from "./PathsExplorer";

export const dynamic = "force-dynamic";

/** Paths — where sessions start, what follows any event, where they end. */
export default async function PathsPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader eyebrow="Operations" title="Analytics" />
      <AnalyticsNav active="/analytics/paths" />
      <PathsExplorer />
    </div>
  );
}
