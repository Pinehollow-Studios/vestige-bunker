import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { pageShell } from "@/components/admin/PageShell";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { SegmentEditor, type CountyOption } from "../SegmentEditor";
import type { SegmentGroup } from "../fields";

export const dynamic = "force-dynamic";

export default async function SegmentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: row, error }, { data: countyRows }] = await Promise.all([
    supabase.from("segments").select("*").eq("id", id).maybeSingle(),
    supabase.from("counties").select("id,name").order("name"),
  ]);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">Failed to load: {error.message}</div>
      </div>
    );
  }
  if (!row) notFound();

  const counties: CountyOption[] = (countyRows ?? []).map((c) => ({ id: c.id as string, name: c.name as string }));
  const definition = (row.definition as SegmentGroup) ?? { op: "and", rules: [] };

  return (
    <div className={pageShell("wide")}>
      <Link href="/segments" className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
        <ArrowLeft className="size-4" /> Segments
      </Link>
      <SegmentEditor
        id={row.id as string}
        initialName={row.name as string}
        initialDescription={(row.description as string | null) ?? null}
        initialDefinition={definition}
        counties={counties}
      />
    </div>
  );
}
