import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CountyThemeEditor } from "./CountyThemeEditor";
import type { SocietyTemplateRow, TemplateCountyTheme } from "../../../types";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ id: string; countyId: string }>;

export default async function CountyThemePage(props: { params: RouteParams }) {
  const { id, countyId } = await props.params;
  const supabase = await createClient();

  const [templateRes, countyRes, courseCountRes, themeRes] = await Promise.all([
    supabase
      .from("society_templates")
      .select("id,slug,name,kind,target_type,fixed_list_id,name_pattern,blurb,story_template,crest,cover_storage_key,default_duration_days,status,featured,sort_order,created_at,updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("counties").select("id,name").eq("id", countyId).maybeSingle(),
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("county_id", countyId),
    supabase
      .from("society_template_counties")
      .select("template_id,county_id,status,name_override,story,crest,cover_storage_key,published_at")
      .eq("template_id", id)
      .eq("county_id", countyId)
      .maybeSingle(),
  ]);

  if (!templateRes.data || !countyRes.data) notFound();

  return (
    <CountyThemeEditor
      template={templateRes.data as SocietyTemplateRow}
      county={{ id: countyRes.data.id, name: countyRes.data.name, course_count: courseCountRes.count ?? 0 }}
      theme={(themeRes.data as TemplateCountyTheme | null) ?? null}
    />
  );
}
