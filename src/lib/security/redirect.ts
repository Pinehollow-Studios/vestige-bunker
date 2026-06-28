/**
 * Returns `raw` only when it is a safe *local* path - a single leading slash,
 * no scheme, no protocol-relative `//`, no backslash tricks. Otherwise falls
 * back to "/". Prevents open-redirect / phishing via attacker-supplied `next`
 * params (e.g. `next=.evil.com` concatenated onto the origin, or
 * `next=//evil.com`).
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  // Must start with exactly one "/" - rejects "https://…", "//host", "" .
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  // Reject backslashes (treated as "/" by some browsers) and control chars.
  if (/[\\\x00-\x1f]/.test(raw)) return "/";
  return raw;
}
