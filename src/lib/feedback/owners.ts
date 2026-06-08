import "server-only";
import { tryCreateServiceClient } from "@/lib/supabase/admin";

/**
 * The admin roster, shaped for the feedback "owner" (assignee) picker.
 *
 * `feedback_reports.owner_user_id` is constrained to admins by the
 * `set_owner` RPC, so the picker only ever offers people in
 * `public.admins`. Their display names live in `public.users`, which has
 * no admin SELECT policy (own / public / friends only — see
 * `lib/supabase/admin.ts`), so we read both through the service-role
 * client. Every caller already sits behind the dashboard layout's
 * `requireAdmin()` gate.
 *
 * Degrades to `[]` when the service-role key isn't configured — the UI
 * then simply hides the owner control rather than erroring.
 */
export type AdminOption = {
  id: string;
  /** display_name → @username → short id, in that order. */
  label: string;
  username: string | null;
};

export async function listAdminOwners(): Promise<AdminOption[]> {
  const supabase = await tryCreateServiceClient();
  if (!supabase) return [];

  const { data: admins, error } = await supabase
    .from("admins")
    .select("user_id");
  if (error || !admins || admins.length === 0) return [];

  const ids = admins.map((a) => a.user_id as string);
  const { data: users } = await supabase
    .from("users")
    .select("id, display_name, username")
    .in("id", ids);
  const byId = new Map(
    (users ?? []).map((u) => [u.id as string, u] as const),
  );

  return ids
    .map((id) => {
      const u = byId.get(id);
      const display = (u?.display_name as string | null)?.trim() || null;
      const username = (u?.username as string | null) ?? null;
      const label = display ?? (username ? `@${username}` : id.slice(0, 8));
      return { id, label, username };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
