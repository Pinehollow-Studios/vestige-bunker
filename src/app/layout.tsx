import type { Metadata } from "next";
import { Inter, DM_Sans, Manrope, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  weight: ["500", "600", "700"],
});

const dmHero = DM_Sans({
  subsets: ["latin"],
  variable: "--font-hero",
  display: "swap",
  weight: ["600", "700"],
});

// Manrope - the app's modern display sans (stat numerals + headings).
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

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
      className={`${inter.variable} ${dmSans.variable} ${dmHero.variable} ${manrope.variable} ${mono.variable} h-full antialiased`}
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
