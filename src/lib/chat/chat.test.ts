import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { chatActions, chatMessages, chatThreads, creditSettings, user, videoIdeas, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * The AI chat (client, 2026-10-31) on a real database, with the model
 * replaced: five free messages a day per workspace then a credit each, a
 * message without an answer not counted, actions only on Confirm and only
 * once, each person's chats their own, and old chats deleted.
 */

const state = vi.hoisted(() => ({ db: null as unknown, access: "owner", userId: "user_1" }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
async function contextFor(websiteId: string) {
  const db = state.db as TestDb["db"];
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  if (!site) throw new Error("not found");
  return { site, orgId: site.organizationId, ownerOrgId: site.organizationId, actorOrgId: site.organizationId, userId: state.userId, role: "owner", access: state.access };
}
vi.mock("@/lib/tenant", () => ({ requireWebsite: vi.fn(contextFor) }));
vi.mock("@/lib/websites/require-editor", () => ({
  requireEditor: vi.fn(async (id: string) => {
    const context = await contextFor(id);
    return context.access === "viewer" ? { ok: false, error: "You have view-only access to this website." } : { ok: true, context };
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn(async () => true) }));
vi.mock("@/lib/i18n/app-locale", () => ({ getAppMessages: vi.fn(async () => ({ locale: "en", t: {} })) }));
const ai = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: ai.create } },
  isAiConfigured: () => true,
  MODELS: { GENERATION: "claude-sonnet-5" },
}));

import { parseBlocks, isInternalHref } from "@/components/chat/chat-markdown";
import { recordCredit } from "@/lib/backlinks/credits";
import { cancelChatAction, confirmChatAction, deleteChatThread, listChatThreads, loadChatThread, sendChatMessage } from "./actions";
import { CHAT_FREE_PER_DAY } from "./config";
import { keepOwnLinks, modelHistory, runAssistant } from "./engine";
import { deleteOldThreads } from "./store";
import type { ChatContext } from "./tools";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  for (const id of ["user_1", "user_2"]) {
    await test.db.insert(user).values({ id, name: id, email: `${id}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  }
});

beforeEach(async () => {
  state.access = "owner";
  state.userId = "user_1";
  ai.create.mockReset();
  await test.db.delete(creditSettings);
  await test.db.insert(creditSettings).values([
    { key: "price:chat_message", value: 1 },
    { key: "price:video_post", value: 1 },
  ]);
});
afterEach(() => vi.unstubAllEnvs());

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
const reply = (content: Block[], stop: "end_turn" | "tool_use" = "end_turn") => ({
  content,
  stop_reason: stop,
  usage: { input_tokens: 1000, output_tokens: 200 },
});
const answer = (text: string) => reply([{ type: "text", text }]);

async function site() {
  const seeded = await seedWebsite(test);
  await test.db.update(websites).set({ brandName: "Image Studio" }).where(eq(websites.id, seeded.websiteId));
  return seeded;
}

async function credits(orgId: string, amount: number) {
  await recordCredit(orgId, { type: "adjustment", amount, note: "test" });
}

describe("answers", () => {
  it("are read only as Markdown, with links only inside RepGet", () => {
    expect(parseBlocks("Hello **there**\n\n- one\n- two\n1. first")).toEqual([
      { kind: "p", text: "Hello **there**" },
      { kind: "ul", items: ["one", "two"] },
      { kind: "ol", items: ["first"] },
    ]);
    expect(isInternalHref("/websites/abc/videos")).toBe(true);
    expect(isInternalHref("https://evil.example")).toBe(false);
    expect(isInternalHref("//evil.example")).toBe(false);
    expect(isInternalHref("/\\evil.example")).toBe(false);
    expect(isInternalHref("javascript:alert(1)")).toBe(false);
  });

  it("keep links only to this website's RepGet pages", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    expect(
      keepOwnLinks(
        `See [Videos](/websites/${id}/videos), [Dashboard](/dashboard), [home](/), [other site](/websites/22222222-2222-2222-2222-222222222222/videos), [evil](https://evil.example) and [Health](/websites/${id}).`,
        id,
      ),
    ).toBe(`See [Videos](/websites/${id}/videos), [Dashboard](/dashboard), home, other site, evil and [Health](/websites/${id}).`);
  });

  it("give the model the conversation taking turns, starting with a question", () => {
    expect(
      modelHistory([
        { role: "assistant", text: "orphan" },
        { role: "user", text: "a" },
        { role: "user", text: "b" },
        { role: "assistant", text: "c" },
        { role: "user", text: "unanswered" },
      ]),
    ).toEqual([
      { role: "user", content: "a\n\nb" },
      { role: "assistant", content: "c" },
    ]);
  });

  it("look data up through the tools, as data, and keep only offers that check out", async () => {
    const { orgId, websiteId } = await site();
    const [idea] = await test.db
      .insert(videoIdeas)
      .values({ websiteId, day: new Date().toISOString().slice(0, 10), style: "bold", language: "en", title: "Three photo mistakes", script: {}, caption: "x" })
      .returning();
    const ctx: ChatContext = { websiteId, ownerOrgId: orgId, userId: "user_1", access: "owner", domain: "x.example", brandName: "Image Studio", locale: "en", level: "paid" };
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        reply(
          [
            { type: "tool_use", id: "t1", name: "get_videos", input: {} },
            { type: "tool_use", id: "t2", name: "propose_make_video", input: { ideaId: idea.id } },
            { type: "tool_use", id: "t3", name: "propose_make_video", input: { ideaId: "00000000-0000-0000-0000-000000000000" } },
          ],
          "tool_use",
        ),
      )
      .mockResolvedValueOnce(answer("Here is a video idea, ready for you to confirm."));
    const result = await runAssistant(ctx, [], "Make me a video", { create });
    expect(result.text).toBe("Here is a video idea, ready for you to confirm.");
    expect(result.pages).toEqual(["videos"]);
    expect(result.proposals).toEqual([{ kind: "make_video", input: { ideaId: idea.id }, details: "Three photo mistakes" }]);
    const toolResults = create.mock.calls[1][0].messages.at(-1).content;
    expect(toolResults[0].content).toMatch(/^<site_data>/);
    expect(toolResults[0].content).toContain("Three photo mistakes");
    expect(toolResults[1].content).toMatch(/NOT been done/);
    expect(toolResults[2].is_error).toBe(true);
    expect(result.usage).toEqual({ model: "claude-sonnet-5", inputTokens: 2000, outputTokens: 400 });
  }, 30_000);

  it("stop looking things up after eight rounds and answer", async () => {
    const { orgId, websiteId } = await site();
    const ctx: ChatContext = { websiteId, ownerOrgId: orgId, userId: "user_1", access: "owner", domain: "x.example", brandName: null, locale: "de", level: "trial" };
    const create = vi.fn(async (params: { tool_choice?: unknown; system: { text: string }[] }) =>
      params.tool_choice ? answer("Genug.") : reply([{ type: "tool_use", id: `t${Math.random()}`, name: "get_credits", input: {} }], "tool_use"),
    );
    const result = await runAssistant(ctx, [], "?", { create: create as never });
    expect(create).toHaveBeenCalledTimes(8);
    expect(result.text).toBe("Genug.");
    expect(create.mock.calls[0][0].system[0].text).toContain("Always write in German");
  });
});

