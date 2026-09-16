import { notFound } from "next/navigation";

import { isLocale, localePath, LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { SuccessStoriesContent } from "../../success-stories-content";

/**
 * Localised success stories: /es/success-stories and the rest.
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
}: PageProps<"/[locale]/success-stories">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = getMessages(locale);
  return {
    title: t.successStories.metaTitle,
    description: t.successStories.metaDescription,
    alternates: {
      canonical: localePath(locale, "/success-stories"),
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, localePath(l, "/success-stories")]),
      ),
    },
  };
}

export default async function LocalisedSuccessStoriesPage({
  params,
}: PageProps<"/[locale]/success-stories">) {
  const { locale } = await params;
  // English lives at /success-stories; /en/... would be a second URL for one page.
  if (!isLocale(locale) || locale === "en") notFound();

  return <SuccessStoriesContent t={getMessages(locale)} />;
}
