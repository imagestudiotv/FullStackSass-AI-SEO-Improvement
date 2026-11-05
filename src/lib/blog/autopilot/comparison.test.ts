import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const ai = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { stream: ai.stream } },
  MODELS: { EXTRACTION: "claude-haiku-4-5", GENERATION: "claude-sonnet-5", BLOG: "claude-sonnet-5", BLOG_TRANSLATION: "claude-haiku-5-5" },
  isAiConfigured: () => true,
}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { message } from "@/test/blog-autopilot";

import { cleanComparison, comparisonKey, comparisonLabel, readComparison, type ComparisonBrief } from "./comparison-brief";
import {
  checkComparisonEvidence,
  comparisonChecks,
  comparisonRules,
  readComparisonPlan,
  researchBlock,
  researchComparison,
  researchProvenance,
  researchShortfall,
  type ComparisonResearch,
  type PlannedComparison,
} from "./comparison";

/**
 * Comparison articles (client, 2026-11-05): grounded in sources, honest about
 * what they do not have, and never from memory. Nothing here reaches a model or
 * the network: the research's ways out are stubs, and the model is a mock.
 */

const BRIEF: ComparisonBrief = {
  entities: [
    { name: "Acme SEO", url: "https://acme.example/pricing" },
    { name: "Beta Rank", url: null },
    { name: "Gamma Audit", url: null },
  ],
  brief: "For a small shop choosing its first tool.",
  criteria: ["Price"],
};

const page = (url: string, words: string) => ({ url, title: `Page at ${url}`, retrievedAt: "2026-11-05T10:00:00.000Z", excerpt: words });

describe("the brief", () => {
  it("is tidied, and refused with a reason an administrator can act on", () => {
    expect(cleanComparison({ entities: [{ name: "  Acme   SEO ", url: "acme.example/pricing" }, { name: "Beta", url: "" }], brief: " x ", criteria: [" Price ", "Price", ""] })).toEqual({
      entities: [
        { name: "Acme SEO", url: "https://acme.example/pricing" },
        { name: "Beta", url: null },
      ],
      brief: "x",
      criteria: ["Price"],
    });
    expect(cleanComparison({ entities: [{ name: "Only one" }] })).toMatch(/at least 2/);
    expect(cleanComparison({ entities: [{ name: "A" }, { name: "a" }] })).toMatch(/twice/);
    expect(cleanComparison({ entities: "A,B,C,D,E,F".split(",").map((name) => ({ name })) })).toMatch(/at most 5/);
    expect(cleanComparison({ entities: [{ name: "A", url: "ftp://x.example" }, { name: "B" }] })).toMatch(/not a web address/);
    expect(cleanComparison(null)).toMatch(/at least 2/);
    expect(readComparison({ entities: [] })).toBeNull();
  });

  it("is one comparison however it is worded or ordered", () => {
    expect(comparisonKey({ entities: [{ name: "Acme", url: null }, { name: "Beta", url: null }] })).toBe(comparisonKey({ entities: [{ name: "beta", url: "https://b.example/" }, { name: "ACME", url: null }] }));
    expect(comparisonLabel(BRIEF)).toBe("Acme SEO vs Beta Rank vs Gamma Audit");
  });
});

