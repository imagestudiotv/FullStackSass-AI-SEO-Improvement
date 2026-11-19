import { getMessages } from "@/lib/i18n/messages";
import { SuccessStoriesContent } from "../success-stories-content";
import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { otherStoryCards } from "@/lib/success-stories/stories";

const t = getMessages("en");

export const metadata = {
  title: t.successStories.metaTitle,
  description: t.successStories.metaDescription,
  ...publicPageMetadata("/success-stories"),
};

/**
 * Built ahead and refreshed at most hourly, like the homepage; a change in
 * Admin -> Success stories, or to a blog customer story, refreshes it at once.
 */
export const revalidate = 3600;

/**
 * Success stories, English.
 *
 * Copy comes from the dictionary so /es/success-stories and the rest render
 * the same page from the same component. See success-stories-content.tsx for
 * why this page is about measurements rather than named customers.
 */
export default async function SuccessStoriesPage() {
  return <SuccessStoriesContent t={t} locale="en" stories={await otherStoryCards("en")} />;
}
