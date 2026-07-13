"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Remove a suppressed address so future campaigns can reach it again — e.g. a
 * mailbox that has since recovered, or a mistaken suppression. Deletes via the
 * admin SESSION client (the `email_suppressions` RLS policy gates on is_admin()).
 */
export async function removeSuppression(email: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("email_suppressions").delete().eq("email", email);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails/suppressions");
  return { ok: true };
}
