import { existsSync } from "node:fs";
import path from "node:path";

import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { creditLedger, creditSettings, creditSpends, socialAccounts, socialTeams, subscriptions, videoIdeas, videoSettings, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Videos (client, 2026-10-29) on a real database: the day's twenty ideas,
 * approving one (its credit, once), a video that cannot be made giving the
 * credit back, publishing a ready video to each platform in its own format,
 * and a refusing platform paused.
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
  anthropic: { messages: { create: vi.fn() } },
  isAiConfigured: () => true,
  MODELS: { GENERATION: "claude-sonnet-5" },
}));

import { recordCredit } from "@/lib/backlinks/credits";
import { approveVideoIdea, editVideoIdea, publishVideoIdea, restoreVideoIdea, skipVideoIdea, undoVideoIdea } from "./actions";
import { captionText, cleanScript, formatFor, styleFor, suggestVideoIdeas, type IdeaInput } from "./ideas";
import { failMaking, finishMaking, spendKey } from "./make";
import { checkVideoPublished, publishVideo } from "./publish";
import { silentTiming, VIDEO_STYLES, type VideoScript } from "./formats";
import { MUSIC_TRACKS, pickTrack } from "./music";
import { louder, respell, speakScript, wav } from "./voice";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const NOW = new Date("2026-10-30T07:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  state.access = "owner";
  queue.queueJob.mockClear();
  await test.db.delete(creditSettings);
  await test.db.insert(creditSettings).values({ key: "price:video_post", value: 1 });
  vi.stubEnv("BUNDLE_SOCIAL_API_KEY", "test-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const SCRIPT: VideoScript = {
  hook: "Three photo mistakes that cost you clients",
  points: [
    { title: "Dark product shots", detail: "Light sells: shoot near a window.", stat: null },
    { title: "Busy backgrounds", detail: "A plain wall keeps the eye on the product.", stat: { value: 40, suffix: "%", label: "more clicks" } },
    { title: "No close-ups", detail: "Show the details people want to touch.", stat: null },
  ],
  proof: "Image Studio shoots 300 products a month.",
  cta: "Follow Image Studio for more tips",
};

async function site(options: { trial?: boolean; plan?: boolean } = {}) {
  const seeded = await seedWebsite(test, { status: options.plan === false ? null : options.trial ? "trialing" : "active" });
  await test.db
    .update(websites)
    .set({ brandName: "Image Studio", language: "English", country: "Ireland", status: "ready", brandColor: "#e85d2a" })
    .where(eq(websites.id, seeded.websiteId));
  if (options.trial) {
    await test.db
      .update(subscriptions)
      .set({ currentPeriodStart: new Date(Date.now() - DAY), currentPeriodEnd: new Date(Date.now() + 29 * DAY) })
      .where(eq(subscriptions.websiteId, seeded.websiteId));
  }
  return seeded;
}

function writer(count = 25) {
  return vi.fn(async (input: IdeaInput) => ({
    ideas: Array.from({ length: Math.min(count, input.count + 3) }, (_, index) => ({
      title: `Idea ${index + 1}`,
      article: null,
      hook: SCRIPT.hook,
      points: SCRIPT.points,
      proof: SCRIPT.proof,
      cta: SCRIPT.cta,
      caption: "Light sells.",
      hashtags: ["photography", "#product photos", "ecommerce"],
    })),
    usage: { inputTokens: 1000, outputTokens: 2000, model: "claude-sonnet-5" },
  }));
}

async function idea(websiteId: string, values: Partial<typeof videoIdeas.$inferInsert> = {}) {
  const [row] = await test.db
    .insert(videoIdeas)
    .values({ websiteId, day: NOW.toISOString().slice(0, 10), style: "bold", language: "en", title: "Three mistakes", script: SCRIPT, caption: "Light sells.", ...values })
    .returning();
  return row;
}

async function balance(orgId: string) {
  const ledger = await test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, orgId));
  return ledger.reduce((sum, entry) => sum + entry.amount, 0);
}

