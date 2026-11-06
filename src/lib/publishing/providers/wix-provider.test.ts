import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { wixProvider } from "./wix-provider";

/**
 * A first send to Wix, against answers shaped as Wix's Blog API reference gives
 * them (Create Draft Post returns { draftPost }, Publish Draft Post { postId }):
 * https://dev.wix.com/docs/api-reference/business-solutions/blog/draft-posts/create-draft-post
 * Stubbed from the reference, not recorded from a real Wix site.
 */

const credentials = { apiKey: "k", siteId: "s" };
const input = { title: "T", contentHtml: "<p>x</p>", slug: "wedding-films", excerpt: "e", status: "publish" as const };
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });

let calls: { url: string; method?: string; body?: unknown }[];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body as string) : undefined });
      if (url.endsWith("/blog/v3/draft-posts")) return json({ draftPost: { id: "d-1", title: "T", status: "UNPUBLISHED" } });
      if (url.endsWith("/publish")) return json({ postId: "p-1" });
      return json({ draftPost: { id: "d-1", title: "T", excerpt: "e", editedDate: "2026-01-01T10:00:00.000Z", richContent: { nodes: [] } } });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("Wix: a first send", () => {
  it("keeps the id Wix returns, publishes that draft, and takes its baseline from it", async () => {
    const sent = await wixProvider.createPost(credentials, input);
    expect(sent).toMatchObject({ remoteId: "d-1", status: "publish", baseline: { modifiedAt: "2026-01-01T10:00:00.000Z" } });
    expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
      "POST /blog/v3/draft-posts",
      "POST /blog/v3/draft-posts/d-1/publish",
      "GET /blog/v3/draft-posts/d-1",
    ]);
  });

  it("asks for the article's address in the field the reference names", async () => {
    await wixProvider.createPost(credentials, { ...input, status: "draft" });
    const { draftPost } = calls[0].body as { draftPost: Record<string, unknown> };
    expect(draftPost.seoSlug).toBe("wedding-films");
    expect(draftPost).not.toHaveProperty("slugs");
  });

  it("a draft is created and left unpublished", async () => {
    const sent = await wixProvider.createPost(credentials, { ...input, status: "draft" });
    expect(sent.remoteId).toBe("d-1");
    expect(calls.some((call) => call.url.endsWith("/publish"))).toBe(false);
  });
});
