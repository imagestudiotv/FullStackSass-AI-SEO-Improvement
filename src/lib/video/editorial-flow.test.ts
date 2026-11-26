import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { videoIdeas, videoSettings, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Editorial ideas end to end on PGlite (client, 2026-11-26: "a second one
 * that reads images from blog posts and website"): a website with pictures of
 * its own gets editorial non-viral ideas carrying those pictures, its viral
 * ideas stay as they were, the *highlight* marks never reach a post text, a
 * title, the voice or another direction, and the video is made from the
 * plan's pictures only.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
async function contextFor(websiteId: string) {
  const db = state.db as TestDb["db"];
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  if (!site) throw new Error("not found");
  return { site, orgId: site.organizationId, userId: "user_1", access: "owner" };
}
vi.mock("@/lib/tenant", () => ({ requireWebsite: vi.fn(contextFor) }));
vi.mock("@/lib/websites/require-editor", () => ({ requireEditor: vi.fn(async (id: string) => ({ ok: true, context: await contextFor(id) })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn(async () => true) }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: vi.fn(), stream: vi.fn() } },
  isAiConfigured: () => true,
  MODELS: { GENERATION: "claude-sonnet-5" },
}));

import { editVideoIdea } from "./actions";
import type { SitePicture } from "./editorial-images";
import type { ProductionChoices, ShotPlan, VideoScript } from "./formats";
import { suggestVideoIdeas, type IdeaInput } from "./ideas";
import { prepareAssets, ProductionError } from "./make";
import { speakScript } from "./voice";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const NOW = new Date("2026-11-26T07:00:00Z");
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const picture = (n: number, source: SitePicture["source"] = "article"): SitePicture => ({
  url: `https://store.example/shared/editorial/site/${n}.jpg`,
  alt: `Picture ${n}`,
  source,
  pageUrl: source === "article" ? "https://shop.example/blog/a" : "https://shop.example/",
  width: 1600,
  height: 1000,
  articleId: null,
});
const POOL = [picture(1), picture(2), picture(3, "website")];

/** A writer that marks words on every text, as an editorial writer would - and, wrongly, in the title, caption and claims too. */
function writer() {
  return vi.fn(async (input: IdeaInput) => ({
    ideas: input.slots.map((slot, index) => ({
      slot: slot.slot,
      title: `The *real* idea ${index + 1}`,
      article: null,
      direction: slot.direction,
      audio: "voiceover" as const,
      hook: `Instagram just gave you *an advantage* ${index + 1}`,
      points: [
        { title: "Reply the *same day*", detail: "People *remember* who answered.", stat: null },
        { title: "Post your *real* work", detail: "Nothing staged.", stat: null },
        { title: "Pin the *best* three", detail: "First impressions decide.", stat: null },
      ],
      proof: "*Use it*",
      cta: "Book your *shoot*",
      caption: "A *premium* look for your feed.",
      hashtags: ["photo*graphy", "studio"],
      why: slot.category === "viral" ? "A *useful* fix people save." : null,
      techniques: slot.techniques,
      visualHook: null,
      povClip: null,
      scenes: Array.from({ length: 6 }, () => ({ query: "photographer in studio", kind: "image" as const, overlay: null, reaction: null })),
      claims: [{ text: "Replies *the same day* win", source: null }],
      controversial: false,
      sensitive: false,
    })),
    usage: { inputTokens: 1000, outputTokens: 2000, model: "claude-sonnet-5" },
  }));
}

async function site() {
  const seeded = await seedWebsite(test, { status: "active" });
  await test.db
    .update(websites)
    .set({ brandName: "Image Studio", language: "English", status: "ready", services: ["Product photography"] })
    .where(eq(websites.id, seeded.websiteId));
  return seeded;
}

const ideasOf = (websiteId: string) => test.db.select().from(videoIdeas).where(eq(videoIdeas.websiteId, websiteId));
const noPov = [] as const;