describe("scripts", () => {
  it("run on fixed times without a voice", () => {
    expect(silentTiming(SCRIPT)).toEqual({ sceneStartsMs: [0, 3000, 7000, 11000, 15000, 18500], totalMs: 22000 });
  });

  it("are kept within what the templates show", () => {
    const long = { ...SCRIPT, title: "x", caption: "", hashtags: [], article: null, hook: "h".repeat(200) };
    expect(cleanScript(long)!.hook).toHaveLength(80);
    expect(cleanScript({ ...long, points: SCRIPT.points.slice(0, 1) })).toBeNull();
    expect(cleanScript({ ...long, points: [{ ...SCRIPT.points[0], stat: { value: Number.NaN, suffix: "%", label: "x" } }, SCRIPT.points[1]] })!.points[0].stat).toBeNull();
  });

  it("carry at most five clean hashtags", () => {
    expect(captionText("Light sells.", ["photography", "#product photos", "photography", "a", "b", "c", "d"])).toBe(
      "Light sells.\n\n#photography #productphotos #a #b #c",
    );
  });

  it("mostly use the website's style and are a carousel one time in four", () => {
    expect([0, 1, 2, 3, 7, 11].map((index) => styleFor(index, "bold"))).toEqual(["bold", "bold", "bold", "numbers", "story", "numbers"]);
    expect([0, 1, 2, 3, 5].map(formatFor)).toEqual(["reel", "carousel", "reel", "reel", "carousel"]);
  });
});

describe("music", () => {
  it("has a track for every style, the same one each time for the same idea", () => {
    for (const style of VIDEO_STYLES) {
      expect(pickTrack("idea-1", style)).not.toBeNull();
      expect(pickTrack("idea-1", style)).toBe(pickTrack("idea-1", style));
    }
    expect(pickTrack("idea-1", "story")?.mood).toBe("chill");
  });

  it("ships every track it lists", () => {
    for (const track of MUSIC_TRACKS) expect(existsSync(path.join(process.cwd(), "public", "video-music", track.file))).toBe(true);
  });
});

describe("the day's ideas", () => {
  it("are topped up to twenty, never more", async () => {
    const { websiteId } = await site();
    const write = writer();
    expect(await suggestVideoIdeas(websiteId, NOW, { write })).toEqual({ created: 20 });
    expect(write.mock.calls[0][0].count).toBe(20);
    expect(await suggestVideoIdeas(websiteId, NOW, { write })).toMatchObject({ created: 0 });
    expect(write).toHaveBeenCalledTimes(1);
    const rows = await test.db.select().from(videoIdeas).where(eq(videoIdeas.websiteId, websiteId));
    expect(rows).toHaveLength(20);
    expect(rows.filter((row) => row.format === "carousel")).toHaveLength(5);
    expect(rows[0]).toMatchObject({ status: "new", language: "en", voice: "coral", captions: true });
  });

  it("follow the website's own style and voice", async () => {
    const { websiteId } = await site();
    await test.db.insert(videoSettings).values({ websiteId, style: "story", voice: null });
    await suggestVideoIdeas(websiteId, NOW, { write: writer() });
    const rows = await test.db.select().from(videoIdeas).where(eq(videoIdeas.websiteId, websiteId));
    expect(rows.filter((row) => row.style === "story").length).toBeGreaterThanOrEqual(15);
    expect(rows.every((row) => row.voice === null)).toBe(true);
  });

  it("are for trials too, and not without a plan", async () => {
    const trial = await site({ trial: true });
    expect(await suggestVideoIdeas(trial.websiteId, NOW, { write: writer() })).toEqual({ created: 20 });
    const none = await site({ plan: false });
    expect(await suggestVideoIdeas(none.websiteId, NOW, { write: writer() })).toMatchObject({ created: 0, reason: "no plan" });
  });
});

