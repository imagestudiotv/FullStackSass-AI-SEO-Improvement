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

  /**
   * Icons are declared against their literal paths in public/ rather than
   * left to the app/ file convention, which serves them from hashed URLs
   * (/icon?abc123). Those change whenever the file does, and Google asks
   * specifically that a favicon URL stay put so it can keep serving the one
   * it has already crawled. These paths are permanent.
   *
   * 48px is the size Google's own guidance asks for (a multiple of 48);
   * 192 and 512 cover Android home screens and the manifest.
   */
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
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
