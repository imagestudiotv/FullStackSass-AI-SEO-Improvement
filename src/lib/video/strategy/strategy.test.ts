import { describe, expect, it } from "vitest";

import { mainLanguageCode } from "@/lib/articles/translation-languages";
import { normalizeLanguage, SUPPORTED_LANGUAGES } from "@/lib/websites/languages";

import { CONTENT_GOALS, type VideoScript } from "../formats";
import { batchCategories, categoryCounts, formatAt, interleave, largestRemainder, topUpCounts } from "./allocation";
import { allowedDirections, assignDirections, buildPlan, directionCap, enforceRecipes, type Slot } from "./creative";
import { lengthPlan } from "./duration";
import { boundedShares, learnFrom, MAX_SHARE } from "./learning";

/**
 * The idea strategy's rules (client, 2026-11-12): the viral mix in whole
 * ideas that always add up, a deck that alternates, real variety of
 * productions, learning that never takes over, and Romanian content.
 */

const total = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

describe("the split of a batch", () => {
  it("is the mockup's default: 8 viral of 20, the rest 50/30/20", () => {
    expect(categoryCounts(20, 40, "balanced")).toEqual({ viral: 8, educational: 6, authority: 4, promotional: 2 });
    expect(categoryCounts(10, 40, "leads")).toEqual({ viral: 4, educational: 2, authority: 2, promotional: 2 });
  });

  it("always adds up exactly, for every mix, goal and size", () => {
    for (const goal of CONTENT_GOALS) {
      for (let mix = 0; mix <= 100; mix += 10) {
        for (const size of [1, 7, 10, 13, 20]) {
          const counts = categoryCounts(size, mix, goal);
          expect(total(counts)).toBe(size);
          expect(counts.viral).toBe(Math.round((size * mix) / 100));
        }
      }
    }
  });

  it("breaks rounding ties the same way every time, in category order", () => {
    // 3 split 1/1/1 with equal remainders: the earlier keys win.
    expect(largestRemainder(2, { a: 1, b: 1, c: 1 }, ["a", "b", "c"])).toEqual({ a: 1, b: 1, c: 0 });
    expect(largestRemainder(5, { a: 0, b: 0 }, ["a", "b"])).toEqual({ a: 5, b: 0 });
  });

  it("tops up the day by what its split still owes", () => {
    const target = categoryCounts(20, 40, "balanced");
    const owed = topUpCounts(target, { viral: 8, educational: 2 }, 10);
    expect(owed).toEqual({ viral: 0, educational: 4, authority: 4, promotional: 2 });
    expect(total(topUpCounts(target, { viral: 12 }, 8))).toBe(8);
  });

  it("alternates: no two viral ideas in a row while they are at most half", () => {
    for (let mix = 0; mix <= 50; mix += 10) {
      const deck = interleave(categoryCounts(20, mix, "balanced"));
      expect(deck).toHaveLength(20);
      deck.forEach((category, index) => {
        if (index > 0 && category === "viral") expect(deck[index - 1]).not.toBe("viral");
      });
    }
    expect(interleave(categoryCounts(20, 40, "balanced"))[0]).toBe("viral");
  });

  it("gives each extra batch its own kind", () => {
    const base = { viralMix: 40, goal: "balanced" as const, services: 4 };
    expect(batchCategories({ ...base, kind: "viral" })).toEqual(new Array(10).fill("viral"));
    expect(new Set(batchCategories({ ...base, kind: "website" }))).toEqual(new Set(["promotional"]));
    // Few services: authority fills in rather than invented products.
    const thin = batchCategories({ ...base, services: 1, kind: "website" });
    expect(thin.filter((c) => c === "promotional")).toHaveLength(6);
    expect(thin.filter((c) => c === "authority")).toHaveLength(4);
    expect(batchCategories({ ...base, kind: "mixed" })).toHaveLength(10);
  });
});

describe("formats", () => {
  it("are about one in four a carousel and one in ten a Story, only those allowed", () => {
    const day = Array.from({ length: 20 }, (_, index) => formatAt(index, ["reel", "story", "carousel"]));
    expect(day.filter((f) => f === "carousel")).toHaveLength(5);
    expect(day.filter((f) => f === "story")).toHaveLength(2);
    expect(Array.from({ length: 20 }, (_, i) => formatAt(i, ["reel"])).every((f) => f === "reel")).toBe(true);
    expect(Array.from({ length: 20 }, (_, i) => formatAt(i, ["story", "carousel"])).includes("reel")).toBe(false);
  });

  it("keep a Story within 60 seconds and points within the templates", () => {
    expect(lengthPlan("60-90", "voiceover", "story", "footage").seconds.max).toBe(60);
    expect(lengthPlan("60-90", "voiceover", "reel", "footage").points).toEqual({ min: 5, max: 6 });
    expect(lengthPlan("60-90", "voiceover", "reel", "animated").points.max).toBe(4);
    const narrated = lengthPlan("30-45", "voiceover", "reel", "voiceover").words;
    expect(narrated).toEqual({ min: 72, max: 108 });
    // Text + Music is read on screen: fewer words than narration over the same time.
    expect(lengthPlan("15-30", "text_music", "reel", "text_music").words.max).toBeLessThanOrEqual(83);
  });
});