describe("approving an idea", () => {
  it("charges one credit, once, and has the video made", async () => {
    const { orgId, websiteId } = await site();
    await recordCredit(orgId, { type: "adjustment", amount: 3, note: "test" });
    const row = await idea(websiteId);
    expect(await approveVideoIdea(websiteId, row.id)).toEqual({ ok: true, data: null });
    expect(await approveVideoIdea(websiteId, row.id)).toEqual({ ok: false, error: "already_handled" });
    expect(await balance(orgId)).toBe(2);
    expect(queue.queueJob).toHaveBeenCalledWith({ name: "video/make.requested", data: { ideaId: row.id } });
    const [saved] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect(saved).toMatchObject({ status: "approved", creditSpendKey: spendKey(row.id), platforms: ["instagram", "tiktok", "youtube", "facebook"] });
  });

  it("is refused without the credit, and nothing changes", async () => {
    const { websiteId } = await site();
    const row = await idea(websiteId);
    expect(await approveVideoIdea(websiteId, row.id)).toEqual({ ok: false, error: "not_enough_credits", price: 1, available: 0 });
    const [saved] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect(saved.status).toBe("new");
    expect(queue.queueJob).not.toHaveBeenCalled();
  });

  it("saves an edit sent along, and refuses one the templates cannot show", async () => {
    const { orgId, websiteId } = await site();
    await recordCredit(orgId, { type: "adjustment", amount: 3, note: "test" });
    const row = await idea(websiteId);
    expect(await editVideoIdea(websiteId, row.id, { script: { ...SCRIPT, points: SCRIPT.points.slice(0, 1) } })).toEqual({ ok: false, error: "bad_script" });
    expect(await approveVideoIdea(websiteId, row.id, { style: "numbers", voice: null })).toEqual({ ok: true, data: null });
    const [saved] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect(saved).toMatchObject({ style: "numbers", voice: null });
  });

  it("is not for a viewer", async () => {
    const { websiteId } = await site();
    const row = await idea(websiteId);
    state.access = "viewer";
    expect(await approveVideoIdea(websiteId, row.id)).toEqual({ ok: false, error: "view_only" });
  });

  it("can be skipped and brought back, for nothing", async () => {
    const { orgId, websiteId } = await site();
    const row = await idea(websiteId);
    await skipVideoIdea(websiteId, row.id);
    expect((await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id)))[0].status).toBe("skipped");
    await restoreVideoIdea(websiteId, row.id);
    expect((await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id)))[0].status).toBe("new");
    expect(await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId))).toHaveLength(0);
  });
});

describe("a make by mistake", () => {
  it("records who made it and how", async () => {
    const { orgId, websiteId } = await site();
    await recordCredit(orgId, { type: "adjustment", amount: 3, note: "test" });
    const row = await idea(websiteId);
    await approveVideoIdea(websiteId, row.id, {}, "key");
    const [saved] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect(saved).toMatchObject({ approvedBy: "user_1", approvedVia: "key" });
  });

  it("can be undone at once: the idea is back and the credit returned, and making it again charges again", async () => {
    const { orgId, websiteId } = await site();
    await recordCredit(orgId, { type: "adjustment", amount: 3, note: "test" });
    const row = await idea(websiteId);
    await approveVideoIdea(websiteId, row.id, {}, "swipe");
    expect(await balance(orgId)).toBe(2);
    expect(await undoVideoIdea(websiteId, row.id)).toEqual({ ok: true, data: null });
    expect(await balance(orgId)).toBe(3);
    const [saved] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect(saved).toMatchObject({ status: "new", approvedAt: null, approvedBy: null, approvedVia: null });
    expect(await undoVideoIdea(websiteId, row.id)).toEqual({ ok: false, error: "already_handled" });
    expect(await balance(orgId)).toBe(3);

    expect(await approveVideoIdea(websiteId, row.id)).toEqual({ ok: true, data: null });
    expect(await balance(orgId)).toBe(2);
  });

  it("cannot be undone once it is being made, after the window, or for a retry or the chat", async () => {
    const { orgId, websiteId } = await site();
    await recordCredit(orgId, { type: "adjustment", amount: 5, note: "test" });
    const started = await idea(websiteId);
    await approveVideoIdea(websiteId, started.id);
    await test.db.update(videoIdeas).set({ status: "making" }).where(eq(videoIdeas.id, started.id));
    const late = await idea(websiteId);
    await approveVideoIdea(websiteId, late.id);
    await test.db.update(videoIdeas).set({ approvedAt: new Date(Date.now() - 20_000) }).where(eq(videoIdeas.id, late.id));
    const chat = await idea(websiteId);
    await approveVideoIdea(websiteId, chat.id, {}, "chat");
    for (const row of [started, late, chat]) expect(await undoVideoIdea(websiteId, row.id)).toEqual({ ok: false, error: "already_handled" });
    expect(await balance(orgId)).toBe(2);
    state.access = "viewer";
    expect(await undoVideoIdea(websiteId, chat.id)).toEqual({ ok: false, error: "view_only" });
  });
});

