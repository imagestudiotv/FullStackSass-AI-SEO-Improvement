import { describe, expect, it } from "vitest";

import { detectPlatform } from "./ai-crawlers";

/**
 * Platform detection must not be fooled by what a site LINKS TO.
 *
 * The patterns used to be bare product names — `/webflow/` matched any string
 * containing those letters. Two of the three callers pass `internalUrls`,
 * every internal link on the page, so RepGet's own marketing site reported
 * itself as built on Webflow: its "works with" grid links to
 * /docs/integrations/webflow.
 *
 * A pattern must match something only the platform itself emits.
 */

/** The signals RepGet's own homepage produces. This is the real bug. */
const REPGET_HOMEPAGE = [
  "/_next/static/css/a1b2c3.css",
  "/_next/static/chunks/main-4f5e6d.js",
  "/docs/integrations/wordpress",
  "/docs/integrations/webflow",
  "/docs/integrations/shopify",
  "/docs/integrations/ghost",
  "/docs/integrations/wix",
  "https://repget.com/blog/how-to-publish-to-webflow",
];

describe("the reported bug: a site is not the platforms it links to", () => {
  it("reports RepGet's own site as Next.js, not Webflow", () => {
    expect(detectPlatform(REPGET_HOMEPAGE)).toBe("Next.js");
  });

  it.each([
    ["Webflow", "/docs/integrations/webflow"],
    ["WordPress", "/docs/integrations/wordpress"],
    ["Shopify", "/docs/integrations/shopify"],
    ["Ghost", "/docs/integrations/ghost"],
    ["Wix", "/docs/integrations/wix"],
    ["Joomla", "/guides/joomla-seo"],
    ["WooCommerce", "/compare/woocommerce-vs-shopify"],
    ["Drupal", "/blog/drupal-migration"],
  ])("a link mentioning %s does not make the site %s", (_name, href) => {
    // Only our own asset URLs besides the link: the answer must be Next.js.
    expect(detectPlatform(["/_next/static/chunks/x.js", href])).toBe("Next.js");
  });

  it("an agency listing every platform it builds on is not any of them", () => {
    const agency = [
      "/_next/static/chunks/app.js",
      "/services/wordpress-development",
      "/services/shopify-stores",
      "/services/webflow-design",
      "/services/squarespace-setup",
    ];
    expect(detectPlatform(agency)).toBe("Next.js");
  });

  it("a blog post about a platform is not that platform", () => {
    expect(
      detectPlatform([
        "https://example.com/blog/why-we-left-wordpress-for-webflow",
      ]),
    ).toBeNull();
  });
});

describe("real fingerprints are still detected", () => {
  it.each([
    ["WordPress", "https://site.test/wp-content/themes/x/style.css"],
    ["WordPress", "https://site.test/wp-includes/js/jquery.js"],
    ["WordPress", "https://site.test/wp-json/wp/v2/posts"],
    ["Shopify", "https://cdn.shopify.com/s/files/1/0/t/assets/theme.js"],
    ["Shopify", "https://acme.myshopify.com/cart"],
    ["Wix", "https://static.wixstatic.com/media/abc.jpg"],
    ["Wix", "https://static.parastorage.com/services/x/bundle.js"],
    ["Squarespace", "https://static1.squarespace.com/static/x/t/y.css"],
    ["Webflow", "https://assets.website-files.com/5f/abc.css"],
    ["Webflow", "https://cdn.prod.website-files.com/5f/app.js"],
    ["Webflow", "https://acme.webflow.io/home"],
    ["Ghost", "https://site.test/ghost/api/content/posts/"],
    ["Ghost", "https://acme.ghost.io/assets/built/screen.css"],
    ["Drupal", "https://site.test/sites/default/files/css/x.css"],
    ["Joomla", "https://site.test/index.php?option=com_content&view=article"],
    ["BigCommerce", "https://cdn11.bigcommerce.com/s-abc/stencil/x.js"],
    ["Next.js", "/_next/static/chunks/framework.js"],
  ])("detects %s from %s", (expected, signal) => {
    expect(detectPlatform([signal])).toBe(expected);
  });

  it("prefers the CMS over the framework it is rendered with", () => {
    // A Shopify store using a Next.js storefront is still "Shopify" to its owner.
    expect(
      detectPlatform([
        "/_next/static/chunks/main.js",
        "https://cdn.shopify.com/s/files/1/theme.js",
      ]),
    ).toBe("Shopify");
  });
});

describe("the generator meta tag is trusted first", () => {
  it("reads a self-declaration even with no asset fingerprints", () => {
    expect(detectPlatform(["WordPress 6.7.1"])).toBe("WordPress");
    expect(detectPlatform(["Webflow"])).toBe("Webflow");
    expect(detectPlatform(["Drupal 10 (https://www.drupal.org)"])).toBe("Drupal");
  });

  it("beats a conflicting asset fingerprint", () => {
    /*
      A WordPress site served behind a Next.js front end still says WordPress
      about itself, and that self-declaration is better evidence than ours.
    */
    expect(
      detectPlatform(["WordPress 6.7.1", "/_next/static/chunks/main.js"]),
    ).toBe("WordPress");
  });

  it("normalises casing to how the product spells itself", () => {
    expect(detectPlatform(["wordpress"])).toBe("WordPress");
    expect(detectPlatform(["WORDPRESS 6.7"])).toBe("WordPress");
  });

  it("is not reachable from a URL that merely contains the word", () => {
    // The table is matched against the first word; a URL starts with / or http.
    expect(detectPlatform(["/wordpress-hosting-guide"])).toBeNull();
    expect(detectPlatform(["https://example.com/webflow"])).toBeNull();
  });
});

describe("honest nulls", () => {
  it("returns null for a plain static site rather than guessing", () => {
    expect(
      detectPlatform([
        "/assets/css/main.css",
        "/assets/js/site.js",
        "/about",
        "/contact",
      ]),
    ).toBeNull();
  });

  it("returns null for no signals at all", () => {
    expect(detectPlatform([])).toBeNull();
  });
});
