import "server-only";
import {
  createClient as createServiceRoleClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { activeEnvKey, ENV_COOKIE, envConfig, type AdminEnvKey } from "./env";

/**
 * Service-role access for admin-only reads.
 *
 * SERVER-ONLY — the file imports `server-only` and the keys are never
 * `NEXT_PUBLIC`, so they can't leak into the client bundle. Service-role
 * bypasses RLS, which is exactly what the admin user directory needs:
 * `public.users` has no admin SELECT policy. Its three SELECT policies are
 *   - own row (`id = auth.uid()`)
 *   - public profiles (`privacy = 'everyone'`)
 *   - friends (`privacy = 'friendsOnly' and is_friend(id)`)
 * (see `Vestige-ios` migration `20260425200001_initial_schema.sql`), so an
 * admin's anon session can only see a privacy-filtered *slice* of users —
 * never the full roster. Reading through this client returns every registered
 * profile.
 *
 * Every caller already sits behind the dashboard layout's `requireAdmin()`
 * gate (plus the middleware session check), so the RLS bypass is never exposed
 * to an unauthenticated request. Same pattern + key source as
 * `lib/sync/clients.ts`; reserve it for reads that RLS would otherwise hide —
 * privacy-gated writes still go through the session client + `is_admin()` RPCs.
 */

const SERVICE_ROLE_KEYS: Record<AdminEnvKey, string | undefined> = {
  dev: process.env.SUPABASE_SERVICE_ROLE_KEY_DEV,
  prod: process.env.SUPABASE_SERVICE_ROLE_KEY_PROD,
};

/** The environment this request targets (prod by default; dev only via the
 *  hidden developer switch). Mirrors `supabase/server.ts`. */
async function resolveActiveEnvKey(): Promise<AdminEnvKey> {
  const store = await cookies();
  return activeEnvKey(store.get(ENV_COOKIE)?.value);
}

/**
 * Public-bucket base URL for the active environment. Use it when building
 * avatar / cover URLs so they point at the SAME Supabase project the page
 * read its data from — otherwise prod-data pages build dev URLs (or vice
 * versa) and every image 404s.
 */
export async function activeStorageBaseUrl(): Promise<string> {
  return envConfig(await resolveActiveEnvKey()).url;
}

/**
 * Service-role Supabase client for the ACTIVE environment. Throws when the
 * matching service-role key isn't configured.
 */
export async function createServiceClient(): Promise<SupabaseClient> {
  const cfg = envConfig(await resolveActiveEnvKey());
  const key = SERVICE_ROLE_KEYS[cfg.key];
  if (!cfg.url || !key) {
    throw new Error(
      `Service-role not configured for ${cfg.key} — set SUPABASE_SERVICE_ROLE_KEY_${cfg.key.toUpperCase()} (server-only).`,
    );
  }
  return createServiceRoleClient(cfg.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Non-throwing variant for non-critical paths (e.g. a sidebar count): returns
 *  null when the active env's service-role key isn't configured. */
export async function tryCreateServiceClient(): Promise<SupabaseClient | null> {
  try {
    return await createServiceClient();
  } catch {
    return null;
  }
}
