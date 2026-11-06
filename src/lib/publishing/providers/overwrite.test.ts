import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What each provider asks its platform before and during an update, with stubbed
 * HTTP. No real site is involved, so this shows what this code sends and how it
 * reads an answer shaped as the platform's documentation says: not that the
 * platform behaves so. lib/publishing/overwrite-guard.ts decides from the result.
 */

type Route = (url: string, init: RequestInit) => Response | undefined;
const http = vi.hoisted(() => ({ route: null as unknown, calls: [] as Array<{ url: string; method: string; body: unknown }> }));
function answer(url: string, init: RequestInit = {}) {
  const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
  http.calls.push({ url, method: init.method ?? "GET", body });
  const response = (http.route as Route)(url, init);
  if (!response) throw new Error(`nothing stubbed for ${init.method ?? "GET"} ${url}`);
  return response;
}
vi.mock("@/lib/net/safe-fetch", async (original) => ({
  ...(await original<typeof import("@/lib/net/safe-fetch")>()),
  safeFetch: vi.fn(async (url: string, init: RequestInit) => answerFromTest(url, init)),
}));
const answerFromTest = vi.hoisted(() => (url: string, init: RequestInit) => (globalThis as unknown as { __answer: typeof answer }).__answer(url, init));

import { ProviderError, RemoteChangedError } from "@/lib/publishing/provider";
import { ghostProvider } from "./ghost-provider";
import { shopifyProvider } from "./shopify-provider";
import { webflowProvider } from "./webflow-provider";
import { webhookProvider } from "./webhook-provider";
import { wixProvider } from "./wix-provider";
import { wordpressProvider } from "./wordpress-provider";

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const input = { title: "T", contentHtml: "<p>x</p>", slug: "t", excerpt: "e", status: "publish" as const };

beforeEach(() => {
  http.calls.length = 0;
  (globalThis as unknown as { __answer: typeof answer }).__answer = answer;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => answer(url, init)));
});
afterEach(() => vi.unstubAllGlobals());

