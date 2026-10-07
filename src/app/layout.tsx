import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DeferredToaster } from "@/components/deferred-toaster";
import { SiteAnalytics } from "@/components/site-analytics";
import "./globals.css";
import { isPreviewDeployment } from "@/lib/deployment";
import { siteUrl as canonicalSiteUrl } from "@/lib/site-url";
import { SITE_OPEN_GRAPH } from "@/lib/seo/page-metadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/*
  Not preloaded: only code-like text (the tools, audit results, the app) uses
  it, never the first screen of a public page. A preload made every page fetch
  it (24 KB) before its first paint; now a page that uses it fetches it then,
  shown meanwhile in the size-matched fallback (font-display: swap).
*/
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

/**
 * Absolute base for canonical, hreflang and og:url addresses.
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
  return new URL(canonicalSiteUrl());
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: "RepGet",
    template: "%s | RepGet",
  },
  description:
    "Automated SEO analysis, AI content generation, publishing and backlinks for small businesses.",

  /**
   * Sharing defaults for every page. The picture itself is app/opengraph-
   * image.tsx; these say whose site it is and ask X for the large card.
   *
   * A page that sets its own `openGraph` replaces this object (Next merges
   * metadata one key deep). Every public page does, through
   * publicPageMetadata (lib/seo/page-metadata.ts), because og:url is
   * different on each page and cannot be set here; it starts from the same
   * SITE_OPEN_GRAPH. The pages that keep this object (signed-in, sign-in
   * and 404 pages, all noindex) have no canonical for an og:url to repeat.
   */
  openGraph: SITE_OPEN_GRAPH,
  twitter: {
    card: "summary_large_image",
  },

  /**
   * A preview deployment is never a search result: noindex on every page, for
   * crawlers that read the page rather than the X-Robots-Tag header that
   * next.config also sends. Production sets nothing here, so each page's own
   * robots setting (or none) applies as before. See lib/deployment.ts.
   */
  ...(isPreviewDeployment() ? { robots: { index: false, follow: false } } : {}),

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
        <DeferredToaster />
        <SiteAnalytics />
      </body>
    </html>
  );
}
