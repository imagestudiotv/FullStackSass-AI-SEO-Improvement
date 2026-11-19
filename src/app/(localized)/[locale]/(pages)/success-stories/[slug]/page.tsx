import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";
import { getPublishedSuccessStory } from "@/lib/success-stories/stories";
import { storyMetadata, SuccessStoryView } from "@/app/(marketing)/success-stories/[slug]/story-page";

/**
 * A success story in another language's pages: /it/success-stories/<slug>.
 * The story is in the language it was written in; the page around it is
 * the reader's, and its canonical is the English address (story-page.tsx).
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const story = await getPublishedSuccessStory(slug);
  return story ? storyMetadata(story, locale) : {};
}

export default async function LocalisedSuccessStoryRoute({ params }: Props) {
  const { locale, slug } = await params;
  // English lives at /success-stories/<slug>; /en/... would be a second URL for one page.
  if (!isLocale(locale) || locale === "en") notFound();
  const story = await getPublishedSuccessStory(slug);
  if (!story) notFound();
  return <SuccessStoryView story={story} locale={locale} />;
}