describe("WordPress: no precondition exists, so it is read first", () => {
  const credentials = { siteUrl: "https://example.com", username: "u", applicationPassword: "p" };
  const edited = (over: Record<string, unknown> = {}) => ({
    id: 7, link: "https://example.com/t/", status: "publish", modified_gmt: "2026-01-01T10:00:00", slug: "t", password: "", featured_media: 3,
    title: { raw: "T", rendered: "T" }, content: { raw: "<p>x</p>", rendered: "<p>x</p>" }, excerpt: { raw: "e", rendered: "e" },
    ...over,
  });

  it("a create and a later read of the same post give the same baseline", async () => {
    http.route = (url: string) => (url.includes("context=edit") ? json(edited()) : json(edited()));
    const created = await wordpressProvider.createPost(credentials, input);
    const read = await wordpressProvider.readRemote!(credentials, "7");
    expect(read).toMatchObject({ modifiedAt: "2026-01-01T10:00:00", hash: created.baseline?.hash, status: "publish", rawContent: "<p>x</p>" });
    expect(created.baseline?.hash).toBeTruthy();
    expect(http.calls.at(-1)?.url).toContain("/wp/v2/posts/7?context=edit");
  });

  it.each([
    ["its text", { content: { raw: "<p>edited</p>" } }],
    ["the letter case of its title", { title: { raw: "t" } }],
    ["its excerpt", { excerpt: { raw: "edited" } }],
    ["its address", { slug: "edited" }],
    ["its password", { password: "edited" }],
    ["its featured image", { featured_media: 4 }],
  ])("the hash moves with %s, and not with the time alone", async (_what, change) => {
    http.route = () => json(edited());
    const before = await wordpressProvider.readRemote!(credentials, "7");
    http.route = () => json(edited(change));
    expect((await wordpressProvider.readRemote!(credentials, "7"))?.hash).not.toBe(before?.hash);
    http.route = () => json(edited({ modified_gmt: "2027-01-01T10:00:00" }));
    expect((await wordpressProvider.readRemote!(credentials, "7"))?.hash).toBe(before?.hash);
  });

  it("no raw fields in the answer: no hash, never a hash of nothing", async () => {
    http.route = () => json({ id: 7, link: "x", status: "publish", modified_gmt: "2026-01-01T10:00:00", title: { rendered: "T" } });
    expect(await wordpressProvider.readRemote!(credentials, "7")).toMatchObject({ hash: null, modifiedAt: "2026-01-01T10:00:00" });
  });

  it("a 404 with the REST API answering: the post is gone", async () => {
    http.route = (url: string) => (url.includes("/posts/7") ? json({ code: "rest_post_invalid_id" }, 404) : json([]));
    expect(await wordpressProvider.readRemote!(credentials, "7")).toBeNull();
  });

  it("a 404 from a site with the REST API off is no such thing: it throws", async () => {
    http.route = () => json({}, 404);
    await expect(wordpressProvider.readRemote!(credentials, "7")).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("Ghost: its own optimistic lock", () => {
  const credentials = { siteUrl: "https://example.com", adminApiKey: "aaaa:bbbb" };
  const post = (over: Record<string, unknown> = {}) => ({ id: "g1", url: "https://example.com/t/", status: "published", updated_at: "2026-01-01T10:00:00.000Z", title: "T", html: "<p>x</p>", custom_excerpt: "e", slug: "t", ...over });

  it("the PUT carries the time that was checked, and reads nothing in between", async () => {
    http.route = () => json({ posts: [post()] });
    const sent = await ghostProvider.updatePost(credentials, "g1", input, { expectedModifiedAt: "2026-01-01T10:00:00.000Z" });
    expect(http.calls.map((call) => call.method)).toEqual(["PUT"]);
    expect((http.calls[0].body as { posts: Array<{ updated_at: string }> }).posts[0].updated_at).toBe("2026-01-01T10:00:00.000Z");
    expect(sent.baseline?.modifiedAt).toBe("2026-01-01T10:00:00.000Z");
    expect(sent.baseline?.hash).toBeTruthy();
  });

  it("Ghost refuses it: a change, not a failure", async () => {
    http.route = () => json({ errors: [{ message: "Saving failed! Someone else is editing this post." }] }, 409);
    await expect(ghostProvider.updatePost(credentials, "g1", input, { expectedModifiedAt: "2026-01-01T10:00:00.000Z" })).rejects.toBeInstanceOf(RemoteChangedError);
  });

  it("read with its html, or there is nothing to hash", async () => {
    http.route = () => json({ posts: [post()] });
    expect((await ghostProvider.readRemote!(credentials, "g1"))?.hash).toBeTruthy();
    expect(http.calls[0].url).toContain("formats=html");
  });

  it("a 404 from a live Ghost: the post is gone. From no Ghost at all: it throws", async () => {
    http.route = (url: string) => (url.includes("/posts/") ? json({}, 404) : json({ site: {} }));
    expect(await ghostProvider.readRemote!(credentials, "g1")).toBeNull();
    http.route = () => json({}, 404);
    await expect(ghostProvider.readRemote!(credentials, "g1")).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("Shopify: read first, no precondition", () => {
  const credentials = { shopDomain: "shop.myshopify.com", accessToken: "t", blogId: "" };
  const article = { id: 9, handle: "t", published_at: "2026-01-01T10:00:00Z", updated_at: "2026-01-01T10:00:00Z", title: "T", body_html: "<p>x</p>", summary_html: "e" };

  it("reads the article it would update, by its blog", async () => {
    http.route = () => json({ article });
    const read = await shopifyProvider.readRemote!(credentials, "5:9");
    expect(http.calls[0].url).toContain("/blogs/5/articles/9.json");
    expect(http.calls[0].method).toBe("GET");
    expect(read).toMatchObject({ modifiedAt: "2026-01-01T10:00:00Z", status: "publish" });
  });

  it("the answer to a write gives the baseline the next read compares with", async () => {
    http.route = () => json({ article });
    const sent = await shopifyProvider.updatePost(credentials, "5:9", input);
    expect(sent.baseline?.hash).toBe((await shopifyProvider.readRemote!(credentials, "5:9"))?.hash);
  });

  it("gone: null", async () => {
    http.route = () => json({}, 404);
    expect(await shopifyProvider.readRemote!(credentials, "5:9")).toBeNull();
  });
});

describe("Webflow: read first, no precondition documented", () => {
  const credentials = { apiToken: "t", collectionId: "c1" };
  const item = (over: Record<string, unknown> = {}) => ({ id: "w1", lastUpdated: "2026-01-01T10:00:00.000Z", isArchived: false, isDraft: false, fieldData: { name: "T", slug: "t", body: "<p>x</p>" }, ...over });

  it("reads its last update and its fields, whatever order they come in", async () => {
    http.route = () => json(item());
    const first = await webflowProvider.readRemote!(credentials, "w1");
    http.route = () => json(item({ fieldData: { body: "<p>x</p>", slug: "t", name: "T" } }));
    expect((await webflowProvider.readRemote!(credentials, "w1"))?.hash).toBe(first?.hash);
    expect(first).toMatchObject({ modifiedAt: "2026-01-01T10:00:00.000Z", status: "publish" });
  });

  it("archived counts as thrown away: the update would bring it back", async () => {
    http.route = () => json(item({ isArchived: true }));
    expect((await webflowProvider.readRemote!(credentials, "w1"))?.status).toBe("trash");
  });

  it("the answer to a PATCH gives the next baseline", async () => {
    http.route = (url: string, init: RequestInit) => (init.method === "PATCH" ? json(item()) : json({ fields: [{ type: "RichText", slug: "body" }] }));
    const sent = await webflowProvider.updatePost(credentials, "w1", input);
    expect(sent.baseline).toMatchObject({ modifiedAt: "2026-01-01T10:00:00.000Z" });
    expect(sent.baseline?.hash).toBeTruthy();
  });

  it("gone: null", async () => {
    http.route = () => json({}, 404);
    expect(await webflowProvider.readRemote!(credentials, "w1")).toBeNull();
  });
});

describe("Wix: read first, nothing relied on but what a read returns", () => {
  const credentials = { apiKey: "k", siteId: "s" };
  const draft = (over: Record<string, unknown> = {}) => ({ draftPost: { id: "x1", title: "T", excerpt: "e", richContent: { nodes: [{ type: "HTML" }] }, ...over } });

  it("the baseline is taken by reading after the write, as its publish may change the draft", async () => {
    http.route = (_url: string, init: RequestInit) => (init.method === "PATCH" || init.method === "POST" ? json({}) : json(draft({ editedDate: "2026-01-01T10:00:00.000Z" })));
    const sent = await wixProvider.updatePost(credentials, "x1", input);
    expect(http.calls.map((call) => call.method)).toEqual(["PATCH", "POST", "GET"]);
    expect(sent.baseline).toMatchObject({ modifiedAt: "2026-01-01T10:00:00.000Z" });
    expect(sent.baseline?.hash).toBe((await wixProvider.readRemote!(credentials, "x1"))?.hash);
  });

  it("a read failing after the write does not fail the send: it is out", async () => {
    http.route = (_url: string, init: RequestInit) => (init.method === "GET" || !init.method ? json({}, 500) : json({}));
    const sent = await wixProvider.updatePost(credentials, "x1", input);
    expect(sent.baseline).toBeUndefined();
  });

  it("no text in the answer: no hash, and no date: nothing can show it unchanged", async () => {
    http.route = () => json({ draftPost: { id: "x1", title: "T" } });
    expect(await wixProvider.readRemote!(credentials, "x1")).toMatchObject({ hash: null, modifiedAt: null });
  });

  it("gone: null", async () => {
    http.route = () => json({}, 404);
    expect(await wixProvider.readRemote!(credentials, "x1")).toBeNull();
  });
});

describe("Webhook: it can only be posted to", () => {
  it("has no way to read a post, so every update is refused before it is sent", () => {
    expect(webhookProvider.readRemote).toBeUndefined();
  });
});
