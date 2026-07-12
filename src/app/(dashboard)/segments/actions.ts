"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import type { SegmentGroup } from "./fields";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; message: string };

export type SegmentOverviewRow = {
  id: string;
  name: string;
  description: string | null;
  definition: SegmentGroup;
  member_count: number | null;
  created_at: string;
  updated_at: string;
};

/** Live count for the definition currently being built (debounced in the UI). */
export async function previewSegmentCount(definition: SegmentGroup): Promise<ActionResult<number>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_segment_count", { p_definition: definition });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: (data as number) ?? 0 };
}

/** Create a fresh segment and open its editor. */
export async function createSegment(): Promise<ActionResult<string>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_upsert_segment", {
    p_id: null,
    p_name: "Untitled segment",
    p_description: null,
    p_definition: { op: "and", rules: [] },
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/segments");
  redirect(`/segments/${data as string}`);
}

export async function saveSegment(
  id: string,
  name: string,
  description: string | null,
  definition: SegmentGroup,
): Promise<ActionResult> {
  await requireAdmin();
  if (!name.trim()) return { ok: false, message: "Give the segment a name." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_upsert_segment", {
    p_id: id,
    p_name: name.trim(),
    p_description: description?.trim() || null,
    p_definition: definition,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/segments");
  revalidatePath(`/segments/${id}`);
  return { ok: true };
}

/** Lightweight segment list for the "apply a segment" control in message pickers. */
export async function listSegmentsForPicker(): Promise<ActionResult<{ id: string; name: string; member_count: number | null }[]>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_segments_overview");
  if (error) return { ok: false, message: error.message };
  const rows = (data as SegmentOverviewRow[] | null) ?? [];
  return { ok: true, data: rows.map((s) => ({ id: s.id, name: s.name, member_count: s.member_count })) };
}

/** Resolve a saved segment to the current set of matching member user-ids. */
export async function segmentMemberIds(id: string): Promise<ActionResult<string[]>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: seg, error: e1 } = await supabase.from("segments").select("definition").eq("id", id).maybeSingle();
  if (e1) return { ok: false, message: e1.message };
  if (!seg) return { ok: false, message: "Segment not found." };
  const { data, error } = await supabase.rpc("admin_segment_members", { p_definition: seg.definition, p_limit: 50000 });
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: (data as string[] | null) ?? [] };
}

export async function deleteSegment(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_segment", { p_id: id });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/segments");
  return { ok: true };
}
