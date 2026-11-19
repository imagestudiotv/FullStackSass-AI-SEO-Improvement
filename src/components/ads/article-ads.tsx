import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { adsenseConfig } from "@/lib/ads/adsense-config";
import { BLOG_CHROME } from "@/lib/blog/locale";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import type { Locale } from "@/lib/i18n/config";

import { AdsenseLoader, AdsenseSlot } from "./adsense-slot";

export type ArticleAds = { top: ReactNode; end: ReactNode };

/**
 * The AdSense units for one blog article (lib/ads/adsense-config.ts), for the
 * article pages only: one in-article unit after the introduction, one display
 * unit after the body. Null when AdSense is off. With the publisher set and
 * no unit ids yet, only the loader (after consent).
 *
 * Whether the visitor already accepted cookies is read here, from the same
 * cookie the banner writes, so the reserved space is in the first HTML (no
 * layout shift); the components follow the banner live after that.
 */
export async function articleAds(locale: Locale): Promise<ArticleAds | null> {
  // Written out so Next inlines each one at build, as in the browser bundle.
  const config = adsenseConfig({
    NEXT_PUBLIC_ADSENSE_CLIENT: process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
    NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_TOP: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_TOP,
    NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_END: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_END,
  });
  if (!config.client) return null;
  const store = await cookies();
  const cookie = store.get(CONSENT_COOKIE)?.value;
  const consented = cookie ? parseConsent(`${CONSENT_COOKIE}=${cookie}`) === "granted" : false;
  const label = BLOG_CHROME[locale].advertisement;
  const { top, end } = config.slots;
  return {
    top: top ? (
      <AdsenseSlot client={config.client} slot={top} format="in-article" label={label} consented={consented} />
    ) : (
      <AdsenseLoader client={config.client} consented={consented} />
    ),
    end: end ? <AdsenseSlot client={config.client} slot={end} format="display" label={label} consented={consented} /> : null,
  };
}
