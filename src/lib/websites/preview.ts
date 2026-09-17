"use server";

import { detectPlatform } from "@/lib/audit/ai-crawlers";
import { requireOrg } from "@/lib/tenant";
import { CrawlError, fetchHomepage } from "@/lib/websites/crawl";
import {
  InvalidUrlError,
  isPublicWebsiteUrl,
  normalizeWebsiteUrl,
} from "@/lib/websites/url";

/**
 * A quick look at a website, for the first onboarding screen.
 *
 * The design fills a preview card the moment an address is entered: the
 * favicon, the cover image, the platform it is built on, the region and the
 * category. The full analysis produces most of that, but it runs as a
 * background job and takes tens of seconds — so the card it is meant to fill
 * would sit empty at exactly the moment the design shows it populated.
 *
 * This is the fast half: one fetch of the homepage, read what is already in
 * the markup, return it. It is deliberately NOT the analysis — no model call,
 * no second page, nothing written to the database. The real analysis still
 * runs afterwards and still owns the values that matter; this exists to make
 * the screen honest about what it knows within a second or two.
 *
 * Everything is nullable, and the UI shows only what came back. A preview that
 * guesses is worse than one that shows four fields instead of five: the
 * customer is looking at their own website and will spot an invented category
 * immediately.
 */

export type WebsitePreview = {
  /** The address after redirects — what the site really answers on. */
  url: string;
  domain: string;
  /** Best available name: og:site_name, then the title, then the domain. */
  name: string;
  faviconUrl: string | null;
  coverUrl: string | null;
  /** "WordPress", "Shopify"… or null when nothing matched. */
  platform: string | null;
  /** Two-letter language code from <html lang>, when present. */
  language: string | null;
  description: string | null;
};

export type PreviewResult =
  | { ok: true; data: WebsitePreview }
  | { ok: false; error: string };

/**
 * Trims a page title down to something that reads as a business name.
 *
 * Titles are routinely "Image Studio | Photo & Film Production in Milan" —
 * everything after the first separator is positioning copy, not the name.
 */
function nameFromTitle(title: string): string {
  const [first] = title.split(/\s+[|–—·•-]\s+/);
  return (first ?? title).trim();
}

export async function previewWebsite(rawUrl: string): Promise<PreviewResult> {
  /**
   * Guarded like every other action, even though it writes nothing: it makes
   * our server fetch a URL a caller chose, so it must not be available to
   * anyone who is not signed in.
   */
  await requireOrg();

  let normalized;
  try {
    normalized = normalizeWebsiteUrl(rawUrl);
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  try {
    /**
     * isPublicWebsiteUrl is passed as the redirect guard, the same as the
     * analysis job does — an open redirect on the customer's site must not
     * walk us onto a private address.
     */
    const page = await fetchHomepage(normalized.url, isPublicWebsiteUrl);

    const name =
      page.ogSiteName?.trim() ||
      (page.title ? nameFromTitle(page.title) : "") ||
      normalized.domain;

    return {
      ok: true,
      data: {
        url: page.finalUrl,
        domain: normalized.domain,
        name,
        faviconUrl: page.faviconUrl,
        coverUrl: page.ogImageUrl,
        /**
         * Detected from asset URLs, which is where the reliable fingerprints
         * are: /wp-content/ in an image src identifies WordPress far better
         * than anything in the body copy.
         */
        platform: detectPlatform(page.images.map((image) => image.src)),
        language: page.lang?.slice(0, 2).toLowerCase() || null,
        description: page.metaDescription,
      },
    };
  } catch (error) {
    /**
     * A failed preview must not block the form. The customer can still add
     * the site — the analysis will try again from the job, where a retry
     * costs them nothing — so this returns a readable reason and the UI keeps
     * its Continue button enabled.
     */
    if (error instanceof CrawlError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Could not read that website" };
  }
}
