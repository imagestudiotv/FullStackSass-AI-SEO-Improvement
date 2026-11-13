import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { brandVoice, videoIdeaBatches, videoIdeas, videoSettings, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Video ideas after the viral upgrade (client, 2026-11-12), on PGlite: the
 * free extra batches through the action and the job, Romanian ideas, the
 * audio choice, per-video edits and overrides with the review state, the
 * settings Save and Reset, and the profile kept in one place.
 */

const state = vi.hoisted(() => ({ db: null as unknown, access: "owner" }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
async function contextFor(websiteId: string) {
  const db = state.db as TestDb["db"];
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  if (!site) throw new Error("not found");
  return { site, orgId: site.organizationId, userId: "user_1", access: state.access };
}
vi.mock("@/lib/tenant", () => ({ requireWebsite: vi.fn(contextFor) }));
vi.mock("@/lib/websites/require-editor", () => ({
  requireEditor: vi.fn(async (id: string) => {
    const context = await contextFor(id);
    return context.access === "viewer" ? { ok: false, error: "You have view-only access to this website." } : { ok: true, context };
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const queue = vi.hoisted(() => ({ queueJob: vi.fn(async () => true) }));
vi.mock("@/inngest/send", () => queue);
vi.mock("@/lib/ai/client", () => ({
  // stream() answers through create(), so a test mocks one function for both.
  anthropic: (() => {
    const create = vi.fn();
    return { messages: { create, stream: (body: unknown, options: unknown) => ({ finalMessage: () => create(body, options) }) } };
  })(),
  isAiConfigured: () => true,
  MODELS: { GENERATION: "claude-sonnet-5" },
}));

import {
  approveVideoReview,
  editVideoIdea,
  requestVideoIdeas,
  resetVideoSettingsAction,
  rewriteVideoIdea,
  saveVideoProfileAction,
  saveVideoSettingsAction,
} from "./actions";
import type { ProductionChoices, ShotPlan, VideoScript } from "./formats";
import { suggestVideoIdeas, WRITE_CHUNK, writeChunks, writeExtraBatch, type IdeaInput } from "./ideas";
import { maxTokensFor } from "./strategy/prompt";
import { contentHash, reviewBlocksAutoPublish } from "./review";
import { readVideoSettings } from "./settings";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const NOW = new Date("2026-11-12T07:00:00Z");

beforeEach(() => {
  state.access = "owner";
  queue.queueJob.mockClear();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
});

const POINTS = [
  { title: "Dark product shots", detail: "Light sells: shoot near a window.", stat: null },
  { title: "Busy backgrounds", detail: "A plain wall keeps the eye on the product.", stat: null },
  { title: "No close-ups", detail: "Show the details people want to touch.", stat: null },
];

/** A writer that follows each slot's plan, with a distinct title and hook per idea. */
function writer(options: { audio?: "voiceover" | "text_music"; tag?: string } = {}) {
  return vi.fn(async (input: IdeaInput) => ({
    ideas: input.slots.map((slot, index) => ({
      slot: slot.slot,
      title: `${options.tag ?? "Idea"} ${index + 1}`,
      article: null,
      direction: slot.direction,
      audio: options.audio ?? ("voiceover" as const),
      hook: `Hook number ${index + 1} for ${options.tag ?? "you"}`,
      points: POINTS,
      proof: "Image Studio photographs products.",
      cta: "Follow Image Studio",
      caption: "Light sells. This is trending everywhere!",
      hashtags: ["photography", "trending"],
      why: slot.category === "viral" ? "A relatable mistake with a quick fix can be worth saving." : null,
      techniques: slot.techniques,
      scenes: Array.from({ length: POINTS.length + 3 }, () => ({ query: "photographer adjusting softbox in studio", kind: "video" as const, overlay: "POV: your first shoot", reaction: "wait..." })),
      claims: [],
      controversial: false,
      sensitive: false,
    })),
    usage: { inputTokens: 1000, outputTokens: 2000, model: "claude-sonnet-5" },
  }));
}

async function site(values: Partial<typeof websites.$inferInsert> = {}) {
  const seeded = await seedWebsite(test, { status: "active" });
  await test.db
    .update(websites)
    .set({ brandName: "Image Studio", language: "English", country: "Ireland", status: "ready", services: ["Product photography", "Video"], ...values })
    .where(eq(websites.id, seeded.websiteId));
  return seeded;
}

const ideasOf = (websiteId: string) => test.db.select().from(videoIdeas).where(eq(videoIdeas.websiteId, websiteId));

describe("the day's ideas", () => {
  it("follow the viral mix, vary their productions, and are honest about trends", async () => {
    const { websiteId } = await site();
    const write = writer();
    expect(await suggestVideoIdeas(websiteId, NOW, { write })).toEqual({ created: 20 });
    const input = write.mock.calls[0][0];
    expect(input.slots.filter((slot) => slot.category === "viral")).toHaveLength(8);
    const rows = await ideasOf(websiteId);
    expect(rows.filter((row) => row.category === "viral")).toHaveLength(8);
    expect(new Set(rows.map((row) => (row.plan as ShotPlan).recipe)).size).toBe(20);
    const byDirection = new Map<string, number>();
    for (const row of rows) byDirection.set(row.direction, (byDirection.get(row.direction) ?? 0) + 1);
    for (const count of byDirection.values()) expect(count).toBeLessThanOrEqual(8);
    for (const row of rows) {
      expect(row.caption).not.toMatch(/trending/i);
      expect((row.plan as ShotPlan).scenes).toHaveLength(6);
      expect(row.batchId).not.toBeNull();
      expect(row.cost).toMatchObject({ budgetUsd: 0.3, reservedUsd: 0, items: [{ kind: "planning", provider: "anthropic", basis: "measured" }] });
      const production = row.production as ProductionChoices;
      // The legacy voice column follows the audio choice.
      expect(row.voice === null).toBe(production.audio === "text_music");
    }
    const viral = rows.find((row) => row.category === "viral")!;
    expect(viral.why).toBeTruthy();
    expect(viral.techniques.length).toBeGreaterThan(0);
  });

  it("are written in Romanian for a Romanian website, never silently in English", async () => {
    const { websiteId } = await site({ language: "Română" });
    const write = writer();
    await suggestVideoIdeas(websiteId, NOW, { write });
    expect(write.mock.calls[0][0].language).toBe("Romanian");
    expect((await ideasOf(websiteId)).every((row) => row.language === "ro")).toBe(true);
  });

  it("have no narration when the customer chose Text + Music", async () => {
    const { websiteId } = await site();
    await test.db.insert(videoSettings).values({ websiteId, audioMode: "text_music" });
    await suggestVideoIdeas(websiteId, NOW, { write: writer({ audio: "voiceover" }) });
    const rows = await ideasOf(websiteId);
    expect(rows.every((row) => row.voice === null && (row.production as ProductionChoices).audio === "text_music")).toBe(true);
    expect(rows.some((row) => row.direction === "voiceover")).toBe(false);
  });
});

describe("extra ideas", () => {
  it("are three free batches of ten a day, each written once, never counted in the day's twenty", async () => {
    const { websiteId } = await site();
    await suggestVideoIdeas(websiteId, NOW, { write: writer() });
    expect(await requestVideoIdeas(websiteId)).toEqual({ ok: false, error: "day_full" });

    const first = await requestVideoIdeas(websiteId, "viral", "click-1");
    expect(first).toMatchObject({ ok: true, data: { slot: 1, kind: "viral", reused: false } });
    const batchId = first.ok ? first.data!.batchId : "";
    expect(queue.queueJob).toHaveBeenCalledWith({ id: `video-ideas-batch:${batchId}:0`, name: "video/ideas.requested", data: { websiteId, batchId } });
    // The same click again: the same batch.
    expect(await requestVideoIdeas(websiteId, "viral", "click-1")).toMatchObject({ ok: true, data: { batchId, reused: true } });
    // Another click while it is being written.
    expect(await requestVideoIdeas(websiteId, "mixed", "click-2")).toMatchObject({ ok: false, error: "busy" });

    expect(await writeExtraBatch(batchId, NOW, { write: writer({ tag: "Viral" }) })).toEqual({ created: 10 });
    // A second job for it writes nothing more.
    expect(await writeExtraBatch(batchId, NOW, { write: writer({ tag: "Again" }) })).toMatchObject({ created: 0 });
    const extra = (await ideasOf(websiteId)).filter((row) => row.batchId === batchId);
    expect(extra).toHaveLength(10);
    expect(extra.every((row) => row.category === "viral")).toBe(true);
    const [batch] = await test.db.select().from(videoIdeaBatches).where(eq(videoIdeaBatches.id, batchId));
    expect(batch).toMatchObject({ status: "done", created: 10, attempts: 1 });

    // Too soon after the last request; then fine.
    vi.setSystemTime(new Date(NOW.getTime() + 5_000));
    expect(await requestVideoIdeas(websiteId, "website")).toMatchObject({ ok: false, error: "too_soon", retryAt: expect.any(String) });
    for (const [index, kind] of (["website", "mixed"] as const).entries()) {
      vi.setSystemTime(new Date(NOW.getTime() + (index + 1) * 60_000));
      const next = await requestVideoIdeas(websiteId, kind);
      expect(next).toMatchObject({ ok: true, data: { slot: index + 2, extraLeft: 1 - index } });
      await writeExtraBatch(next.ok ? next.data!.batchId : "", new Date(), { write: writer({ tag: kind }) });
    }
    vi.setSystemTime(new Date(NOW.getTime() + 5 * 60_000));
    expect(await requestVideoIdeas(websiteId, "viral")).toEqual({ ok: false, error: "extra_used_up" });
    expect(await ideasOf(websiteId)).toHaveLength(50);
  });

  it("are not for a viewer", async () => {
    const { websiteId } = await site();
    state.access = "viewer";
    expect(await requestVideoIdeas(websiteId, "viral")).toEqual({ ok: false, error: "view_only" });
    expect(await saveVideoSettingsAction(websiteId, { viralMix: 50 })).toEqual({ ok: false, error: "view_only" });
  });
});

describe("one video's changes", () => {
  async function oneIdea() {
    const { websiteId } = await site();
    await suggestVideoIdeas(websiteId, NOW, { write: writer() });
    const [row] = (await ideasOf(websiteId)).filter((idea) => idea.format === "reel");
    return { websiteId, row };
  }

  it("change its production and overrides only, never the settings", async () => {
    const { websiteId, row } = await oneIdea();
    const before = await readVideoSettings(websiteId);
    expect(
      await editVideoIdea(websiteId, row.id, {
        direction: "text_music",
        production: { captionStyle: "minimal", ctaText: "Book a shoot" },
        overrides: { audience: "Etsy sellers", tonePreset: "playful" },
      }),
    ).toEqual({ ok: true, data: null });
    const [saved] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect(saved).toMatchObject({ direction: "text_music", voice: null, overrides: { audience: "Etsy sellers", tonePreset: "playful" } });
    expect(saved.production).toMatchObject({ audio: "text_music", captionStyle: "minimal", ctaText: "Book a shoot" });
    expect((saved.plan as ShotPlan).direction).toBe("text_music");
    expect(await readVideoSettings(websiteId)).toEqual(before);
    expect(await editVideoIdea(websiteId, row.id, { overrides: { tone: "x".repeat(301) } })).toEqual({ ok: false, error: "bad_script" });
    expect(await editVideoIdea(websiteId, row.id, { production: { duration: "2 minutes" } })).toEqual({ ok: false, error: "bad_script" });
  });

  it("need the review again when reviewed words change", async () => {
    const { websiteId, row } = await oneIdea();
    await test.db.update(videoIdeas).set({ reviewStatus: "required", reviewReasons: ["controversial"] }).where(eq(videoIdeas.id, row.id));
    expect(await approveVideoReview(websiteId, row.id)).toEqual({ ok: true, data: null });
    let [saved] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    const view = () => ({ ...saved, script: saved.script as VideoScript, plan: saved.plan as ShotPlan, production: saved.production as ProductionChoices });
    expect(saved).toMatchObject({ reviewStatus: "approved", reviewedBy: "user_1" });
    expect(saved.reviewedHash).toBe(contentHash(view()));
    expect(reviewBlocksAutoPublish(view())).toBe(false);
    await editVideoIdea(websiteId, row.id, { caption: "A sharper take." });
    [saved] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect(saved.reviewStatus).toBe("required");
    expect(reviewBlocksAutoPublish(view())).toBe(true);
  });

  it("can be rewritten for free, ten times a day", async () => {
    const { websiteId, row } = await oneIdea();
    // The real writer is mocked at the AI client: answer one rewritten idea.
    const { anthropic } = await import("@/lib/ai/client");
    const create = anthropic.messages.create as unknown as ReturnType<typeof vi.fn>;
    create.mockImplementation(async (body: { system: string }) => {
      expect(body.system).toContain("Write exactly 1 ideas");
      const [idea] = (await writer({ tag: "Rewritten" })({ slots: [{ slot: 1, category: "educational", direction: row.direction, alternatives: [], format: "reel", audio: "voiceover", techniques: [], length: { seconds: { min: 30, max: 45 }, words: { min: 72, max: 108 }, points: { min: 3, max: 4 } } }] } as unknown as IdeaInput)).ideas;
      return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ ideas: [idea] }) }], usage: { input_tokens: 10, output_tokens: 20 } };
    });
    for (let i = 0; i < 10; i++) expect(await rewriteVideoIdea(websiteId, row.id)).toMatchObject({ ok: true, data: { rewritesLeft: 9 - i } });
    expect(await rewriteVideoIdea(websiteId, row.id)).toEqual({ ok: false, error: "rewrites_used_up" });
    const [saved] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect(saved.title).toBe("Rewritten 1");
    expect((saved.cost as { items: unknown[] }).items.length).toBe(11);
  });
});

describe("settings", () => {
  it("refuse a value a field cannot have, and save the rest exactly", async () => {
    const { websiteId } = await site();
    for (const [field, value] of [
      ["viralMix", 45],
      ["viralMix", 110],
      ["goal", "fame"],
      ["techniques", ["curiosity_hooks", "clickbait"]],
      ["formats", []],
      ["defaultCta", "x".repeat(151)],
      ["priorityTopics", "x".repeat(501)],
      ["publishMode", "always"],
      ["humor", "dark"],
      ["frequency", "10_day"],
      ["showHook", "yes"],
    ] as const) {
      expect(await saveVideoSettingsAction(websiteId, { [field]: value })).toEqual({ ok: false, error: "bad_settings", field });
    }
    expect(await saveVideoSettingsAction(websiteId, { viralMix: 60, goal: "reach", formats: ["reel", "reel"], musicDirection: "none", publishMode: "draft", defaultCta: "  Follow us  " })).toEqual({ ok: true, data: null });
    const saved = await readVideoSettings(websiteId);
    expect(saved).toMatchObject({ viralMix: 60, goal: "reach", formats: ["reel"], musicDirection: "none", music: false, publishMode: "draft", defaultCta: "Follow us" });
  });

  it("reset to the defaults without switching posting on or adding platforms", async () => {
    const { websiteId } = await site();
    await saveVideoSettingsAction(websiteId, { viralMix: 100, humor: "bold", requireFactReview: false, platforms: ["instagram"], publishMode: "manual", frequency: null });
    const reset = await resetVideoSettingsAction(websiteId);
    expect(reset).toMatchObject({ ok: true, data: { viralMix: 40, humor: "light", requireFactReview: true, platforms: ["instagram"], publishMode: "manual", frequency: null } });
  });

  it("keep audience, language and tone in the profile and Brand Voice", async () => {
    const { websiteId } = await site();
    await test.db.insert(brandVoice).values({ websiteId, tone: "Warm", facts: ["Since 2015"] });
    expect(await saveVideoProfileAction(websiteId, { language: "Klingon" })).toEqual({ ok: false, error: "bad_language", field: "language" });
    expect(
      await saveVideoProfileAction(websiteId, { targetAudience: "Online shops", language: "ro", tone: "Friendly", priorityTopics: "Lighting", tonePreset: "bold" }),
    ).toEqual({ ok: true, data: null });
    const [stored] = await test.db.select().from(websites).where(eq(websites.id, websiteId));
    expect(stored).toMatchObject({ targetAudience: "Online shops", language: "Romanian", country: "Ireland" });
    const [voice] = await test.db.select().from(brandVoice).where(eq(brandVoice.websiteId, websiteId));
    expect(voice).toMatchObject({ tone: "Friendly", facts: ["Since 2015"] });
    expect(await readVideoSettings(websiteId)).toMatchObject({ priorityTopics: "Lighting", tonePreset: "bold" });
  });
});

describe("writing a batch", () => {
  const input = (count: number) => ({ count, slots: Array.from({ length: count }, (_, i) => ({ slot: i + 1 })) }) as unknown as IdeaInput;

  it("splits a day's twenty into calls of five that keep their slot numbers", () => {
    const chunks = writeChunks(input(20));
    expect(chunks.map((chunk) => chunk.count)).toEqual([5, 5, 5, 5]);
    expect(chunks.flatMap((chunk) => chunk.slots.map((slot) => slot.slot))).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(writeChunks(input(12)).map((chunk) => chunk.count)).toEqual([5, 5, 2]);
    expect(writeChunks(input(3))).toHaveLength(1);
  });

  it("asks one call for less than the SDK allows without streaming", () => {
    // @anthropic-ai/sdk refuses a non-streamed max_tokens above about 21,333 (its ten-minute estimate).
    expect(maxTokensFor(WRITE_CHUNK)).toBeLessThan(21_333);
  });
});
