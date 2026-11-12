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

export const fontUrl = (weight: string, subset: "latin" | "latin-ext" = "latin") => staticFile(`video-fonts/inter-${subset}-${weight}-normal.woff2`);

/**
 * Latin Extended (2026-11-12): Romanian (ș ț ă î â) and Polish (ą ę ł ś ź ż)
 * scripts need glyphs the Latin subset lacks; the browser takes them from
 * this face only for those characters (@fontsource/inter 5.0.18, OFL).
 */
const LATIN_EXT_RANGE = "U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

function load(): void {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return;
  const handle = delayRender("Loading the Inter font", { timeoutInMilliseconds: 60_000 });
  Promise.all(
    WEIGHTS.flatMap((weight) => [
      (async () => {
        const face = new FontFace(FAMILY, `url(${fontUrl(weight)}) format("woff2")`, { weight, style: "normal" });
        document.fonts.add(await face.load());
      })(),
      (async () => {
        const face = new FontFace(FAMILY, `url(${fontUrl(weight, "latin-ext")}) format("woff2")`, { weight, style: "normal", unicodeRange: LATIN_EXT_RANGE });
        document.fonts.add(await face.load());
      })(),
    ]),
  )
    .catch((error) => console.warn("[remotion] Inter did not load; using the fallback font", error))
    .finally(() => continueRender(handle));
}

load();

export const FONT = `"${FAMILY}", Inter, "Helvetica Neue", Arial, sans-serif`;
