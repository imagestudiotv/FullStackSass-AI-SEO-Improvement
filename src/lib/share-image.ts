/**
 * The site's sharing picture, drawn by app/opengraph-image.tsx.
 *
 * Kept here so the picture and the pages that point at it agree. Next attaches
 * the picture to every page by itself - EXCEPT a page that sets its own
 * `openGraph`, because Next merges metadata one key deep and that object
 * replaces the root's, image and all. Blog posts do, so a shared post showed no
 * picture until they named this one explicitly.
 */
export const SHARE_IMAGE = {
  /** The route Next serves app/opengraph-image.tsx at. Resolved against metadataBase. */
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "RepGet - AI SEO Platform for Content & Backlinks",
} as const;
