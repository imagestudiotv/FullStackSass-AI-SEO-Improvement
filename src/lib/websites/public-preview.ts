import "server-only";

import { detectPlatform } from "@/lib/audit/ai-crawlers";
import { guardPublicTool } from "@/lib/tools/public-guard";
import { fetchHomepage } from "@/lib/websites/crawl";
import { siteCard, type SiteCard } from "@/lib/websites/site-card";
import { iconData } from "@/lib/websites/site-icon-data";
import { InvalidUrlError, isPublicWebsiteUrl, normalizeWebsiteUrl } from "@/lib/websites/url";

/**
 * The homepage field's suggestion for an anonymous visitor (client,
 * 2026-11-18, after explee.com): one fetch of the typed site's homepage,
 * read for its name, a line about it and its icon. The signed-in twin is
 * lib/websites/preview.ts (the first onboarding screen).
 *
 * It makes our server fetch an address a stranger typed, so it goes through
 * the free tools' guard (lib/tools/public-guard.ts, tool "preview"): per
 * visitor, per site and overall limits, bounded concurrency, and safeFetch's
 * SSRF and size limits underneath fetchHomepage. A site asked about again
 * within the hour is answered from this instance's memory and counts
 * nothing. Never throws: no suggestion is a fine answer.
 */

const CACHE_MS = 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { card: SiteCard | null; at: number }>();

function remember(domain: string, card: SiteCard | null): void {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(domain, { card, at: Date.now() });
}

/** For tests. */
export function forgetPreviews(): void {
  cache.clear();
}

export async function publicSitePreview(input: string, visitor: string): Promise<SiteCard | null> {
  let normalized;
  try {
    normalized = normalizeWebsiteUrl(input);
  } catch (error) {
    if (error instanceof InvalidUrlError) return null;
    throw error;
  }
  const hit = cache.get(normalized.domain);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.card;

  try {
    const guarded = await guardPublicTool<SiteCard | null>({
      tool: "preview",
      site: normalized.domain,
      visitor,
      run: async () => {
        try {
          const page = await fetchHomepage(normalized.url, isPublicWebsiteUrl);
          const platform = detectPlatform([...page.platformSignals, ...page.images.map((image) => image.src)], page.generator ?? null);
          const card = siteCard(page, normalized.domain, platform);
          // The icon with the suggestion, never a gap while it loads; a white one marked for a dark tile.
          const icon = card.faviconUrl ? await iconData(card.faviconUrl) : null;
          return icon ? { ...card, faviconUrl: icon.dataUrl, faviconTone: icon.tone } : card;
        } catch {
          return null;
        }
      },
    });
    // A refusal (limits, busy) is not remembered: the next keystroke may be let through.
    if (!guarded.ok) return null;
    remember(normalized.domain, guarded.value);
    return guarded.value;
  } catch (error) {
    console.error("[preview] site suggestion failed", error);
    return null;
  }
}