describe("a website with pictures of its own", () => {
  it("gets editorial non-viral ideas on those pictures, its viral ones unchanged", async () => {
    const { websiteId } = await site();
    const write = writer();
    await suggestVideoIdeas(websiteId, NOW, { write, povLibrary: noPov, pictures: async () => POOL });
    const slots = write.mock.calls[0][0].slots;
    for (const slot of slots) {
      if (slot.category === "viral") expect(slot.direction).not.toBe("editorial");
      else {
        expect(slot.direction).toBe("editorial");
        expect(slot.alternatives).toEqual([]);
        expect(slot.audio).toBe("text_music");
      }
    }
    const rows = await ideasOf(websiteId);
    const editorial = rows.filter((row) => row.category !== "viral");
    expect(editorial.length).toBeGreaterThan(0);
    expect(new Set(editorial.map((row) => row.format)).size).toBeGreaterThan(1);
    for (const row of editorial) {
      const plan = row.plan as ShotPlan;
      expect(row.direction).toBe("editorial");
      expect(Array.isArray(plan.scenes)).toBe(true);
      expect(plan.scenes.every((scene) => scene.visual.source === "article")).toBe(true);
      expect(plan.images!.map((image) => image.url).sort()).toEqual(POOL.map((image) => image.url).sort());
      expect(row.media).toEqual(plan.images!.map((image) => ({ url: image.url, kind: "image" })));
      // Text + Music by default: no voice cost.
      expect((row.production as ProductionChoices).audio).toBe("text_music");
      expect(row.voice).toBeNull();
      // The marks stay on screen only.
      expect((row.script as VideoScript).hook).toContain("*an advantage*");
    }
    // The day's editorial ideas do not all open on the same picture.
    expect(new Set(editorial.map((row) => (row.plan as ShotPlan).images![0].url)).size).toBeGreaterThan(1);
    for (const row of rows) {
      expect(row.title).not.toContain("*");
      expect(row.caption).not.toContain("*");
      expect(row.why ?? "").not.toContain("*");
      expect(JSON.stringify(row.claims)).not.toContain("*");
      if (row.category === "viral") {
        expect(row.direction).not.toBe("editorial");
        expect((row.plan as ShotPlan).images ?? null).toBeNull();
        expect(JSON.stringify(row.script)).not.toContain("*");
      }
    }
  });

  it("with only one picture keeps the usual directions", async () => {
    const { websiteId } = await site();
    await suggestVideoIdeas(websiteId, NOW, { write: writer(), povLibrary: noPov, pictures: async () => [picture(1)] });
    const rows = await ideasOf(websiteId);
    expect(rows.some((row) => row.direction === "editorial")).toBe(false);
    expect(rows.every((row) => !JSON.stringify(row.script).includes("*"))).toBe(true);
  });

  it("keeps the usual directions when the pictures cannot be collected", async () => {
    const { websiteId } = await site();
    await suggestVideoIdeas(websiteId, NOW, { write: writer(), povLibrary: noPov, pictures: async () => Promise.reject(new Error("down")) });
    expect((await ideasOf(websiteId)).some((row) => row.direction === "editorial")).toBe(false);
  });

  it("speaks its editorial reels when the customer chose a voice, carousels stay silent", async () => {
    const { websiteId } = await site();
    await test.db.insert(videoSettings).values({ websiteId, audioMode: "voiceover" });
    await suggestVideoIdeas(websiteId, NOW, { write: writer(), povLibrary: noPov, pictures: async () => POOL });
    const editorial = (await ideasOf(websiteId)).filter((row) => row.direction === "editorial");
    expect(editorial.length).toBeGreaterThan(0);
    for (const row of editorial) expect((row.production as ProductionChoices).audio).toBe(row.format === "carousel" ? "text_music" : "voiceover");
  });
});

describe("an editorial video", () => {
  async function editorialIdea() {
    const { websiteId } = await site();
    await suggestVideoIdeas(websiteId, NOW, { write: writer(), povLibrary: noPov, pictures: async () => POOL });
    const [row] = (await ideasOf(websiteId)).filter((idea) => idea.direction === "editorial" && idea.format !== "carousel");
    return { websiteId, row };
  }

  it("is made from its plan's pictures, the website's own, never stock or AI", async () => {
    const { row } = await editorialIdea();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await prepareAssets(row.id)).toMatchObject({ assets: 6 });
    const [made] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    const assets = made.assets as { sceneIndex: number; url: string; source: string; provider: string; licence: string }[];
    const images = (row.plan as ShotPlan).images!;
    expect(assets.map((asset) => asset.sceneIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(assets[0].url).toBe(images[0].url);
    for (const asset of assets) {
      expect(images.map((image) => image.url)).toContain(asset.url);
      expect(asset.source).toBe("article");
      expect(["article", "website"]).toContain(asset.provider);
      expect(asset.licence).toBe("The website's own picture");
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails clearly without its pictures", async () => {
    const { row } = await editorialIdea();
    await test.db.update(videoIdeas).set({ plan: { ...(row.plan as ShotPlan), images: [] } }).where(eq(videoIdeas.id, row.id));
    await expect(prepareAssets(row.id)).rejects.toBeInstanceOf(ProductionError);
  });

  it("shows its words plain once switched to another direction, and an idea without pictures cannot become one", async () => {
    const { websiteId, row } = await editorialIdea();
    expect(await editVideoIdea(websiteId, row.id, { direction: "footage" })).toMatchObject({ ok: true });
    const [switched] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect(JSON.stringify(switched.script)).not.toContain("*");
    await test.db.update(videoIdeas).set({ plan: { ...(switched.plan as ShotPlan), images: null } }).where(eq(videoIdeas.id, row.id));
    expect(await editVideoIdea(websiteId, row.id, { direction: "editorial" })).toMatchObject({ ok: false });
  });

  it("keeps a long statement on its slide when edited", async () => {
    const { websiteId, row } = await editorialIdea();
    const script = row.script as VideoScript;
    const long = "Answer every single review the *same day*: trust starts there";
    expect(long.length).toBeGreaterThan(48);
    expect(await editVideoIdea(websiteId, row.id, { script: { ...script, points: [{ ...script.points[0], title: long }, ...script.points.slice(1)] } })).toMatchObject({ ok: true });
    const [edited] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect((edited.script as VideoScript).points[0].title).toBe(long);
  });
});

describe("the voice", () => {
  it("never reads out or captions the highlight marks", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const inputs: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (String(url).endsWith("/audio/speech")) {
          inputs.push(JSON.parse(String(init.body)).input);
          return new Response(new Uint8Array(48_000), { status: 200 });
        }
        return new Response(JSON.stringify({ words: [{ word: "Use", start: 0.1, end: 0.3 }, { word: "it", start: 0.3, end: 0.5 }] }), { status: 200 });
      }),
    );
    const spoken = await speakScript(["*Use it*"], "coral", "en");
    expect(inputs).toEqual(["Use it"]);
    expect(spoken.words.map((word) => word.text).join(" ")).not.toContain("*");
  });
});