describe("making the video", () => {
  it("gives the credit back when it cannot be made, and can be tried again", async () => {
    const { orgId, websiteId } = await site();
    await recordCredit(orgId, { type: "adjustment", amount: 1, note: "test" });
    const row = await idea(websiteId);
    await approveVideoIdea(websiteId, row.id);
    await test.db.update(videoIdeas).set({ status: "making" }).where(eq(videoIdeas.id, row.id));
    await failMaking(row.id, "The render machine stopped");
    expect(await balance(orgId)).toBe(1);
    const [saved] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect(saved).toMatchObject({ status: "failed", error: "The render machine stopped" });
    // A second try is charged again - the first credit came back.
    expect(await approveVideoIdea(websiteId, row.id)).toEqual({ ok: true, data: null });
    expect(await balance(orgId)).toBe(0);
  });

  it("is ready for the customer, or scheduled at a good hour when the website publishes automatically", async () => {
    const { websiteId } = await site();
    const manual = await idea(websiteId, { status: "making" });
    expect(await finishMaking(manual.id, { videoUrl: "https://files.example/reel.mp4" }, NOW)).toEqual({ autoAt: null });
    expect((await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, manual.id)))[0]).toMatchObject({ status: "ready", videoUrl: "https://files.example/reel.mp4" });

    await test.db.insert(videoSettings).values({ websiteId, publishMode: "auto" });
    const auto = await idea(websiteId, { status: "making" });
    const { autoAt } = await finishMaking(auto.id, { videoUrl: "https://files.example/reel2.mp4" }, NOW);
    // Ireland: noon local, the first of the best hours after now.
    expect(autoAt?.toISOString()).toBe("2026-10-30T12:07:00.000Z");
    const second = await idea(websiteId, { status: "making" });
    expect((await finishMaking(second.id, { videoUrl: "https://files.example/reel3.mp4" }, NOW)).autoAt?.toISOString()).toBe("2026-10-30T18:07:00.000Z");
  });
});

