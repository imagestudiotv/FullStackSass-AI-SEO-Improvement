import { describe, expect, it } from "vitest";

import { languageAlternates, PREFIXED_LOCALES, TRANSLATED_PATHS } from "@/lib/i18n/config";
import { SHARE_IMAGE } from "@/lib/share-image";

import { publicPageMetadata, SITE_OPEN_GRAPH } from "./page-metadata";

/**
 * og:url (client: "please add og:url") must name the same address as the
 * canonical, and building a page's own openGraph must not lose what the root
 * layout's gave it - Next replaces that object whole. Every route in the
 * sitemap is checked end to end in app/sitemap-metadata.test.ts; these pin
 * the helper itself.
 */

describe("publicPageMetadata", () => {
  it("gives og:url exactly the canonical", () => {
    const meta = publicPageMetadata("/privacy");
    expect(meta.alternates.canonical).toBe("/privacy");
    expect(meta.openGraph.url).toBe("/privacy");
  });

  it("does the same for the homepage, which Next resolves to the bare origin for both", () => {
    const meta = publicPageMetadata("/");
    expect(meta.alternates.canonical).toBe("/");
    expect(meta.openGraph.url).toBe("/");
  });

  it("points a translated copy's canonical and og:url at its own language", () => {
    for (const locale of PREFIXED_LOCALES) {
      const about = publicPageMetadata("/about", { locale });
      expect(about.alternates.canonical).toBe(`/${locale}/about`);
      expect(about.openGraph.url).toBe(`/${locale}/about`);

      const home = publicPageMetadata("/", { locale });
      expect(home.alternates.canonical).toBe(`/${locale}`);
      expect(home.openGraph.url).toBe(`/${locale}`);
    }
  });

  it("keeps the root layout's site name and type, and names the share picture", () => {
    const { openGraph } = publicPageMetadata("/faq");
    expect(openGraph).toMatchObject(SITE_OPEN_GRAPH);
    expect(openGraph.images).toEqual([SHARE_IMAGE]);
  });

  /**
   * Next fills og:title and og:description from the page's own when openGraph
   * leaves them out. A copy here would be a second place to update.
   */
  it("leaves og:title and og:description to Next, so they follow the page's own", () => {
    const { openGraph } = publicPageMetadata("/pricing");
    expect(openGraph).not.toHaveProperty("title");
    expect(openGraph).not.toHaveProperty("description");
  });

  it("declares hreflang for every translated page, from both sides", () => {
    for (const path of TRANSLATED_PATHS) {
      expect(publicPageMetadata(path).alternates.languages).toEqual(languageAlternates(path));
      expect(publicPageMetadata(path, { locale: "de" }).alternates.languages).toEqual(
        languageAlternates(path),
      );
    }
  });

  it("declares no hreflang for an English-only page, which has no translations to name", () => {
    for (const path of ["/blog", "/tools/robots-checker", "/docs/integrations/wordpress", "/terms"]) {
      expect(publicPageMetadata(path).alternates).toEqual({ canonical: path });
    }
  });

  it("lets a blog post describe itself as an article and keep the picture and address", () => {
    const { openGraph } = publicPageMetadata("/blog/a-post", {
      openGraph: {
        type: "article",
        title: "A post",
        publishedTime: "2026-10-01",
        authors: ["Jane Doe"],
      },
    });
    expect(openGraph).toMatchObject({
      type: "article",
      title: "A post",
      publishedTime: "2026-10-01",
      siteName: SITE_OPEN_GRAPH.siteName,
      images: [SHARE_IMAGE],
      url: "/blog/a-post",
    });
  });

  it("never lets a caller point og:url anywhere but the canonical", () => {
    const { openGraph } = publicPageMetadata("/contact", {
      // @ts-expect-error -- `url` is not an accepted override; this checks the runtime too.
      openGraph: { type: "website", url: "/somewhere-else" },
    });
    expect(openGraph.url).toBe("/contact");
  });
});
