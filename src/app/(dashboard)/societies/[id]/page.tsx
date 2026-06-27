import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditor } from "./TemplateEditor";
import type {
  CuratedListOption,
  SocietyTemplateRow,
  TemplateCountyRow,
} from "../types";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ id: string }>;

export default async function TemplateEditorPage(props: { params: RouteParams }) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: template, error } = await supabase
    .from("society_templates")
    .select(
      "id,slug,name,kind,target_type,fixed_list_id,name_pattern,blurb,story_template,crest,cover_storage_key,default_duration_days,status,featured,sort_order,created_at,updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load template: {error.message}
        </div>
      </div>
    );
  }
  if (!template) notFound();

  const row = template as SocietyTemplateRow;

  // County workbench (only meaningful for county-target completion templates)
  // and the curated-list picker run in parallel.
  const [countyRes, listRes] = await Promise.all([
    row.kind === "completion" && row.target_type === "county"
      ? supabase.rpc("admin_template_counties", { p_template: id })
      : Promise.resolve({ data: null, error: null }),
    supabase.from("curated_lists").select("id,name").order("name"),
  ]);

  const counties = (countyRes.data as TemplateCountyRow[] | null) ?? [];
  const curatedLists: CuratedListOption[] = (listRes.data ?? []).map((l) => ({ id: l.id, name: l.name }));

  return <TemplateEditor row={row} counties={counties} curatedLists={curatedLists} />;
}