describe("publishing a video", () => {
  async function ready(options: { carousel?: boolean } = {}) {
    const seeded = await site();
    for (const platform of ["instagram", "tiktok", "youtube", "facebook"]) {
      await test.db.insert(socialAccounts).values({
        websiteId: seeded.websiteId,
        platform,
        username: `${platform}_user`,
        bundleAccountId: `acc_${platform}`,
        warmupEndsAt: new Date(NOW.getTime() - DAY),
      });
    }
    await test.db.insert(socialTeams).values({ websiteId: seeded.websiteId, teamId: `team_${seeded.websiteId.slice(0, 6)}` });
    const row = await idea(seeded.websiteId, {
      status: "ready",
      format: options.carousel ? "carousel" : "reel",
      videoUrl: options.carousel ? null : "https://files.example/reel.mp4",
      slideUrls: options.carousel ? ["https://files.example/1.png", "https://files.example/2.png"] : null,
    });
    return { ...seeded, row };
  }

  function bundle(...replies: unknown[]) {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      void init;
      if (String(url).includes("/upload/from-url")) return new Response(JSON.stringify({ id: `up_${Math.random()}` }), { status: 200 });
      if (String(url).includes("/misc/tiktok/post-settings")) {
        return new Response(JSON.stringify({ privacyLevelOptions: ["SELF_ONLY", "PUBLIC_TO_EVERYONE"], commentDisabled: false, duetDisabled: true, stitchDisabled: false }), { status: 200 });
      }
      return new Response(JSON.stringify(replies.shift()), { status: 200 });
    });
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  /** The post RepGet handed to bundle.social. */
  function postBody(fetch: ReturnType<typeof bundle>) {
    const call = fetch.mock.calls.find(([url, init]) => String(url).endsWith("/post/") && init?.method === "POST");
    return JSON.parse(String(call![1]!.body));
  }

  it("goes to each platform in its own format, and records where it is", async () => {
    const { websiteId, row } = await ready();
    expect(await publishVideoIdea(websiteId, row.id, { platforms: ["instagram", "tiktok", "youtube", "facebook"], when: "now" })).toMatchObject({ ok: true });
    const fetch = bundle(
      { id: "post_1", status: "SCHEDULED", error: null, errors: null, externalData: null },
      {
        id: "post_1",
        status: "POSTED",
        error: null,
        errors: null,
        externalData: {
          INSTAGRAM: { id: "1", permalink: "https://instagram.com/reel/1" },
          TIKTOK: { id: "2", permalink: "https://tiktok.com/@x/video/2" },
          YOUTUBE: { id: "3", permalink: "https://youtube.com/shorts/3" },
          FACEBOOK: { id: "4", permalink: "https://facebook.com/reel/4" },
        },
      },
    );
    expect((await publishVideo(row.id, NOW)).outcome).toBe("posting");
    const body = postBody(fetch);
    expect(body.socialAccountTypes.sort()).toEqual(["FACEBOOK", "INSTAGRAM", "TIKTOK", "YOUTUBE"]);
    expect(body.data.INSTAGRAM).toMatchObject({ type: "REEL", text: "Light sells." });
    expect(body.data.FACEBOOK).toMatchObject({ type: "REEL" });
    expect(body.data.YOUTUBE).toMatchObject({ type: "SHORT", text: "Three mistakes", description: "Light sells.", privacy: "PUBLIC", madeForKids: false });
    expect(body.data.TIKTOK).toMatchObject({ type: "VIDEO", privacy: "PUBLIC_TO_EVERYONE", disableDuet: true });

    expect(await checkVideoPublished(row.id, NOW)).toBe("posted");
    const [saved] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect(saved).toMatchObject({ status: "posted", bundlePostId: "post_1", error: null });
    expect(saved.postedUrls).toMatchObject({ youtube: "https://youtube.com/shorts/3" });
    // Once: a second job for it does nothing.
    expect((await publishVideo(row.id, NOW)).outcome).toBe("skipped");
  });

  it("sends a carousel as photos, and never to YouTube", async () => {
    const { websiteId, row } = await ready({ carousel: true });
    await publishVideoIdea(websiteId, row.id, { platforms: ["instagram", "youtube", "tiktok"], when: "now" });
    const [scheduled] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect(scheduled.platforms).toEqual(["instagram", "tiktok"]);
    const fetch = bundle({ id: "post_c", status: "SCHEDULED", error: null, errors: null, externalData: null });
    await publishVideo(row.id, NOW);
    const body = postBody(fetch);
    expect(body.data.INSTAGRAM).toMatchObject({ type: "POST" });
    expect(body.data.INSTAGRAM.uploadIds).toHaveLength(2);
    expect(body.data.TIKTOK).toMatchObject({ type: "IMAGE", autoAddMusic: true });
  });

  it("pauses only the platform that refused it", async () => {
    const { websiteId, row } = await ready();
    await publishVideoIdea(websiteId, row.id, { platforms: ["instagram", "tiktok"], when: "now" });
    bundle(
      { id: "post_2", status: "SCHEDULED", error: null, errors: null, externalData: null },
      { id: "post_2", status: "ERROR", error: null, errors: { TIKTOK: "Spam risk" }, externalData: { INSTAGRAM: { id: "1", permalink: "https://instagram.com/reel/1" } } },
    );
    await publishVideo(row.id, NOW);
    expect(await checkVideoPublished(row.id, NOW)).toBe("partly");
    const [saved] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, row.id));
    expect(saved).toMatchObject({ status: "posted", error: "TikTok: Spam risk" });
    const accounts = await test.db.select().from(socialAccounts).where(eq(socialAccounts.websiteId, websiteId));
    expect(accounts.find((account) => account.platform === "tiktok")?.pausedReason).toBe("Spam risk");
    expect(accounts.find((account) => account.platform === "instagram")?.pausedAt).toBeNull();
  });

  it("needs a connected platform", async () => {
    const { websiteId } = await site();
    const row = await idea(websiteId, { status: "ready", videoUrl: "https://files.example/reel.mp4" });
    expect(await publishVideoIdea(websiteId, row.id, { platforms: ["instagram"], when: "now" })).toEqual({ ok: false, error: "no_accounts" });
  });

  it("waits for the next good hour once a platform has had its three videos today", async () => {
    const { websiteId, row } = await ready();
    for (let index = 0; index < 3; index += 1) {
      await idea(websiteId, { status: "posted", platforms: ["instagram"], postedAt: new Date(NOW.getTime() - 60_000) });
    }
    await test.db.update(videoIdeas).set({ status: "scheduled", platforms: ["instagram"], scheduledFor: NOW }).where(eq(videoIdeas.id, row.id));
    const fetch = bundle();
    const result = await publishVideo(row.id, NOW);
    expect(result.outcome).toBe("later");
    expect(fetch).not.toHaveBeenCalled();
    const [saved] = await test.db.select().from(videoIdeas).where(and(eq(videoIdeas.id, row.id)));
    expect(saved.status).toBe("scheduled");
  });
});

