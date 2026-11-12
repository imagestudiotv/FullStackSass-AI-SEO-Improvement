import { describe, expect, it } from "vitest";

import type { ShotPlan, VideoScript } from "./formats";
import {
  assertsTrend,
  assessReview,
  checkClaims,
  contentHash,
  promisesResult,
  reviewAfterEdit,
  reviewBlocksAutoPublish,
  withoutClaimsOfTrendOrPromise,
} from "./review";

/**
 * Honesty and brand safety (client, 2026-11-12): figures need a source or a
 * person's check, an approval holds only for the words it was given on, and
 * nothing claims a trend or promises a result.
 */

const SCRIPT: VideoScript = {
  hook: "Three photo mistakes that cost you clients",
  points: [
    { title: "Dark product shots", detail: "Light sells: shoot near a window.", stat: null },
    { title: "Busy backgrounds", detail: "A plain wall keeps the eye on the product.", stat: null },
  ],
  proof: "Image Studio has shot products since 2015.",
  cta: "Follow Image Studio for more tips",
};
const PLAN: ShotPlan = {
  direction: "meme",
  pacing: "fast",
  captionStyle: "bold",
  musicMood: "playful",
  recipe: "x",
  scenes: [{ visual: { source: "stock", query: "office", kind: "video" }, transition: "cut", reaction: "wait...", overlay: "POV: your photos" }],
};
const content = { script: SCRIPT, caption: "Light sells.", plan: PLAN, production: { ctaText: null } };
const ON = { requireFactReview: true, requireControversyReview: true };

describe("an approval", () => {
  it("holds for the same words, and not after any published word changes", () => {
    const hash = contentHash(content);
    expect(contentHash({ ...content, plan: { ...PLAN, pacing: "calm", recipe: "y" } })).toBe(hash);
    for (const changed of [
      { ...content, caption: "Light sells!" },
      { ...content, script: { ...SCRIPT, cta: "Book now" } },
      { ...content, script: { ...SCRIPT, points: [SCRIPT.points[0], { ...SCRIPT.points[1], stat: { value: 40, suffix: "%", label: "more" } }] } },
      { ...content, plan: { ...PLAN, scenes: [{ ...PLAN.scenes[0], overlay: "POV: the boss" }] } },
      { ...content, production: { ctaText: "Call us" } },
    ]) {
      expect(contentHash(changed)).not.toBe(hash);
    }
  });

  it("lets automatic publishing go only when not required, or approved for these words", () => {
    const hash = contentHash(content);
    expect(reviewBlocksAutoPublish({ ...content, reviewStatus: "none", reviewedHash: null })).toBe(false);
    expect(reviewBlocksAutoPublish({ ...content, reviewStatus: "required", reviewedHash: hash })).toBe(true);
    expect(reviewBlocksAutoPublish({ ...content, reviewStatus: "approved", reviewedHash: hash })).toBe(false);
    expect(reviewBlocksAutoPublish({ ...content, caption: "Edited", reviewStatus: "approved", reviewedHash: hash })).toBe(true);
  });

  it("goes back to required when an edit changes reviewed words, and a new figure adds a reason", () => {
    const approved = { reviewStatus: "approved", reviewReasons: ["controversial"], reviewedHash: contentHash(content), claims: [] };
    expect(reviewAfterEdit(approved, content, ON)).toEqual({ reviewStatus: "approved", reviewReasons: ["controversial"] });
    expect(reviewAfterEdit(approved, { ...content, caption: "Hot take" }, ON).reviewStatus).toBe("required");
    const clean = { reviewStatus: "none", reviewReasons: [], reviewedHash: null, claims: [] };
    expect(reviewAfterEdit(clean, { ...content, caption: "We cut costs by 30%." }, ON)).toEqual({ reviewStatus: "required", reviewReasons: ["unverified_claim"] });
    expect(reviewAfterEdit(clean, { ...content, caption: "We cut costs by 30%." }, { ...ON, requireFactReview: false }).reviewStatus).toBe("none");
  });
});

describe("a new idea's review", () => {
  it("needs a check for a figure or ranking with no source in the material", () => {
    const claims = checkClaims([{ text: "Rated the best studio in Dublin", source: null }], 3);
    expect(assessReview({ content, claims, controversial: false, sensitive: false, techniques: [] }, ON)).toEqual({ reviewStatus: "required", reviewReasons: ["unverified_claim"] });
    const sourced = checkClaims([{ text: "40% more clicks", source: "article:2" }], 3);
    const withStat = { ...content, script: { ...SCRIPT, points: [SCRIPT.points[0], { ...SCRIPT.points[1], stat: { value: 40, suffix: "%", label: "more clicks" } }] } };
    expect(assessReview({ content: withStat, claims: sourced, controversial: false, sensitive: false, techniques: [] }, ON).reviewStatus).toBe("none");
    // The same figure "from" an article that was not given is no source.
    const invented = checkClaims([{ text: "40% more clicks", source: "article:9" }], 3);
    expect(invented[0].source).toBeNull();
    expect(assessReview({ content: withStat, claims: invented, controversial: false, sensitive: false, techniques: [] }, ON).reviewReasons).toEqual(["unverified_claim"]);
  });

  it("needs an approval for a hot take while that setting is on, and always for a sensitive topic", () => {
    const base = { content, claims: [], controversial: false, sensitive: false };
    expect(assessReview({ ...base, techniques: ["hot_takes"] }, ON).reviewReasons).toEqual(["controversial"]);
    expect(assessReview({ ...base, techniques: ["hot_takes"] }, { ...ON, requireControversyReview: false }).reviewStatus).toBe("none");
    expect(assessReview({ ...base, sensitive: true, techniques: [] }, { requireFactReview: false, requireControversyReview: false }).reviewReasons).toEqual(["sensitive"]);
  });
});

describe("trends and promises", () => {
  it("are never claimed", () => {
    expect(assertsTrend("This is trending on TikTok")).toBe(true);
    expect(assertsTrend("Acest format este în trend")).toBe(true);
    expect(assertsTrend("A proven format for photographers")).toBe(false);
    expect(promisesResult("This will go viral")).toBe(true);
    expect(withoutClaimsOfTrendOrPromise("Useful advice. Guaranteed views! Save it.")).toBe("Useful advice. Save it.");
    expect(withoutClaimsOfTrendOrPromise("Currently trending.")).toBeNull();
  });
});
