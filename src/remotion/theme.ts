import type { BrandLook, VideoStyle } from "../lib/video/formats";

/**
 * Colour helpers for the templates. Every colour on screen is derived from
 * the brand's four colours, so any brand (a pale yellow, a near-black) still
 * gets legible text: the derived shades are pushed until they contrast.
 */

type Rgb = [number, number, number];

function parse(hex: string): Rgb {
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3) value = value.split("").map((c) => c + c).join("");
  const n = Number.parseInt(value.slice(0, 6), 16);
  if (!/^[0-9a-f]{6}/i.test(value) || Number.isNaN(n)) return [79, 70, 229];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

/** `a` blended towards `b` by `t` (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const x = parse(a);
  const y = parse(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** The colour with an alpha, for CSS. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.32;
}

/** Near-black or white, whichever reads better on the colour. */
export function readableOn(hex: string): string {
  return contrast(hex, "#ffffff") >= contrast(hex, "#0f0f14") ? "#ffffff" : "#0f0f14";
}

/** The colour darkened (or lightened) just enough to reach `ratio` against `on`. */
export function ensureContrast(hex: string, on: string, ratio: number): string {
  if (contrast(hex, on) >= ratio) return hex;
  const towards = isDark(on) ? "#ffffff" : "#000000";
  for (let t = 0.08; t <= 1; t += 0.08) {
    const candidate = mix(hex, towards, t);
    if (contrast(candidate, on) >= ratio) return candidate;
  }
  return towards;
}

/** The colours one template uses; `dark` says which way the scene leans. */
export type Palette = {
  dark: boolean;
  /** Scene background, top and bottom of its gradient. */
  bgTop: string;
  bgBottom: string;
  /** Headline and body text on the background. */
  ink: string;
  inkSoft: string;
  /** The brand colour as a text colour on the background (the second headline line). */
  highlight: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  /** Cards on the background. */
  card: string;
  cardInk: string;
  cardInkSoft: string;
  cardBorder: string;
  /** Caption word boxes. */
  captionBox: string;
  captionInk: string;
  glowA: string;
  glowB: string;
};

/**
 * bold: the reference reel's warm, pale brand tint with dark text;
 * numbers: a deep brand gradient with white text and accent figures;
 * story: dark (the pictures carry the colour).
 */
export function palette(brand: BrandLook, style: VideoStyle): Palette {
  const primary = brand.primary;
  const accent = brand.accent;
  if (style === "bold") {
    const base = isDark(brand.background) ? mix(primary, "#ffffff", 0.93) : brand.background;
    const bgTop = mix(base, "#ffffff", 0.55);
    const bgBottom = mix(base, primary, 0.1);
    const ink = ensureContrast(isDark(brand.text) ? brand.text : "#14141c", bgBottom, 9);
    return {
      dark: false,
      bgTop,
      bgBottom,
      ink,
      inkSoft: mix(ink, bgTop, 0.42),
      highlight: ensureContrast(primary, bgBottom, 3.2),
      primary,
      onPrimary: readableOn(primary),
      accent,
      onAccent: readableOn(accent),
      card: "#ffffff",
      cardInk: ink,
      cardInkSoft: mix(ink, "#ffffff", 0.48),
      cardBorder: alpha(ink, 0.07),
      captionBox: mix(ink, "#000000", 0.4),
      captionInk: "#ffffff",
      glowA: alpha(primary, 0.16),
      glowB: alpha(accent, 0.14),
    };
  }
  const deep = isDark(primary) ? mix(primary, "#000000", 0.35) : mix(primary, "#06060c", 0.62);
  const bgTop = style === "story" ? "#0b0b12" : mix(primary, "#06060c", 0.38);
  const bgBottom = style === "story" ? "#050508" : deep;
  const highlight = ensureContrast(accent, bgBottom, 4.5);
  return {
    dark: true,
    bgTop,
    bgBottom,
    ink: "#ffffff",
    inkSoft: "rgba(255, 255, 255, 0.72)",
    highlight,
    primary,
    onPrimary: readableOn(primary),
    accent: highlight,
    onAccent: readableOn(highlight),
    card: "rgba(255, 255, 255, 0.08)",
    cardInk: "#ffffff",
    cardInkSoft: "rgba(255, 255, 255, 0.66)",
    cardBorder: "rgba(255, 255, 255, 0.14)",
    captionBox: "#ffffff",
    captionInk: "#0f0f14",
    glowA: alpha(mix(primary, "#ffffff", 0.15), 0.55),
    glowB: alpha(mix(primary, "#ffffff", 0.35), 0.28),
  };
}
