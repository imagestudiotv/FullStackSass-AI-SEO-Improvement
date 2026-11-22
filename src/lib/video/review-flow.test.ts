import { and, eq, gt } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { creditSettings, creditSpends, videoIdeaBatches, videoIdeas, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Daniel's 21 Nov ticket on PGlite: New ideas cost credits (the day's twenty
 * stay free; short of credits nothing is reserved; a batch that writes no
 * idea gives its credits back), and manual publishing's "Mark as posted"
 * (kept per destination, moving the video between Saved Videos and Posted).
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
async function contextFor(websiteId: string) {
  const db = state.db as TestDb["db"];
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  if (!site) throw new Error("not found");
  return { site, orgId: site.organizationId, userId: "user_1", access: "owner" };
}
vi.mock("@/lib/tenant", () => ({ requireWebsite: vi.fn(contextFor) }));
vi.mock("@/lib/websites/require-editor", () => ({ requireEditor: vi.fn(async (id: string) => ({ ok: true, context: await contextFor(id) })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const queue = vi.hoisted(() => ({ queueJob: vi.fn(async () => true) }));
vi.mock("@/inngest/send", () => queue);
vi.mock("@/lib/ai/client", () => ({
  anthropic: (() => {
    const create = vi.fn();
    return { messages: { create, stream: (body: unknown, options: unknown) => ({ finalMessage: () => create(body, options) }) } };
  })(),
  isAiConfigured: () => true,
  MODELS: { GENERATION: "claude-sonnet-5" },
}));

import { recordCredit } from "@/lib/backlinks/credits";
import { walletOf } from "@/lib/credits/spend";

import { requestVideoIdeas } from "./actions";
import { ideasSpendKey } from "./batches";
import { readDestinations } from "./destinations";
import type { VideoScript } from "./formats";
import { writeExtraBatch } from "./ideas";
import { markVideoPosted } from "./publish-actions";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const NOW = new Date("2026-11-21T09:00:00Z");
beforeEach(async () => {
  queue.queueJob.mockClear();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  // No admin price saved: a batch of new ideas costs 1 credit.
  await test.db.delete(creditSettings);
});
afterEach(() => {
  vi.useRealTimers();
});

async function site() {
  const seeded = await seedWebsite(test, { status: "active" });
  await test.db.update(websites).set({ brandName: "Image Studio", language: "English", status: "ready" }).where(eq(websites.id, seeded.websiteId));
  return seeded;
}
const available = async (orgId: string) => (await walletOf(test.db, orgId)).available;
const extraBatches = (websiteId: string) => test.db.select().from(videoIdeaBatches).where(and(eq(videoIdeaBatches.websiteId, websiteId), gt(videoIdeaBatches.slot, 0)));
/** A writer that answers nothing usable. */
const empty = () => vi.fn(async () => ({ ideas: [], usage: { inputTokens: 10, outputTokens: 10, model: "claude-sonnet-5" } }));

describe("new ideas", () => {
  it("are refused when the credits are short, and nothing is reserved", async () => {
    const { websiteId } = await site();
    expect(await requestVideoIdeas(websiteId, "viral", "click-1")).toEqual({ ok: false, error: "not_enough_credits", price: 1, available: 0 });
    expect(await extraBatches(websiteId)).toHaveLength(0);
    expect(queue.queueJob).not.toHaveBeenCalled();
  });

  it("are free when the administrator sets the price to 0", async () => {
    const { websiteId } = await site();
    await test.db.insert(creditSettings).values({ key: "price:video_ideas", value: 0 });
    expect(await requestVideoIdeas(websiteId, "mixed", "click-free")).toMatchObject({ ok: true, data: { slot: 1, reused: false } });
  });

  it("give their credits back when a batch writes no idea, and its one re-request is charged again", async () => {
    const { websiteId, orgId } = await site();
    await recordCredit(orgId, { type: "adjustment", amount: 2, note: "test" });
    const first = await requestVideoIdeas(websiteId, "viral", "click-a");
    if (!first.ok || !first.data) throw new Error("not reserved");
    expect(await available(orgId)).toBe(1);

    await writeExtraBatch(first.data.batchId, NOW, { write: empty() }, { final: true }).catch(() => null);
    const [failed] = await test.db.select().from(videoIdeaBatches).where(eq(videoIdeaBatches.id, first.data.batchId));
    expect(failed).toMatchObject({ status: "failed", created: 0 });
    expect(await available(orgId)).toBe(2);
    const [spend] = await test.db.select().from(creditSpends).where(eq(creditSpends.idempotencyKey, ideasSpendKey(first.data.batchId, false)));
    expect(spend.refundedAt).not.toBeNull();

    // Asked again a minute later: the same slot, charged under its own key, and refunded again when it fails.
    vi.setSystemTime(new Date(NOW.getTime() + 60_000));
    const again = await requestVideoIdeas(websiteId, "viral", "click-b");
    expect(again).toMatchObject({ ok: true, data: { batchId: first.data.batchId, slot: 1 } });
    expect(await available(orgId)).toBe(1);
    await writeExtraBatch(first.data.batchId, new Date(), { write: empty() }, { final: true }).catch(() => null);
    expect(await available(orgId)).toBe(2);
  });

  it("give back the credits of a batch that stalled (its job never ran)", async () => {
    const { websiteId, orgId } = await site();
    await recordCredit(orgId, { type: "adjustment", amount: 1, note: "test" });
    const first = await requestVideoIdeas(websiteId, "website", "click-1");
    expect(first.ok).toBe(true);
    expect(await available(orgId)).toBe(0);
    // Eleven minutes on, the next request finds it stalled: it fails and its credit comes back,
    // then the same slot is asked for again - and paid with that credit.
    vi.setSystemTime(new Date(NOW.getTime() + 11 * 60_000));
    const next = await requestVideoIdeas(websiteId, "website", "click-2");
    expect(next).toMatchObject({ ok: true, data: { slot: 1 } });
    expect(await available(orgId)).toBe(0);
    const spends = await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId));
    expect(spends.map((row) => [row.idempotencyKey.endsWith(":first"), row.refundedAt !== null]).sort()).toEqual([
      [false, false],
      [true, true],
    ]);
  });
});

const SCRIPT: VideoScript = {
  hook: "Three photo mistakes",
  points: [
    { title: "Dark shots", detail: "Light sells.", stat: null },
    { title: "Busy backgrounds", detail: "Keep it plain.", stat: null },
  ],
  proof: "",
  cta: "Follow for more",
};

async function video(values: Partial<typeof videoIdeas.$inferInsert> = {}) {
  const { websiteId } = await site();
  const [row] = await test.db
    .insert(videoIdeas)
    .values({
      websiteId,
      day: "2026-11-21",
      style: "bold",
      language: "en",
      title: "Three mistakes",
      script: SCRIPT,
      caption: "Light sells. #photo",
      status: "ready",
      videoUrl: "https://files.example/reel.mp4",
      platforms: ["instagram", "tiktok", "youtube"],
      ...values,
    })
    .returning();
  return { websiteId, row };
}
const reload = async (id: string) => (await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, id)))[0];

