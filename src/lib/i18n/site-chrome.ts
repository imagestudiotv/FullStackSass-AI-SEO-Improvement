import "server-only";

import { LOCALES, type Locale } from "@/lib/i18n/config";
import { homeMenuCopy, type HomeRedesignCopy } from "@/lib/i18n/home-redesign";
import { siteMenuCopy, type SiteFrameCopy } from "@/lib/i18n/home/site-menu";
import { getMessages, type Messages } from "@/lib/i18n/messages";

/**
 * The few words the public site's header, footer and analytics cookie banner
 * (components/consent-banner.tsx) need, in every language.
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
 *
 * `a11y` is what only a screen reader hears - the menu button, the phone
 * menu's close button, the language switcher, the logo link and the night
 * mode button (also its hover tip). They were English on every page; the
 * words are the app's own (`app.common`).
 *
 * `menu` is the header's Features and Integrations mega-menus (client's
 * design, 2026-11-03). Its words live with the homepage redesign's copy
 * (lib/i18n/home-redesign.ts); they are picked out here for the same reason,
 * so the header never imports that file either - only the menu's slice of it
 * reaches the browser.
 *
 * `site` is what the design added around those menus and the footer's "Back to
 * top" (lib/i18n/home/site-menu.ts). The words of the menus' drawings and each
 * channel's line are not here: they are about half of `site`, sent in five
 * languages to every visitor for menus most never open, so the header loads
 * them when a menu is about to open (marketing-nav.tsx). None of them is in
 * the page's HTML before that, so search engines read the same links and text.
 */
export type SiteChromeA11y = Pick<Messages["app"]["common"], "openMenu" | "changeLanguage" | "brandHome" | "close" | "darkMode">;

export type SiteChrome = Record<
  Locale,
  Pick<Messages, "nav" | "footer" | "consent"> & { a11y: SiteChromeA11y; menu: HomeRedesignCopy["menu"]; site: SiteFrameCopy }
>;

/** The same, plus the "page not found" copy, for the 404 page. */
export type NotFoundCopy = Record<
  Locale,
  Pick<Messages, "nav" | "footer" | "notFound">
>;

/** What the header and footer need before any menu is open. */
function siteFrameCopy(locale: Locale): SiteFrameCopy {
  const { primaryNav, closeMenu, illustrations, workflowSteps, modes, backToTop, backToTopLabel } = siteMenuCopy(locale);
  return { primaryNav, closeMenu, illustrations, workflowSteps, modes, backToTop, backToTopLabel };
}

export function siteChrome(): SiteChrome {
  return Object.fromEntries(
    LOCALES.map((locale) => {
      const t = getMessages(locale);
      const { openMenu, changeLanguage, brandHome, close, darkMode } = t.app.common;
      return [
        locale,
        {
          nav: t.nav,
          footer: t.footer,
          consent: t.consent,
          a11y: { openMenu, changeLanguage, brandHome, close, darkMode },
          menu: homeMenuCopy(locale),
          site: siteFrameCopy(locale),
        },
      ];
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
