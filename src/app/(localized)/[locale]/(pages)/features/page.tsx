import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";
import { featuresPageCopy } from "@/lib/i18n/features-page";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { FeaturesPageContent } from "@/app/(marketing)/features-page";

/** /features in Spanish, French, Italian and German: the English page's layout, translated copy. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/features">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = featuresPageCopy(locale);
  return { title: t.metaTitle, description: t.metaDescription, ...publicPageMetadata("/features", { locale }) };
}

export default async function LocalisedPage({ params }: PageProps<"/[locale]/features">) {
  const { locale } = await params;
  // English lives at /features.
  if (!isLocale(locale) || locale === "en") notFound();
  return <FeaturesPageContent locale={locale} />;
}
