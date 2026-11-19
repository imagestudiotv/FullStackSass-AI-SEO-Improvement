import { notFound } from "next/navigation";

import { isLocale, LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { otherStoryCards } from "@/lib/success-stories/stories";
import { SuccessStoriesContent } from "@/app/(marketing)/success-stories-content";

/** Refreshed at most hourly, and at once on a change in Admin -> Success stories (as the English page). */
export const revalidate = 3600;

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
    ...publicPageMetadata("/success-stories", { locale }),
  };
}

export default async function LocalisedSuccessStoriesPage({
  params,
}: PageProps<"/[locale]/success-stories">) {
  const { locale } = await params;
  // English lives at /success-stories; /en/... would be a second URL for one page.
  if (!isLocale(locale) || locale === "en") notFound();

  return <SuccessStoriesContent t={getMessages(locale)} locale={locale} stories={await otherStoryCards(locale)} />;
}
