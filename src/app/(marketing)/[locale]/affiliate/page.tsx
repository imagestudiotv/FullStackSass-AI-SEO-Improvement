import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { AffiliateContent } from "../../affiliate-content";

/**
 * Localised /affiliate. Same component, different dictionary; hreflang
 * marks these as one page in five languages rather than five competing pages.
 */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({
    locale,
  }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/affiliate">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = getMessages(locale);
  return {
    title: t.affiliate.metaTitle,
    description: t.affiliate.metaDescription,
    ...publicPageMetadata("/affiliate", { locale }),
  };
}

export default async function Page({
  params,
}: PageProps<"/[locale]/affiliate">) {
  const { locale } = await params;
  // English lives at /affiliate; /en/... would be a second URL for one page.
  if (!isLocale(locale) || locale === "en") notFound();

  const t = getMessages(locale);
  return <AffiliateContent t={t} />;
}