describe("messages", () => {
  it(`are free ${CHAT_FREE_PER_DAY} a day for the workspace, then a credit each`, async () => {
    const { orgId, websiteId } = await site();
    ai.create.mockResolvedValue(answer("Your site is doing well."));
    let threadId: string | null = null;
    for (let i = 0; i < CHAT_FREE_PER_DAY; i += 1) {
      const sent = await sendChatMessage(websiteId, { threadId, text: `Question ${i}` });
      if (!sent.ok) throw new Error(sent.error);
      threadId = sent.data.threadId;
      expect(sent.data.freeLeft).toBe(CHAT_FREE_PER_DAY - i - 1);
    }
    // No credits: the sixth is refused and nothing is stored.
    expect(await sendChatMessage(websiteId, { threadId, text: "One more" })).toEqual({ ok: false, error: "not_enough_credits", price: 1, available: 0 });
    expect(await test.db.select().from(chatMessages).where(eq(chatMessages.threadId, threadId!))).toHaveLength(CHAT_FREE_PER_DAY * 2);

    await credits(orgId, 3);
    const paid = await sendChatMessage(websiteId, { threadId, text: "One more" });
    expect(paid.ok).toBe(true);
    const [question] = await test.db.select().from(chatMessages).where(eq(chatMessages.text, "One more"));
    expect(question).toMatchObject({ free: false, creditSpendKey: `chat:${question.id}` });
  }, 60_000);

  it("are not counted when no answer comes: removed, and a paid one's credit returned", async () => {
    const { orgId, websiteId } = await site();
    ai.create.mockRejectedValue(new Error("overloaded"));
    expect(await sendChatMessage(websiteId, { text: "Hello?" })).toEqual({ ok: false, error: "ai_failed" });
    expect(await test.db.select().from(chatThreads).where(eq(chatThreads.websiteId, websiteId))).toHaveLength(0);

    // Used up the free ones, then a paid one fails: the credit comes back.
    ai.create.mockResolvedValue(answer("ok"));
    for (let i = 0; i < CHAT_FREE_PER_DAY; i += 1) await sendChatMessage(websiteId, { text: `q${i}` });
    await credits(orgId, 1);
    ai.create.mockRejectedValue(new Error("overloaded"));
    expect(await sendChatMessage(websiteId, { text: "paid" })).toEqual({ ok: false, error: "ai_failed" });
    ai.create.mockResolvedValue(answer("ok"));
    expect((await sendChatMessage(websiteId, { text: "paid again" })).ok).toBe(true);
  }, 60_000);

  it("are refused for a viewer, and empty or too long ones", async () => {
    const { websiteId } = await site();
    expect(await sendChatMessage(websiteId, { text: "   " })).toEqual({ ok: false, error: "empty" });
    expect(await sendChatMessage(websiteId, { text: "x".repeat(2001) })).toEqual({ ok: false, error: "too_long" });
    state.access = "viewer";
    expect(await sendChatMessage(websiteId, { text: "Hi" })).toEqual({ ok: false, error: "view_only" });
    expect(ai.create).not.toHaveBeenCalled();
  });
});

