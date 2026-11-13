import { MarketingShell } from "@/components/marketing-shell";
import { DEFAULT_LOCALE, isLocale, PREFIXED_LOCALES } from "@/lib/i18n/config";
import { readLiveBanner } from "@/lib/promo-banner/read";

import { ROOT_METADATA, RootDocument } from "../../root-document";

/**
 * Root layout of the translated public pages: /es, /fr, /it, /de.
 *
 * It sits under [locale], so it is given the language and the HTML leaves the
 * server as <html lang="de"> on the German pages - matching their hreflang,
 * which is what crawlers compare (Ahrefs, "Hreflang and HTML lang mismatch",
 * 2026-11-13). The language comes from the address, so these pages are still
 * prebuilt (generateStaticParams below); nothing here reads the request.
 * app/root-document.tsx explains the three roots.
 *
 * English keeps the unprefixed paths it already has (app/(marketing)) —
 * adding /en would break every existing link and every canonical tag.
 *
 * Only the locales we actually ship are generated. Any other first segment
 * (/xx, /anything) still reaches this layout, drawn in English, and is
 * answered with the public site's 404 by (pages)/layout.tsx and
 * ./not-found.tsx, as before. That matters for search engines: a site that
 * answers 200 for any prefix ends up with every page indexed several times
 * over.
 */
export function generateStaticParams() {
  return PREFIXED_LOCALES.map((locale) => ({ locale }));
}

export const metadata = ROOT_METADATA;

export default async function LocalizedRootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  const lang = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return (
    <RootDocument lang={lang}>
      <MarketingShell banner={await readLiveBanner()}>{children}</MarketingShell>
    </RootDocument>
  );
}
