import { getMessages } from "@/lib/i18n/messages";
import { SuccessStoriesContent } from "../success-stories-content";

const t = getMessages("en");

export const metadata = {
  title: t.successStories.metaTitle,
  description: t.successStories.metaDescription,
  alternates: { canonical: "/success-stories" },
};

/**
 * Success stories, English.
 *
 * Copy comes from the dictionary so /es/success-stories and the rest render
 * the same page from the same component. See success-stories-content.tsx for
 * why this page is about measurements rather than named customers.
 */
export default function SuccessStoriesPage() {
  return <SuccessStoriesContent t={t} />;
}
