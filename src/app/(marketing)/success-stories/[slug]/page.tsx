import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getPublishedSuccessStory } from "@/lib/success-stories/stories";

import { storyMetadata, SuccessStoryView } from "./story-page";

/**
 * A success story from Admin -> Success stories, English (client,
 * 2026-11-19). Image Studio's hand-built case study, ../image-studio, is
 * matched before this. A draft or a deleted story is a 404.
 *
 * Drawn on its first visit and kept for an hour; a save in the admin
 * refreshes it at once (lib/admin/success-stories.ts).
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = await getPublishedSuccessStory(slug);
  return story ? storyMetadata(story, DEFAULT_LOCALE) : {};
}

export default async function SuccessStoryRoute({ params }: Props) {
  const { slug } = await params;
  const story = await getPublishedSuccessStory(slug);
  if (!story) notFound();
  return <SuccessStoryView story={story} locale={DEFAULT_LOCALE} />;
}
