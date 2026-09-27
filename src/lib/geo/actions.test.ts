import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { usageEvents, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

const state = vi.hoisted(() => ({ db: null as unknown, access: "owner", guestOrgId: null as string | null }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

/*
  Auth is mocked at the tenant boundary only: the caller "is" whoever owns
  the website asked about, with the access the test sets. Everything below
  that - entitlement, quotas, the database - is real.
*/
async function contextFor(websiteId: string) {
  const db = state.db as TestDb["db"];
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  if (!site) throw new Error("not found");
  // A guest editor acts from their own workspace; the site's owner pays.
  return { site, orgId: state.guestOrgId ?? site.organizationId, userId: "user_1", access: state.access };
}
vi.mock("@/lib/tenant", () => ({ requireWebsite: vi.fn(contextFor) }));
vi.mock("@/lib/websites/require-editor", () => ({
  requireEditor: vi.fn(async (id: string) => {
    const context = await contextFor(id);
    return context.access === "viewer"
      ? { ok: false, error: "You have view-only access to this website." }
      : { ok: true, context };
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// The queue: jobs go through the real outbox (lib/jobs/outbox.ts) to this send.
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
const geoProvider = vi.hoisted(() => ({ runCheck: vi.fn(), ENGINE: "claude" }));
vi.mock("@/lib/geo/check", () => geoProvider);

const ai = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: ai.create } },
  isAiConfigured: () => true,
  MODELS: { GENERATION: "claude-sonnet-5", EXTRACTION: "claude-haiku-4-5" },
}));

import { deliverJobs, MAX_DELIVERY_ATTEMPTS } from "@/lib/jobs/outbox";
import { geoPrompts } from "@/lib/db/schema";
import { checkGeo } from "@/inngest/functions/check-geo";
import { runGeoCheck, suggestGeoPrompts } from "./actions";

const REPLY = {
  content: [{ type: "text", text: JSON.stringify({ prompts: ["best dentist near me for implants"] }) }],
  usage: { input_tokens: 200, output_tokens: 100 },
};

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  state.access = "owner";
  state.guestOrgId = null;
  inngestMock.send.mockReset();
  inngestMock.send.mockResolvedValue({ ids: [] });
  geoProvider.runCheck.mockReset();
  ai.create.mockReset();
  ai.create.mockResolvedValue(REPLY);
});

describe("suggestGeoPrompts", () => {
  it("refuses a viewer without calling the model", async () => {
    const { websiteId } = await seedWebsite(test);
    state.access = "viewer";
    expect((await suggestGeoPrompts(websiteId)).ok).toBe(false);
    expect(ai.create).not.toHaveBeenCalled();
  });

  it("refuses a cancelled plan without calling the model", async () => {
    const { websiteId } = await seedWebsite(test, { status: "canceled" });
    const outcome = await suggestGeoPrompts(websiteId);
    expect(outcome).toEqual({ ok: false, error: expect.stringMatching(/not active/) });
    expect(ai.create).not.toHaveBeenCalled();
  });

  it("works for a paying customer and records what it cost", async () => {
    const { orgId, websiteId } = await seedWebsite(test);
    expect(await suggestGeoPrompts(websiteId)).toEqual({
      ok: true,
      data: ["best dentist near me for implants"],
    });
    const events = await test.db.select().from(usageEvents).where(eq(usageEvents.organizationId, orgId));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "llm", websiteId });
  });

  it("holds the hourly ceiling under simultaneous requests", async () => {
    const { websiteId } = await seedWebsite(test);
    const outcomes = await Promise.all(
      Array.from({ length: 40 }, () => suggestGeoPrompts(websiteId)),
    );
    expect(outcomes.filter((o) => o.ok)).toHaveLength(30);
    expect(ai.create).toHaveBeenCalledTimes(30);
  });

  it("does not use up the allowance when the provider refuses", async () => {
    const { websiteId } = await seedWebsite(test);
    ai.create.mockRejectedValue(
      new Anthropic.APIError(529, { type: "overloaded_error" }, "overloaded", new Headers()),
    );
    for (let i = 0; i < 35; i += 1) {
      expect((await suggestGeoPrompts(websiteId)).ok).toBe(false);
    }
    ai.create.mockResolvedValue(REPLY);
    expect((await suggestGeoPrompts(websiteId)).ok).toBe(true);
  });

  it("bounds the prompt a client can make us pay for", async () => {
    const { websiteId } = await seedWebsite(test);
    const huge = Array.from({ length: 5000 }, (_, i) => `question ${i} ${"x".repeat(2000)}`);

    await suggestGeoPrompts(websiteId, 100_000, huge);

    const request = ai.create.mock.calls[0][0];
    expect(request.max_tokens).toBeLessThanOrEqual(4000);
    const content: string = request.messages[0].content;
    expect(content).toContain("question 59 ");
    expect(content).not.toContain("question 60 ");
    expect(content.length).toBeLessThan(60 * 320 + 2000);
    expect(content).not.toMatch(/Write 100000 questions/);
  });

  it("counts a timed-out call, which may have been billed", async () => {
    const { websiteId } = await seedWebsite(test);
    ai.create.mockRejectedValue(new Anthropic.APIConnectionTimeoutError());
    for (let i = 0; i < 35; i += 1) await suggestGeoPrompts(websiteId);
    expect(ai.create).toHaveBeenCalledTimes(30);
  });

  it("bills a shared site's owner, not the invited editor's workspace", async () => {
    const { orgId: ownerOrgId, websiteId } = await seedWebsite(test);
    state.guestOrgId = "org_guest";
    state.access = "editor";
    expect((await suggestGeoPrompts(websiteId)).ok).toBe(true);
    const events = await test.db.select().from(usageEvents).where(eq(usageEvents.websiteId, websiteId));
    expect(events.map((e) => e.organizationId)).toEqual([ownerOrgId]);
  });
});

