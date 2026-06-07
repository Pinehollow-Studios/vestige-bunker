/**
 * Environment registry.
 *
 * The dashboard's DEFAULT and primary target is PROD — the live app that
 * TestFlight / App Store users are on. Admins log in with their prod account
 * and the main view reads + writes prod directly. There is no separate
 * "workshop" environment for day-to-day use, and no read-only "prod view".
 *
 * A hidden DEV switch exists ONLY for developers: when
 * `NEXT_PUBLIC_ENABLE_DEV_SWITCH` is "true" (set in local + Vercel Preview,
 * NEVER in production) a toggle lets a developer point the whole dashboard —
 * data AND auth — at the dev project to test changes. The production
 * deployment never sets the flag, so it is always prod with no switch in sight.
 *
 * ISOMORPHIC — must NOT import `next/headers` (it's pulled into the browser
 * bundle via `supabase/client.ts`). The active-env COOKIE VALUE is passed in by
 * the caller: the server reads `next/headers` cookies, the client reads
 * `document.cookie`, middleware reads `request.cookies`.
 *
 * Anon keys are public + RLS-gated (they already ship inside the iOS binary).
 * Service-role keys are NEVER referenced here.
 */

export type AdminEnvKey = "dev" | "prod";

export type AdminEnvConfig = {
  key: AdminEnvKey;
  label: string;
  url: string;
  anonKey: string;
};

/** Cookie that selects the active environment (only honoured when the dev
 *  switch is enabled — see `DEV_SWITCH_ENABLED`). */
export const ENV_COOKIE = "vestige_env";

/** The hidden dev switch only renders + functions when this is set — local
 *  + Vercel Preview, never the production deployment Jack uses. */
export const DEV_SWITCH_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEV_SWITCH === "true";

const PROD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL_PROD ?? "";
const PROD_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD ?? "";
// Dev falls back to the legacy single-project vars so a local clone that only
// set the unsuffixed keys still has a dev target for the hidden switch.
const DEV_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL_DEV ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";
const DEV_ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

const ENVS: Record<AdminEnvKey, AdminEnvConfig> = {
  dev: { key: "dev", label: "Dev", url: DEV_URL, anonKey: DEV_ANON },
  prod: { key: "prod", label: "Prod", url: PROD_URL, anonKey: PROD_ANON },
};

/** True when both url + anon key are present for the env. */
export function isEnvConfigured(key: AdminEnvKey): boolean {
  const e = ENVS[key];
  return Boolean(e.url && e.anonKey);
}

/** Prefer prod; fall back to dev only when prod isn't configured (a local
 *  clone with only the _DEV vars set), so a config is never empty. */
function fallbackEnv(): AdminEnvKey {
  return isEnvConfigured("prod") ? "prod" : "dev";
}

/** The (url, anonKey) pair for an env, falling back when the requested env
 *  isn't configured. */
export function envConfig(key: AdminEnvKey): AdminEnvConfig {
  return isEnvConfigured(key) ? ENVS[key] : ENVS[fallbackEnv()];
}

/**
 * The active environment for this request. Prod unless the dev switch is
 * enabled AND the caller's cookie explicitly selects dev AND dev is configured.
 */
export function activeEnvKey(cookieValue?: string | null): AdminEnvKey {
  if (DEV_SWITCH_ENABLED && cookieValue === "dev" && isEnvConfigured("dev")) {
    return "dev";
  }
  return fallbackEnv();
}
