import { randomUUID } from "node:crypto";

import type Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

/**
 * Discover & earn (client ticket, 2026-11-11) on PGlite: the one bonus per
 * member - refused below the goal, given once, once under racing claims -
 * the comment rules checked again on the server, and the AI drafts' daily cap.
 * The counts themselves are lib/blog/engagement.ts's (its own tests); here
 * they are set directly, so each case says exactly what the server counted.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  progress: { upvotes: 0, comments: 0 } as { upvotes: number; comments: number },
  session: { orgId: "", userId: "" },
  sharedOnly: false,
}));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));
const engagement = vi.hoisted(() => ({
  addComment: vi.fn<(input: { userId: string; postId: string; body: string }) => Promise<{ ok: true; commentId: string }>>(async () => ({ ok: true, commentId: "c1" })),
  setPostUpvote: vi.fn(async () => ({ upvoted: true, count: 1 })),
  listCustomerStories: vi.fn(async () => [] as unknown[]),
}));
vi.mock("@/lib/blog/engagement", async (actual) => ({
  ...(await actual<typeof import("@/lib/blog/engagement")>()),
  discoverProgress: async () => state.progress,
  addComment: engagement.addComment,
  setPostUpvote: engagement.setPostUpvote,
  listCustomerStories: engagement.listCustomerStories,
}));
vi.mock("@/lib/auth-guard", () => ({ requireSession: async () => ({ user: { id: state.session.userId } }) }));
vi.mock("@/lib/tenant", () => ({ requireOrg: async () => ({ orgId: state.session.orgId, userId: state.session.userId, role: "owner" }) }));
vi.mock("@/lib/websites/accessible", () => ({ hasOnlySharedWork: async () => state.sharedOnly }));
vi.mock("@/lib/i18n/app-locale", () => ({ resolveAppLocale: async () => "en" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getBalance } from "@/lib/backlinks/credits";
import { creditLedger, organization, spendReservations } from "@/lib/db/schema";
import { claimDiscoverBonus, discoverBonusKey } from "@/lib/earn/discover";
import { claimDiscoverBonusAction, discoverCommentAction, discoverDraftAction, discoverUpvoteAction } from "@/lib/earn/discover-actions";
import { cleanDraft, draftDiscoverComment, draftPrompt, DRAFT_LIMITS } from "@/lib/earn/discover-draft";
import { commentProblem } from "@/lib/earn/discover-rules";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  state.progress = { upvotes: 0, comments: 0 };
  state.sharedOnly = false;
  engagement.addComment.mockClear();
  engagement.setPostUpvote.mockClear();
  engagement.listCustomerStories.mockClear();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
});

async function member() {
  const id = randomUUID().slice(0, 8);
  const orgId = `org_${id}`;
  await test.db.insert(organization).values({ id: orgId, name: id, slug: orgId, createdAt: new Date() });
  return { orgId, userId: `user_${id}` };
}

async function workspace() {
  const id = randomUUID().slice(0, 8);
  await test.db.insert(organization).values({ id: `org_${id}`, name: id, slug: `org_${id}`, createdAt: new Date() });
  return `org_${id}`;
}

const bonusRows = async (userId: string) => test.db.select().from(creditLedger).where(eq(creditLedger.idempotencyKey, discoverBonusKey(userId)));

describe("the Discover & earn bonus", () => {
  it("is refused below either goal, and writes nothing", async () => {
    const { orgId, userId } = await member();
    for (const progress of [
      { upvotes: 19, comments: 10 },
      { upvotes: 20, comments: 9 },
      { upvotes: 0, comments: 0 },
    ]) {
      state.progress = progress;
      expect(await claimDiscoverBonus(userId, orgId)).toMatchObject({ outcome: "not_reached", progress });
    }
    expect(await bonusRows(userId)).toEqual([]);
    expect(await getBalance(orgId)).toBe(0);
  });

  it("gives 20 credits once both goals are met, and never again", async () => {
    const { orgId, userId } = await member();
    state.progress = { upvotes: 20, comments: 10 };
    expect(await claimDiscoverBonus(userId, orgId)).toMatchObject({ outcome: "claimed", credits: 20 });
    expect(await claimDiscoverBonus(userId, orgId)).toMatchObject({ outcome: "already_claimed" });
    // Even after more upvotes and comments, and after some were taken away.
    state.progress = { upvotes: 40, comments: 20 };
    expect(await claimDiscoverBonus(userId, orgId)).toMatchObject({ outcome: "already_claimed" });
    state.progress = { upvotes: 2, comments: 1 };
    expect(await claimDiscoverBonus(userId, orgId)).toMatchObject({ outcome: "already_claimed" });

    const rows = await bonusRows(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ organizationId: orgId, type: "reward", amount: 20, referenceId: userId });
    expect(await getBalance(orgId)).toBe(20);
  });

  it("is one per MEMBER: claiming again from another workspace gives nothing, another member has their own", async () => {
    const first = await member();
    const otherWorkspace = await workspace();
    state.progress = { upvotes: 20, comments: 10 };
    expect(await claimDiscoverBonus(first.userId, first.orgId)).toMatchObject({ outcome: "claimed" });
    expect(await claimDiscoverBonus(first.userId, otherWorkspace)).toMatchObject({ outcome: "already_claimed" });
    expect(await getBalance(otherWorkspace)).toBe(0);

    const second = await member();
    expect(await claimDiscoverBonus(second.userId, second.orgId)).toMatchObject({ outcome: "claimed" });
    expect(await getBalance(second.orgId)).toBe(20);
  });

  it("racing claims give it once", async () => {
    const { orgId, userId } = await member();
    state.progress = { upvotes: 20, comments: 10 };
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => claimDiscoverBonus(userId, orgId)));
    expect(outcomes.filter((claim) => claim.outcome === "claimed")).toHaveLength(1);
    expect(outcomes.filter((claim) => claim.outcome === "already_claimed")).toHaveLength(7);
    expect(await bonusRows(userId)).toHaveLength(1);
    expect(await getBalance(orgId)).toBe(20);
  });

  it("the button claims for the session's member and workspace only, and not with only shared work", async () => {
    const own = await member();
    state.session = own;
    state.progress = { upvotes: 20, comments: 10 };

    state.sharedOnly = true;
    expect(await claimDiscoverBonusAction()).toEqual({ ok: false, error: "not_allowed" });
    expect(await bonusRows(own.userId)).toEqual([]);

    state.sharedOnly = false;
    const victim = await member();
    const forge = claimDiscoverBonusAction as unknown as (input: unknown) => ReturnType<typeof claimDiscoverBonusAction>;
    expect(await forge({ userId: victim.userId, orgId: victim.orgId })).toMatchObject({ ok: true, credits: 20 });
    expect(await getBalance(own.orgId)).toBe(20);
    expect(await getBalance(victim.orgId)).toBe(0);
    expect(await bonusRows(victim.userId)).toEqual([]);
    expect(await claimDiscoverBonusAction()).toMatchObject({ ok: false, error: "already_claimed" });
  });
});

describe("a Discover comment, checked on the server", () => {
  const postId = randomUUID();
  const good = "The way the bakery explains its slow fermentation is clear and genuinely useful.";

  beforeEach(async () => {
    state.session = await member();
  });

  it("needs 50 characters, no link and the member's confirmation, before anything is posted", async () => {
    expect(await discoverCommentAction({ postId, body: "Too short to count.", confirmed: true })).toEqual({ ok: false, error: "short" });
    expect(await discoverCommentAction({ postId, body: `  ${"x".repeat(45)}    `, confirmed: true })).toEqual({ ok: false, error: "short" });
    expect(await discoverCommentAction({ postId, body: `${good} See https://spam.example`, confirmed: true })).toEqual({ ok: false, error: "link" });
    expect(await discoverCommentAction({ postId, body: `${good} Visit www.spam.example now`, confirmed: true })).toEqual({ ok: false, error: "link" });
    expect(await discoverCommentAction({ postId, body: `${good} Details on mybakery.com today`, confirmed: true })).toEqual({ ok: false, error: "link" });
    expect(await discoverCommentAction({ postId, body: good, confirmed: false })).toEqual({ ok: false, error: "unconfirmed" });
    const forge = discoverCommentAction as unknown as (input: unknown) => ReturnType<typeof discoverCommentAction>;
    expect(await forge({ postId, body: good, confirmed: "true" })).toEqual({ ok: false, error: "unconfirmed" });
    expect(await discoverCommentAction({ postId, body: "y".repeat(751), confirmed: true })).toEqual({ ok: false, error: "too_long" });
    expect(engagement.addComment).not.toHaveBeenCalled();
  });

  it("posts a valid one as the session's user, and answers with the server's count", async () => {
    state.progress = { upvotes: 4, comments: 3 };
    expect(await discoverCommentAction({ postId, body: `  ${good}  `, confirmed: true })).toEqual({ ok: true, progress: { upvotes: 4, comments: 3 } });
    expect(engagement.addComment).toHaveBeenCalledWith({ userId: state.session.userId, postId, body: good });
  });

  it("passes on the blog's own refusals", async () => {
    engagement.addComment.mockResolvedValueOnce({ ok: false, reason: "rate_limited" } as never);
    expect(await discoverCommentAction({ postId, body: good, confirmed: true })).toEqual({ ok: false, error: "rate_limited" });
    expect(await discoverCommentAction({ postId: "not-a-post", body: good, confirmed: true })).toEqual({ ok: false, error: "not_found" });
  });

  it("the shared rule the dialog uses says the same", () => {
    expect(commentProblem("short", true)).toBe("short");
    expect(commentProblem(good, true)).toBeNull();
    expect(commentProblem(`${good} http://x.y`, true)).toBe("link");
    expect(commentProblem(good, false)).toBe("unconfirmed");
  });

  it("an upvote of something that is not a post id is refused before the blog is asked", async () => {
    expect(await discoverUpvoteAction("1; drop table")).toEqual({ ok: false, error: "not_found" });
    expect(engagement.setPostUpvote).not.toHaveBeenCalled();
  });
});

describe("the AI draft", () => {
  const story = {
    postId: randomUUID(),
    slug: "lakeside",
    locale: "en",
    title: "How Lakeside Bakery doubled its Saturday orders",
    description: "A family bakery in Como and its sourdough.",
    name: "Lakeside Bakery",
    category: "Food & Drink",
    tagline: "Sourdough in Como.",
    websiteUrl: "https://lakeside.example",
    imageUrl: null,
    logoUrl: null,
    href: "/blog/lakeside",
  };
  const answer = (text: string) =>
    vi.fn<(body: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>>(async () => ({ content: [{ type: "text", text }] }) as unknown as Anthropic.Message);

  beforeEach(async () => {
    await test.db.delete(spendReservations);
  });

  it(`is capped at ${DRAFT_LIMITS.perUserPerDay} a day per member, without calling the model past it`, async () => {
    const create = answer("Which loaf would you suggest for someone trying your sourdough for the very first time?");
    for (let i = 0; i < DRAFT_LIMITS.perUserPerDay; i += 1) {
      expect(await draftDiscoverComment({ userId: "drafter-a", story, style: "question", locale: "en" }, create)).toMatchObject({ ok: true });
    }
    expect(await draftDiscoverComment({ userId: "drafter-a", story, style: "question", locale: "en" }, create)).toEqual({ ok: false, reason: "limit" });
    expect(create).toHaveBeenCalledTimes(DRAFT_LIMITS.perUserPerDay);
    // Another member has their own.
    expect(await draftDiscoverComment({ userId: "drafter-b", story, style: "insight", locale: "en" }, create)).toMatchObject({ ok: true });
  });

  it("hands a draft back when the provider refused it before billing", async () => {
    const refused = vi.fn(async () => {
      throw Object.assign(new Error("overloaded"), { notBilled: true });
    });
    expect(await draftDiscoverComment({ userId: "drafter-c", story, style: "question", locale: "en" }, refused as never)).toEqual({ ok: false, reason: "failed" });
    const live = await test.db.select().from(spendReservations).where(eq(spendReservations.key, "discover-draft:user-day:drafter-c"));
    expect(live.map((row) => row.state)).toEqual(["released"]);
  });

  it("without a model configured: no call, and the dialog is told so", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const create = answer("unused");
    expect(await draftDiscoverComment({ userId: "drafter-d", story, style: "question", locale: "en" }, create)).toEqual({ ok: false, reason: "unavailable" });
    expect(create).not.toHaveBeenCalled();
  });

  it("is grounded in the post, in the member's language, and never carries a link", async () => {
    const prompt = draftPrompt(story, "appreciation", "it");
    expect(prompt).toContain("Write in Italian.");
    expect(prompt).toContain("<business_profile>");
    expect(prompt).toContain("How Lakeside Bakery doubled its Saturday orders");
    expect(prompt).toContain("Never claim or suggest that the writer has used");
    expect(cleanDraft('"I like how clearly the story explains the fermentation process behind each loaf." See lakeside.example/bread')).toBe(
      "I like how clearly the story explains the fermentation process behind each loaf.",
    );
    expect(cleanDraft("Nice!")).toBeNull();
    expect(cleanDraft("Visit https://lakeside.example for more about this wonderful family bakery")).toBeNull();
  });

  it("the action reads the story from its id, and an unknown one is refused without a model call", async () => {
    state.session = await member();
    engagement.listCustomerStories.mockResolvedValueOnce([story]);
    expect(await discoverDraftAction({ postId: randomUUID(), style: "question" })).toEqual({ ok: false, reason: "not_found" });
  });
});
