import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

import { AiCrawlersTool, aiCrawlersMetadata } from "../../../tools/ai-crawler-checker/tool";

// Per request, like the English page: it fetches a live website, and the nonce CSP (src/proxy.ts) covers it.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/tools/ai-crawler-checker">) {
  const { locale } = await params;
  return isLocale(locale) ? aiCrawlersMetadata(locale) : {};
}

/** /tools/ai-crawler-checker in Spanish, French, Italian and German. */
export default async function LocalisedAiCrawlerCheckerPage({ params, searchParams }: PageProps<"/[locale]/tools/ai-crawler-checker">) {
  const { locale } = await params;
  // English lives at /tools/ai-crawler-checker.
  if (!isLocale(locale) || locale === "en") notFound();
  return <AiCrawlersTool locale={locale} searchParams={await searchParams} />;
}
