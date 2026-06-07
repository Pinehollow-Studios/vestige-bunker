import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { envConfig } from "./env";

// When this cookie is "1" the dashboard is in PROD VIEW: page data reads come
// from prod (via the service-role client), and the OPERATIONAL writes that act
// on prod-resident user data — feedback triage (reply / status / etc.) and
// announcements — also target prod via the service-role client
// (`createWriteClient`). The admin GATE still runs on the dev session
// (`requireAdmin` → `createDevClient`), so only a signed-in dev admin can ever
// reach prod view. EDITORIAL writes (curated lists / badges / course fields)
// deliberately STAY on dev via `createDevClient` — prod editorial is a
// downstream replica fed by the /sync promotion console, never edited directly.
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

// Prod service-role client (server-only key). It bypasses RLS, so the prod
// admin RPCs treat it as an admin caller (see Vestige-ios migration
// 20260607110000: is_admin() short-circuits true for service_role, and the
// feedback triage RPCs accept a service-role caller, attributing the action to
// the team). Used for both prod-view READS and prod-view feedback/announcement
// WRITES.
function prodServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL_PROD ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY_PROD ?? "";
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** True when the operator is in PROD VIEW (reads + operational writes hit prod). */
export async function isProdView(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(PROD_VIEW_COOKIE)?.value === "1";
}

/**
 * The DATA client used by page reads. Returns the prod service-role client when
 * PROD VIEW is active, otherwise the dev session client.
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  if (cookieStore.get(PROD_VIEW_COOKIE)?.value === "1") {
    return prodServiceClient();
  }
  return devSessionClient(cookieStore);
}

/**
 * The OPERATIONAL write client for prod-resident user data (feedback triage +
 * announcements). In PROD VIEW it returns the prod service-role client so the
 * write lands on the project the operator is looking at; otherwise the dev
 * session client (identical to `createDevClient`). Editorial writes must NOT use
 * this — they stay on `createDevClient` and are promoted via /sync.
 */
export async function createWriteClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  if (cookieStore.get(PROD_VIEW_COOKIE)?.value === "1") {
    return prodServiceClient();
  }
  return devSessionClient(cookieStore);
}

/**
 * The DEV session client — always dev, ignores PROD VIEW. Used by the admin
 * gate (`requireAdmin`) and by EDITORIAL writes, so the gate stays on the dev
 * session and editorial edits can only ever land on dev.
 */
export async function createDevClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return devSessionClient(cookieStore);
}
