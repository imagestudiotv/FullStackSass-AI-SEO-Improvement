import { describe, expect, it } from "vitest";

import { buildPrompt } from "@/lib/websites/extract";
import { isEmptyProfile, mergeProfile, seedsFromQueries, signalsSnapshot } from "./fallback-profile";

const empty = { brandName: null, industry: null, country: null, language: null, description: null, targetAudience: null, services: [] as string[] };
const inferred = {
  brandName: "L'erba del vicino",
  industry: "herbal shop",
  country: "Italy",
  language: "Italian",
  description: "A herbal shop selling natural remedies.",
  targetAudience: null,
  services: ["herbal teas", "essential oils"],
  competitors: [],
};

describe("a website RepGet could not read", () => {
  it("is recognised by its empty profile", () => {
    expect(isEmptyProfile(empty)).toBe(true);
    expect(isEmptyProfile({ ...empty, services: null })).toBe(true);
    expect(isEmptyProfile({ ...empty, industry: "bakery" })).toBe(false);
    expect(isEmptyProfile({ ...empty, services: ["bread"] })).toBe(false);
  });

  it("is profiled from its address and searches, inside the page block", () => {
    const prompt = buildPrompt(signalsSnapshot({ url: "http://shop.example.it", domain: "shop.example.it", queries: ["tisane naturali", "olio essenziale lavanda"] }));
    expect(prompt).toContain("shop.example.it");
    expect(prompt).toContain("tisane naturali | olio essenziale lavanda");
    expect(prompt).toMatch(/could not be read/);
  });

  it("keeps what the customer or the analysis wrote, and fills only the gaps", () => {
    const merged = mergeProfile({ ...empty, country: "Switzerland" }, inferred);
    expect(merged).toMatchObject({ country: "Switzerland", industry: "herbal shop", services: ["herbal teas", "essential oils"] });
    expect(mergeProfile({ ...empty, services: ["mine"] }, inferred).services).toEqual(["mine"]);
  });

  it("falls back to the searches themselves as seeds, without the brand", () => {
    const seeds = seedsFromQueries(["erba del vicino orari", "tisane naturali", "comprare olio di lavanda online"], "Erba del Vicino");
    expect(seeds.map((s) => s.term)).toEqual(["tisane naturali", "comprare olio di lavanda online"]);
    expect(seeds[1].intent).toBe("transactional");
    expect(seedsFromQueries([], null)).toEqual([]);
  });
});
