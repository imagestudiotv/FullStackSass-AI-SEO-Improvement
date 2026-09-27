import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, calendarItems, integrations, networkSites, platformControls, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";
import { NEW_SITE_DEFAULTS } from "@/lib/websites/new-site-defaults";

/**
 * The generation job and the publish job, with the new defaults: a draft for
 * a Partner Network website is held for review; images reach storage and the
 * CMS as real 1280 x 720 JPEGs. Providers are faked; nothing is paid for.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/websites/fetch-page", () => ({
  fetchPage: vi.fn(async () => new Response("<html><title>x</title></html>", { status: 200, headers: { "content-type": "text/html" } })),
}));
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(async () => ({ ids: ["evt"] })),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
const writer = vi.hoisted(() => ({ generateOutline: vi.fn(), generateBody: vi.fn() }));
vi.mock("@/lib/articles/generate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/articles/generate")>()),
  generateOutline: writer.generateOutline,
  generateBody: writer.generateBody,
}));
const stored = vi.hoisted(() => ({ images: [] as { data: Buffer; contentType: string }[] }));
vi.mock("@/lib/images/storage", () => ({
  isImageStorageConfigured: () => true,
  storeArticleImage: vi.fn(async (_site: string, _article: string, data: Buffer, contentType: string) => {
    stored.images.push({ data, contentType });
    return `https://storage.test/${stored.images.length}.${contentType === "image/jpeg" ? "jpg" : "bin"}`;
  }),
}));
vi.mock("@/lib/images/scene", () => ({ describeArticleScene: vi.fn(async () => ({ scene: "a couple at sunset", alt: "A couple at sunset" })) }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));
vi.mock("@/lib/plugin/sync", () => ({ nudgePluginIfDue: vi.fn(async () => "nothing-due"), recordSyncUrl: vi.fn() }));
const cms = vi.hoisted(() => ({ uploads: [] as { data: Buffer; contentType: string; filename: string }[] }));
vi.mock("@/lib/publishing/credentials", () => ({
  resolveIntegration: vi.fn(async () => ({ integrationId: "int-1", providerId: "wordpress" })),
  loadCredentialsById: vi.fn(async () => ({ integrationId: "int-1", providerId: "wordpress", credentials: {} })),
}));
vi.mock("@/lib/publishing/registry", () => ({
  getProvider: () => ({
    uploadMedia: vi.fn(async (_c: unknown, file: { data: Buffer; contentType: string; filename: string }) => {
      cms.uploads.push(file);
      return { id: "m1", url: "https://site.test/m1.jpg" };
    }),
  }),
}));

import { generateArticle, queueArticleForCalendarItem } from "./generate-article";
import { publishArticleJob } from "./publish-article";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  // The operator has switched the managed review on (lib/publishing/controls.ts).
  await test.db.insert(platformControls).values({ key: "managed_review", enabled: true, updatedBy: "test" });
  vi.stubEnv("IMAGE_PROVIDER", "openai");
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
  vi.stubEnv("OPENAI_IMAGE_MODEL", "gpt-image-2");
});
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  stored.images.length = 0;
  cms.uploads.length = 0;
  inngestMock.send.mockClear();
  // The image provider, answering with a real 3:2 PNG.
  const png = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: "#3a6" } }).png().toBuffer();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: png.toString("base64") }], usage: { output_tokens: 1000 } }))),
  );
});

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
function memoisedStep(stopAfter?: string) {
  const done = new Map<string, unknown>();
  return {
    run: async (id: string, fn: () => unknown) => {
      if (done.has(id)) return done.get(id);
      const result = await fn();
      done.set(id, result);
      if (id === stopAfter) throw new Error(`stop after ${id}`);
      return result;
    },
  };
}

const WRITTEN =
  "<p>Intro.</p><h2>Planning the day</h2><p>Light matters.</p><h2>What it costs</h2><p>It depends.</p>";

async function generate(participating: boolean) {
  const { orgId, websiteId } = await seedWebsite(test);
  // A website created by this build (lib/websites/new-site-defaults.ts).
  await test.db.update(websites).set({ url: "https://studio.test", domain: "studio.test", ...NEW_SITE_DEFAULTS }).where(eq(websites.id, websiteId));
  await test.db.insert(networkSites).values({ websiteId, acceptingLinks: participating, monthlyCap: 3 });
  await test.db.insert(integrations).values({ websiteId, kind: "wordpress", status: "connected" });
  const [item] = await test.db.insert(calendarItems).values({ websiteId, title: "Planning a wedding" }).returning({ id: calendarItems.id });
  const queued = await queueArticleForCalendarItem(websiteId, item.id);
  if (!queued.ok) throw new Error(queued.error);
  const data = (inngestMock.send.mock.calls.at(-1) as unknown as [{ data: unknown }])[0].data;
  inngestMock.send.mockClear();
  writer.generateOutline.mockResolvedValue({ sections: [{ heading: "A", points: [] }], metaDescription: "m" });
  writer.generateBody.mockResolvedValue({ bodyHtml: WRITTEN, metaDescription: "m", slug: "planning", wordCount: 20 });
  const job = generateArticle as unknown as { handler: (ctx: unknown) => Promise<unknown> };
  await job.handler({ event: { data }, step: memoisedStep(), logger });
  const [row] = await test.db.select().from(articles).where(eq(articles.id, queued.articleId));
  return { orgId, websiteId, row };
}

const publishes = () =>
  inngestMock.send.mock.calls.flat().filter((e) => (e as { name?: string }).name === "article/publish.requested");

describe("a new article on a Partner Network website", () => {
  it("is held for review - not published, the first-article exception included", async () => {
    const { row } = await generate(true);
    expect(row.reviewStatus).toBe("pending");
    expect(publishes()).toEqual([]);
    // Written with the new defaults: a contents list linking to real headings.
    expect(row.bodyHtml).toContain('<a href="#planning-the-day">Planning the day</a>');
    expect(row.bodyHtml).toContain('<h2 id="planning-the-day">');
  });

  it("stores a real 1280 x 720 JPEG as its header image", async () => {
    const { row } = await generate(true);
    expect(stored.images).toHaveLength(1);
    expect(stored.images[0].contentType).toBe("image/jpeg");
    expect(await sharp(stored.images[0].data).metadata()).toMatchObject({ width: 1280, height: 720, format: "jpeg" });
    expect(row.imageUrl).toMatch(/\.jpg$/);
  });
});

describe("a website outside the network", () => {
  it("keeps the old rule: its first article is published at once", async () => {
    const { row } = await generate(false);
    expect(row.reviewStatus).toBeNull();
    expect(publishes()).toHaveLength(1);
  });
});

describe("the publish job's image", () => {
  it("uploads a generated header image to the CMS as a real 1280 x 720 JPEG", async () => {
    const { orgId, websiteId, row } = await generate(false);
    await test.db.update(articles).set({ imageUrl: null, imageAlt: null }).where(eq(articles.id, row.id));
    const job = publishArticleJob as unknown as { handler: (ctx: unknown) => Promise<unknown> };
    await expect(
      job.handler({ event: { data: { articleId: row.id, websiteId, organizationId: orgId, status: "publish" } }, step: memoisedStep("upload-image"), logger }),
    ).rejects.toThrow("stop after upload-image");
    expect(cms.uploads).toHaveLength(1);
    expect(cms.uploads[0]).toMatchObject({ contentType: "image/jpeg", filename: expect.stringMatching(/\.jpg$/) });
    expect(await sharp(cms.uploads[0].data).metadata()).toMatchObject({ width: 1280, height: 720, format: "jpeg" });
  });
});
