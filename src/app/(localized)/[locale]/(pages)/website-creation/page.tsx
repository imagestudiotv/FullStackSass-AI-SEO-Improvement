import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";
import { WEBSITE_CREATION_COPY } from "@/lib/marketing/website-creation/copy";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { WebsiteCreationContent } from "@/app/(marketing)/website-creation/website-creation-page";

/** /website-creation in Spanish, French, Italian and German. */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/website-creation">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = WEBSITE_CREATION_COPY[locale];
  return { title: t.metaTitle, description: t.metaDescription, ...publicPageMetadata("/website-creation", { locale }) };
}

export default async function LocalisedWebsiteCreationPage({ params }: PageProps<"/[locale]/website-creation">) {
  const { locale } = await params;
  // English lives at /website-creation.
  if (!isLocale(locale) || locale === "en") notFound();
  return <WebsiteCreationContent locale={locale} />;
}
