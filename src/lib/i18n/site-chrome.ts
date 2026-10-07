import "server-only";

import { LOCALES, type Locale } from "@/lib/i18n/config";
import { getMessages, type Messages } from "@/lib/i18n/messages";

/**
 * The few words the public site's header and footer need, in every language.
 *
 * The header and footer are client components: only the address says which
 * language the visitor is reading, and the shared layout is not told it. They
 * used to call getMessages() themselves, and a client component that imports
 * messages.ts sends the WHOLE of it to the browser - every language and the
 * signed-in app's strings, about 770 KB of JavaScript (240 KB compressed) on
 * every public page, for some twenty labels. It was the largest download on
 * the home page and what kept its mobile PageSpeed score out of the green.
 *
 * So the server picks these words out here and passes them down as props (a
 * few KB for all five languages); the components still choose the language
 * from the address. A client component must never import messages.ts itself
 * - only its types (`import type`).
 */
export type SiteChrome = Record<Locale, Pick<Messages, "nav" | "footer">>;

/** The same, plus the "page not found" copy, for the 404 page. */
export type NotFoundCopy = Record<
  Locale,
  Pick<Messages, "nav" | "footer" | "notFound">
>;

export function siteChrome(): SiteChrome {
  return Object.fromEntries(
    LOCALES.map((locale) => {
      const t = getMessages(locale);
      return [locale, { nav: t.nav, footer: t.footer }];
    }),
  ) as SiteChrome;
}

export function notFoundCopy(): NotFoundCopy {
  return Object.fromEntries(
    LOCALES.map((locale) => {
      const t = getMessages(locale);
      return [locale, { nav: t.nav, footer: t.footer, notFound: t.notFound }];
    }),
  ) as NotFoundCopy;
}
