import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

import { MetaTagsTool, metaTagsMetadata } from "../../../tools/meta-tag-checker/tool";

// Per request, like the English page: it fetches a live website, and the nonce CSP (src/proxy.ts) covers it.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/tools/meta-tag-checker">) {
  const { locale } = await params;
  return isLocale(locale) ? metaTagsMetadata(locale) : {};
}

/** /tools/meta-tag-checker in Spanish, French, Italian and German. */
export default async function LocalisedMetaTagCheckerPage({ params, searchParams }: PageProps<"/[locale]/tools/meta-tag-checker">) {
  const { locale } = await params;
  // English lives at /tools/meta-tag-checker.
  if (!isLocale(locale) || locale === "en") notFound();
  return <MetaTagsTool locale={locale} searchParams={await searchParams} />;
}
