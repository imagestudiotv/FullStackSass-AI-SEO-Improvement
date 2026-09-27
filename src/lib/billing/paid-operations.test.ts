import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedCalendarItem, seedWebsite } from "@/test/fixtures";

/*
  Audits, keyword research and image regeneration: the paid operations that
  used to be limited by counting usage_events written AFTER the spend, which
  simultaneous requests all read as zero.
*/

const state = vi.hoisted(() => ({ db: null as unknown, guestOrgId: null as string | null }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

// Auth mocked at the tenant boundary; entitlement, quotas and rows are real.
async function contextFor(websiteId: string) {
  const db = state.db as TestDb["db"];
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  return state.guestOrgId
    ? { site, orgId: state.guestOrgId, userId: "guest", access: "editor" as const }
    : { site, orgId: site.organizationId, userId: "owner", access: "owner" as const };
}
vi.mock("@/lib/tenant", () => ({ requireWebsite: vi.fn(contextFor) }));
vi.mock("@/lib/websites/require-editor", () => ({
  requireEditor: vi.fn(async (id: string) => ({ ok: true, context: await contextFor(id) })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// The queue: jobs go through the real outbox (lib/jobs/outbox.ts) to this send.
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));

// Every paid provider, mocked.
const images = vi.hoisted(() => ({
  generateArticleImage: vi.fn(),
  isImageGenerationConfigured: () => true,
}));
vi.mock("@/lib/images/generate", () => images);
vi.mock("@/lib/images/scene", () => ({ describeArticleScene: vi.fn(async () => null) }));
vi.mock("@/lib/images/storage", () => ({
  ALLOWED_IMAGE_TYPES: [],
  MAX_IMAGE_BYTES: 1,
  isImageStorageConfigured: () => true,
  storeArticleImage: vi.fn(async () => "https://cdn.example/img.png"),
  deleteArticleImage: vi.fn(),
  listWebsiteImages: vi.fn(),
}));
const crawler = vi.hoisted(() => ({ crawlSite: vi.fn() }));
vi.mock("@/lib/audit/crawler", () => crawler);

import { startAudit } from "@/lib/audit/actions";
import { startResearch } from "@/lib/keywords/actions";
import { regenerateArticleImage } from "@/lib/articles/image-actions";
import { auditWebsite } from "@/inngest/functions/audit-website";
import { deliverJobs, MAX_DELIVERY_ATTEMPTS } from "@/lib/jobs/outbox";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  state.guestOrgId = null;
  inngestMock.send.mockReset();
  inngestMock.send.mockResolvedValue({ ids: [] });
  images.generateArticleImage.mockReset();
  images.generateArticleImage.mockResolvedValue({
    data: Buffer.from("png"),
    contentType: "image/png",
    alt: "alt",
    costUsd: 0.04,
  });
  crawler.crawlSite.mockReset();
});

/** Drives delivery past its last attempt, as the outbox cron would. */
async function giveUpDelivery() {
  await test.client.query("update job_outbox set attempts = $1 where status = 'pending'", [
    MAX_DELIVERY_ATTEMPTS - 1,
  ]);
  await deliverJobs(test.db, { now: new Date(Date.now() + 24 * 3600 * 1000) });
}

async function article(websiteId: string) {
  const [row] = await test.db
    .insert(articles)
    .values({
      websiteId,
      calendarItemId: await seedCalendarItem(test, websiteId),
      title: "Article",
      status: "draft",
    })
    .returning({ id: articles.id });
  return row.id;
}

describe("audits", () => {
  it("admit the hourly ceiling under simultaneous presses", async () => {
    const { websiteId } = await seedWebsite(test);
    const outcomes = await Promise.all(Array.from({ length: 10 }, () => startAudit(websiteId)));
    expect(outcomes.filter((o) => o.ok)).toHaveLength(4);
    expect(inngestMock.send).toHaveBeenCalledTimes(4);
  });

  it("are billed to a shared site's owner", async () => {
    const { orgId, websiteId } = await seedWebsite(test);
    state.guestOrgId = "org_guest";
    expect((await startAudit(websiteId)).ok).toBe(true);
    expect(inngestMock.send.mock.calls[0][0].data.organizationId).toBe(orgId);
  });

  it("do not crawl when the plan was cancelled before the paid step ran", async () => {
    const { websiteId } = await seedWebsite(test);
    expect((await startAudit(websiteId)).ok).toBe(true);
    const data = inngestMock.send.mock.calls[0][0].data;
    await test.client.query("update subscriptions set status = 'canceled' where website_id = $1", [websiteId]);

    const job = auditWebsite as unknown as { handler: (ctx: unknown) => Promise<unknown> };
    await expect(
      job.handler({
        event: { data },
        step: { run: (_: string, fn: () => unknown) => fn() },
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      }),
    ).rejects.toThrow(/subscription is not active/);
    expect(crawler.crawlSite).not.toHaveBeenCalled();
  });
});

describe("keyword research", () => {
  it("admits the hourly ceiling under simultaneous presses", async () => {
    const { websiteId } = await seedWebsite(test);
    const outcomes = await Promise.all(Array.from({ length: 10 }, () => startResearch(websiteId)));
    expect(outcomes.filter((o) => o.ok)).toHaveLength(3);
    expect(inngestMock.send).toHaveBeenCalledTimes(3);
  });

  it("accepts research while the queue is down, and returns the slot only when delivery is given up", async () => {
    const { websiteId } = await seedWebsite(test);
    inngestMock.send.mockRejectedValue(new Error("queue down"));
    const states = async () =>
      (
        await test.client.query<{ state: string }>(
          "select state from spend_reservations where website_id = $1",
          [websiteId],
        )
      ).rows.map((r) => r.state);

    expect((await startResearch(websiteId)).ok).toBe(true);
    // Still promised: held, and waiting to be delivered.
    expect(await states()).toEqual(["reserved", "reserved"]);

    await giveUpDelivery();
    expect(await states()).toEqual(["released", "released"]);
  });
});

describe("image regeneration", () => {
  it("never exceeds the per-article cap under simultaneous presses", async () => {
    const { websiteId } = await seedWebsite(test);
    const articleId = await article(websiteId);

    const outcomes = await Promise.all(
      Array.from({ length: 12 }, () => regenerateArticleImage(websiteId, articleId, "")),
    );

    expect(outcomes.filter((o) => o.ok)).toHaveLength(5);
    expect(images.generateArticleImage).toHaveBeenCalledTimes(5);
    const [row] = await test.db.select().from(articles).where(eq(articles.id, articleId));
    expect(row.imageAttempts).toBe(5);
  });

  it("gives the slot back when the provider refuses", async () => {
    const { websiteId } = await seedWebsite(test);
    const articleId = await article(websiteId);
    images.generateArticleImage.mockRejectedValue(
      new Anthropic.APIError(400, { type: "invalid_request_error" }, "rejected", new Headers()),
    );
    for (let i = 0; i < 8; i += 1) await regenerateArticleImage(websiteId, articleId, "a cat");

    images.generateArticleImage.mockResolvedValue({
      data: Buffer.from("png"), contentType: "image/png", alt: "alt", costUsd: 0.04,
    });
    expect((await regenerateArticleImage(websiteId, articleId, "a cat")).ok).toBe(true);
  });

  it("still counts regenerations made before the ledger existed", async () => {
    const { websiteId } = await seedWebsite(test);
    const articleId = await article(websiteId);
    await test.db.update(articles).set({ imageAttempts: 4 }).where(eq(articles.id, articleId));

    expect((await regenerateArticleImage(websiteId, articleId, "")).ok).toBe(true);
    expect(await regenerateArticleImage(websiteId, articleId, "")).toEqual({
      ok: false,
      error: expect.stringMatching(/regenerated this image 5 times/),
    });
  });

  it("is refused for a cancelled plan", async () => {
    const { websiteId } = await seedWebsite(test, { status: "canceled" });
    const articleId = await article(websiteId);
    expect((await regenerateArticleImage(websiteId, articleId, "")).ok).toBe(false);
    expect(images.generateArticleImage).not.toHaveBeenCalled();
  });
});
