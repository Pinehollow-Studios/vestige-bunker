import type { Metadata } from "next";

/**
 * Overrides the root metadata for the login route so the page gives nothing
 * away: a generic tab title, no description, and noindex/nofollow so it never
 * surfaces in search. Keeps the sign-in page invisible to a passer-by.
 */
export const metadata: Metadata = {
  title: "Sign in",
  description: "",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