describe("the research", () => {
  it("reads the named page and searches, per thing compared, and records what the search cost", async () => {
    const readPage = vi.fn(async (url: string) => page(url, "Acme SEO costs $29 a month on the Starter plan, billed monthly."));
    const search = vi.fn(async (entity: { name: string }, _topic: string, onCost: (cost: number | undefined) => Promise<void>) => {
      await onCost(0.002);
      return entity.name === "Gamma Audit" ? [] : [page(`https://reviews.example/${entity.name[0]}`, `${entity.name} includes rank tracking.`)];
    });
    const research = await researchComparison("Which is best", BRIEF, { readPage, search, canSearch: () => true });

    expect(readPage).toHaveBeenCalledTimes(1);
    expect(research.costUsd).toBeCloseTo(0.006);
    expect(research.entities.map((entity) => [entity.name, entity.status])).toEqual([
      ["Acme SEO", "researched"],
      ["Beta Rank", "researched"],
      ["Gamma Audit", "missing"],
    ]);
    expect(research.sources.map((source) => source.id)).toEqual(["S1", "S2", "S3"]);
    // Enough to go on: the third is marked, and the model is told to say nothing specific about it.
    expect(researchShortfall(research)).toBeNull();
    expect(researchBlock(research)).toContain("No sources could be found for: Gamma Audit");
  });

  it("does not take a page that never names the thing for a source about it", async () => {
    const research = await researchComparison("x", { entities: [{ name: "Acme SEO", url: null }, { name: "Beta Rank", url: null }], brief: "", criteria: [] }, {
      search: async () => [page("https://unrelated.example", "Nothing about either product is on this page, at considerable length.")],
      canSearch: () => true,
    });
    expect(research.sources).toEqual([]);
    expect(research.entities[0].notes.join(" ")).toContain("did not name it");
  });

  it("with sources for fewer than two, says so and invents nothing", async () => {
    const research = await researchComparison("x", BRIEF, {
      readPage: async () => {
        throw new Error("blocked");
      },
      canSearch: () => false,
    });
    expect(research.entities.every((entity) => entity.status === "missing")).toBe(true);
    const shortfall = researchShortfall(research);
    expect(shortfall).toContain("No sources could be found for Acme SEO, Beta Rank, Gamma Audit");
    expect(shortfall).toContain("nothing was invented");
    expect(research.entities[0].notes.join(" ")).toContain("https://acme.example/pricing");
    expect(research.entities[1].notes.join(" ")).toContain("not set up");
  });

  it("keeps no page text in what is noted on the run, only where it came from", async () => {
    const research = await researchComparison("x", BRIEF, { search: async (entity) => [page(`https://r.example/${entity.name[0]}`, `${entity.name} secret page text.`)], readPage: async () => null, canSearch: () => true });
    const noted = JSON.stringify(researchProvenance(research));
    expect(noted).toContain("https://r.example/A");
    expect(noted).not.toContain("secret page text");
  });
});

const RESEARCH: ComparisonResearch = {
  checkedAt: "2026-11-05T10:00:00.000Z",
  costUsd: 0,
  entities: [
    { name: "Acme SEO", status: "researched", notes: [] },
    { name: "Beta Rank", status: "researched", notes: ["The page given for it could not be read: https://b.example"] },
    { name: "Gamma Audit", status: "missing", notes: [] },
  ],
  sources: [
    { id: "S1", entity: "Acme SEO", url: "https://acme.example", title: "Acme", retrievedAt: "2026-11-05", excerpt: "Acme SEO costs $29 a month on the Starter plan, billed monthly." },
    { id: "S2", entity: "Beta Rank", url: "https://beta.example", title: "Beta", retrievedAt: "2026-11-05", excerpt: "Beta Rank includes  rank tracking for 100 keywords." },
  ],
};

describe("the plan's facts", () => {
  const fact = (entity: string, sourceId: string, quote: string) => ({ entity, claim: `${entity}: a claim`, sourceId, quote });

  it("keep only a quotation really in the source it names, about something being compared", () => {
    const { comparison, warnings } = readComparisonPlan(
      {
        criteria: ["Price", "Tracking"],
        facts: [
          fact("Acme SEO", "S1", "costs $29 a month on the Starter plan"),
          // The page's spacing differs: the same words.
          fact("beta rank", "S2", "includes rank tracking for 100 keywords"),
          fact("Beta Rank", "S2", "includes rank tracking for 9999 keywords"),
          fact("Acme SEO", "S9", "costs $29 a month on the Starter plan"),
          fact("Delta Unrelated", "S1", "costs $29 a month on the Starter plan"),
          fact("Acme SEO", "S1", "$29"),
        ],
        unverified: ["Beta Rank: current price"],
      },
      BRIEF,
      RESEARCH,
    );
    expect(comparison.facts.map((item) => [item.entity, item.sourceId])).toEqual([
      ["Acme SEO", "S1"],
      ["Beta Rank", "S2"],
    ]);
    expect(comparison.criteria).toEqual(["Price", "Tracking"]);
    expect(comparison.unverified).toEqual(["Gamma Audit: nothing could be confirmed from the sources", "Beta Rank: current price"]);
    expect(warnings[0]).toBe("4 of the plan's 6 facts were thrown out: their quotation is not in the source they name, or they are not about what is being compared.");
    expect(warnings.join(" ")).toContain("Nothing could be confirmed about Gamma Audit");
    expect(warnings.join(" ")).toContain("Research on Beta Rank");
  });

  it("are refused when fewer than two things are left with one: the sources do not support a comparison", () => {
    expect(() => readComparisonPlan({ facts: [fact("Acme SEO", "S1", "costs $29 a month on the Starter plan"), fact("Beta Rank", "S2", "made up words that are not in the page")] }, BRIEF, RESEARCH)).toThrow(/only 1 of the 3 .*Nothing was invented/);
  });
});

