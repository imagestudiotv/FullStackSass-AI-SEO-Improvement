import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

import { LlmHtmlTool, llmHtmlMetadata } from "../../../tools/llm-html-checker/tool";

// Per request, like the English page: it fetches a live website, and the nonce CSP (src/proxy.ts) covers it.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/tools/llm-html-checker">) {
  const { locale } = await params;
  return isLocale(locale) ? llmHtmlMetadata(locale) : {};
}

/** /tools/llm-html-checker in Spanish, French, Italian and German. */
export default async function LocalisedLlmHtmlCheckerPage({ params, searchParams }: PageProps<"/[locale]/tools/llm-html-checker">) {
  const { locale } = await params;
  // English lives at /tools/llm-html-checker.
  if (!isLocale(locale) || locale === "en") notFound();
  return <LlmHtmlTool locale={locale} searchParams={await searchParams} />;
}
