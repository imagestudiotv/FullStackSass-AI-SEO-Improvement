import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

import { KeywordDensityTool, keywordDensityMetadata } from "../../../tools/keyword-density/tool";

// Per request, like the English page: it fetches a live website, and the nonce CSP (src/proxy.ts) covers it.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/tools/keyword-density">) {
  const { locale } = await params;
  return isLocale(locale) ? keywordDensityMetadata(locale) : {};
}

/** /tools/keyword-density in Spanish, French, Italian and German. */
export default async function LocalisedKeywordDensityPage({ params, searchParams }: PageProps<"/[locale]/tools/keyword-density">) {
  const { locale } = await params;
  // English lives at /tools/keyword-density.
  if (!isLocale(locale) || locale === "en") notFound();
  return <KeywordDensityTool locale={locale} searchParams={await searchParams} />;
}
