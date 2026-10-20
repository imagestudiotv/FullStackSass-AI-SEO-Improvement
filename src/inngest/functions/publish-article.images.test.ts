import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { articles, integrations, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";
import { reviewHash } from "@/lib/articles/review";

const state = vi.hoisted(() => ({ db: null as unknown, integrationId: "" }));
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), image: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/inngest/client", () => ({ inngest: { createFunction: (_c: unknown, handler: unknown) => ({ handler }), send: vi.fn() } }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));
vi.mock("@/lib/articles/internal-links", () => ({ prepareStoredArticle: async () => null, summarize: vi.fn() }));
vi.mock("@/lib/net/safe-fetch", async original => ({ ...await original<object>(), safeFetch: mocks.fetch }));
vi.mock("@/lib/images/generate", () => ({ isImageGenerationConfigured: () => true, generateArticleImage: mocks.image }));
vi.mock("@/lib/publishing/credentials", () => ({
  resolveIntegration: async () => ({ integrationId: state.integrationId, providerId: "webhook" }),
  loadCredentialsById: async () => ({ integrationId: state.integrationId, providerId: "webhook",
    credentials: { endpointUrl: "https://receiver.example.com/articles", signingSecret: "synthetic-test-secret" } }),
}));
import { publishArticleJob } from "./publish-article";
import { shopifyProvider } from "@/lib/publishing/providers/shopify-provider";

let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });
afterAll(async () => { await test.client.close(); });
beforeEach(() => {
  mocks.fetch.mockReset().mockImplementation(async () => Response.json({ id: "post-1", url: "https://receiver.example.com/post-1" }));
  mocks.image.mockReset();
});
const imageUrl = "https://images.example.com/saved-header.webp";
async function fixture(image: string | null) {
  const f = await seedWebsite(test);
  await test.db.update(websites).set({ autoPublish: false, firstArticleSentAt: new Date(), poweredByLink: false }).where(eq(websites.id, f.websiteId));
  const [integration] = await test.db.insert(integrations).values({ websiteId: f.websiteId, kind: "webhook", status: "connected" }).returning();
  state.integrationId = integration.id;
  const [article] = await test.db.insert(articles).values({ websiteId: f.websiteId, title: "Saved article", slug: "saved-article", bodyHtml: "<h2>Details</h2><p>Reviewed content.</p>", imageUrl: image }).returning();
  return { ...f, article };
}
const run = (f: Awaited<ReturnType<typeof fixture>>) =>
  (publishArticleJob as unknown as { handler: (ctx: unknown) => Promise<unknown> }).handler({
    event: { id: `event-${f.article.id}`, data: { articleId: f.article.id, websiteId: f.websiteId, organizationId: f.orgId, status: "publish", trigger: "manual" } },
    step: { run: async (_id: string, fn: () => unknown) => fn() },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });

it("delivers the exact saved header URL through the real webhook adapter without downloading or regenerating it", async () => {
  const f = await fixture(imageUrl);
  await expect(run(f)).resolves.toMatchObject({ status: "publish" });
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  const [endpoint, request] = mocks.fetch.mock.calls[0];
  expect(endpoint).toBe("https://receiver.example.com/articles");
  expect(request.method).toBe("POST");
  expect(JSON.parse(request.body).article.imageUrl).toBe(imageUrl);
  expect(request.headers["x-signature"]).toMatch(/^[a-f0-9]{64}$/);
  expect(mocks.image).not.toHaveBeenCalled();
});

it("does not pay to generate an image that a URL-only destination cannot upload", async () => {
  await run(await fixture(null));
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).article.imageUrl).toBeNull();
  expect(mocks.image).not.toHaveBeenCalled();
});

it("never sends a changed header on an old research approval", async () => {
  const f = await fixture(imageUrl);
  await test.db.update(articles).set({ researchReviewRequired: true, researchApprovedHash: reviewHash(f.article), imageUrl: "https://images.example.com/new-header.webp" }).where(eq(articles.id, f.article.id));
  await expect(run(f)).resolves.toEqual({ held: "changed_since_approval" });
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.image).not.toHaveBeenCalled();
});

it("Shopify also sends the saved URL as the article image", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ article: { id: 1, handle: "saved-article", published_at: "2026-10-20" } }));
  vi.stubGlobal("fetch", fetch);
  try {
    await shopifyProvider.createPost({ shopDomain: "example.myshopify.com", accessToken: "synthetic", blogId: "1" }, {
      title: "Saved article", contentHtml: "<p>Text</p>", slug: "saved-article", excerpt: null, status: "publish", featuredImageUrl: imageUrl,
    });
    expect(JSON.parse(fetch.mock.calls[0][1].body).article.image.src).toBe(imageUrl);
  } finally { vi.unstubAllGlobals(); }
});
