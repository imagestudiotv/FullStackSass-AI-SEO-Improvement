import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Inter for everything: heavy weights with tight tracking give the
 * reference reel's headline look, and its Latin set covers the accents of
 * French, German, Spanish and Italian.
 *
 * Served by RepGet itself (public/video-fonts, from @fontsource/inter, SIL
 * Open Font License), not Google Fonts: a render must not wait on another
 * site, and the page's preview needs no font host in its security policy.
 * In the render the files come from the template bundle's own public folder
 * (scripts/remotion-bundle.mjs); in the app's preview, from /video-fonts.
 *
 * Loaded once at module level. The render waits for it (delayRender); a font
 * that fails to load falls back to the system's sans-serif rather than
 * failing the video.
 */
const FAMILY = "RepGet Inter";
const WEIGHTS = ["500", "700", "800", "900"] as const;

export const fontUrl = (weight: string) => staticFile(`video-fonts/inter-latin-${weight}-normal.woff2`);

function load(): void {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return;
  const handle = delayRender("Loading the Inter font", { timeoutInMilliseconds: 60_000 });
  Promise.all(
    WEIGHTS.map(async (weight) => {
      const face = new FontFace(FAMILY, `url(${fontUrl(weight)}) format("woff2")`, { weight, style: "normal" });
      document.fonts.add(await face.load());
    }),
  )
    .catch((error) => console.warn("[remotion] Inter did not load; using the fallback font", error))
    .finally(() => continueRender(handle));
}

load();

export const FONT = `"${FAMILY}", Inter, "Helvetica Neue", Arial, sans-serif`;
