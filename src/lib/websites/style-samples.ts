/**
 * Where the image-style examples on Article Settings live.
 *
 * Pure data, safe for the client bundle. The files are made by
 * scripts/style-samples/build.mjs (see PROVENANCE.md there): illustrations of
 * each style, NOT output of the production image model.
 *
 * Every URL carries STYLE_SAMPLE_VERSION as a query string. The files keep
 * their names (they are derived from the stored style ids), so without it a
 * browser or CDN holding the previous examples would go on showing them after
 * a release. Bump it whenever the files are rebuilt.
 */
export const STYLE_SAMPLE_VERSION = "2026-10-03";

/** Card thumbnail and enlarged preview sizes (both 16:9, like production's 1280 x 720). */
export const STYLE_SAMPLE_SIZE = {
  thumb: { width: 640, height: 360 },
  large: { width: 1280, height: 720 },
} as const;

/** Style ids that have an example file, per kind. "match" has none of its own. */
const AVAILABLE = {
  body: new Set(["sketch", "watercolour", "realistic", "illustration", "brand-text"]),
  featured: new Set(["sketch", "watercolour", "illustration"]),
} as const;

/** The example for a stored style id, or null when there is none (an unknown or legacy id). */
export function styleSampleSrc(kind: "body" | "featured", id: string, size: "thumb" | "large" = "thumb"): string | null {
  if (!AVAILABLE[kind].has(id)) return null;
  const suffix = size === "large" ? "-large" : "";
  return `/style-samples/${kind}-${id}${suffix}.webp?v=${STYLE_SAMPLE_VERSION}`;
}
