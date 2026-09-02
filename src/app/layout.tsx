import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Absolute base for canonical and hreflang URLs.
 *
 * Without this Next emits them relative ("/es/pricing"), and search engines
 * ignore a relative hreflang entirely — the translations would be treated as
 * duplicates of each other rather than alternates, which is the exact problem
 * hreflang exists to prevent.
 *
 * Falls back to the production domain rather than localhost so a missing env
 * var cannot publish canonical tags pointing at a developer machine.
 */
function siteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  return new URL(
    configured && !configured.includes("localhost")
      ? configured
      : "https://seovision.io",
  );
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: "AI SEO Platform",
    template: "%s | AI SEO Platform",
  },
  description:
    "Automated SEO analysis, AI content generation, publishing and backlinks for small businesses.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