describe("mark as posted", () => {
  it("works without any connected account, moves the video to Posted, and back when taken back", async () => {
    const { websiteId, row } = await video();
    expect(await markVideoPosted(websiteId, row.id, "tiktok", true)).toEqual({ ok: true, data: { status: "posted" } });
    let saved = await reload(row.id);
    expect(saved.status).toBe("posted");
    expect(saved.postedAt).not.toBeNull();
    // Only where it is: the settings' platforms are not claimed as posted.
    expect(saved.platforms).toEqual(["tiktok"]);
    expect(readDestinations(saved.destinations).tiktok).toMatchObject({ status: "posted", manual: true, bundlePostId: null });

    expect(await markVideoPosted(websiteId, row.id, "youtube", true)).toMatchObject({ ok: true });
    expect((await reload(row.id)).platforms).toEqual(["tiktok", "youtube"]);
    expect(await markVideoPosted(websiteId, row.id, "youtube", false)).toMatchObject({ ok: true, data: { status: "posted" } });
    expect(await markVideoPosted(websiteId, row.id, "tiktok", false)).toEqual({ ok: true, data: { status: "ready" } });
    saved = await reload(row.id);
    expect(saved).toMatchObject({ status: "ready", postedAt: null });
    expect(readDestinations(saved.destinations)).toEqual({});
  });

  it("waits for the video, and leaves a video being published alone", async () => {
    const making = await video({ status: "making", videoUrl: null });
    expect(await markVideoPosted(making.websiteId, making.row.id, "instagram", true)).toEqual({ ok: false, error: "not_ready" });
    const posting = await video({ status: "posting" });
    expect(await markVideoPosted(posting.websiteId, posting.row.id, "instagram", true)).toEqual({ ok: false, error: "already_handled" });
    expect(await markVideoPosted(posting.websiteId, posting.row.id, "snapchat", true)).toEqual({ ok: false, error: "not_found" });
  });

  it("keeps a schedule for the other platforms, and never takes back a post RepGet made", async () => {
    const scheduled = await video({
      status: "scheduled",
      scheduledFor: new Date(NOW.getTime() + 3_600_000),
      platforms: ["instagram"],
      destinations: { instagram: { status: "scheduled", bundlePostId: null, url: null, error: null, attempts: 0 } },
    });
    expect(await markVideoPosted(scheduled.websiteId, scheduled.row.id, "tiktok", true)).toEqual({ ok: true, data: { status: "scheduled" } });
    const saved = await reload(scheduled.row.id);
    expect(saved.platforms).toEqual(["instagram"]);
    expect(readDestinations(saved.destinations)).toMatchObject({ instagram: { status: "scheduled" }, tiktok: { status: "posted", manual: true } });

    const posted = await video({
      status: "posted",
      postedAt: NOW,
      platforms: ["instagram"],
      destinations: { instagram: { status: "posted", bundlePostId: "post_1", url: "https://instagram.example/p/1", error: null, attempts: 1 } },
    });
    expect(await markVideoPosted(posted.websiteId, posted.row.id, "instagram", false)).toEqual({ ok: true, data: { status: "posted" } });
    expect(readDestinations((await reload(posted.row.id)).destinations).instagram).toMatchObject({ status: "posted", bundlePostId: "post_1" });
  });
});
