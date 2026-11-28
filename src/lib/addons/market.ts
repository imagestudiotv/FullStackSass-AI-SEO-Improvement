import { MARKET_GLOBAL } from "@/lib/websites/markets";

/**
 * Add-ons for one country only, offered only where they fit (eval 2026-11-28:
 * a Ukrainian site was offered "Top 250 live USA Local Citations").
 *
 * THE ADD-ONS HAVE NO COUNTRY COLUMN, and a migration for one service is not
 * worth it. So the country is DERIVED, and only for add-ons that are clearly
 * bound to one: the rule below names its country by the add-on's slug or name
 * ("usa_local_citations", "... USA Local Citations"). Every other add-on -
 * credit packs, "We fix the errors for you", website projects - has no
 * country and is offered everywhere, as before.
 *
 * THE WEBSITE'S MARKET is its profile's target market (websites.country, a
 * country NAME - lib/websites/markets.ts - set in the profile or by analysis).
 * A website with no market (Global) or none known yet is not refused anything:
 * nothing says the add-on does not fit it.
 *
 * No server import: the pages and the sidebar share it.
 */
export type MarketAddon = { slug: string; name: string };

type CountryRule = {
  /** The country, as the market picker stores it. */
  country: string;
  /** Whether this add-on is for that country only. */
  matches: (addon: MarketAddon) => boolean;
  /** How a website's market may name the same country, lower case. */
  names: ReadonlySet<string>;
};

const COUNTRY_RULES: readonly CountryRule[] = [
  {
    country: "United States",
    matches: (addon) => /(^|_)usa?(_|$)/i.test(addon.slug) || /\bUSA\b/.test(addon.name) || /\bUnited States\b/i.test(addon.name),
    names: new Set([
      "united states",
      "united states of america",
      "usa",
      "u.s.a.",
      "us",
      "u.s.",
      "america",
      "estados unidos",
      "états-unis",
      "etats-unis",
      "stati uniti",
      "vereinigte staaten",
    ]),
  },
];

/** The one country this add-on is for, or null when it is for every market. */
export function addonCountry(addon: MarketAddon): string | null {
  return COUNTRY_RULES.find((rule) => rule.matches(addon))?.country ?? null;
}

/** Whether to offer this add-on to a website whose market is `market`. */
export function addonFitsMarket(addon: MarketAddon, market: string | null | undefined): boolean {
  const rule = COUNTRY_RULES.find((candidate) => candidate.matches(addon));
  if (!rule) return true;
  const named = (market ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!named || market === MARKET_GLOBAL || named === "global" || named.startsWith("global ")) return true;
  return rule.names.has(named);
}

/** The add-ons to offer a website in this market, in the same order. */
export function addonsForMarket<T extends MarketAddon>(addons: readonly T[], market: string | null | undefined): T[] {
  return addons.filter((addon) => addonFitsMarket(addon, market));
}