describe("the voice", () => {
  it("is timed part by part, so each scene starts with its words", async () => {
    // 24 kHz 16-bit mono: 48 bytes a millisecond.
    const lengths = [1000, 2000, 1500];
    let speech = 0;
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/audio/speech")) return new Response(new Uint8Array(lengths[speech++] * 48), { status: 200 });
        return new Response(JSON.stringify({ words: [{ word: "Three", start: 0.1, end: 0.4 }, { word: "tips", start: 0.4, end: 0.8 }] }), { status: 200 });
      }),
    );
    const spoken = await speakScript(["Three tips", "Three tips", "Three tips"], "coral", "en");
    // Each part, then a 280 ms pause before the next.
    expect(spoken.sceneStartsMs).toEqual([0, 1280, 3560]);
    expect(spoken.durationMs).toBe(5060);
    expect(spoken.words[2]).toEqual({ text: "Three", startMs: 1380, endMs: 1680 });
    expect(spoken.audio.subarray(0, 4).toString()).toBe("RIFF");
  });

  it("captions read as the script is written", () => {
    expect(respell([{ text: "3", startMs: 0, endMs: 100 }, { text: "tips", startMs: 100, endMs: 200 }], "Three tips.")).toEqual([
      { text: "Three", startMs: 0, endMs: 100 },
      { text: "tips.", startMs: 100, endMs: 200 },
    ]);
    // When they do not line up, what was heard is kept.
    expect(respell([{ text: "three", startMs: 0, endMs: 100 }], "Three tips")).toHaveLength(1);
    expect(wav(Buffer.alloc(48)).readUInt32LE(40)).toBe(48);
  });

  it("is turned up to just under full scale, never clipped or over 4x", () => {
    const pcm = (...samples: number[]) => {
      const buffer = Buffer.alloc(samples.length * 2);
      samples.forEach((sample, index) => buffer.writeInt16LE(sample, index * 2));
      return buffer;
    };
    const samples = (buffer: Buffer) => Array.from({ length: buffer.length / 2 }, (_, index) => buffer.readInt16LE(index * 2));
    // Peaks at -10 dB: about 2.8x, the loudest at -1 dB.
    expect(samples(louder(pcm(10_362, -5_000, 0)))).toEqual([29_204, -14_092, 0]);
    expect(samples(louder(pcm(1_000, -500)))).toEqual([4_000, -2_000]);
    expect(samples(louder(pcm(32_000, -32_768)))).toEqual([32_000, -32_768]);
    expect(samples(louder(pcm(0, 0)))).toEqual([0, 0]);
  });
});
