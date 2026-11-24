import { randomUUID } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { user } from "@/lib/db/auth-tables";
import { agencyWorkspaces, freePlanAccounts, geoPrompts, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

const state = vi.hoisted(() => ({ db: null as unknown, ai: true }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn(), createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })) },
}));
const ai = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: ai.create } },
  isAiConfigured: () => state.ai,
  MODELS: { GENERATION: "claude-sonnet-5", EXTRACTION: "claude-haiku-4-5" },
}));

import { firstVisibilityQuestions } from "@/inngest/functions/first-visibility-questions";
import { FREE_PLAN } from "@/lib/plans/free-plan";
import { askFirstQuestionsIfDue, firstQuestionCandidates, FIRST_QUESTIONS_WINDOW_MS } from "./first-questions";

/**
 * Onboarding's AI visibility step is gone (Daniel, 2026-11-24) and was the only
 * thing that wrote a website's first questions: they are written by themselves,
 * once, ever, for an analysed website with a plan.
 */

const REPLY = {
  content: [{ type: "text", text: JSON.stringify({ prompts: Array.from({ length: 60 }, (_, i) => `best dentist near me number ${i}`) }) }],
  usage: { input_tokens: 200, output_tokens: 100 },
};

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(() => {
  state.ai = true;
  ai.create.mockReset();
  ai.create.mockResolvedValue(REPLY);
});

const questions = (websiteId: string) => test.db.select().from(geoPrompts).where(eq(geoPrompts.websiteId, websiteId));

async function freeSite() {
  const site = await seedWebsite(test, { status: null });
  const userId = `user_${randomUUID()}`;
  const now = new Date();
  await test.db.insert(user).values({ id: userId, name: "Free owner", email: `${userId}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  await test.db.insert(freePlanAccounts).values({ organizationId: site.orgId, websiteId: site.websiteId, domain: `${site.orgId}.example`, userId });
  return site;
}

describe("askFirstQuestionsIfDue", () => {
  it("saves a plan's worth of active questions, once, ever", async () => {
    const { websiteId } = await seedWebsite(test);
    expect(await askFirstQuestionsIfDue(websiteId)).toBe("added");
    const rows = await questions(websiteId);
    expect(rows).toHaveLength(20);
    expect(rows.every((row) => row.active && row.isSuggested)).toBe(true);
    expect(await askFirstQuestionsIfDue(websiteId)).toBe("already_asked");

    // Removed by the customer: never brought back.
    await test.db.delete(geoPrompts).where(eq(geoPrompts.websiteId, websiteId));
    expect(await askFirstQuestionsIfDue(websiteId)).toBe("already_asked");
    expect(await firstQuestionCandidates()).not.toContain(websiteId);
    expect(ai.create).toHaveBeenCalledTimes(1);
  });

  it("gives Free its few", async () => {
    const { websiteId } = await freeSite();
    expect(await askFirstQuestionsIfDue(websiteId)).toBe("added");
    expect(await questions(websiteId)).toHaveLength(FREE_PLAN.visibilityQuestions);
  });

  it("spends nothing without a plan, while the analysis runs, for an agency website, or without the AI", async () => {
    const unpaid = await seedWebsite(test, { status: null });
    expect(await askFirstQuestionsIfDue(unpaid.websiteId)).toBe("not_entitled");

    const analysing = await seedWebsite(test);
    await test.db.update(websites).set({ status: "crawling" }).where(eq(websites.id, analysing.websiteId));
    expect(await askFirstQuestionsIfDue(analysing.websiteId)).toBe("not_ready");

    const agency = await seedWebsite(test);
    await test.db.insert(agencyWorkspaces).values({ organizationId: agency.orgId, articleLimit: 10, keywordLimit: 10, siteLimit: 1 });
    expect(await askFirstQuestionsIfDue(agency.websiteId)).toBe("already_asked");
    expect(await firstQuestionCandidates()).not.toContain(agency.websiteId);

    state.ai = false;
    expect(await askFirstQuestionsIfDue((await seedWebsite(test)).websiteId)).toBe("not_ready");
    expect(ai.create).not.toHaveBeenCalled();
  });

  it("leaves a website that has questions of its own alone", async () => {
    const { websiteId } = await seedWebsite(test);
    await test.db.insert(geoPrompts).values({ websiteId, prompt: "Which dentist is open on Sunday?", isSuggested: false });
    expect(await askFirstQuestionsIfDue(websiteId)).toBe("already_asked");
    expect(ai.create).not.toHaveBeenCalled();
  });

  it("tries again after a refusal, and not after a call that may have been billed", async () => {
    const { websiteId } = await seedWebsite(test);
    ai.create.mockRejectedValueOnce(new Anthropic.APIError(529, { type: "overloaded_error" }, "overloaded", new Headers()));
    expect(await askFirstQuestionsIfDue(websiteId)).toBe("failed");
    expect(await askFirstQuestionsIfDue(websiteId)).toBe("added");

    const other = await seedWebsite(test);
    ai.create.mockRejectedValueOnce(new Anthropic.APIConnectionTimeoutError());
    expect(await askFirstQuestionsIfDue(other.websiteId)).toBe("failed");
    expect(await askFirstQuestionsIfDue(other.websiteId)).toBe("already_asked");
  });

  it("pays once when two runs overlap", async () => {
    const { websiteId } = await seedWebsite(test);
    const outcomes = await Promise.all([askFirstQuestionsIfDue(websiteId), askFirstQuestionsIfDue(websiteId), askFirstQuestionsIfDue(websiteId)]);
    expect(outcomes.filter((outcome) => outcome === "added")).toHaveLength(1);
    expect(ai.create).toHaveBeenCalledTimes(1);
  });
});

describe("first-visibility-questions", () => {
  it("asks for recent websites only, one paid call each", async () => {
    const fresh = await seedWebsite(test);
    const old = await seedWebsite(test);
    await test.db
      .update(websites)
      .set({ createdAt: new Date(Date.now() - FIRST_QUESTIONS_WINDOW_MS - 60_000) })
      .where(eq(websites.id, old.websiteId));
    const job = firstVisibilityQuestions as unknown as { handler: (input: unknown) => Promise<Record<string, number>> };
    const step = { run: (_id: string, fn: () => unknown) => fn() };
    const result = await job.handler({ step, logger: { info: vi.fn() } });
    expect(result.added).toBeGreaterThanOrEqual(1);
    expect(await questions(fresh.websiteId)).toHaveLength(20);
    expect(await questions(old.websiteId)).toHaveLength(0);
  });
});
