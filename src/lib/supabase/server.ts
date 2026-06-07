import { createServerClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { activeEnvKey, ENV_COOKIE, envConfig } from "./env";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function sessionClient(cookieStore: CookieStore): SupabaseClient {
  // Default: prod. Dev only when the hidden dev switch is enabled and selected
  // (see env.ts → activeEnvKey). The same client serves reads AND writes —
  // there is no separate dev/write/service-role client anymore.
  const env = envConfig(activeEnvKey(cookieStore.get(ENV_COOKIE)?.value));
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

/**
 * The one client used everywhere — page reads, mutations, and the admin gate.
 * Bound to the active environment (prod by default; dev only via the hidden
 * developer switch) and to that environment's logged-in session, so every
 * `is_admin()`-gated RPC runs as the real admin with correct attribution.
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return sessionClient(cookieStore);
}

/**
 * @deprecated Aliases of `createClient`, kept so existing call sites keep
 * compiling. The dev/prod split + read-only prod view were removed
 * 2026-06-07 — there is now a single active-environment session client.
 * Migrate call sites to `createClient` over time.
 */
export const createDevClient = createClient;
export const createWriteClient = createClient;
