import { notFound, permanentRedirect } from "next/navigation";

import { isPublicEnglishPage } from "@/lib/seo/public-pages";

/**
 * Any address under a language prefix that is not one of its pages
 * (/es/no-such-page, /fr/privacy).
 *
 * A page that exists only in English (/de/terms, /es/privacy) is sent to its
 * English address for good (308). Since 2026-10-13 the tools, the free check
 * and the integration guides exist in every language, so their routes under
 * [locale] answer first and never reach this one.
 * Until 2026-10-04 the translated pages linked to such addresses, so search
 * engines learned them and kept reporting them as 404s (client, 2026-10-13);
 * a permanent redirect hands them over to the real page. Only pages in
 * lib/seo/public-pages.ts are redirected - anything else stays a 404.
 *
 * The 404 is answered here rather than by the root not-found page. The root
 * one is built once, ahead of time, for no address in particular - so it was
 * written in English, and in a Spanish visitor's browser it then redrew itself
 * in Spanish, which React reports as an error (a hydration mismatch).
 * Answered here, the page is drawn for the address actually asked for, inside
 * the public site's layout, by (marketing)/not-found.tsx, with a real 404
 * status. Real pages (/es/pricing) are matched before this.
 */
export default async function UnknownTranslatedPage({ params }: PageProps<"/[locale]/[...rest]">) {
  const { rest } = await params;
  const english = `/${rest.join("/")}`;
  if (isPublicEnglishPage(english)) permanentRedirect(english);
  notFound();
}
