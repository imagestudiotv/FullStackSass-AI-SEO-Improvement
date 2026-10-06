import type { Metadata } from "next";

import {
  DEFAULT_LOCALE,
  languageAlternates,
  type Locale,
  localePath,
  TRANSLATED_PATHS,
} from "@/lib/i18n/config";
import { SHARE_IMAGE } from "@/lib/share-image";

type OpenGraph = NonNullable<Metadata["openGraph"]>;

/**
 * Omit applied to each member of a union. Plain Omit flattens OpenGraph's
 * website/article/... members into one type, which would lose the fields a
 * blog post's `type: "article"` allows (publishedTime, authors).
 */
type OmitEach<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * Whose site a shared link is from. The root layout's sharing defaults and
 * every public page's own Open Graph tags start from this one object, so the
 * name cannot read differently on different pages.
 */
export const SITE_OPEN_GRAPH = {
  siteName: "RepGet",
  type: "website",
} as const satisfies OpenGraph;

export type PublicPageMetadata = {
  alternates: { canonical: string; languages?: Record<Locale | "x-default", string> };
  openGraph: OpenGraph;
};

/**
 * The address tags of one public page - canonical, hreflang and og:url - and
 * its sharing tags, all from ONE path.
 *
 * WHY og:url HAS TO BE THE CANONICAL. Facebook, LinkedIn and the other
 * networks treat og:url as the page's identity: shares and likes are counted
 * against it, so a link shared as /pricing?utm_source=x is shown as, and
 * counted for, /pricing. Without it each network decides for itself which
 * address a share belongs to (client: "please add og:url"). It must say
 * exactly what <link rel="canonical"> says, or the page names two different
 * addresses as itself. Both are built here from the same string, and Next
 * resolves both against metadataBase with the same function, so they cannot
 * differ.
 *
 * WHY EVERY PAGE BUILDS ITS OWN openGraph. og:url differs per page, so the
 * root layout cannot supply it. And Next merges metadata one key deep: a page
 * that sets `openGraph` replaces the root layout's whole object, including the
 * picture Next attaches from app/opengraph-image.tsx. So this returns the
 * complete set - site name, type, picture and address - rather than only the
 * address, which would have silently dropped the other three.
 *
 * WHY THERE IS NO TITLE OR DESCRIPTION HERE. When `openGraph` names neither,
 * Next fills og:title and og:description from the page's own title and
 * description (and twitter:* from those). Leaving them out is what keeps them
 * from drifting: there is no second copy to forget. A page that wants a
 * different share title passes it in `openGraph` (blog posts do).
 *
 * hreflang comes from TRANSLATED_PATHS rather than from each caller, so a
 * page that exists in every language always declares its alternates - they
 * only count when every version lists every other (lib/i18n/config.ts).
 *
 * `locale` is for the translated copies: /es/about passes ("/about",
 * { locale: "es" }) and gets /es/about as both its canonical and its og:url.
 * `openGraph` may add to the tags or replace the type and picture; it cannot
 * set `url`, which is always the canonical.
 */
export function publicPageMetadata(
  path: string,
  {
    locale = DEFAULT_LOCALE,
    openGraph,
  }: { locale?: Locale; openGraph?: OmitEach<OpenGraph, "url"> } = {},
): PublicPageMetadata {
  const canonical = localePath(locale, path);

  return {
    alternates: TRANSLATED_PATHS.has(path)
      ? { canonical, languages: languageAlternates(path) }
      : { canonical },
    openGraph: {
      ...SITE_OPEN_GRAPH,
      images: [SHARE_IMAGE],
      ...openGraph,
      url: canonical,
    },
  };
}
