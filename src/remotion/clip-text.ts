import { LOOK_SPECS, type CaptionLook } from "./caption-looks";
import { fitFontSize, splitWords } from "./text";

/**
 * The text on a Viral clip as the customer styles it (client, 2026-11-24:
 * "People may needed different size and change the position of the text";
 * his mockup repget_video_editor_no_scenes.html): font, weight, size, colour,
 * alignment, case, outline, background and where it sits. Saved with the
 * video (ProductionChoices.textStyle); without one the video keeps the look
 * picked for it (caption-looks.ts).
 *
 * The preview, the editor's drag box and the render all draw it with
 * components/ClipText.tsx, so the text sits at the same place in each.
 *
 * Pure: no React, no fonts loaded here (fonts.ts loads the faces).
 */

export const CLIP_FRAME = { width: 1080, height: 1920 } as const;

/**
 * The faces, all shipped with the app (public/video-fonts): free ones close
 * to Arial, Georgia, Impact and Trebuchet, which the render machine does not
 * have and RepGet may not ship. `em` and `upper`: a generous letter
 * width, as written and in capitals, so what is counted to fit does.
 */
export const CLIP_FONTS = {
  inter: { weights: [500, 700, 800, 900], em: 0.64, upper: 0.76 },
  arimo: { weights: [500, 700], em: 0.6, upper: 0.76 },
  gelasio: { weights: [500, 700], em: 0.6, upper: 0.8 },
  anton: { weights: [400], em: 0.5, upper: 0.52 },
  fira: { weights: [500, 700, 900], em: 0.62, upper: 0.72 },
  courier: { weights: [700], em: 0.61, upper: 0.61 },
  marker: { weights: [400], em: 0.7, upper: 0.76 },
} as const satisfies Record<string, { weights: readonly number[]; em: number; upper: number }>;
export type ClipFont = keyof typeof CLIP_FONTS;
export const CLIP_FONT_KEYS = Object.keys(CLIP_FONTS) as ClipFont[];

export const CLIP_ALIGNS = ["left", "center", "right"] as const;
export const CLIP_CASES = ["normal", "upper", "lower"] as const;
/** The backgrounds offered one by one; "orange" and "highlight" come with their quick style. */
export const CLIP_BACKGROUNDS = ["none", "dark", "light", "orange", "highlight"] as const;
export const CLIP_SIZE = { min: 28, max: 160 } as const;
export const CLIP_STROKE_MAX = 6;
export const CLIP_WIDTH = { min: 25, max: 96 } as const;
/** Percent of the frame the text stays away from its edges. */
const EDGE = 2;
export const CLIP_TOP = 3;

export type ClipTextStyle = {
  font: ClipFont;
  weight: number;
  /** Px on the 1080-wide frame. */
  size: number;
  /** #rrggbb. */
  color: string;
  align: (typeof CLIP_ALIGNS)[number];
  case: (typeof CLIP_CASES)[number];
  /** 0-6. */
  stroke: number;
  strokeColor: string;
  bg: (typeof CLIP_BACKGROUNDS)[number];
  /** #rrggbb for the highlighted words (*word* in the text; client, 2026-11-26 reference: white type with one word in red); absent = no highlight colour. */
  accent?: string | null;
  /** The text box: its left, top and width, in percent of the frame. */
  x: number;
  y: number;
  w: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === "string" && (list as readonly string[]).includes(value);
const isColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** The face's weight nearest the one asked for. */
export function nearestWeight(font: ClipFont, weight: number): number {
  return [...CLIP_FONTS[font].weights].sort((a, b) => Math.abs(a - weight) - Math.abs(b - weight))[0];
}

/** Every number within its range and the box inside the frame. */
export function boundClipText(style: ClipTextStyle): ClipTextStyle {
  const w = round1(clamp(style.w, CLIP_WIDTH.min, CLIP_WIDTH.max));
  return {
    ...style,
    weight: nearestWeight(style.font, style.weight),
    size: Math.round(clamp(style.size, CLIP_SIZE.min, CLIP_SIZE.max)),
    stroke: Math.round(clamp(style.stroke, 0, CLIP_STROKE_MAX)),
    w,
    x: round1(clamp(style.x, EDGE, 100 - EDGE - w)),
    y: round1(clamp(style.y, CLIP_TOP, 96)),
  };
}

/** A saved or sent style checked: null when it is not one; numbers out of range are brought back into it. */
export function cleanClipText(value: unknown): ClipTextStyle | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.font !== "string" || !Object.hasOwn(CLIP_FONTS, v.font)) return null;
  if (!isColor(v.color) || !isColor(v.strokeColor)) return null;
  if (!oneOf(CLIP_ALIGNS, v.align) || !oneOf(CLIP_CASES, v.case) || !oneOf(CLIP_BACKGROUNDS, v.bg)) return null;
  if (!isNumber(v.weight) || !isNumber(v.size) || !isNumber(v.stroke) || !isNumber(v.x) || !isNumber(v.y) || !isNumber(v.w)) return null;
  return boundClipText({
    font: v.font as ClipFont,
    weight: v.weight,
    size: v.size,
    color: v.color.toLowerCase(),
    align: v.align,
    case: v.case,
    stroke: v.stroke,
    strokeColor: v.strokeColor.toLowerCase(),
    bg: v.bg,
    ...(isColor(v.accent) ? { accent: v.accent.toLowerCase() } : {}),
    x: v.x,
    y: v.y,
    w: v.w,
  });
}

export function shownClipText(text: string, style: Pick<ClipTextStyle, "case">): string {
  return style.case === "upper" ? text.toUpperCase() : style.case === "lower" ? text.toLowerCase() : text;
}