/** Drives delivery past its last attempt, as the outbox cron would. */
async function giveUpDelivery() {
  await test.client.query("update job_outbox set attempts = $1 where status = 'pending'", [
    MAX_DELIVERY_ATTEMPTS - 1,
  ]);
  await deliverJobs(test.db, { now: new Date(Date.now() + 24 * 3600 * 1000) });
}

async function withPrompt(options: { status?: string | null } = {}) {
  const seeded = await seedWebsite(test, options);
  await test.db.insert(geoPrompts).values({ websiteId: seeded.websiteId, prompt: "best dentist in town" });
  return seeded;
}

describe("runGeoCheck", () => {
  it("admits the hourly ceiling under simultaneous presses", async () => {
    const { websiteId } = await withPrompt();
    const outcomes = await Promise.all(Array.from({ length: 10 }, () => runGeoCheck(websiteId)));
    expect(outcomes.filter((o) => o.ok)).toHaveLength(2);
    expect(inngestMock.send).toHaveBeenCalledTimes(2);
  });

  it("refuses a cancelled plan", async () => {
    const { websiteId } = await withPrompt({ status: "canceled" });
    expect((await runGeoCheck(websiteId)).ok).toBe(false);
    expect(inngestMock.send).not.toHaveBeenCalled();
  });

  it("accepts a check while the queue is down; the slot returns only if delivery is given up", async () => {
    const { websiteId } = await withPrompt();
    inngestMock.send.mockRejectedValue(new Error("queue down"));
    const states = async () =>
      (
        await test.client.query<{ state: string }>(
          "select state from spend_reservations where website_id = $1",
          [websiteId],
        )
      ).rows.map((r) => r.state);

    expect((await runGeoCheck(websiteId)).ok).toBe(true);
    expect(await states()).toEqual(["reserved", "reserved"]);
    await giveUpDelivery();
    expect(await states()).toEqual(["released", "released"]);
  });
});

describe("the check-geo job", () => {
  const job = checkGeo as unknown as { handler: (ctx: unknown) => Promise<{ checked: number }> };
  const step = { run: (_: string, fn: () => unknown) => fn() };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const RESULT = { mentioned: true, position: 1, cited: false, competitors: [], excerpt: "x" };

  it("does not pay for a website whose plan ended before the weekly sweep", async () => {
    const { websiteId } = await withPrompt({ status: "canceled" });
    geoProvider.runCheck.mockResolvedValue(RESULT);

    await job.handler({ event: { data: { websiteId } }, step, logger });

    expect(geoProvider.runCheck).not.toHaveBeenCalled();
  });

  it("spends against the reservation a user's check was admitted under", async () => {
    const { websiteId } = await withPrompt();
    expect((await runGeoCheck(websiteId)).ok).toBe(true);
    const data = inngestMock.send.mock.calls[0][0].data;
    geoProvider.runCheck.mockResolvedValue(RESULT);

    const outcome = await job.handler({ event: { data }, step, logger });

    expect(outcome.checked).toBe(1);
    const { rows } = await test.client.query<{ state: string }>(
      "select state from spend_reservations where website_id = $1",
      [websiteId],
    );
    expect(rows.map((r) => r.state)).toEqual(["consumed", "consumed"]);
  });
});
