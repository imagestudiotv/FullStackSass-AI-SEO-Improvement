import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

import { SitemapTool, sitemapMetadata } from "../../../tools/sitemap-checker/tool";

// Per request, like the English page: it fetches a live website, and the nonce CSP (src/proxy.ts) covers it.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/tools/sitemap-checker">) {
  const { locale } = await params;
  return isLocale(locale) ? sitemapMetadata(locale) : {};
}

/** /tools/sitemap-checker in Spanish, French, Italian and German. */
export default async function LocalisedSitemapCheckerPage({ params, searchParams }: PageProps<"/[locale]/tools/sitemap-checker">) {
  const { locale } = await params;
  // English lives at /tools/sitemap-checker.
  if (!isLocale(locale) || locale === "en") notFound();
  return <SitemapTool locale={locale} searchParams={await searchParams} />;
}
