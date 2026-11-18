/**
 * What a plan screen must not show while there is no evidence for a reference
 * price (conservative copy for the ads pilot, 2026-11-18): a price struck
 * through, a percentage off, or the words that set the charged price against
 * a regular, former or promotional one - in every language the app speaks.
 *
 * The yearly saving ("save 17%" beside the plan step's yearly switch) is not
 * a reference price - it compares two prices checkout really charges - so a
 * screen showing it is checked without its yearly option.
 */
export const REFERENCE_PRICE_PATTERNS: readonly RegExp[] = [
  /<del\b/,
  /line-through/,
  /\d\s?%/,
  /\bOFF\b/,
  /\bSAVE\b/,
  // Against a figure: "Beweise statt Versprechen" is not a price.
  /(instead of|en lugar de|au lieu de|invece di|\bstatt) €/i,
  /regular price|precio normal|prix normal|prezzo normale|regulär/i,
  /promotional price|precio promocional|prix promotionnel|prezzo promozionale|Aktionspreis/i,
  /\bwas €|\bantes €|\bprima €/i,
];

/** The patterns `html` matches; empty when it states only the charged price. */
export function referencePriceMatches(html: string): string[] {
  return REFERENCE_PRICE_PATTERNS.filter((pattern) => pattern.test(html)).map(String);
}
