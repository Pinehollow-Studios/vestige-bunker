import { SectionHeader } from "@/components/admin/SectionHeader";
import { AnalyticsNav } from "@/components/admin/analytics/AnalyticsNav";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { EventExplorer } from "./EventExplorer";

export const dynamic = "force-dynamic";

/** Explore — any event over time, broken down by version / device / locale / source. */
export default async function ExplorePage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader eyebrow="Operations" title="Analytics" />
      <AnalyticsNav active="/analytics/explore" />
      <EventExplorer />
    </div>
  );
}
