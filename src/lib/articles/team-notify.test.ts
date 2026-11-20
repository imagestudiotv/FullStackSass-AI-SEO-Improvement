import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The team's email for an article held for its review (ticket 2026-11-19,
 * item 4: "we receive a notification"): only for a held article, the first
 * article of a new client said so, one email per admin per article version.
 */

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ row: null as Record<string, unknown> | null, sent: [] as { to: string; subject: string; idempotencyKey?: string; text: string }[] }));
vi.mock("@/lib/db", () => {
  const chain = { from: () => chain, innerJoin: () => chain, where: () => chain, limit: async () => (state.row ? [state.row] : []) };
  return { db: { select: () => chain } };
});
vi.mock("@/lib/admin/guard", () => ({ adminEmails: () => (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean) }));
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async (email: { to: string; subject: string; idempotencyKey?: string; text: string }) => {
    state.sent.push(email);
    return { ok: true };
  }),
}));

import { emailTeamArticleHeld } from "./team-notify";

const held = { title: "Best wedding venues", reviewStatus: "pending", reviewVersion: 3, wordCount: 1500, domain: "venues.test", workspace: "Venues", first: true };

afterEach(() => {
  vi.unstubAllEnvs();
  state.sent.length = 0;
  state.row = null;
});

describe("emailTeamArticleHeld", () => {
  it("emails every admin about a new client's first held article, with its review page", async () => {
    vi.stubEnv("ADMIN_EMAILS", "a@repget.com,b@repget.com");
    state.row = held;
    expect(await emailTeamArticleHeld({ articleId: "art-1" })).toEqual({ sent: 2 });
    expect(state.sent[0].subject).toBe("First article to review: Best wedding venues (venues.test)");
    expect(state.sent[0].text).toContain("/admin/network/art-1");
    expect(state.sent[0].idempotencyKey).toBe("article-held:art-1:3:a@repget.com");
  });

  it("says Article, not First article, for a client who already has one", async () => {
    vi.stubEnv("ADMIN_EMAILS", "a@repget.com");
    state.row = { ...held, first: false };
    await emailTeamArticleHeld({ articleId: "art-2" });
    expect(state.sent[0].subject).toBe("Article to review: Best wedding venues (venues.test)");
  });

  it("sends nothing for an article not held, or with no admin configured", async () => {
    vi.stubEnv("ADMIN_EMAILS", "a@repget.com");
    state.row = { ...held, reviewStatus: "none" };
    expect(await emailTeamArticleHeld({ articleId: "art-3" })).toEqual({ sent: 0 });
    vi.stubEnv("ADMIN_EMAILS", "");
    state.row = held;
    expect(await emailTeamArticleHeld({ articleId: "art-4" })).toEqual({ sent: 0 });
    expect(state.sent).toHaveLength(0);
  });
});
