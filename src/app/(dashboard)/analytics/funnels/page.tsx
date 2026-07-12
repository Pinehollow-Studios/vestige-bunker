import { SectionHeader } from "@/components/admin/SectionHeader";
import { AnalyticsNav } from "@/components/admin/analytics/AnalyticsNav";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { FunnelBuilder } from "./FunnelBuilder";

export const dynamic = "force-dynamic";

/** Funnels — any ordered event sequence with a conversion window. */
export default async function FunnelsPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHeader eyebrow="Operations" title="Analytics" />
      <AnalyticsNav active="/analytics/funnels" />
      <FunnelBuilder />
    </div>
  );
}
