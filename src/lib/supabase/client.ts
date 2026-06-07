import { createBrowserClient } from "@supabase/ssr";
import { activeEnvKey, ENV_COOKIE, envConfig } from "./env";

function readEnvCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${ENV_COOKIE}=`));
  return match?.split("=")[1];
}

/** Browser client for the active environment (prod by default; dev only via
 *  the hidden developer switch). */
export function createClient() {
  const env = envConfig(activeEnvKey(readEnvCookie()));
  return createBrowserClient(env.url, env.anonKey);
}
