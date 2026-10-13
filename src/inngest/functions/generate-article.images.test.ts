import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedCalendarItem, seedWebsite } from "@/test/fixtures";

/**
 * The article job with pictures inside the article (client, 2026-10-13: "3
 * more images for the article and not just the hero image"), every paid
 * provider and the image store mocked: nothing leaves the process.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
const providers = vi.hoisted(() => ({
  generateOutline: vi.fn(),
  generateBody: vi.fn(),
  sanitizeHtml: (html: string) => html,
  countWords: () => 0,
}));
vi.mock("@/lib/articles/generate", () => providers);
const images = vi.hoisted(() => ({
  generateArticleImage: vi.fn(),
  storeArticleImage: vi.fn(),
  describeArticleScene: vi.fn(),
  describeBodyScenes: vi.fn(),
}));
vi.mock("@/lib/images/generate", () => ({
  isImageGenerationConfigured: () => true,
  generateArticleImage: images.generateArticleImage,
}));
vi.mock("@/lib/images/storage", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isImageStorageConfigured: () => true,
  storeArticleImage: images.storeArticleImage,
}));
vi.mock("@/lib/images/scene", () => ({
  describeArticleScene: images.describeArticleScene,
  describeBodyScenes: images.describeBodyScenes,
}));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));

import { generateArticle, queueArticleForCalendarItem } from "./generate-article";

type Fn = { handler: (ctx: unknown) => Promise<unknown> };
const job = generateArticle as unknown as Fn;
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

function memoisedStep() {
  const done = new Map<string, unknown>();
  return {
    run: async (id: string, fn: () => unknown) => {
      if (done.has(id)) return done.get(id);
      const result = await fn();
      done.set(id, result);
      return result;
    },
  };
}

const BODY = [
  "<h2>What it costs</h2><p>Opening 1.</p><p>More 1.</p>",
  "<h2>What drives the price</h2><p>Opening 2.</p><h3>Season</h3><p>Part.</p>",
  "<h2>Comparing packages</h2><p>Opening 3.</p><table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>",
  "<h2>How to book</h2><p>Opening 4.</p>",
  "<h2>Mistakes to avoid</h2><p>Opening 5.</p>",
  "<h2>Frequently asked questions</h2><h3>How early?</h3><p>Early.</p>",
].join("");

let stored = 0;
beforeEach(async () => {
  await test.client.exec("delete from job_outbox");
  inngestMock.send.mockReset();
  inngestMock.send.mockResolvedValue({ ids: ["evt"] });
  providers.generateOutline.mockReset().mockResolvedValue({ sections: [{ heading: "A", subheadings: [], points: [] }], metaDescription: "m", faq: ["How early?"] });
  providers.generateBody.mockReset().mockResolvedValue({ bodyHtml: BODY, metaDescription: "m", slug: "s", wordCount: 1500 });
  images.describeArticleScene.mockReset().mockResolvedValue({ scene: "The cover scene.", alt: "Cover" });
  images.describeBodyScenes.mockReset().mockImplementation(async ({ sections }: { sections: { heading: string }[] }) =>
    sections.map((section) => ({ scene: `A photo for ${section.heading}.`, alt: `Photo: ${section.heading}` })),
  );
  images.generateArticleImage.mockReset().mockImplementation(async (_t: string, _i: string, _c: null, settings: { alt?: string }) => ({
    data: Buffer.from("jpeg"),
    contentType: "image/jpeg",
    alt: settings?.alt ?? "x",
    costUsd: 0.04,
    width: 1200,
    height: 800,
  }));
  stored = 0;
  images.storeArticleImage.mockReset().mockImplementation(async () => `https://storage.test/image-${++stored}.jpg`);
});

async function run(over: Partial<typeof websites.$inferInsert> = {}) {
  const { websiteId } = await seedWebsite(test, {});
  if (Object.keys(over).length) await test.db.update(websites).set(over).where(eq(websites.id, websiteId));
  const itemId = await seedCalendarItem(test, websiteId);
  const outcome = await queueArticleForCalendarItem(websiteId, itemId);
  if (!outcome.ok) throw new Error(outcome.error);
  const data = inngestMock.send.mock.calls.at(-1)![0].data;
  await job.handler({ event: { data }, step: memoisedStep(), logger });
  const [row] = await test.db.select().from(articles).where(eq(articles.id, outcome.articleId));
  return row;
}

describe("pictures inside the article", () => {
  it("writes the cover and three pictures, one in each of three sections spread through the text - none in the first section or the FAQ", async () => {
    const article = await run();

    expect(article.status).not.toBe("failed");
    expect(article.imageUrl).toBe("https://storage.test/image-1.jpg");
    const body = article.bodyHtml ?? "";
    expect(body.match(/<img /g)).toHaveLength(3);
    const firstSection = body.slice(body.indexOf("What it costs"), body.indexOf("What drives the price"));
    expect(firstSection).not.toContain("<img");
    expect(body.slice(body.indexOf("Frequently asked questions"))).not.toContain("<img");
    // One description call for all three, knowing the cover, so they differ from it.
    expect(images.describeBodyScenes).toHaveBeenCalledTimes(1);
    expect(images.describeBodyScenes.mock.calls[0][0]).toMatchObject({ coverScene: "The cover scene." });
    expect(images.describeBodyScenes.mock.calls[0][0].sections.map((s: { heading: string }) => s.heading)).toEqual([
      "What drives the price",
      "How to book",
      "Mistakes to avoid",
    ]);
    // Never inside a table.
    expect(body).not.toMatch(/<table>(?:(?!<\/table>).)*<img /);
    expect(body).toContain('alt="Photo: How to book"');
    expect(images.generateArticleImage).toHaveBeenCalledTimes(4);
  });

  it("a website set to no pictures gets only the cover", async () => {
    const article = await run({ bodyImages: 0 });
    expect(article.imageUrl).toBeTruthy();
    expect(article.bodyHtml ?? "").not.toContain("<img");
    expect(images.describeBodyScenes).not.toHaveBeenCalled();
    expect(images.generateArticleImage).toHaveBeenCalledTimes(1);
  });

  it("a picture that fails is left out; the article is still written with the others", async () => {
    let call = 0;
    images.generateArticleImage.mockImplementation(async (_t: string, _i: string, _c: null, settings: { alt?: string }) => {
      call += 1;
      if (call === 3) throw new Error("content policy");
      return { data: Buffer.from("jpeg"), contentType: "image/jpeg", alt: settings?.alt ?? "x", costUsd: 0.04, width: 1200, height: 800 };
    });
    const article = await run();
    expect(article.status).not.toBe("failed");
    expect((article.bodyHtml ?? "").match(/<img /g)).toHaveLength(2);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ step: "body-image-2" }), expect.stringContaining("continuing without it"));
  });
});
