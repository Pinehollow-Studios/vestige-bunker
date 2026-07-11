import "server-only";
import { tryCreateServiceClient, activeStorageBaseUrl } from "@/lib/supabase/admin";
import { avatarURL } from "@/lib/storage";

/** One selectable user for the hand-picked recipient picker. */
export type PickerUser = {
  id: string;
  display_name: string | null;
  username: string | null;
  /** From auth.users — only populated when loaded `withEmail`. */
  email: string | null;
  avatar_url: string | null;
};

/**
 * The full user roster for the hand-picked recipient picker.
 *
 * Reads `public.users` through the SERVER-ONLY service-role client (RLS would
 * otherwise hide most rows — see `lib/supabase/admin.ts`). When `withEmail`,
 * each user's address is pulled from `auth.users` via the GoTrue admin API
 * (email isn't on `public.users`) and merged by id — so the email picker can
 * show who it's actually sending to. The user base is small, so we load
 * everyone; if it grows past a few thousand, switch to server-side search.
 */
export async function listPickerUsers(
  { withEmail = false }: { withEmail?: boolean } = {},
): Promise<PickerUser[]> {
  // Resilient: the picker is a sub-feature, so a missing service-role key or a
  // read error yields an empty roster (the picker shows "No users") rather than
  // crashing the whole editor.
  const supabase = await tryCreateServiceClient();
  if (!supabase) return [];
  const baseUrl = await activeStorageBaseUrl();

  const { data: rows, error } = await supabase
    .from("users")
    .select("id, username, display_name, avatar_photo_id")
    .order("display_name", { ascending: true })
    .limit(5000);
  if (error) return [];

  const users = (rows ?? []) as {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_photo_id: string | null;
  }[];

  const emailById = new Map<string, string | null>();
  if (withEmail) {
    // GoTrue admin list is paginated; walk until a short page.
    const perPage = 200;
    for (let page = 1; page <= 50; page++) {
      const { data, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage });
      if (listErr) break;
      const list = data?.users ?? [];
      for (const u of list) emailById.set(u.id, u.email ?? null);
      if (list.length < perPage) break;
    }
  }

  return users.map((u) => ({
    id: u.id,
    display_name: u.display_name,
    username: u.username,
    email: withEmail ? emailById.get(u.id) ?? null : null,
    avatar_url: avatarURL(u.id, u.avatar_photo_id, baseUrl),
  }));
}
