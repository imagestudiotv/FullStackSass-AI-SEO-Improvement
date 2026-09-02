import { notFound } from "next/navigation";

import { isLocale, PREFIXED_LOCALES } from "@/lib/i18n/config";

/**
 * Localised marketing routes: /es, /fr, /it, /de.
 *
 * English keeps the unprefixed paths it already has — adding /en would break
 * every existing link and every canonical tag.
 *
 * Only the locales we actually ship are generated, so /xx is a real 404 rather
 * than an English page served under a nonsense prefix. That matters for search
 * engines: a site that answers 200 for any prefix ends up with every page
 * indexed several times over.
 */
export function generateStaticParams() {
  return PREFIXED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  // A prefix that is not one of ours, or "en" which must stay unprefixed.
  if (!isLocale(locale) || locale === "en") {
    notFound();
  }

  return children;
}
