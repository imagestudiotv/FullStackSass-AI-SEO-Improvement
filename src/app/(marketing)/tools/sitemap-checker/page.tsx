import { SitemapTool, sitemapMetadata } from "./tool";

export const metadata = sitemapMetadata("en");

// Fetches a live website per request, so it can never be prerendered (and the nonce CSP needs a per-request render).
export const dynamic = "force-dynamic";

/** /tools/sitemap-checker (tool.tsx); other languages: [locale]/tools/sitemap-checker. */
export default async function SitemapCheckerPage({ searchParams }: PageProps<"/tools/sitemap-checker">) {
  return <SitemapTool locale="en" searchParams={await searchParams} />;
}
