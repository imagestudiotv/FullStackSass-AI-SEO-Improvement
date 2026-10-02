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
 * The brand domain now that it answers (repget.com redirects to www). It was
 * the Vercel deployment's own address until DNS pointed here; that address
 * still serves the app - see LEGACY_HOSTS.
 */
const FALLBACK = "https://www.repget.com";

/**
 * The production address from before repget.com: the deployment still
 * answers on it, and WordPress plugin 1.7.0 calls it (its built-in default),
 * as do the payment providers' webhooks. API calls there are fine; a PERSON
 * sent there is not - their RepGet sign-in lives on the brand domain, so they
 * were asked to sign in again on an address they did not recognise (client,
 * 2026-10-01). Pages a browser is sent to redirect away (legacyRedirect).
 */
const LEGACY_HOSTS = new Set(["full-stack-sass-ai-seo-improvement.vercel.app"]);

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

/**
 * Where to send a browser that asked for `path` on `host`: the same path on
 * the canonical address when `host` is the pre-repget.com one, else null.
 * Only that exact host - a preview deployment or a staging domain is left
 * alone, so it keeps working against its own database.
 */
export function legacyRedirect(host: string | null | undefined, path: string): string | null {
  const name = host?.trim().toLowerCase().replace(/:\d+$/, "");
  if (!name || !LEGACY_HOSTS.has(name)) return null;
  const target = siteUrl();
  // Never a redirect to itself, whatever NEXT_PUBLIC_APP_URL says.
  if (new URL(target).hostname === name) return null;
  return `${target}${path.startsWith("/") ? path : `/${path}`}`;
}
