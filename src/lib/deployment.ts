/**
 * Which kind of deployment this is - for keeping previews out of search
 * engines (client's launch review, 2026-10-03: "staging noindex").
 *
 * NO IMPORTS: next.config.ts loads this directly, before path aliases exist.
 *
 * TRUE ONLY ON A POSITIVE "preview". VERCEL_ENV is set by Vercel on every
 * deployment: "production", "preview" or "development". Absence is never read
 * as "not production" - a production build with the variable missing must
 * stay indexable. Hiding the real site from Google by mistake is far worse
 * than a preview being found, so the safe default is "index".
 */
export function isPreviewDeployment(
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
): boolean {
  return vercelEnv === "preview";
}

/**
 * The header that keeps a preview out of search results.
 *
 * A header rather than robots.txt: a crawler blocked by robots.txt never
 * fetches the page, so never sees a noindex, and the URL can stay listed from
 * links alone - the same reason /sign-up is noindexed rather than disallowed
 * (app/(auth)/layout.tsx). A header also covers files a meta tag cannot, such
 * as llms.txt and images.
 */
export const PREVIEW_ROBOTS_HEADER = { key: "X-Robots-Tag", value: "noindex, nofollow" };
