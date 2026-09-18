import "server-only";

import { fetchHomepage } from "@/lib/websites/crawl";
import { isPublicWebsiteUrl, normalizeWebsiteUrl } from "@/lib/websites/url";

/**
 * A picture of a website, for the audit loading frame.
 *
 * Returns the site's own og:image — the one it already publishes for social
 * cards — which is the closest thing to a screenshot available without a
 * rendering service. Checked against sites that refuse framing: all of them
 * had one, because publishing a social image and refusing to be embedded are
 * unrelated decisions.
 *
 * Never throws. This is decoration on a screen whose real job is running an
 * audit, so a site that is slow, unreachable or simply has no image returns
 * null and the frame shows its address instead. A failed picture must not take
 * down the page it decorates.
 */
export async function previewSiteImage(input: string): Promise<string | null> {
  try {
    const normalized = normalizeWebsiteUrl(input);
    const page = await fetchHomepage(normalized.url, isPublicWebsiteUrl);
    return page.ogImageUrl;
  } catch {
    return null;
  }
}
