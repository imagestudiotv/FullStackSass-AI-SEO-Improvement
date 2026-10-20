import { describe, expect, it } from "vitest";

import { coveredBy, topicWords, withoutCovered, type CoveredTopics } from "./covered-match";

/**
 * Whether a keyword is already covered (client, 2026-10-20: plan new ideas,
 * not the blog's own topics again), on titles from Image Studio's blog.
 */

const covered = (overrides: Partial<CoveredTopics> = {}): CoveredTopics => ({
  siteTitles: [
    "Destination Wedding Photographer Italy: A Practical Guide",
    "Lake Como Wedding Photography: Venues, Light and Timing",
    "Choosing a Wedding Videography Studio: Questions to Ask",
    "Castle Wedding Photography in Italy: Beyond the Backdrop",
  ],
  writtenTitles: ["Building a Music Video Production Crew: Key Roles"],
  writtenKeywords: ["music video production crew"],
  ...overrides,
});

describe("a keyword already covered", () => {
  it("is one the blog has an article mostly about, word forms and plurals folded", () => {
    expect(coveredBy("destination wedding photographer italy", covered())).toBe("Destination Wedding Photographer Italy: A Practical Guide");
    expect(coveredBy("lake como wedding photographers", covered())).toBe("Lake Como Wedding Photography: Venues, Light and Timing");
    expect(coveredBy("Castle weddings in Italy photography", covered())).toBe("Castle Wedding Photography in Italy: Beyond the Backdrop");
  });

  it("is one RepGet has written already, however it is spelled", () => {
    expect(coveredBy("Music video production crews", covered())).toBe("music video production crew");
  });

  it("is not a broader keyword an article only touches", () => {
    // The videography article is about questions to ask a studio, not the head term.
    expect(coveredBy("wedding videographer", covered())).toBeNull();
    expect(coveredBy("wedding photographer", covered())).toBeNull();
    // One meaningful word is never judged covered by a title.
    expect(coveredBy("como", covered())).toBeNull();
    expect(coveredBy("elopement photographer amalfi coast", covered())).toBeNull();
  });

  it("ignores the small words of every language RepGet writes", () => {
    expect(topicWords("How much does a wedding photographer cost in Italy")).toEqual(["wedd", "photograph", "cost", "ital"]);
    expect(topicWords("Il fotografo per matrimonio sul lago di Como")).toEqual(["fotografo", "matrimonio", "lago", "como"]);
  });
});

describe("a plan's topics", () => {
  it("lose what is covered; a covered pillar gives way to the next keyword; an empty topic goes", () => {
    const { clusters, dropped } = withoutCovered(
      [
        { name: "Lake Como", pillarKeyword: "lake como wedding photographer", terms: ["lake como wedding photographer", "lake como elopement photographer", "villa balbianello wedding"] },
        { name: "Music videos", pillarKeyword: "music video production crew", terms: ["music video production crew"] },
        { name: "Amalfi", pillarKeyword: "amalfi coast wedding photographer", terms: ["amalfi coast wedding photographer"] },
      ],
      covered(),
    );
    expect(clusters).toEqual([
      { name: "Lake Como", pillarKeyword: "lake como elopement photographer", terms: ["lake como elopement photographer", "villa balbianello wedding"] },
      { name: "Amalfi", pillarKeyword: "amalfi coast wedding photographer", terms: ["amalfi coast wedding photographer"] },
    ]);
    expect(dropped.map((entry) => entry.keyword)).toEqual(["lake como wedding photographer", "music video production crew"]);
  });
});
