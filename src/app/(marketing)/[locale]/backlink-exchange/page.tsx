import { notFound } from "next/navigation";

import { isLocale, localePath, LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { BacklinkExchangeContent } from "../../backlink-exchange-content";

/**
 * Localised /backlink-exchange. Same component, different dictionary; hreflang
 * marks these as one page in five languages rather than five competing pages.
 */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({
    locale,
  }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/backlink-exchange">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = getMessages(locale);
  return {
    title: t.backlinkExchange.metaTitle,
    description: t.backlinkExchange.metaDescription,
    alternates: {
      canonical: localePath(locale, "/backlink-exchange"),
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, localePath(l, "/backlink-exchange")]),
      ),
    },
  };
}

export default async function Page({
  params,
}: PageProps<"/[locale]/backlink-exchange">) {
  const { locale } = await params;
  // English lives at /backlink-exchange; /en/... would be a second URL for one page.
  if (!isLocale(locale) || locale === "en") notFound();

  const t = getMessages(locale);
  return <BacklinkExchangeContent t={t} href={(path) => localePath(locale, path)} />;
}
