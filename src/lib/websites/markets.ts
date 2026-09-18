/**
 * Target markets a website can rank in.
 *
 * The design shows a "Target market" picker whose first option is "Global (all
 * countries)". That option is not decoration: a country here narrows keyword
 * research and shapes what an article assumes about its reader (currency,
 * seasonality, regulation), so "global" has to be sayable. Leaving the field
 * blank would mean the same thing but read as an unanswered question.
 *
 * Stored as the country NAME rather than an ISO code, matching the existing
 * `websites.country` column, which already holds extracted names and is fed
 * straight into prompts where "Italy" instructs better than "IT".
 *
 * Not a closed list in the database — the field stays free text, and analysis
 * may extract a country outside this set. The picker keeps an unrecognised
 * value rather than discarding it; see MARKET_GLOBAL below.
 */

export type Market = {
  /** Stored value. Empty string means global — see MARKET_GLOBAL. */
  value: string;
  label: string;
  /** Flag emoji, as the design shows beside each option. */
  flag: string;
};

/**
 * Global is stored as NULL, not as the word "Global".
 *
 * The column is read by keyword research and article generation, both of
 * which already treat a missing country as "no geographic bias". Storing a
 * literal "Global" would make every one of those call sites special-case a
 * magic string, and any that forgot would target a country named Global.
 *
 * NOT the empty string, though it means the same thing in the database.
 * Radix's Select reserves "" for "nothing is selected" and shows the
 * placeholder instead of the option — so global, which is the DEFAULT for a
 * new site, rendered as an unanswered "Choose a market". This sentinel is
 * translated back to null on save; see the setup step.
 */
export const MARKET_GLOBAL = "__global__";

/**
 * The markets offered, ordered by where this product is actually sold — the
 * client's own market and the neighbouring ones first, then the larger English
 * speaking markets.
 */
export const MARKETS: Market[] = [
  { value: MARKET_GLOBAL, label: "Global (all countries)", flag: "\u{1F310}" },
  { value: "Italy", label: "Italy", flag: "\u{1F1EE}\u{1F1F9}" },
  { value: "Spain", label: "Spain", flag: "\u{1F1EA}\u{1F1F8}" },
  { value: "France", label: "France", flag: "\u{1F1EB}\u{1F1F7}" },
  { value: "Germany", label: "Germany", flag: "\u{1F1E9}\u{1F1EA}" },
  { value: "Netherlands", label: "Netherlands", flag: "\u{1F1F3}\u{1F1F1}" },
  { value: "Portugal", label: "Portugal", flag: "\u{1F1F5}\u{1F1F9}" },
  { value: "Poland", label: "Poland", flag: "\u{1F1F5}\u{1F1F1}" },
  {
    value: "United Kingdom",
    label: "United Kingdom",
    flag: "\u{1F1EC}\u{1F1E7}",
  },
  { value: "Ireland", label: "Ireland", flag: "\u{1F1EE}\u{1F1EA}" },
  {
    value: "United States",
    label: "United States",
    flag: "\u{1F1FA}\u{1F1F8}",
  },
  { value: "Canada", label: "Canada", flag: "\u{1F1E8}\u{1F1E6}" },
  { value: "Australia", label: "Australia", flag: "\u{1F1E6}\u{1F1FA}" },
];

/** True when a value is one of the markets in the list above. */
export function isKnownMarket(value: string | null): boolean {
  return MARKETS.some((market) => market.value === (value ?? MARKET_GLOBAL));
}
