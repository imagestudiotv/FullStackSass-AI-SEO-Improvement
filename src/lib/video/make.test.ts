import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { creditLedger, creditSettings, videoIdeas, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Making a production video on a real (in-process) database: a duplicate
 * make event never takes a video another run is making, Text + Music never
 * calls the voice or the transcription, a refused budget or an unsupported
 * voice language fails before anything is paid, and a failure returns the
 * credit while the cost ledger keeps every attempt.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn(async () => true) }));

import { recordCredit } from "@/lib/backlinks/credits";
import { spendCredits } from "@/lib/credits/spend";

import { readLedger, recordCost } from "./cost";
import type { ShotPlan, VideoScript } from "./formats";
import { claimMaking, failMaking, holdProductionBudget, prepareVoice, ProductionError, spendKey } from "./make";
import { noMusicRemuxArgs, remuxJob } from "./render";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  await test.db.delete(creditSettings);
  await test.db.insert(creditSettings).values({ key: "price:video_post", value: 1 });
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const SCRIPT: VideoScript = {
  hook: "POV: your customer asks for the photo again",
  points: [
    { title: "Shoot near a window", detail: "Daylight sells better than any lamp.", stat: null },
    { title: "Keep the background plain", detail: "The eye goes straight to the product.", stat: null },
  ],
  proof: "Image Studio shoots 300 products a month.",
  cta: "Follow for more photo tips",
};

const PLAN: ShotPlan = {
  direction: "text_music",
  pacing: "fast",
  captionStyle: "bold",
  musicMood: "upbeat",
  recipe: "text_music|fast|zoom|bold|upbeat|brand",
  scenes: Array.from({ length: 5 }, () => ({ visual: { source: "brand" as const, query: "studio product photo", kind: "image" as const }, transition: "zoom" as const, reaction: null, overlay: null })),
};

async function site() {
  const seeded = await seedWebsite(test, { status: "active" });
  await test.db.update(websites).set({ brandName: "Image Studio", language: "English", country: "Ireland", status: "ready", brandColor: "#e85d2a" }).where(eq(websites.id, seeded.websiteId));
  return seeded;
}

async function idea(websiteId: string, values: Partial<typeof videoIdeas.$inferInsert> = {}) {
  const [row] = await test.db
    .insert(videoIdeas)
    .values({
      websiteId,
      day: "2026-11-12",
      style: "bold",
      language: "en",
      title: "Photo tips",
      script: SCRIPT,
      caption: "Light sells.",
      direction: "text_music",
      plan: PLAN,
      production: { audio: "text_music", narration: "natural", captionStyle: "bold", music: "auto", duration: "15-30", showHook: true, includeCta: true, ctaText: null },
      voice: "coral",
      status: "approved",
      ...values,
    })
    .returning();
  return row;
}

describe("making a production video", () => {
  it("lets only one run make an idea: a duplicate event's claim gets nothing, the same run's retry is not a new attempt", async () => {
    const { websiteId } = await site();
    const row = await idea(websiteId);
    expect(await claimMaking(row.id, "run-a")).toEqual({ format: "reel" });
    expect(await claimMaking(row.id, "run-b")).toBeNull();
    expect(await claimMaking(row.id, "run-a")).toEqual({ format: "reel" });
    expect((await readLedger(row.id)).attempt).toBe(1);
    // A claim abandoned for an hour may be taken over (the run died without its failure handler).
    await test.db.update(videoIdeas).set({ updatedAt: new Date(Date.now() - 60 * 60 * 1000) }).where(eq(videoIdeas.id, row.id));
    expect(await claimMaking(row.id, "run-c")).toEqual({ format: "reel" });
    expect((await readLedger(row.id)).attempt).toBe(2);
  });

  it("never calls the voice or the transcription for Text + Music, and times the scenes by reading speed", async () => {
    const { websiteId } = await site();
    const row = await idea(websiteId, { status: "making" });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const made = await prepareVoice(row.id);
    expect(fetcher).not.toHaveBeenCalled();
    expect(made.voiceUrl).toBeNull();
    // 15-30 s chosen: the silent timeline lands inside it.
    expect(made.durationMs).toBeGreaterThanOrEqual(15_000);
    expect(made.durationMs).toBeLessThanOrEqual(30_000);
    expect((await readLedger(row.id)).items.some((item) => item.kind === "narration" || item.kind === "transcription")).toBe(false);
  });

  it("refuses a voice in a language it cannot speak before paying for anything", async () => {
    const { websiteId } = await site();
    const row = await idea(websiteId, { status: "making", language: "sv", direction: "voiceover", plan: { ...PLAN, direction: "voiceover" }, production: { audio: "voiceover", narration: "warm", captionStyle: "editorial", music: "auto", duration: "30-45", showHook: true, includeCta: true, ctaText: null } });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(prepareVoice(row.id)).rejects.toThrow(ProductionError);
    await expect(prepareVoice(row.id)).rejects.toThrow(/cannot be made in this language/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses a video that cannot fit its budget before spending, and a failure returns the credit but keeps the ledger", async () => {
    const { orgId, websiteId } = await site();
    await recordCredit(orgId, { type: "adjustment", amount: 1, note: "test" });
    const row = await idea(websiteId, { status: "making" });
    const key = spendKey(row.id);
    await test.db.transaction((tx) => spendCredits(tx, { organizationId: orgId, action: "video_post", key, websiteId }));
    await test.db.update(videoIdeas).set({ creditSpendKey: key }).where(eq(videoIdeas.id, row.id));
    await claimMaking(row.id, "run-1");
    // An earlier attempt already spent most of the budget.
    await recordCost(row.id, { kind: "render", provider: "vercel-sandbox", usd: 0.25, basis: "estimated" });
    await expect(holdProductionBudget(row.id)).rejects.toThrow(/production budget/);
    await failMaking(row.id, "over budget");
    const balance = (await test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, orgId))).reduce((sum, entry) => sum + entry.amount, 0);
    expect(balance).toBe(1);
    const ledger = await readLedger(row.id);
    expect(ledger.items.map((item) => item.kind)).toEqual(["render"]);
    expect(ledger.reservedUsd).toBe(0);
    const [saved] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect(saved.status).toBe("failed");
  });
});

describe("the version without RepGet's music", () => {
  it("copies the picture and puts the voice (or silence) under it - no second render", () => {
    const args = noMusicRemuxArgs({ video: "/tmp/reel.mp4", audio: "/tmp/voice.wav", output: "/tmp/out.mp4" });
    expect(args).toEqual(["-y", "-i", "/tmp/reel.mp4", "-i", "/tmp/voice.wav", "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", "/tmp/out.mp4"]);
    const voiced = remuxJob("/tmp/reel.mp4", null, { voiceUrl: "https://files.example/voice.wav", durationMs: 20_000 });
    expect(voiced.inputs).toEqual([{ path: "/tmp/no-music-audio.wav", url: "https://files.example/voice.wav" }]);
    const silent = remuxJob(null, "https://files.example/reel.mp4", { voiceUrl: null, durationMs: 2_000 });
    expect(silent.inputs[0]).toEqual({ path: "/tmp/no-music-video.mp4", url: "https://files.example/reel.mp4" });
    // Two seconds of 8 kHz 16-bit silence, with its WAV header.
    expect(Buffer.from(silent.inputs[1].base64!, "base64").length).toBe(44 + 2 * 8000 * 2);
    expect(silent.args).toContain("copy");
  });
});
