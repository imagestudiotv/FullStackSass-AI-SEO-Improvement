import { describe, expect, it } from "vitest";

import { addonCountry, addonFitsMarket, addonsForMarket } from "@/lib/addons/market";
import { MARKET_GLOBAL } from "@/lib/websites/markets";

/** Add-ons for one country only, offered where they fit (eval 2026-11-28). */
const CITATIONS = { slug: "usa_local_citations", name: "Top 250 live USA Local Citations" };
const FIX = { slug: "audit_fix", name: "We fix the errors for you" };
const PACK = { slug: "credits_50", name: "500 credits" };
const NEW_SITE = { slug: "website_new", name: "New website" };

describe("addonCountry", () => {
  it("derives a country only for an add-on clearly bound to one", () => {
    expect(addonCountry(CITATIONS)).toBe("United States");
    expect(addonCountry({ slug: "local_listings", name: "United States business listings" })).toBe("United States");
    for (const addon of [FIX, PACK, NEW_SITE, { slug: "bonus_usage", name: "Usage report" }]) expect(addonCountry(addon)).toBeNull();
  });
});

describe("addonFitsMarket", () => {
  it.each(["Ukraine", "Italy", "United Kingdom", "Україна"])("hides the USA-only add-on from a website in %s", (market) => {
    expect(addonFitsMarket(CITATIONS, market)).toBe(false);
  });

  it.each(["United States", "united states", " USA ", "United States of America", "Stati Uniti"])("offers it to a website in %s", (market) => {
    expect(addonFitsMarket(CITATIONS, market)).toBe(true);
  });

  it("offers it where no market is set: Global, or none known yet", () => {
    for (const market of [null, undefined, "", MARKET_GLOBAL, "Global (all countries)"]) expect(addonFitsMarket(CITATIONS, market)).toBe(true);
  });

  it("never hides an add-on that is for every market", () => {
    expect(addonsForMarket([PACK, CITATIONS, FIX, NEW_SITE], "Ukraine")).toEqual([PACK, FIX, NEW_SITE]);
  });
});
