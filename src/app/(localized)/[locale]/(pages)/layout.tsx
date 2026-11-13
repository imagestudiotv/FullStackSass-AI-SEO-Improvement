import { notFound } from "next/navigation";

import { isLocale } from "@/lib/i18n/config";

/**
 * Refuses a prefix that is not one of ours, or "en", which must stay
 * unprefixed: /xx and /en/pricing are 404s, not English pages under a
 * nonsense prefix.
 *
 * Here rather than in the root layout above (app/(localized)/[locale]/
 * layout.tsx): a notFound() thrown by a root layout has no not-found page
 * above it to show. Thrown here, it is caught by ../not-found.tsx, inside the
 * site's frame, with a real 404 status.
 */
export default async function LocalePagesLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!isLocale(locale) || locale === "en") {
    notFound();
  }

  return children;
}
