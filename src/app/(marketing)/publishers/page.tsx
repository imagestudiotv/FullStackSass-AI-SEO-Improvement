import { getMessages } from "@/lib/i18n/messages";
import { PublishersContent } from "../publishers-content";
import { languageAlternates } from "@/lib/i18n/config";

const t = getMessages("en");

export const metadata = {
  title: t.publishers.metaTitle,
  description: t.publishers.metaDescription,
  alternates: { canonical: "/publishers", languages: languageAlternates("/publishers") },
};

/**
 * English route. Copy lives in the dictionary so /es/publishers and the
 * rest render the same component in their own language.
 */
export default function Page() {
  return <PublishersContent t={t} href={(path) => path} />;
}
