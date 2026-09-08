import { notFound } from "next/navigation";

import { isLocale, localePath, LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { AboutContent } from "../../static-pages";

/**
 * Localised about page: /es/about, /fr/about, /it/about, /de/about.
 *
 * Same component as the English page, different dictionary. hreflang tells
 * search engines these are one page in five languages rather than five pages
 * competing with each other.
 */
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== "en").map((locale) => ({
    locale,
  }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = getMessages(locale);
  return {
    title: t.about.metaTitle,
    description: t.about.metaDescription,
    alternates: {
      canonical: localePath(locale, "/about"),
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, localePath(l, "/about")]),
      ),
    },
  };
}

export default async function LocalisedAboutPage({
  params,
}: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  // English lives at /about; /en/about would be a second URL for one page.
  if (!isLocale(locale) || locale === "en") notFound();

  return <AboutContent t={getMessages(locale)} />;
}
