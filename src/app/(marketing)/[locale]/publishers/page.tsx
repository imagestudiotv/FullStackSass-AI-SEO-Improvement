import { notFound } from "next/navigation";

import { isLocale, localePath, LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { PublishersContent } from "../../publishers-content";

/**
 * Localised /publishers. Same component, different dictionary; hreflang
 * marks these as one page in five languages rather than five competing pages.
 */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({
    locale,
  }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/publishers">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = getMessages(locale);
  return {
    title: t.publishers.metaTitle,
    description: t.publishers.metaDescription,
    alternates: {
      canonical: localePath(locale, "/publishers"),
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, localePath(l, "/publishers")]),
      ),
    },
  };
}

export default async function Page({
  params,
}: PageProps<"/[locale]/publishers">) {
  const { locale } = await params;
  // English lives at /publishers; /en/... would be a second URL for one page.
  if (!isLocale(locale) || locale === "en") notFound();

  const t = getMessages(locale);
  return <PublishersContent t={t} href={(path) => localePath(locale, path)} />;
}
