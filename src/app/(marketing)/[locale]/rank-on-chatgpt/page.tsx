import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";
import { featurePageContent } from "@/lib/marketing/feature-pages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { FeaturePageContent } from "../../feature-page";

/** /rank-on-chatgpt in Spanish, French, Italian and German: the English page's layout, translated copy. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/rank-on-chatgpt">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { page } = featurePageContent("/rank-on-chatgpt", locale);
  return { title: page.metaTitle, description: page.metaDescription, ...publicPageMetadata("/rank-on-chatgpt", { locale }) };
}

export default async function LocalisedPage({ params }: PageProps<"/[locale]/rank-on-chatgpt">) {
  const { locale } = await params;
  // English lives at /rank-on-chatgpt.
  if (!isLocale(locale) || locale === "en") notFound();
  const { page, example } = featurePageContent("/rank-on-chatgpt", locale);
  return <FeaturePageContent page={page} example={example} locale={locale} />;
}
