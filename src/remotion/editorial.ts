import type { BrandLook, CreativeDirection, EditorialImage, MediaItem, ProductionChoices, ReelProps, ShotPlan, VideoFormat, VideoScript } from "../lib/video/formats";
import { boundClipText, cleanClipText, CLIP_FONTS, CLIP_SIZE, countLines, shownClipText, type ClipTextStyle } from "./clip-text";
import { safeArea, type SceneRole } from "./production";
import { isProduction, type ProductionReelProps } from "./props";
import { emphasis, splitWords } from "./text";
import { contrast } from "./theme";

/**
 * The editorial look (client, 2026-11-26: "the rest of kind educational
 * content ... looks cheap and simple ... grabbing images from the blog post,
 * insert few captions there as carousel and making the photos carousel
 * looking premium", his reference: black, huge condensed white capitals, the
 * key words in red, a real photo overlapping bottom right). The rules here
 * are shared by the carousel slides, the reel and the editor, so a slide, a
 * scene and the drag box agree on where the words and the picture are.
 *
 * Pure: no React, no fonts (directions/Editorial.tsx draws it).
 */

/** The reference's red, for a brand without a colour that reads on black. */
export const EDITORIAL_RED = "#ff2d2d";
/** The near-black the slides sit on. */
export const EDITORIAL_INK = "#0b0b0d";

export type Frame = { width: number; height: number };
export type Bounds = { top: number; bottom: number; left: number; right: number };

export const EDITORIAL_FRAMES: Record<VideoFormat, Frame> = {
  carousel: { width: 1080, height: 1350 },
  reel: { width: 1080, height: 1920 },
  story: { width: 1080, height: 1920 },
};

/** The brand row's height and its distance from the bottom of the slide or the reel's safe area. */
export const EDITORIAL_FOOTER = { carousel: { bottom: 52, height: 56 }, video: { above: 34, height: 56 } } as const;

/**
 * Where text and pictures may go: inside the slide, above its brand row; in a
 * reel or Story, inside the safe area (out of the apps' buttons and caption).
 */
export function editorialBounds(format: VideoFormat): Bounds {
  if (format === "carousel") {
    const footer = EDITORIAL_FOOTER.carousel;
    return { top: 64, bottom: EDITORIAL_FRAMES.carousel.height - footer.bottom - footer.height - 34, left: 80, right: 1000 };
  }
  const safe = safeArea(format === "story");
  const footer = EDITORIAL_FOOTER.video;
  return { top: safe.top + 10, bottom: safe.bottom - footer.above - footer.height - 30, left: safe.left, right: safe.right };
}

const hex = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

