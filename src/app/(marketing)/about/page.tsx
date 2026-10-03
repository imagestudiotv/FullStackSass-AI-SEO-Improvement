import { AboutContent } from "../static-pages";
import { getMessages } from "@/lib/i18n/messages";
import { languageAlternates } from "@/lib/i18n/config";

const t = getMessages("en");

export const metadata = {
  title: t.about.metaTitle,
  description: t.about.metaDescription,
  alternates: { canonical: "/about", languages: languageAlternates("/about") },
};

/**
 * About page.
 *
 * States the product's actual principle rather than generic startup copy. The
 * scoring rule described here is real — it is how the keyword ranking works —
 * so a prospect who reads this and then uses the product sees the same idea.
 *
 * Copy comes from the dictionary so /es/about and the rest render the same
 * page from the same component. See static-pages.tsx.
 */
export default function AboutPage() {
  return <AboutContent t={t} />;
}
