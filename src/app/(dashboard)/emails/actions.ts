"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

/** One editable email (subject + HTML) — mirrors public.email_templates. */
export type EmailTemplateRow = {
  key: string;
  name: string;
  description: string;
  subject: string;
  html: string;
  available_tokens: string[];
  updated_at: string;
  updated_by: string | null;
};

/** Every app email, in display order (welcome first, then the auth emails). */
export async function loadEmailTemplates(): Promise<ActionResult<EmailTemplateRow[]>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_email_templates");
  if (error) return { ok: false, message: error.message };
  return { ok: true, data: (data as EmailTemplateRow[] | null) ?? [] };
}

/**
 * Save an email's subject + HTML. Both are required. The senders (send-welcome,
 * auth-email-hook) read the row live, so a save takes effect on the next email —
 * no deploy.
 */
export async function saveEmailTemplate(
  key: string,
  subject: string,
  html: string,
): Promise<ActionResult> {
  const trimmedSubject = subject.trim();
  const trimmedHtml = html.trim();
  if (!trimmedSubject || !trimmedHtml) {
    return { ok: false, message: "Subject and HTML are both required." };
  }
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_email_template", {
    p_key: key,
    p_subject: trimmedSubject,
    p_html: trimmedHtml,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/emails");
  return { ok: true };
}
