import { LIMITS } from "@/lib/audit/rules";

/**
 * Search snippet checker.
 *
 * Titles and meta descriptions get truncated in search results when they run
 * long, which quietly costs clicks — the part that gets cut is usually the part
 * that would have persuaded someone.
 *
 * Deliberately reuses LIMITS from the audit rather than defining its own
 * numbers. A free tool that grades a title differently from the paid product
 * teaches customers not to trust either.
 *
 * Pure functions, no network: this runs client-side, so a visitor gets an
 * answer as they type and we do not pay for a request per keystroke.
 */

export type LengthVerdict = "short" | "good" | "long";

export type SnippetCheck = {
  text: string;
  length: number;
  verdict: LengthVerdict;
  /** What to do about it, in the customer's terms. */
  advice: string;
};

/**
 * Character counts, not pixel widths.
 *
 * Google actually truncates on pixel width, which varies by character — an
 * "iiii" title fits where "WWWW" does not. Pixel measurement needs the exact
 * font and rendering, which we cannot do reliably server-side or in a text
 * box, so this reports characters and says so. An approximate answer labelled
 * approximate beats a precise-looking one that is wrong.
 */
export function checkTitle(text: string): SnippetCheck {
  const trimmed = text.trim();
  const length = trimmed.length;

  let verdict: LengthVerdict = "good";
  let advice = "Good length. This should show in full.";

  if (length === 0) {
    verdict = "short";
    advice = "Every page needs a title. It is the headline in search results.";
  } else if (length < LIMITS.titleMin) {
    verdict = "short";
    advice = `Short titles waste space you are given. Aim for ${LIMITS.titleMin}–${LIMITS.titleMax} characters.`;
  } else if (length > LIMITS.titleMax) {
    verdict = "long";
    advice = `Google usually cuts titles around ${LIMITS.titleMax} characters. Put what matters first.`;
  }

  return { text: trimmed, length, verdict, advice };
}

export function checkDescription(text: string): SnippetCheck {
  const trimmed = text.trim();
  const length = trimmed.length;

  let verdict: LengthVerdict = "good";
  let advice = "Good length. This should show in full.";

  if (length === 0) {
    verdict = "short";
    advice =
      "Without a description, Google picks a sentence from the page — often the wrong one.";
  } else if (length < LIMITS.metaMin) {
    verdict = "short";
    advice = `Use the space: ${LIMITS.metaMin}–${LIMITS.metaMax} characters gives you room to say why to click.`;
  } else if (length > LIMITS.metaMax) {
    verdict = "long";
    advice = `Google usually cuts descriptions around ${LIMITS.metaMax} characters.`;
  }

  return { text: trimmed, length, verdict, advice };
}

export const SNIPPET_LIMITS = {
  titleMin: LIMITS.titleMin,
  titleMax: LIMITS.titleMax,
  metaMin: LIMITS.metaMin,
  metaMax: LIMITS.metaMax,
} as const;
