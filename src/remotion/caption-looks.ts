/**
 * The text looks of the Viral videos' one line (client, 2026-11-23: "Also is
 * missing the changing of the font text character etc as reference"): his
 * reference reels change the font from video to video - mostly a plain
 * TikTok-style line with a thin outline, sometimes big and bold, a white
 * label, a typewriter, a meme face or handwriting. Each video gets one,
 * the same every time for the same video (the preview, the render and a
 * remake agree), varied across videos - so two customers' videos differ in
 * their type too.
 *
 * Pure: no React, no fonts loaded here (fonts.ts loads the faces).
 */

export const CAPTION_LOOKS = ["native", "bold", "box", "typewriter", "meme", "marker"] as const;
export type CaptionLook = (typeof CAPTION_LOOKS)[number];

export type LookSpec = {
  /** "inter" | "anton" | "courier" | "marker": the face (fonts.ts). */
  face: "inter" | "anton" | "courier" | "marker";
  weight: number;
  /** Font size range in px for 1080-wide frames, and the face's average letter width in em (text.ts fitFontSize). */
  max: number;
  min: number;
  charEm: number;
  lineHeight: number;
  letterSpacing: string;
  upper: boolean;
  /** "outline": white letters with a dark outline of `stroke` px; "box": dark letters on a white label. */
  paint: "outline" | "box";
  stroke: number;
};

export const LOOK_SPECS: Record<CaptionLook, LookSpec> = {
  native: { face: "inter", weight: 700, max: 60, min: 40, charEm: 0.54, lineHeight: 1.2, letterSpacing: "0em", upper: false, paint: "outline", stroke: 1.5 },
  bold: { face: "inter", weight: 900, max: 78, min: 48, charEm: 0.58, lineHeight: 1.06, letterSpacing: "-0.02em", upper: false, paint: "outline", stroke: 3 },
  box: { face: "inter", weight: 700, max: 54, min: 38, charEm: 0.54, lineHeight: 1.5, letterSpacing: "0em", upper: false, paint: "box", stroke: 0 },
  typewriter: { face: "courier", weight: 700, max: 60, min: 40, charEm: 0.6, lineHeight: 1.2, letterSpacing: "0em", upper: false, paint: "outline", stroke: 2 },
  meme: { face: "anton", weight: 400, max: 86, min: 52, charEm: 0.46, lineHeight: 1.04, letterSpacing: "0.01em", upper: true, paint: "outline", stroke: 3.5 },
  marker: { face: "marker", weight: 400, max: 64, min: 42, charEm: 0.62, lineHeight: 1.15, letterSpacing: "0em", upper: false, paint: "outline", stroke: 2 },
};

/** A small, stable string hash (FNV-1a). */
export function lookHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The look for a seed: the same seed, the same look. */
export function captionLookFor(seed: string): CaptionLook {
  return CAPTION_LOOKS[lookHash(seed) % CAPTION_LOOKS.length];
}

/** A POV clip video's look, from its clip and its own mirror/zoom/hue (set once when the idea is written), so editing the line keeps it. */
export function povCaptionLook(pov: { id: string; mirror: boolean; zoom: number; hue: number }): CaptionLook {
  return captionLookFor(`pov|${pov.id}|${pov.mirror ? 1 : 0}|${pov.zoom}|${pov.hue}`);
}

/** A hook clip video's look for its opening line, from the clip picked and the line. */
export function hookCaptionLook(pickId: string | null | undefined, text: string): CaptionLook {
  return captionLookFor(`hook|${pickId ?? ""}|${text.trim()}`);
}

/** A dark outline of `px` in eight directions plus a soft shadow, so white letters read on any clip. */
export function outlineShadow(px: number): string {
  if (px <= 0) return "0 4px 18px rgba(0,0,0,0.55)";
  const d = [-1, 0, 1];
  const rings = d.flatMap((x) => d.filter((y) => x !== 0 || y !== 0).map((y) => `${x * px}px ${y * px}px 0 #000`));
  return [...rings, "0 4px 18px rgba(0,0,0,0.55)"].join(", ");
}
