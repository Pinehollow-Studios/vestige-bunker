"use server";

import { revalidatePath } from "next/cache";
import { createDevClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function approveList(listId: string): Promise<ActionResult> {
  const supabase = await createDevClient();
  const { error } = await supabase.rpc("admin_approve_user_list", {
    list_id: listId,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/lists");
  return { ok: true };
}

export async function rejectList(listId: string): Promise<ActionResult> {
  const supabase = await createDevClient();
  const { error } = await supabase.rpc("admin_reject_user_list", {
    list_id: listId,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/lists");
  return { ok: true };
}
