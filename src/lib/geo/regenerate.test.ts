import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { calendarItems, clusters, geoPrompts, keywords, spendReservations, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn(), createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })) },
}));
const ai = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: ai.create } },
  isAiConfigured: () => true,
  MODELS: { GENERATION: "claude-sonnet-5", EXTRACTION: "claude-haiku-4-5" },
}));

import { askFirstQuestionsIfDue } from "./first-questions";
import { regenerateQuestions, REGENERATIONS_PER_DAY } from "./regenerate";
import { categoryQuestionCount, planTopics, questionBrief } from "./suggest";

const reply = (prompts: string[]) => ({
  content: [{ type: "text", text: JSON.stringify({ prompts }) }],
  usage: { input_tokens: 200, output_tokens: 100 },
});
const ukrainian = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `Де купити подарунок на свято номер ${from + i}?`);

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(() => {
  ai.create.mockReset();
});

const questions = (websiteId: string) => test.db.select().from(geoPrompts).where(eq(geoPrompts.websiteId, websiteId));

async function ukrainianSite() {
  const seeded = await seedWebsite(test);
  await test.db.update(websites).set({ language: "Ukrainian", country: "Ukraine", industry: "Gifts" }).where(eq(websites.id, seeded.websiteId));
  const [cluster] = await test.db.insert(clusters).values({ websiteId: seeded.websiteId, name: "Привітання з днем народження", pillarKeyword: "привітання" }).returning();
  await test.db.insert(keywords).values({ websiteId: seeded.websiteId, term: "подарунок для мами", clusterId: cluster.id, priorityScore: 9 });
  await test.db.insert(calendarItems).values({ websiteId: seeded.websiteId, title: "50 ідей подарунків на Новий рік" });
  return seeded;
}

/**
 * Questions in the website's article language, from its content plan
 * (review of 2026-11-27: twenty English questions about recipes and films
 * for a Ukrainian gifts website).
 */
describe("the questions' brief", () => {
  it("asks for the article language and market, most questions from the plan, two or three about the business", () => {
    const brief = questionBrief({
      domain: "acme.ua",
      market: { language: "Ukrainian", region: "Ukraine", countryCode: "UA" },
      count: 20,
      topics: { clusters: ["Привітання"], keywords: ["подарунок для мами"], titles: ["50 ідей подарунків"] },
    });
    expect(brief).toContain("Write every question in Ukrainian");
    expect(brief).toContain("in Ukraine");
    expect(brief).toContain("17 of them about the topics in the content plan");
    expect(brief).toContain("3 of them about this kind of business");
    expect(brief).toContain("подарунок для мами");
    expect(brief).toContain("50 ідей подарунків");
    expect(brief).toContain("<site_data>");
    expect(categoryQuestionCount(5, true)).toBe(2);
    expect(categoryQuestionCount(5, false)).toBe(5);
  });

  it("reads the plan's clusters, keywords and planned titles", async () => {
    const { websiteId } = await ukrainianSite();
    expect(await planTopics(websiteId)).toEqual({
      clusters: ["Привітання з днем народження", "привітання"],
      keywords: ["подарунок для мами"],
      titles: ["50 ідей подарунків на Новий рік"],
    });
  });

  it("writes a new website's first questions in its language, and records it", async () => {
    const { websiteId } = await ukrainianSite();
    ai.create.mockResolvedValue(reply(ukrainian(30)));
    expect(await askFirstQuestionsIfDue(websiteId)).toBe("added");
    const prompt = ai.create.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain("Write every question in Ukrainian");
    expect(prompt).toContain("подарунок для мами");
    const rows = await questions(websiteId);
    expect(rows).toHaveLength(20);
    expect(rows.every((row) => row.language === "Ukrainian" && row.region === "Ukraine")).toBe(true);
  });
});

describe("writing the questions again", () => {
  it("replaces ours, keeps the customer's, and stays within the allowance without using it", async () => {
    const { websiteId } = await ukrainianSite();
    await test.db.insert(geoPrompts).values([
      ...Array.from({ length: 15 }, (_, i) => ({ websiteId, prompt: `where can i find good recipes online ${i}`, isSuggested: true })),
      { websiteId, prompt: "Мій власний питання про листівки", isSuggested: false },
    ]);
    ai.create.mockResolvedValue(reply(ukrainian(25)));

    const outcome = await regenerateQuestions(websiteId, { reason: "manual" });

    expect(outcome).toEqual({ ok: true, added: 19, removed: 15, kept: 1 });
    const rows = await questions(websiteId);
    expect(rows).toHaveLength(20);
    expect(rows.filter((r) => !r.isSuggested).map((r) => r.prompt)).toEqual(["Мій власний питання про листівки"]);
    expect(rows.filter((r) => r.isSuggested).every((r) => r.language === "Ukrainian" && !r.prompt.includes("recipes"))).toBe(true);
    // Asked for the room left: the allowance minus the customer's own.
    expect(ai.create.mock.calls[0][0].messages[0].content).toContain("Write 19 questions");
    // The first questions' once-ever allowance is untouched.
    const held = await test.db.select({ key: spendReservations.key }).from(spendReservations).where(eq(spendReservations.websiteId, websiteId));
    expect(held.map((r) => r.key)).not.toContain(`geo:first:${websiteId}`);
    expect(held.map((r) => r.key)).toContain(`geo-regenerate:site:${websiteId}`);
  });

  it("replaces the customer's questions too only when asked to", async () => {
    const { websiteId } = await ukrainianSite();
    await test.db.insert(geoPrompts).values({ websiteId, prompt: "my own question about cards", isSuggested: false });
    ai.create.mockResolvedValue(reply(ukrainian(20)));
    expect(await regenerateQuestions(websiteId, { reason: "manual", replaceAll: true })).toEqual({ ok: true, added: 20, removed: 1, kept: 0 });
    expect((await questions(websiteId)).every((r) => r.isSuggested)).toBe(true);
  });

  it("after a language change, rewrites only a list that has questions we wrote", async () => {
    const { websiteId } = await ukrainianSite();
    await test.db.insert(geoPrompts).values({ websiteId, prompt: "only my own question here", isSuggested: false });
    expect(await regenerateQuestions(websiteId, { reason: "language" })).toEqual({ ok: false, reason: "nothing_to_do" });
    expect(ai.create).not.toHaveBeenCalled();
  });

  it("keeps the questions when the model fails, and is limited per day", async () => {
    const { websiteId } = await ukrainianSite();
    await test.db.insert(geoPrompts).values({ websiteId, prompt: "an old suggested question", isSuggested: true });
    ai.create.mockResolvedValue({ content: [{ type: "text", text: "nope" }], usage: { input_tokens: 1, output_tokens: 1 } });
    expect(await regenerateQuestions(websiteId, { reason: "manual" })).toEqual({ ok: false, reason: "failed" });
    expect((await questions(websiteId)).map((r) => r.prompt)).toEqual(["an old suggested question"]);

    ai.create.mockResolvedValue(reply(ukrainian(20)));
    for (let i = 1; i < REGENERATIONS_PER_DAY; i++) expect((await regenerateQuestions(websiteId, { reason: "manual" })).ok).toBe(true);
    expect(await regenerateQuestions(websiteId, { reason: "manual" })).toEqual({ ok: false, reason: "limited" });
  });
});
