import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { cfAccessEnabled, verifyCfAccess } from "@/lib/security/cf-access";

export async function middleware(request: NextRequest) {
  // Edge gate: when Cloudflare Access is configured, reject any request that
  // didn't come through it (e.g. someone hitting the raw *.vercel.app origin to
  // dodge the wall). Inert until CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD are set,
  // so it can never lock anyone out before the Access proxy is live.
  if (cfAccessEnabled()) {
    const token =
      request.headers.get("cf-access-jwt-assertion") ??
      request.cookies.get("CF_Authorization")?.value ??
      null;
    const ok = await verifyCfAccess(token);
    if (!ok) {
      return new NextResponse("Forbidden — access is restricted to the Cloudflare Access gate.", {
        status: 403,
      });
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
