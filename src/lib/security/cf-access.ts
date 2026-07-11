import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Cloudflare Access edge verification.
 *
 * Cloudflare Access sits in front of `bunker.vestige.golf` and, on every
 * request that passed its Google gate, injects a JWT signed by our Cloudflare
 * team (`Cf-Access-Jwt-Assertion` header / `CF_Authorization` cookie). Verifying
 * it here means a request that DIDN'T come through Access — e.g. someone hitting
 * the raw `*.vercel.app` origin URL to bypass the wall — is rejected by the app
 * itself. Belt-and-braces on top of the admin login.
 *
 * Fail-OPEN by design when unconfigured: with the two env vars unset this is a
 * no-op, so it can be shipped safely and switched on only once the Access proxy
 * is live (set `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD` in Vercel).
 *   • CF_ACCESS_TEAM_DOMAIN — e.g. `pinehollow.cloudflareaccess.com`
 *   • CF_ACCESS_AUD         — the application's Audience (AUD) tag from the
 *                             Access app settings.
 */
const TEAM_DOMAIN = process.env.CF_ACCESS_TEAM_DOMAIN?.trim();
const AUD = process.env.CF_ACCESS_AUD?.trim();

/** Whether the Access gate is configured (and therefore enforced). */
export function cfAccessEnabled(): boolean {
  return Boolean(TEAM_DOMAIN && AUD);
}

// Cached across invocations — jose refreshes the key set on rotation.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/**
 * True when the request is allowed to proceed: either Access isn't configured
 * (no-op) or it carries a valid Access JWT for our team + application.
 */
export async function verifyCfAccess(token: string | undefined | null): Promise<boolean> {
  if (!TEAM_DOMAIN || !AUD) return true; // not configured → don't block anything
  if (!token) return false;
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${TEAM_DOMAIN}/cdn-cgi/access/certs`));
  }
  try {
    await jwtVerify(token, jwks, {
      issuer: `https://${TEAM_DOMAIN}`,
      audience: AUD,
    });
    return true;
  } catch {
    return false;
  }
}
