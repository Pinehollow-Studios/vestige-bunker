import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { envConfig } from "./env";

// When this cookie is "1" the dashboard is in read-only PROD VIEW: page data
// reads come from prod (via service-role), but the admin gate + every write
// still run against dev. No prod login required — it's gated by the dev
// session, and there is no prod-write client, so prod-view can only ever READ.
export const PROD_VIEW_COOKIE = "vestige_prod_view";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function devSessionClient(cookieStore: CookieStore): SupabaseClient {
  const env = envConfig("dev");
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — middleware refreshes the session.
        }
      },
    },
  });
}

function prodReadClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL_PROD ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY_PROD ?? "";
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * The DATA client used by page reads. Returns the prod read-only (service-role)
 * client when PROD VIEW is active, otherwise the dev session client. Never used
 * for writes — those go through `createDevClient()`.
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  if (cookieStore.get(PROD_VIEW_COOKIE)?.value === "1") {
    return prodReadClient();
  }
  return devSessionClient(cookieStore);
}

/**
 * The DEV session client — always dev, ignores PROD VIEW. Used by the admin
 * gate (`requireAdmin`) and every write/mutation, so the gate stays on the dev
 * session and edits can only ever land on dev.
 */
export async function createDevClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return devSessionClient(cookieStore);
}