describe("chats", () => {
  it("are each person's own, and kept 30 days after their last message", async () => {
    const { websiteId } = await site();
    ai.create.mockResolvedValue(answer("Hello"));
    const sent = await sendChatMessage(websiteId, { text: "How is my website doing?" });
    if (!sent.ok) throw new Error(sent.error);
    expect(await listChatThreads(websiteId)).toEqual({ ok: true, data: [expect.objectContaining({ id: sent.data.threadId, title: "How is my website doing?" })] });

    state.userId = "user_2";
    expect(await listChatThreads(websiteId)).toEqual({ ok: true, data: [] });
    expect(await loadChatThread(websiteId, sent.data.threadId)).toEqual({ ok: false, error: "not_found" });
    expect(await sendChatMessage(websiteId, { threadId: sent.data.threadId, text: "Hi" })).toEqual({ ok: false, error: "not_found" });
    await deleteChatThread(websiteId, sent.data.threadId);

    state.userId = "user_1";
    expect((await loadChatThread(websiteId, sent.data.threadId)).ok).toBe(true);
    await test.db.update(chatThreads).set({ updatedAt: new Date(Date.now() - 31 * 86_400_000) }).where(eq(chatThreads.id, sent.data.threadId));
    expect(await deleteOldThreads()).toBeGreaterThanOrEqual(1);
    expect(await test.db.select().from(chatThreads).where(eq(chatThreads.id, sent.data.threadId))).toHaveLength(0);
  }, 30_000);
});

describe("actions", () => {
  it("run only on Confirm, once, through the feature's own action and price", async () => {
    const { orgId, websiteId } = await site();
    await credits(orgId, 5);
    const [idea] = await test.db
      .insert(videoIdeas)
      .values({ websiteId, day: new Date().toISOString().slice(0, 10), style: "bold", language: "en", title: "Three photo mistakes", script: { hook: "h", points: [{ title: "a", detail: "b", stat: null }], proof: "p", cta: "c" }, caption: "x" })
      .returning();
    ai.create
      .mockResolvedValueOnce(reply([{ type: "tool_use", id: "t1", name: "propose_make_video", input: { ideaId: idea.id } }, { type: "tool_use", id: "t2", name: "propose_find_social_posts", input: {} }], "tool_use"))
      .mockResolvedValueOnce(answer("I have prepared it for you to confirm."));
    const sent = await sendChatMessage(websiteId, { text: "Make a video" });
    if (!sent.ok) throw new Error(sent.error);
    const offered = sent.data.messages.at(-1)!.actions;
    expect(offered.map((a) => [a.kind, a.status, a.details])).toEqual([
      ["make_video", "proposed", "Three photo mistakes"],
      ["find_social_posts", "proposed", ""],
    ]);
    // Nothing happened yet.
    expect((await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, idea.id)))[0].status).toBe("new");

    const done = await confirmChatAction(websiteId, offered[0].id);
    expect(done).toEqual({ ok: true, data: expect.objectContaining({ status: "done" }) });
    expect((await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, idea.id)))[0].status).toBe("approved");
    expect(await confirmChatAction(websiteId, offered[0].id)).toEqual({ ok: false, error: "already_handled" });

    expect(await cancelChatAction(websiteId, offered[1].id)).toEqual({ ok: true, data: expect.objectContaining({ status: "cancelled" }) });
    expect(await confirmChatAction(websiteId, offered[1].id)).toEqual({ ok: false, error: "already_handled" });

    // Somebody else cannot confirm this person's offers.
    state.userId = "user_2";
    expect(await confirmChatAction(websiteId, offered[0].id)).toEqual({ ok: false, error: "not_found" });
    expect((await test.db.select().from(chatActions).where(eq(chatActions.id, offered[0].id)))[0].decidedBy).toBe("user_1");
  }, 60_000);
});
