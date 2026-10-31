/**
 * Text helpers: sizing without measuring (the templates render in the
 * browser Player and headless Chrome alike, so a character-count heuristic
 * keeps both identical), headline splitting and figures found in a sentence.
 * The scripts come in English, French, German, Spanish and Italian, so long
 * compound words are what the sizing guards against.
 */

/** Inter's average advance at heavy weights, in em. */
const CHAR_EM = 0.6;

export function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * The largest font size (px) at which `text` fits `maxLines` lines of
 * `width` px, and its longest word fits one line.
 */
export function fitFontSize(text: string, width: number, maxLines: number, max: number, min: number, charEm = CHAR_EM): number {
  const words = splitWords(text);
  const longest = words.reduce((n, word) => Math.max(n, word.length), 1);
  const chars = Math.max(1, text.trim().length);
  // Lines are never filled edge to edge: leave ~18% for ragged wrapping.
  const byLines = (width * maxLines * 0.82) / (chars * charEm);
  const byWord = width / (longest * charEm * 1.04);
  return Math.round(Math.max(min, Math.min(max, byLines, byWord)));
}

/**
 * The headline in two parts - the second is shown in the brand colour, as in
 * the reference reel ("Research first. / Then the Reels."). Splits at a
 * sentence break near the middle when there is one, else at the middle word.
 */
export function splitHeadline(text: string): [string, string] {
  const words = splitWords(text);
  if (words.length < 3) return [text.trim(), ""];
  const total = text.trim().length;
  let best = -1;
  let bestDistance = Infinity;
  let at = 0;
  for (let i = 0; i < words.length - 1; i++) {
    at += words[i].length + 1;
    if (/[.!?:;,—–-]$/.test(words[i])) {
      const distance = Math.abs(at / total - 0.5);
      if (distance < 0.3 && distance < bestDistance) {
        best = i + 1;
        bestDistance = distance;
      }
    }
  }
  if (best < 0) {
    at = 0;
    for (let i = 0; i < words.length; i++) {
      at += words[i].length + 1;
      if (at / total >= 0.5) {
        best = Math.min(words.length - 1, Math.max(1, i + 1));
        break;
      }
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

/**
 * Which words of a headline to colour: those with a figure in them, else the
 * last few (the payoff of most hooks).
 */
export function emphasis(words: string[]): Set<number> {
  const withFigures = words.flatMap((word, i) => (/\d/.test(word) ? [i] : []));
  if (withFigures.length) {
    // A figure and the word after it ("30 Reels") read as one.
    const set = new Set<number>();
    for (const i of withFigures) {
      set.add(i);
      if (i + 1 < words.length && !/[.!?:,]$/.test(words[i])) set.add(i + 1);
    }
    return set;
  }
  const count = Math.max(1, Math.min(3, Math.round(words.length / 3)));
  return new Set(words.map((_, i) => i).slice(-count));
}

export type Figure = {
  before: string;
  prefix: string;
  value: number;
  decimals: number;
  suffix: string;
  after: string;
  /** The figure as written. */
  raw: string;
};

/** The first figure in a sentence ("3x", "92%", "1,200+", "€40"), to count up to. */
export function findFigure(text: string): Figure | null {
  const match = /([$€£]?)(\d+(?:[.,\s ]\d{3})*(?:[.,]\d+)?)(\s?(?:%|x|×|\+|k|K|M|h|s)?)(?![A-Za-zÀ-ɏ\d])/.exec(text);
  if (!match) return null;
  const [raw, prefix, number, suffix] = match;
  let normalised = number.replace(/[\s ]/g, "");
  // "1,200" / "1.200" are thousands; "1,5" / "2.5" are decimals.
  if (/^\d{1,3}([.,]\d{3})+$/.test(normalised)) normalised = normalised.replace(/[.,]/g, "");
  else normalised = normalised.replace(",", ".");
  const value = Number.parseFloat(normalised);
  if (!Number.isFinite(value)) return null;
  // A year ("since 2009") is a date, not an amount: counting up to it reads wrong.
  if (!prefix && !suffix.trim() && /^\d{4}$/.test(normalised) && value >= 1900 && value <= 2100) return null;
  const decimals = normalised.includes(".") ? normalised.split(".")[1].length : 0;
  return {
    before: text.slice(0, match.index),
    prefix,
    value,
    decimals,
    suffix: suffix.trim(),
    after: text.slice(match.index + raw.length),
    raw,
  };
}

/** A number for a counter: grouped with a narrow space, which reads right in all five languages. */
export function formatNumber(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.length > 4 ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : whole;
  return fraction ? `${grouped}.${fraction}` : grouped;
}

export function decimalsOf(value: number): number {
  if (Number.isInteger(value)) return 0;
  return Math.min(2, String(value).split(".")[1]?.length ?? 0);
}

/** Whether both parts of a split headline fit a line each, so the break between them can be forced. */
export function breakFits(first: string, second: string, size: number, width: number): boolean {
  return Math.max(first.length, second.length) * CHAR_EM * size <= width * 0.94;
}
