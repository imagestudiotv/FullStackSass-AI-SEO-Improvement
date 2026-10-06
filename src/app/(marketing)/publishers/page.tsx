import { getMessages } from "@/lib/i18n/messages";
import { PublishersContent } from "../publishers-content";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

const t = getMessages("en");

export const metadata = {
  title: t.publishers.metaTitle,
  description: t.publishers.metaDescription,
  ...publicPageMetadata("/publishers"),
};

/**
 * English route. Copy lives in the dictionary so /es/publishers and the
 * rest render the same component in their own language.
 */
export default function Page() {
  return <PublishersContent t={t} href={(path) => path} />;
}