describe("what the writer is told", () => {
  it("forbids memory, invented tests and links", () => {
    const rules = comparisonRules();
    for (const rule of ["comparison.facts", "tested, tried, used", "Not confirmed in the sources we checked", "Do not link to any of them"]) expect(rules).toContain(rule);
  });
});

describe("the draft's checks", () => {
  const SHEET: PlannedComparison = {
    entities: ["Acme SEO", "Beta Rank"],
    criteria: ["Price"],
    facts: [{ entity: "Acme SEO", claim: "Starter is $29 a month", sourceId: "S1", quote: "costs $29 a month" }],
    unverified: ["Beta Rank: current price"],
  };
  const GOOD =
    "<h2>How we compared</h2><table><tbody><tr><th><p>Criterion</p></th><th><p>Acme SEO</p></th><th><p>Beta Rank</p></th></tr><tr><td><p>Price</p></td><td><p>$29 a month</p></td><td><p>Not confirmed in the sources we checked</p></td></tr></tbody></table><h2>The trade-offs of each</h2><p>Text.</p><h2>Which one should you choose</h2><p>Text.</p>";

  it("say only what is still unconfirmed when the structure is all there", () => {
    expect(comparisonChecks(GOOD, [], SHEET)).toEqual(["Could not be confirmed from the sources: Beta Rank: current price."]);
  });

  it("flag a missing table, trade-offs and recommendation, and something never named", () => {
    const warnings = comparisonChecks("<h2>Acme SEO</h2><p>Text.</p>", [], SHEET).join(" ");
    expect(warnings).toContain("never names Beta Rank");
    expect(warnings).toContain("No table has the things compared");
    expect(warnings).toContain("no section on the trade-offs");
    expect(warnings).toContain("who should choose which");
  });

  it("flag a figure the research does not have and a claim of experience nobody had, in the FAQs too", () => {
    const warnings = comparisonChecks(`${GOOD}<p>In our tests Beta Rank was 40% faster.</p>`, ["<p>Beta Rank costs €15.</p>"], SHEET).join(" ");
    expect(warnings).toContain("40%");
    expect(warnings).toContain("€15");
    expect(warnings).not.toContain("$29,");
    expect(warnings).toContain('"In our test');
  });
});

describe("the evidence check", () => {
  const SHEET: PlannedComparison = { entities: ["A one", "B two"], criteria: [], facts: [], unverified: [] };

  it("reports what the model found against the facts, and what it cost", async () => {
    ai.stream.mockImplementationOnce(() => ({ finalMessage: async () => message({ issues: ['"Beta has 5 users" is not in the facts.'] }) }));
    const result = await checkComparisonEvidence('<p>Text.</p><img src="https://x.example/1.webp" alt="A">', ["<p>Answer.</p>"], SHEET);
    expect(result.issues).toEqual(['"Beta has 5 users" is not in the facts.']);
    expect(result.usage.costUsd).toBeGreaterThan(0);
    const asked = ai.stream.mock.calls.at(-1)![0] as { messages: { content: string }[] };
    expect(asked.messages[0].content).not.toContain("<img");
  });
});
