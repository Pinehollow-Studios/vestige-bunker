import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Manrope is the single Vestige brand typeface (design system §7): it carries
// every display AND UI surface outside the iOS app. The old Inter (UI) + DM Sans
// (headings) pairing was off-brand — the spec forbids substituting a third
// typeface. One Manrope instance feeds --font-display; globals.css aliases
// --font-sans / --font-heading / --font-hero to it so every surface is Manrope.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

// Kept for genuinely monospace, tabular technical readouts only (kbd chips,
// status lines, code). Not a brand text face.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Bunker",
  description: "Operational queues and editorial surfaces for Vestige.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${manrope.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Restore the sidebar collapsed state before paint (no flash). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(localStorage.getItem("vestige.sidebar")==="collapsed"){document.documentElement.classList.add("sidebar-collapsed")}}catch(e){}',
          }}
        />
        {/* Dark-only: the dashboard matches the iOS app (Atlas is dark). The
            class is forced so every `dark:` utility resolves and the toggle is
            gone. */}
        <ThemeProvider attribute="class" forcedTheme="dark">
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
