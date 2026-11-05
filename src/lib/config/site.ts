/**
 * Site-wide contact and identity details.
 *
 * These appear in legal pages, which are a compliance surface: a placeholder
 * address on a privacy policy is not merely untidy, it means a data-subject
 * request has nowhere to go. They were hardcoded in six places across four
 * pages, so any change had to be made six times and drift was inevitable.
 *
 * NEXT_PUBLIC_SUPPORT_EMAIL still overrides it, but the default is RepGet's
 * real, monitored inbox (client, 2026-10-09). It used to be the placeholder
 * support@example.com, which every environment without the variable - a
 * preview, a staging copy, a fresh deploy - showed on its contact and legal
 * pages. A placeholder put back by hand is still caught: hasRealSupportEmail()
 * below and `npm run doctor`.
 */

/** Support address shown on legal and contact pages. */
/**
 * Where "We'll build one for you" goes: the public page for website builds and
 * redesigns.
 */
export const WEBSITE_CREATION_PATH = "/website-creation";

/**
 * The old way there, /contact?about=website_build. Links to it are out in the
 * world, so the contact page forwards it (websiteBuildRedirect).
 */
export const WEBSITE_BUILD_TOPIC = "website_build";

/**
 * The address /contact?about=website_build now lives at, in the same language
 * and keeping every other parameter (utm tags, ?type=, ?email=).
 */
export function websiteBuildRedirect(path: string, params: Record<string, string | string[] | undefined>): string {
  const kept = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "about" || value === undefined) continue;
    for (const one of Array.isArray(value) ? value : [value]) kept.append(key, one);
  }
  const query = kept.toString();
  return query ? `${path}?${query}` : path;
}

export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@repget.com";

/** Trading name used in legal copy. */
export const COMPANY_NAME =
  process.env.NEXT_PUBLIC_COMPANY_NAME ?? "RepGet";

/** False only while the address is a placeholder (an @example.com one set by hand). */
export function hasRealSupportEmail(): boolean {
  return !SUPPORT_EMAIL.endsWith("@example.com");
}
