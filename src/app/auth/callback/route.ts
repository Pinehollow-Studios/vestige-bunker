import { NextResponse, type NextRequest } from "next/server";
import { createDevClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/security/redirect";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Validate `next` is a local path - an attacker-supplied absolute/`//`/`.host`
  // value would otherwise redirect off-site after a successful login.
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createDevClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`);
}
