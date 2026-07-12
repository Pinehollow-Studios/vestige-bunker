import { SectionHeader } from "@/components/admin/SectionHeader";
import { AnalyticsNav } from "@/components/admin/analytics/AnalyticsNav";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { RetentionExplorer } from "./RetentionExplorer";

export const dynamic = "force-dynamic";

/** Retention — weekly signup cohorts, classic + unbounded curves, segment-filtered. */
export default async function RetentionPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader eyebrow="Operations" title="Analytics" />
      <AnalyticsNav active="/analytics/retention" />
      <RetentionExplorer />
    </div>
  );
}
