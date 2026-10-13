import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

import { LlmsTxtTool, llmsTxtMetadata } from "../../../tools/llms-txt-generator/tool";

// Per request, like the English page: it fetches a live website, and the nonce CSP (src/proxy.ts) covers it.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/tools/llms-txt-generator">) {
  const { locale } = await params;
  return isLocale(locale) ? llmsTxtMetadata(locale) : {};
}

/** /tools/llms-txt-generator in Spanish, French, Italian and German. */
export default async function LocalisedLlmsTxtGeneratorPage({ params, searchParams }: PageProps<"/[locale]/tools/llms-txt-generator">) {
  const { locale } = await params;
  // English lives at /tools/llms-txt-generator.
  if (!isLocale(locale) || locale === "en") notFound();
  return <LlmsTxtTool locale={locale} searchParams={await searchParams} />;
}
