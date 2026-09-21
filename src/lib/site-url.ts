/**
 * The canonical public address of this deployment.
 *
 * WHY THIS IS CENTRAL: the same fallback was written out in five places —
 * layout.tsx, robots.ts, sitemap.ts, the marketing page and the settings page
 * — and every one of them read `https://seovision.io`, which is a live,
 * unrelated company's website rather than a domain we own.
 *
 * That was not cosmetic. robots.ts and sitemap.ts hand this value to search
 * engines as the site's own address, layout.tsx makes it the metadataBase
 * behind every canonical and Open Graph URL, and the marketing page embeds it
 * in JSON-LD. Whenever NEXT_PUBLIC_APP_URL was unset — a preview build, a
 * misconfigured environment — the app published a competitor's domain as its
 * own identity.
 *
 * One copy means the next correction is one edit. Five copies is how the
 * wrong value survived in four of them after the fifth was noticed.
 */

/**
 * The fallback, used only when NEXT_PUBLIC_APP_URL is unset or local.
 *
 * Deliberately the live Vercel deployment rather than the eventual brand
 * domain: repget.com does not resolve yet, and a fallback that does not
 * answer is worse than an ugly one that does. Change this the day that DNS
 * points at Vercel — and change NEXT_PUBLIC_APP_URL, which is what actually
 * gets used in production.
 */
const FALLBACK = "https://full-stack-sass-ai-seo-improvement.vercel.app";

/**
 * No trailing slash, so callers can concatenate a path without doubling it.
 *
 * A localhost value is rejected rather than returned: these URLs end up in
 * sitemaps, structured data and links a customer may share, and a developer
 * machine's address is useless in all three.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  return configured && !configured.includes("localhost") ? configured : FALLBACK;
}
