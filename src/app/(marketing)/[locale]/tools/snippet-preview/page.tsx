import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";

import { SnippetTool, snippetMetadata } from "../../../tools/snippet-preview/tool";

/** /tools/snippet-preview in Spanish, French, Italian and German. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/tools/snippet-preview">) {
  const { locale } = await params;
  return isLocale(locale) ? snippetMetadata(locale) : {};
}

export default async function LocalisedSnippetPreviewPage({ params }: PageProps<"/[locale]/tools/snippet-preview">) {
  const { locale } = await params;
  // English lives at /tools/snippet-preview.
  if (!isLocale(locale) || locale === "en") notFound();
  return <SnippetTool locale={locale} />;
}
