import type { PageSnapshot } from "@/lib/websites/crawl";

/**
 * Trims a page title down to something that reads as a business name.
 *
 * Titles are routinely "Image Studio | Photo & Film Production in Milan" -
 * everything after the first separator is positioning copy, not the name.
 */
export function nameFromTitle(title: string): string {
  const [first] = title.split(/\s+[|–—·•-]\s+/);
  return (first ?? title).trim();
}

/** What the title says after the name ("Photo & Film Production in Milan"), or null. */
export function taglineFromTitle(title: string): string | null {
  const parts = title.split(/\s+[|–—·•-]\s+/);
  const rest = parts.slice(1).join(" · ").trim();
  return rest || null;
}

/** Longest description a suggestion carries: the field shows one line of it. */
export const SITE_CARD_DESCRIPTION_CHARS = 140;

/**
 * A website as the homepage field's suggestion shows it (the reference the
 * client sent, 2026-11-18: explee.com): its icon, its name, a short line
 * about it and its address. Everything comes from the site's own homepage
 * markup; nothing is guessed, and what is missing stays null.
 */
export type SiteCard = {
  domain: string;
  name: string;
  /** The title's tagline, else the meta description, cut to one line. */
  description: string | null;
  /** HTTPS only: the browser loads it straight from the site. */
  faviconUrl: string | null;
  platform: string | null;
  /** Two-letter code from <html lang>. */
  language: string | null;
};

function cut(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function siteCard(page: Pick<PageSnapshot, "title" | "ogSiteName" | "metaDescription" | "faviconUrl" | "lang">, domain: string, platform: string | null): SiteCard {
  const name = page.ogSiteName?.trim() || (page.title ? nameFromTitle(page.title) : "") || domain;
  const tagline = page.title ? taglineFromTitle(page.title) : null;
  const about = tagline && tagline.toLowerCase() !== name.toLowerCase() ? tagline : page.metaDescription?.trim() || null;
  let favicon: string | null = null;
  try {
    if (page.faviconUrl && new URL(page.faviconUrl).protocol === "https:") favicon = page.faviconUrl;
  } catch {
    favicon = null;
  }
  return {
    domain,
    name: cut(name, 80),
    description: about ? cut(about, SITE_CARD_DESCRIPTION_CHARS) : null,
    faviconUrl: favicon,
    platform,
    language: page.lang?.slice(0, 2).toLowerCase() || null,
  };
}
