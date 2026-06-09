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
  /** users.display_name → admins.display_name → @username → short id. */
  label: string;
  username: string | null;
};

export async function listAdminOwners(): Promise<AdminOption[]> {
  const supabase = await tryCreateServiceClient();
  if (!supabase) return [];

  // The admin's name lives on the `admins` record (admin-only accounts have no
  // public.users profile — and shouldn't, see migration 20260610120000). We
  // still prefer a real users.display_name when the admin is also a full user.
  const { data: admins, error } = await supabase
    .from("admins")
    .select("user_id, display_name");
  if (error || !admins || admins.length === 0) return [];

  const ids = admins.map((a) => a.user_id as string);
  const adminNameById = new Map(
    admins.map(
      (a) =>
        [a.user_id as string, (a.display_name as string | null)?.trim() || null] as const,
    ),
  );

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
      const userDisplay = (u?.display_name as string | null)?.trim() || null;
      const username = (u?.username as string | null) ?? null;
      const label =
        userDisplay ??
        adminNameById.get(id) ??
        (username ? `@${username}` : id.slice(0, 8));
      return { id, label, username };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
