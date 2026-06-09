import { redirect } from "next/navigation";
import { createDevClient } from "@/lib/supabase/server";

export type AdminRole = "super_admin" | "moderator" | "editor";

export type AdminUser = {
  id: string;
  email: string | null;
  role: AdminRole;
  /** From public.users — nullable when an admin auth row has no
   *  matching user profile (admin-only accounts never finish
   *  onboarding). Falls back to email local-part at the call site. */
  displayName: string | null;
  username: string | null;
};

// Server-side gate. Call from any (dashboard) page or layout to guarantee
// the request is from a signed-in admin. Redirects when not.
//
// Backed by the `public.admins` table + `is_admin()` / `admin_role()`
// helpers introduced in Vestige-ios migration 20260502140000_admins.sql.
// Bootstrap a first super_admin via docs/admin-runbook.md → "Setup —
// admin roster" before anyone can sign in.
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createDevClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Three queries in parallel: the role check (auth gate), the optional
  // public.users profile (cosmetic), and the admin record's display name.
  // Admin-only accounts have no `public.users` row by design (they aren't
  // app users — see migration 20260610120000), so their name lives on the
  // `admins` record; `admins_select` RLS lets an admin session read it.
  const [roleRes, profileRes, adminRes] = await Promise.all([
    supabase.rpc("admin_role"),
    supabase
      .from("users")
      .select("display_name, username")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("admins")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (roleRes.error || !roleRes.data) {
    redirect("/unauthorized");
  }

  const profileName = (profileRes.data?.display_name as string | undefined) ?? null;
  const adminName = (adminRes.data?.display_name as string | undefined) ?? null;

  return {
    id: user.id,
    email: user.email ?? null,
    role: roleRes.data as AdminRole,
    displayName: profileName ?? adminName,
    username: (profileRes.data?.username as string | undefined) ?? null,
  };
}

/**
 * Friendly display label for an admin. Tries display name, falls
 * back to @username, then the email local-part. Never returns the
 * full email — that's for the user-detail pill, not the greeting.
 */
export function adminDisplayLabel(admin: AdminUser): string {
  if (admin.displayName && admin.displayName.trim().length > 0) {
    return admin.displayName.trim();
  }
  if (admin.username && admin.username.trim().length > 0) {
    return admin.username.trim();
  }
  if (admin.email) {
    const local = admin.email.split("@")[0];
    if (local && local.length > 0) return local;
  }
  return "admin";
}

/** Two-letter initials for avatar chips. */
export function adminInitials(admin: AdminUser): string {
  const label = adminDisplayLabel(admin);
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}
