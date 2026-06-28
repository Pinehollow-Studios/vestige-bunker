import "server-only";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/**
 * Dev + prod service-role clients for the editorial mirror (/sync).
 *
 * The mirror reads dev and writes prod regardless of which env the
 * dashboard is currently viewing, so it can't use the cookie-driven
 * anon clients in `supabase/server.ts`. Service-role bypasses RLS -
 * needed to read dev `courses` (authenticated-only) and to
 * upsert/delete/storage-copy on prod.
 *
 * Keys are SERVER-ONLY (never `NEXT_PUBLIC`) and live only in Vercel /
 * local env, never the (public) repo. The single caller - the /sync
 * server action - is gated on `requireAdmin()` + `super_admin`.
 */

export type SyncClients = { dev: SupabaseClient; prod: SupabaseClient };

const DEV_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL_DEV ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const DEV_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_DEV;
const PROD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL_PROD;
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY_PROD;

/** Which halves of the sync credentials are present (for the UI to
 *  explain what's missing without leaking values). */
export function syncConfigStatus() {
  return {
    devReady: Boolean(DEV_URL && DEV_KEY),
    prodReady: Boolean(PROD_URL && PROD_KEY),
    devUrlPresent: Boolean(DEV_URL),
    devKeyPresent: Boolean(DEV_KEY),
    prodUrlPresent: Boolean(PROD_URL),
    prodKeyPresent: Boolean(PROD_KEY),
  };
}

export function createSyncClients(): SyncClients {
  if (!DEV_URL || !DEV_KEY) {
    throw new Error(
      "Dev service-role not configured - set NEXT_PUBLIC_SUPABASE_URL_DEV (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY_DEV.",
    );
  }
  if (!PROD_URL || !PROD_KEY) {
    throw new Error(
      "Prod service-role not configured - set NEXT_PUBLIC_SUPABASE_URL_PROD + SUPABASE_SERVICE_ROLE_KEY_PROD.",
    );
  }
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  return {
    dev: createSupabaseClient(DEV_URL, DEV_KEY, opts),
    prod: createSupabaseClient(PROD_URL, PROD_KEY, opts),
  };
}