describe("creative directions", () => {
  const slots: Slot[] = interleave(categoryCounts(20, 40, "balanced")).map((category, index) => ({ category, format: formatAt(index, ["reel", "story", "carousel"]) }));

  it("never give one direction more than 40% of a batch, and only directions the idea allows", () => {
    const directions = assignDirections(slots, "auto", { seed: 3 });
    const counts = new Map<string, number>();
    directions.forEach((direction, index) => {
      counts.set(direction, (counts.get(direction) ?? 0) + 1);
      expect(allowedDirections(slots[index].category, slots[index].format, "auto")).toContain(direction);
    });
    for (const count of counts.values()) expect(count).toBeLessThanOrEqual(directionCap(20));
    expect(counts.size).toBeGreaterThanOrEqual(4);
    // Deterministic.
    expect(assignDirections(slots, "auto", { seed: 3 })).toEqual(directions);
  });

  it("follow the audio choice: no narration under Text + Music, none on carousels", () => {
    expect(assignDirections(slots, "text_music")).not.toContain("voiceover");
    expect(assignDirections(slots, "voiceover")).not.toContain("text_music");
    expect(allowedDirections("educational", "carousel", "auto")).not.toContain("voiceover");
  });

  it("stay varied even when learning favours one direction", () => {
    const directions = assignDirections(slots, "auto", { weights: { storytelling: 50 } });
    expect(directions.filter((d) => d === "storytelling").length).toBeLessThanOrEqual(directionCap(20));
  });

  it("never repeat a production recipe within a batch or the last week", () => {
    const script: VideoScript = { hook: "h", points: [{ title: "a", detail: "b", stat: null }, { title: "c", detail: "d", stat: null }], proof: "p", cta: "c" };
    const input = { direction: "meme" as const, format: "reel" as const, script, scenes: [], captionStyle: "bold" as const, music: "auto" as const, ownMedia: false, articlePicture: false, fallbackQuery: "office" };
    const items = Array.from({ length: 12 }, () => input);
    const recent = [buildPlan(input).recipe];
    const plans = enforceRecipes(items, (item) => buildPlan(item), (item, variant) => buildPlan({ ...item, variant }), recent);
    const recipes = plans.map((plan) => plan.recipe);
    expect(new Set(recipes).size).toBe(12);
    expect(recipes).not.toContain(recent[0]);
    expect(plans[0].scenes).toHaveLength(5);
  });
});

describe("learning from posted videos", () => {
  it("keeps every share within the cap and above the exploration floor", () => {
    const shares = boundedShares(["meme", "footage", "storytelling", "text_music"], { meme: 10, footage: 0.1 });
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    for (const share of Object.values(shares)) {
      expect(share).toBeLessThanOrEqual(MAX_SHARE + 1e-9);
      expect(share).toBeGreaterThanOrEqual(0.1 - 1e-9);
    }
  });

  it("needs a few posted videos, and only nudges", () => {
    const video = (direction: string, views: number) => ({ direction, category: "viral", techniques: ["myth_busting"], stats: { tiktok: { views, likes: 0, comments: 0, shares: 0 } } });
    expect(learnFrom([video("meme", 1000), video("meme", 900)]).summary).toEqual([]);
    const learnt = learnFrom([video("meme", 5000), video("meme", 4000), video("footage", 100), video("footage", 200)]);
    expect(learnt.directionWeights.meme).toBeLessThanOrEqual(1.6);
    expect(learnt.directionWeights.footage).toBeGreaterThanOrEqual(0.6);
    expect(learnt.directionWeights.meme!).toBeGreaterThan(learnt.directionWeights.footage!);
    expect(learnt.summary.join("\n")).not.toMatch(/trending/i);
  });
});

describe("Romanian", () => {
  it("is a content language, whatever the spelling, written as ro", () => {
    expect(SUPPORTED_LANGUAGES).toContainEqual({ value: "Romanian", label: "Română (Romanian)" });
    for (const spelling of ["ro", "RO", "Romanian", "română", "Română", "Română".normalize("NFD"), "romana"]) expect(normalizeLanguage(spelling)).toBe("Romanian");
    expect(mainLanguageCode("Romanian")).toBe("ro");
    expect(mainLanguageCode("Română")).toBe("ro");
  });
});
