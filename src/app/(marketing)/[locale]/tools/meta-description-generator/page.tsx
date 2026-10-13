import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

import { MetaDescriptionTool, metaDescriptionMetadata } from "../../../tools/meta-description-generator/tool";

// Per request, like the English page: it fetches a live website, and the nonce CSP (src/proxy.ts) covers it.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/tools/meta-description-generator">) {
  const { locale } = await params;
  return isLocale(locale) ? metaDescriptionMetadata(locale) : {};
}

/** /tools/meta-description-generator in Spanish, French, Italian and German. */
export default async function LocalisedMetaDescriptionGeneratorPage({ params, searchParams }: PageProps<"/[locale]/tools/meta-description-generator">) {
  const { locale } = await params;
  // English lives at /tools/meta-description-generator.
  if (!isLocale(locale) || locale === "en") notFound();
  return <MetaDescriptionTool locale={locale} searchParams={await searchParams} />;
}
