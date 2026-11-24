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

/**
 * The caption looks' own faces (caption-looks.ts; client, 2026-11-23: "Also is
 * missing the changing of the font text character etc as reference"), from
 * @fontsource 5 like Inter: Anton (OFL), Courier Prime (OFL), Permanent
 * Marker (Apache 2.0, Latin only: other letters come from Inter). Licences
 * in public/video-fonts.
 */
export const ANTON = "RepGet Anton";
export const COURIER = "RepGet Courier Prime";
export const MARKER = "RepGet Marker";
const EXTRA_FACES: { family: string; file: string; weight: string; ext?: string }[] = [
  { family: ANTON, file: "anton-latin-400-normal.woff2", weight: "400", ext: "anton-latin-ext-400-normal.woff2" },
  { family: COURIER, file: "courier-prime-latin-700-normal.woff2", weight: "700", ext: "courier-prime-latin-ext-700-normal.woff2" },
  { family: MARKER, file: "permanent-marker-latin-400-normal.woff2", weight: "400" },
];

/**
 * The other faces a customer can choose for the text on a Viral clip
 * (clip-text.ts; client, 2026-11-24), @fontsource 5, OFL: Arimo, Gelasio and
 * Fira Sans. Loaded when a text uses one, not with every video.
 */
export const ARIMO = "RepGet Arimo";
export const GELASIO = "RepGet Gelasio";
export const FIRA = "RepGet Fira Sans";
const CLIP_FACES: Record<string, { family: string; file: string; weights: string[] }> = {
  arimo: { family: ARIMO, file: "arimo", weights: ["500", "700"] },
  gelasio: { family: GELASIO, file: "gelasio", weights: ["500", "700"] },
  fira: { family: FIRA, file: "fira-sans", weights: ["500", "700", "900"] },
};
const clipFontsAsked = new Set<string>();

/** Loads a chosen face once; the render waits for it, and a face that fails falls back to Inter. */
export function ensureClipFont(font: string): void {
  const face = CLIP_FACES[font];
  if (!face || clipFontsAsked.has(font) || typeof document === "undefined" || typeof FontFace === "undefined") return;
  clipFontsAsked.add(font);
  const handle = delayRender(`Loading ${face.family}`, { timeoutInMilliseconds: 60_000 });
  Promise.all(face.weights.flatMap((weight) => [addFace(face.family, `${face.file}-latin-${weight}-normal.woff2`, weight), addFace(face.family, `${face.file}-latin-ext-${weight}-normal.woff2`, weight, LATIN_EXT_RANGE)]))
    .catch((error) => console.warn(`[remotion] ${face.family} did not load; using Inter`, error))
    .finally(() => continueRender(handle));
}

async function addFace(family: string, file: string, weight: string, unicodeRange?: string): Promise<void> {
  const face = new FontFace(family, `url(${staticFile(`video-fonts/${file}`)}) format("woff2")`, { weight, style: "normal", ...(unicodeRange ? { unicodeRange } : {}) });
  document.fonts.add(await face.load());
}

function load(): void {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return;
  const handle = delayRender("Loading the fonts", { timeoutInMilliseconds: 60_000 });
  Promise.all([
    ...EXTRA_FACES.flatMap((face) => [addFace(face.family, face.file, face.weight), ...(face.ext ? [addFace(face.family, face.ext, face.weight, LATIN_EXT_RANGE)] : [])].map((p) => p.catch((error) => console.warn(`[remotion] ${face.family} did not load; using Inter`, error)))),
    ...WEIGHTS.flatMap((weight) => [
      (async () => {
        const face = new FontFace(FAMILY, `url(${fontUrl(weight)}) format("woff2")`, { weight, style: "normal" });
        document.fonts.add(await face.load());
      })(),
      (async () => {
        const face = new FontFace(FAMILY, `url(${fontUrl(weight, "latin-ext")}) format("woff2")`, { weight, style: "normal", unicodeRange: LATIN_EXT_RANGE });
        document.fonts.add(await face.load());
      })(),
    ]),
  ])
    .catch((error) => console.warn("[remotion] Inter did not load; using the fallback font", error))
    .finally(() => continueRender(handle));
}

load();

export const FONT = `"${FAMILY}", Inter, "Helvetica Neue", Arial, sans-serif`;