export const CLIP_LINE_HEIGHT = 1.2;
const BOXED_LINE_HEIGHT = 1.5;
const boxed = (style: Pick<ClipTextStyle, "bg">) => style.bg === "dark" || style.bg === "light" || style.bg === "orange";

export function clipLineHeight(style: Pick<ClipTextStyle, "bg">): number {
  return boxed(style) ? BOXED_LINE_HEIGHT : CLIP_LINE_HEIGHT;
}

/** The lines the words take in `width` px, word by word as the browser wraps them; a word longer than a line takes several. */
export function countLines(text: string, width: number, charPx: number): number {
  const room = Math.max(1, Math.floor(width / charPx));
  let lines = 1;
  let used = 0;
  for (const word of splitWords(text)) {
    if (used > 0 && used + 1 + word.length <= room) {
      used += 1 + word.length;
      continue;
    }
    if (used > 0) lines += 1;
    lines += Math.ceil(word.length / room) - 1;
    used = word.length % room || (word.length ? room : 0);
  }
  return lines;
}

export type ClipTextLayout = { left: number; width: number; size: number };

/**
 * The text's column and size on the 1080x1920 frame. Where it ends is up to
 * the browser (ClipText.tsx keeps it inside the frame); the size chosen is made
 * smaller where the longest word would not fit a line, or the text the frame,
 * so no word is broken or cut off (down to CLIP_SIZE.min).
 */
export function clipTextLayout(text: string, style: ClipTextStyle): ClipTextLayout {
  const bound = boundClipText(style);
  const shown = shownClipText(text, bound);
  const left = Math.round((bound.x / 100) * CLIP_FRAME.width);
  const width = Math.round((bound.w / 100) * CLIP_FRAME.width);
  const em = bound.case === "upper" ? CLIP_FONTS[bound.font].upper : CLIP_FONTS[bound.font].em;
  const longest = splitWords(shown).reduce((n, word) => Math.max(n, word === word.toUpperCase() && /\p{L}{2}/u.test(word) ? (word.length * CLIP_FONTS[bound.font].upper) / em : word.length), 1);
  const room = CLIP_FRAME.height * (1 - (2 * CLIP_TOP) / 100);
  let size = bound.size;
  while (size > CLIP_SIZE.min) {
    const inner = boxed(bound) ? width - size * 0.72 : width;
    if (longest * size * em <= inner && countLines(shown, inner, size * em) * size * clipLineHeight(bound) <= room) break;
    size = Math.max(CLIP_SIZE.min, size - 2);
  }
  return { left, width, size };
}

/** A style to start from that looks like the look picked for the video, where that look draws its text. */
export function clipTextFromLook(look: CaptionLook, text: string, place: { left: number; top: number; width: number; align: "left" | "center"; scale?: number }): ClipTextStyle {
  const spec = LOOK_SPECS[look];
  const scale = place.scale ?? 1;
  const shown = spec.upper ? text.toUpperCase() : text;
  return boundClipText({
    font: spec.face,
    weight: spec.weight,
    size: fitFontSize(shown, spec.paint === "box" ? place.width - 48 : place.width, 3, Math.round(spec.max * scale), Math.round(spec.min * scale), spec.charEm),
    color: spec.paint === "box" ? "#111114" : "#ffffff",
    align: place.align,
    case: spec.upper ? "upper" : "normal",
    stroke: spec.paint === "box" ? 0 : spec.stroke >= 3 ? 2 : 1,
    strokeColor: "#000000",
    bg: spec.paint === "box" ? "light" : "none",
    x: (place.left / CLIP_FRAME.width) * 100,
    y: (place.top / CLIP_FRAME.height) * 100,
    w: (place.width / CLIP_FRAME.width) * 100,
  });
}

/** The mockup's quick styles: a starting point, every part of it can be changed after. The size and place stay (but "subtitle", which goes to the bottom). */
export const CLIP_PRESETS = ["clean", "bold", "outline", "highlight", "box", "whitebox", "orange", "subtitle"] as const;
export type ClipPreset = (typeof CLIP_PRESETS)[number];
const PRESET: Record<ClipPreset, Partial<ClipTextStyle>> = {
  clean: { weight: 500, color: "#ffffff", stroke: 0, bg: "none" },
  bold: { weight: 900, color: "#ffffff", stroke: 0, bg: "none" },
  outline: { weight: 900, color: "#ffffff", stroke: 2, strokeColor: "#17212c", bg: "none" },
  highlight: { weight: 800, color: "#ffffff", stroke: 0, bg: "highlight" },
  box: { weight: 800, color: "#ffffff", stroke: 0, bg: "dark" },
  whitebox: { weight: 800, color: "#222832", stroke: 0, bg: "light" },
  orange: { weight: 900, color: "#ffffff", stroke: 0, bg: "orange" },
  subtitle: { weight: 700, color: "#ffffff", stroke: 1, strokeColor: "#000000", bg: "none", size: 56, align: "center", x: 10, y: 70, w: 80 },
};

export function withClipPreset(style: ClipTextStyle, preset: ClipPreset): ClipTextStyle {
  return boundClipText({ ...style, font: "inter", case: "normal", ...PRESET[preset] });
}

/** The quick style the style is, or null once it was changed. */
export function clipPresetOf(style: ClipTextStyle): ClipPreset | null {
  return CLIP_PRESETS.find((preset) => JSON.stringify(withClipPreset(style, preset)) === JSON.stringify(boundClipText(style))) ?? null;
}