/** 0 (grey) to 1 (pure colour). */
function saturation(color: string): number {
  const n = Number.parseInt(color.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return (max - min) / (1 - Math.abs(2 * l - 1));
}

/**
 * The highlight colour a video starts with: the brand's accent, else its main
 * colour, when it is a real colour that stands out on black; else the
 * reference's red. A pale or grey brand colour would not read as a highlight.
 */
export function editorialAccent(brand?: Pick<BrandLook, "primary" | "accent"> | null): string {
  for (const color of [brand?.accent, brand?.primary]) {
    if (hex(color) && saturation(color) >= 0.5 && contrast(color, EDITORIAL_INK) >= 4.5 && contrast(color, "#ffffff") >= 2) return color.toLowerCase();
  }
  return EDITORIAL_RED;
}

/**
 * The text style an editorial video starts with (the reference): the
 * Impact-style face in capitals, white, left aligned at the top, as large as
 * it fits, the brand's highlight colour for the *starred* words. The customer
 * changes any of it in the editor (one style for the whole video).
 */
export function editorialDefaultStyle(format: VideoFormat, brand?: Pick<BrandLook, "primary" | "accent"> | null): ClipTextStyle {
  const frame = EDITORIAL_FRAMES[format] ?? EDITORIAL_FRAMES.reel;
  const bounds = editorialBounds(format);
  const top = format === "carousel" ? 100 : bounds.top + 50;
  return boundClipText({
    font: "anton",
    weight: 400,
    size: format === "carousel" ? 150 : 140,
    color: "#ffffff",
    align: "left",
    case: "upper",
    stroke: 0,
    strokeColor: "#000000",
    bg: "none",
    accent: editorialAccent(brand),
    x: (bounds.left / frame.width) * 100,
    y: (top / frame.height) * 100,
    w: ((bounds.right - bounds.left) / frame.width) * 100,
  });
}

/** The video's text style: the customer's own (with a highlight colour), else the default. */
export function editorialStyleOf(production: Pick<ProductionChoices, "textStyle"> | null | undefined, format: VideoFormat, brand?: Pick<BrandLook, "primary" | "accent"> | null): ClipTextStyle {
  const own = cleanClipText(production?.textStyle);
  if (!own) return editorialDefaultStyle(format, brand);
  return own.accent ? own : { ...own, accent: editorialAccent(brand) };
}

/* ---------------------------------------------------------------------------
 * Highlighted words: the writer stars one or two words ("Instagram just gave
 * you *an advantage*. *Use it*"). They show in the highlight colour; the
 * stars themselves are never shown (nor spoken, nor posted).
 * ------------------------------------------------------------------------ */

const MARKED = /\*([^*\n]+)\*/g;

/**
 * The text without its stars, for every place it is shown, spoken or posted:
 * every asterisk goes, paired or not. The one rule: lib/video/editorial-images.ts
 * plainText (post texts, titles, the voice) is this function.
 */
export function stripHighlight(text: string): string {
  if (!text.includes("*")) return text;
  return text.replace(/\*+/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

/** The longest point title: an editorial slide's statement is up to about twelve words, the other productions' a short heading. */
export const EDITORIAL_TITLE_MAX = 90;
export function pointTitleMax(direction: CreativeDirection): number {
  return direction === "editorial" ? EDITORIAL_TITLE_MAX : 48;
}

export type HighlightRun = { text: string; strong: boolean };

/** The text cut into plain and highlighted runs, the stars removed (a lone star is dropped). */
export function highlightRuns(text: string): HighlightRun[] {
  const runs: HighlightRun[] = [];
  const push = (value: string, strong: boolean) => {
    const clean = value.replace(/\*/g, "");
    if (!clean) return;
    const last = runs[runs.length - 1];
    if (last && last.strong === strong) last.text += clean;
    else runs.push({ text: clean, strong });
  };
  let at = 0;
  for (const match of text.matchAll(MARKED)) {
    const index = match.index ?? 0;
    push(text.slice(at, index), false);
    push(match[1], true);
    at = index + match[0].length;
  }
  push(text.slice(at), false);
  return runs;
}

export function hasHighlight(text: string): boolean {
  return highlightRuns(text).some((run) => run.strong && run.text.trim() !== "");
}

export type EditorialWord = { text: string; strong: boolean };

/**
 * The words to draw, each highlighted or not. A word is highlighted when any
 * of it was starred ("*advantage*." keeps its full stop in the colour). A
 * text with no stars (older ideas, or a customer who wrote none) gets the
 * templates' own pick when `auto`: the figures, else the closing words.
 */
export function editorialWords(text: string, auto = true): EditorialWord[] {
  const words: EditorialWord[] = [];
  let open = false;
  for (const run of highlightRuns(text)) {
    for (const piece of run.text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) {
        open = false;
        continue;
      }
      const last = words[words.length - 1];
      if (open && last) {
        last.text += piece;
        last.strong ||= run.strong;
      } else words.push({ text: piece, strong: run.strong });
      open = true;
    }
  }
  if (auto && words.length > 2 && !words.some((word) => word.strong)) {
    const strong = emphasis(words.map((word) => word.text));
    return words.map((word, i) => ({ ...word, strong: strong.has(i) }));
  }
  return words;
}

/** The script with every star removed: what the other looks draw (only the editorial look highlights). */
export function plainScript(script: VideoScript): VideoScript {
  return {
    ...script,
    hook: stripHighlight(script.hook),
    points: script.points.map((point) => ({
      ...point,
      title: stripHighlight(point.title),
      detail: stripHighlight(point.detail ?? ""),
      stat: point.stat ? { ...point.stat, suffix: stripHighlight(point.stat.suffix), label: stripHighlight(point.stat.label) } : null,
    })),
    proof: stripHighlight(script.proof),
    cta: stripHighlight(script.cta),
  };
}


/**
 * The props as every look but the editorial one draws them: the stars
 * removed from the script and the closing line (Reel.tsx, Slide.tsx), so a
 * video switched to another look never shows them.
 */
export function withoutStars<P extends ReelProps & Partial<ProductionReelProps>>(props: P): P {
  if (props.direction === "editorial" && isProduction(props)) return props;
  const ctaText = props.production?.ctaText;
  return {
    ...props,
    script: plainScript(props.script),
    ...(props.production && ctaText ? { production: { ...props.production, ctaText: stripHighlight(ctaText) } } : {}),
  };
}

/* ---------------------------------------------------------------------------
 * Pictures and layouts.
 * ------------------------------------------------------------------------ */

/**
 * The pictures an editorial video uses: the plan's (the website's own, found
 * when the idea was written), else the idea's own pictures (the website's and
 * those the customer added). Never stock: none means typographic slides.
 */
export function editorialImages(plan: Pick<ShotPlan, "images"> | null | undefined, media?: MediaItem[] | null): EditorialImage[] {
  const planned = (plan?.images ?? []).filter((image) => image && typeof image.url === "string" && image.url !== "");
  if (planned.length) return planned;
  const seen = new Set<string>();
  return (media ?? [])
    .filter((item) => item.kind === "image" && item.url && !seen.has(item.url) && seen.add(item.url))
    .map((item) => ({ url: item.url, alt: null, source: "website" as const, pageUrl: null, width: null, height: null }));
}

/** The picture a slide or scene shows: the cover the first, and so on, starting over when there are fewer pictures than parts. */
export function editorialImageFor(images: EditorialImage[] | null | undefined, partIndex: number): EditorialImage | null {
  const list = (images ?? []).filter((image) => image && typeof image.url === "string" && image.url !== "");
  if (!list.length) return null;
  const i = Math.max(0, Math.floor(Number.isFinite(partIndex) ? partIndex : 0));
  return list[i % list.length];
}

/**
 * How a slide or scene is laid out, varied along the video:
 *  - cover: black, huge type, the picture as a tilted card overlapping it;
 *  - bleed: the picture full frame under a strong dark gradient;
 *  - card: black, the picture as a large rounded card beside the text;
 *  - frame: the picture edge to edge on one side, fading into black;
 *  - end: the closing line over the picture, darkened, with the brand large;
 *  - type: no picture - big type on the brand colour.
 */
export type EditorialLayout = "cover" | "bleed" | "card" | "frame" | "end" | "type";
const INNER: EditorialLayout[] = ["bleed", "card", "frame"];

/**
 * A diagram, chart or screenshot (EditorialImage.graphic: flat colours and its own words) is only ever
 * shown framed - the cover's card or a card beside the text - never full frame under the words, where its
 * own text fights them (owner, 2026-11-26: repget.com's blog pictures are diagrams); the closing slide
 * is then plain type on the brand colour.
 */
export function editorialLayout(index: number, role: SceneRole, hasImage: boolean, graphic = false): EditorialLayout {
  if (role === "cta") return hasImage && graphic ? "type" : "end";
  if (index <= 0) return "cover";
  if (!hasImage) return "type";
  if (graphic) return "card";
  return INNER[(index - 1) % INNER.length];
}

/** The share of the text area the words may take: the rest is the picture's. */
const TEXT_SHARE: Record<EditorialLayout, number> = { cover: 0.58, bleed: 1, card: 0.5, frame: 0.5, end: 1, type: 1 };

export type EditorialTextBox = {
  left: number;
  top: number;
  width: number;
  /** The title's size, made smaller where it would not fit (never under CLIP_SIZE.min). */
  size: number;
  lineHeight: number;
  /** The supporting line: its size and the gap above it. */
  detailSize: number;
  detailGap: number;
  /** The whole block, title and supporting line, as estimated. */
  height: number;
};

export type EditorialRect = { left: number; top: number; width: number; height: number };

export type EditorialScene = {
  frame: Frame;
  bounds: Bounds;
  text: EditorialTextBox;
  /** Whether the text sits in the upper part of the frame (the picture then goes under it). */
  textTop: boolean;
  /**
   * Where the picture goes for a card, frame or cover layout; null for the
   * full-frame ones. Under the text, the slide lays it out after the text as
   * drawn (directions/Editorial.tsx), so this is its estimate there.
   */
  photo: EditorialRect | null;
  /** Px between the text and the picture. */
  gap: number;
  /** The cover card's overlap of the last line, and the frame picture's fade into black. */
  overlap: number;
  fade: number;
};

export function editorialLineHeight(style: Pick<ClipTextStyle, "font" | "bg">): number {
  if (style.bg === "dark" || style.bg === "light" || style.bg === "orange") return 1.42;
  return style.font === "anton" ? 1.02 : style.font === "marker" ? 1.18 : 1.1;
}

/**
 * The text block and the picture of one slide or scene. The text keeps the
 * customer's place (x, y, width in percent of the frame) and shrinks until it
 * fits its share; the picture takes the larger free side, so moving the text
 * to the bottom puts the picture on top.
 */
export function editorialScene(title: string, detail: string | null, style: ClipTextStyle, format: VideoFormat, layout: EditorialLayout): EditorialScene {
  const frame = EDITORIAL_FRAMES[format] ?? EDITORIAL_FRAMES.reel;
  const bounds = editorialBounds(format);
  const bound = boundClipText(style);
  const left = Math.round((bound.x / 100) * frame.width);
  const width = Math.round((bound.w / 100) * frame.width);
  const lineHeight = editorialLineHeight(bound);
  const shown = shownClipText(stripHighlight(title), bound);
  const em = bound.case === "upper" ? CLIP_FONTS[bound.font].upper : CLIP_FONTS[bound.font].em;
  const longest = splitWords(shown).reduce((n, word) => Math.max(n, word.length), 1);
  const detailText = detail ? stripHighlight(detail) : "";
  const detailSize = format === "carousel" ? 36 : 40;
  const detailGap = detailText ? Math.round(detailSize * 0.8) : 0;
  const detailHeight = detailText ? detailGap + countLines(detailText, width, detailSize * 0.56) * detailSize * 1.3 : 0;
  const room = (bounds.bottom - bounds.top) * TEXT_SHARE[layout];
  const boxed = bound.bg === "dark" || bound.bg === "light" || bound.bg === "orange";
  let size = bound.size;
  let titleHeight = 0;
  for (;;) {
    const inner = boxed ? width - size * 0.72 : width;
    titleHeight = countLines(shown, inner, size * em) * size * lineHeight;
    if (size <= CLIP_SIZE.min || (longest * size * em <= inner && titleHeight + detailHeight <= room)) break;
    size = Math.max(CLIP_SIZE.min, size - 2);
  }
  const height = Math.round(titleHeight + detailHeight);
  const wanted = Math.round((bound.y / 100) * frame.height);
  const top = Math.max(bounds.top, Math.min(wanted, bounds.bottom - height));
  const text: EditorialTextBox = { left, top, width, size, lineHeight, detailSize, detailGap, height };

  const gap = format === "carousel" ? 44 : 56;
  const overlap = Math.round(text.size * 0.55);
  const fade = Math.round(frame.height * 0.08);
  const below = bounds.bottom - (top + height + gap);
  const above = top - gap - bounds.top;
  const textTop = below >= above;
  let photo: EditorialRect | null = null;
  if (layout === "card") {
    const y0 = textTop ? top + height + gap : bounds.top;
    const y1 = textTop ? bounds.bottom : top - gap;
    photo = { left: bounds.left, top: y0, width: frame.width - 2 * bounds.left, height: Math.max(0, y1 - y0) };
  } else if (layout === "frame") {
    // Edge to edge from the frame's side; its inner edge fades into the black behind the text.
    photo = textTop
      ? { left: 0, top: top + height + gap - fade, width: frame.width, height: frame.height - (top + height + gap - fade) }
      : { left: 0, top: 0, width: frame.width, height: top - gap + fade };
  } else if (layout === "cover") {
    // The reference: a card bottom right, overlapping the last line a little, running off the frame.
    const cardWidth = Math.round(frame.width * 0.58);
    const y0 = textTop ? top + height - overlap : -Math.round(frame.height * 0.04);
    const y1 = textTop ? frame.height + Math.round(frame.height * 0.04) : top + overlap;
    const minHeight = Math.round(frame.height * 0.36);
    const h = Math.max(minHeight, y1 - y0);
    photo = { left: frame.width - cardWidth - Math.round(frame.width * 0.05), top: textTop ? Math.min(y0, y1 - h) : y0, width: cardWidth, height: h };
  }
  return { frame, bounds, text, textTop, photo, gap, overlap, fade };
}

/* ---------------------------------------------------------------------------
 * The reel's timing: the words rise in one after another, the highlighted
 * ones pop once they are up. The cover still (cover.ts) waits for the last.
 * ------------------------------------------------------------------------ */

export const EDITORIAL_REVEAL = { start: 3, stagger: 1.6, pop: 5, settle: 22 } as const;
/** Frames the next part takes to slide in over the last one, like a swipe. */
export const EDITORIAL_PUSH = 10;

/** The frame (within a scene) by which a title of `words` words is fully drawn. */
export function editorialSettledFrame(words: number): number {
  return Math.round(EDITORIAL_REVEAL.start + EDITORIAL_REVEAL.stagger * Math.max(0, words - 1) + EDITORIAL_REVEAL.pop + EDITORIAL_REVEAL.settle);
}
