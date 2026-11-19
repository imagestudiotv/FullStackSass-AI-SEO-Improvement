import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Downloading an article (ticket 2026-11-19, item 4): only what the customer
 * may see AND what may leave RepGet. A draft held for the team - emptied by
 * getArticle under the two-step flow, or refused by the publishing gate
 * (checkReleasable) under managed review - is a 404, the same answer as an
 * article that does not exist.
 */

const state = vi.hoisted(() => ({
  article: null as Record<string, unknown> | null,
  release: { ok: true } as { ok: boolean; reason?: string },
  released: [] as string[],
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth-guard", () => ({ requireSession: vi.fn(async () => ({ user: { id: "u1" } })) }));
vi.mock("@/lib/billing/require-plan", () => ({ requireWebsitePlan: vi.fn(async () => undefined) }));
vi.mock("@/lib/tenant", () => ({ requireWebsitePage: vi.fn(async () => ({ site: { id: "w1", language: "English" }, access: "owner" })) }));
vi.mock("@/lib/articles/actions", () => ({ getArticle: vi.fn(async () => state.article) }));
vi.mock("@/lib/articles/review", () => ({
  checkReleasable: vi.fn(async (id: string) => {
    state.released.push(id);
    return state.release;
  }),
}));

import { GET } from "./route";

const ID = "11111111-2222-4333-8444-555555555555";
const call = () => GET(new Request(`https://repget.test/websites/w1/articles/${ID}/download`), { params: Promise.resolve({ websiteId: "w1", articleId: ID }) });

const approved = {
  id: ID,
  title: "How to plan SEO",
  slug: "how-to-plan-seo",
  metaDescription: "A plan.",
  imageUrl: "https://cdn.example.com/a.png",
  imageAlt: "Cover",
  bodyHtml: "<h2>Start</h2><p>Text</p><script>alert(1)</script>",
  status: "draft",
  preparing: null,
};

beforeEach(() => {
  state.article = approved;
  state.release = { ok: true };
  state.released = [];
});

describe("article download", () => {
  it("serves an approved article as an HTML attachment, sanitised", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="how-to-plan-seo.html"');
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const html = await response.text();
    expect(html).toContain("<h1>How to plan SEO</h1>");
    expect(html).toContain("<h2>Start</h2>");
    expect(html).not.toContain("<script>");
    expect(state.released).toEqual([ID]);
  });

  it("refuses a draft held for the team's review (publishing gate), as a 404", async () => {
    state.release = { ok: false, reason: "pending_review" };
    await expect(call()).rejects.toThrow("NOT_FOUND");
    state.release = { ok: false, reason: "changed_since_approval" };
    await expect(call()).rejects.toThrow("NOT_FOUND");
  });

  it("refuses what getArticle keeps from the customer under the two-step flow, before asking the gate", async () => {
    state.article = { ...approved, bodyHtml: null, preparing: "team" };
    await expect(call()).rejects.toThrow("NOT_FOUND");
    state.article = null;
    await expect(call()).rejects.toThrow("NOT_FOUND");
    expect(state.released).toEqual([]);
  });

  it("refuses an article still being written or failed", async () => {
    state.article = { ...approved, status: "failed" };
    await expect(call()).rejects.toThrow("NOT_FOUND");
  });
});
