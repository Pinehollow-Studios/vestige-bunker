import Link from "next/link";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { listAdminOwners } from "@/lib/feedback/owners";
import { activeStorageBaseUrl } from "@/lib/supabase/admin";
import {
  FEEDBACK_PAGE_SIZE,
  fetchFeedbackQueue,
  parseFeedbackFilters,
} from "@/lib/feedback/queue";
import type { ShipVersionOption } from "./[id]/ShipInVersionControl";
import { QueueFilters } from "./QueueFilters";
import { FeedbackInbox } from "./FeedbackInbox";

export const dynamic = "force-dynamic";

type SearchParamArray = string | string[] | undefined;
type QueueView = "active" | "done" | "all";

/** Build a URLSearchParams from Next's plain searchParams object. */
function toURLSearchParams(params: Record<string, SearchParamArray>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) for (const v of value) out.append(key, v);
    else if (typeof value === "string" && value.length > 0) out.set(key, value);
  }
  return out;
}

export default async function FeedbackQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamArray>>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const supabase = await createClient();

  const usp = toURLSearchParams(params);
  const filters = parseFeedbackFilters(usp);
  const selectedId =
    typeof params.selected === "string"
      ? params.selected
      : Array.isArray(params.selected)
        ? params.selected[0]
        : null;

  const [queue, owners, draftVersionsRes, storageBaseUrl] = await Promise.all([
    fetchFeedbackQueue(supabase, filters),
    listAdminOwners(),
    supabase
      .from("app_versions")
      .select("id, version, title")
      .eq("status", "draft")
      .order("major", { ascending: false })
      .order("minor", { ascending: false })
      .order("patch", { ascending: false }),
    activeStorageBaseUrl(),
  ]);

  const draftVersions = (draftVersionsRes.data as ShipVersionOption[] | null) ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:h-[calc(100dvh-8rem)] lg:overflow-hidden">
      <SectionHeader eyebrow="Queues · review" title="Feedback" />

      <ViewTabs view={filters.view} params={params} />
      <QueueFilters initialSearch={filters.query} owners={owners} />

      {queue.error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load queue: {queue.error}
        </div>
      ) : (
        <FeedbackInbox
          rows={queue.rows}
          shipped={queue.shippedByReport}
          hasMore={queue.hasMore}
          initialSelectedId={selectedId}
          owners={owners}
          currentAdminId={admin.id}
          isSuperAdmin={admin.role === "super_admin"}
          draftVersions={draftVersions}
          storageBaseUrl={storageBaseUrl}
          pageSize={FEEDBACK_PAGE_SIZE}
        />
      )}
    </div>
  );
}

// ── View tabs — Active / Done / All partition over the queue ───────────
function ViewTabs({
  view,
  params,
}: {
  view: QueueView;
  params: Record<string, SearchParamArray>;
}) {
  const tabs: { key: QueueView; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "done", label: "Done" },
    { key: "all", label: "All" },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-xl glass-panel p-1 text-xs">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={viewURL(params, tab.key)}
          className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${
            tab.key === view ? "bg-brand/15 text-brand" : "text-ink-3 hover:text-ink-2"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function viewURL(params: Record<string, SearchParamArray>, view: QueueView): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "offset" || key === "view" || key === "workStage" || key === "selected") continue;
    if (Array.isArray(value)) for (const v of value) next.append(key, v);
    else if (typeof value === "string" && value.length > 0) next.set(key, value);
  }
  if (view !== "active") next.set("view", view);
  const q = next.toString();
  return q ? `/feedback?${q}` : "/feedback";
}
