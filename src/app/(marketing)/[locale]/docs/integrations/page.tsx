import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";
import { docsUi } from "@/lib/publishing/docs";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { GuidesIndex } from "../../../docs/integrations/guide-pages";

/** The integration guides' index in Spanish, French, Italian and German. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/docs/integrations">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const ui = docsUi(locale);
  return { title: ui.metaTitle, description: ui.metaDescription, ...publicPageMetadata("/docs/integrations", { locale }) };
}

export default async function LocalisedIntegrationDocsPage({ params }: PageProps<"/[locale]/docs/integrations">) {
  const { locale } = await params;
  // English lives at /docs/integrations.
  if (!isLocale(locale) || locale === "en") notFound();
  return <GuidesIndex locale={locale} />;
}
