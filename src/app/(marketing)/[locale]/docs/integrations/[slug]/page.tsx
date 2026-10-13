import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";
import { docsUi, getIntegrationDoc, INTEGRATION_DOCS } from "@/lib/publishing/docs";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { Guide } from "../../../../docs/integrations/guide-pages";

/** Every guide in Spanish, French, Italian and German, prerendered. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").flatMap((locale) => INTEGRATION_DOCS.map((doc) => ({ locale, slug: doc.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/docs/integrations/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const doc = getIntegrationDoc(slug, locale);
  if (!doc) return { title: docsUi(locale).notFound };
  return {
    title: docsUi(locale).connectTitle.replace("{name}", doc.name),
    description: doc.summary,
    ...publicPageMetadata(`/docs/integrations/${doc.slug}`, { locale }),
  };
}

export default async function LocalisedIntegrationDocPage({ params }: PageProps<"/[locale]/docs/integrations/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || locale === "en") notFound();
  const doc = getIntegrationDoc(slug, locale);
  if (!doc) notFound();
  return <Guide doc={doc} locale={locale} />;
}
