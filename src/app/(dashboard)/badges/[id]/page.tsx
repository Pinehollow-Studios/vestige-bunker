import { pageShell } from "@/components/admin/PageShell";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/admin/fetch-all";
import { BadgeEditor } from "./BadgeEditor";
import type {
  BadgeDefinitionRow,
  CountyOption,
  CourseOption,
  CuratedListOption,
} from "../types";

export const dynamic = "force-dynamic";

export default async function BadgeEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("badge_definitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!row) notFound();

  // Picker data for the criteria builder.
  const [{ data: countyRows }, { data: listRows }, { data: courseRows }] = await Promise.all([
    supabase.from("counties").select("id,name").order("name"),
    supabase.from("curated_lists").select("id,name").order("name"),
    // Page past the 1000-row cap so every course is pickable for a
    // specific-course badge criterion (the dataset is already >1000).
    fetchAllRows<{ id: string; name: string; county_id: string | null }>((from, to) =>
      supabase.from("courses").select("id,name,county_id").order("name").order("id").range(from, to),
    ),
  ]);

  const counties: CountyOption[] = (countyRows ?? []).map((c) => ({ id: c.id, name: c.name }));
  const countyName: Record<string, string> = {};
  for (const c of counties) countyName[c.id] = c.name;

  const lists: CuratedListOption[] = (listRows ?? []).map((l) => ({ id: l.id, name: l.name }));
  const courses: CourseOption[] = (courseRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    county_name: c.county_id ? (countyName[c.county_id] ?? null) : null,
  }));

  return (
    <div className={pageShell("wide")}>
      <Link
        href="/badges"
        className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Badges
      </Link>
      <BadgeEditor
        row={row as BadgeDefinitionRow}
        counties={counties}
        lists={lists}
        courses={courses}
      />
    </div>
  );
}
