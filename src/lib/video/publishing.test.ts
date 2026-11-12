import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { providerSpend, providerSpendEvents, socialAccounts, socialTeams, usageEvents, videoIdeas, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Publishing videos per destination (client, 2026-11-12) on a real database,
 * with bundle.social answered from recorded shapes (no live call): Stories,
 * LinkedIn, X as its own post within its spending limit, native Instagram
 * music, retries that never post twice, and the review hold on automatic
 * posts.
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
const queue = vi.hoisted(() => ({ queueJob: vi.fn(async () => true) }));
vi.mock("@/inngest/send", () => queue);
vi.mock("@/lib/ai/client", () => ({ anthropic: { messages: { create: vi.fn() } }, isAiConfigured: () => true, MODELS: { GENERATION: "claude-sonnet-5" } }));

import { syncBundleAccounts } from "@/lib/social/accounts";

import { compatibility, fitCaption, readDestinations } from "./destinations";
import type { VideoScript } from "./formats";
import { checkVideoPublished, publishVideo } from "./publish";
import { publishVideoIdea, setNativeAudio } from "./publish-actions";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(() => {
  queue.queueJob.mockClear();
  vi.stubEnv("BUNDLE_SOCIAL_API_KEY", "test-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const NOW = new Date("2026-11-16T07:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const SCRIPT: VideoScript = {
  hook: "Three photo mistakes",
  points: [
    { title: "Dark shots", detail: "Light sells.", stat: null },
    { title: "Busy backgrounds", detail: "Keep it plain.", stat: null },
  ],
  proof: "300 products a month.",
  cta: "Follow for more",
};

type Options = { platforms: string[]; targets?: Record<string, string | null>; idea?: Partial<typeof videoIdeas.$inferInsert> };

/** A website with the given accounts connected through bundle.social, and a ready video. */
async function ready({ platforms, targets = {}, idea = {} }: Options) {
  const seeded = await seedWebsite(test);
  await test.db.update(websites).set({ country: "Ireland" }).where(eq(websites.id, seeded.websiteId));
  for (const platform of platforms) {
    await test.db.insert(socialAccounts).values({
      websiteId: seeded.websiteId,
      platform,
      username: `${platform}_user`,
      bundleAccountId: `acc_${platform}`,
      target: platform in targets ? targets[platform] : platform === "linkedin" ? "organization" : null,
      warmupEndsAt: new Date(NOW.getTime() - DAY),
    });
  }
  await test.db.insert(socialTeams).values({ websiteId: seeded.websiteId, teamId: `team_${seeded.websiteId.slice(0, 6)}` });
  const [row] = await test.db
    .insert(videoIdeas)
    .values({
      websiteId: seeded.websiteId,
      day: "2026-11-16",
      style: "bold",
      language: "en",
      title: "Three mistakes",
      script: SCRIPT,
      caption: "Light sells. See https://example.test/blog #photo #light",
      status: "ready",
      videoUrl: "https://files.example/reel.mp4",
      durationMs: 30_000,
      ...idea,
    })
    .returning();
  return { ...seeded, row };
}

/** bundle.social, from recorded response shapes: each POST /post/ gets the next reply from `posts`, each GET /post/{id} its `final`. */
function bundle(posts: ((body: Record<string, unknown>) => Record<string, unknown>)[], final: Record<string, Record<string, unknown>> = {}) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url);
    if (path.includes("/upload/from-url")) {
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: `up:${body.url}` }), { status: 200 });
    }
    if (path.includes("/misc/tiktok/post-settings")) {
      return new Response(JSON.stringify({ privacyLevelOptions: ["PUBLIC_TO_EVERYONE"], commentDisabled: false, duetDisabled: false, stitchDisabled: false }), { status: 200 });
    }
    if (path.endsWith("/post/") && init?.method === "POST") {
      const next = posts.shift();
      if (!next) throw new Error("unexpected post");
      return new Response(JSON.stringify(next(JSON.parse(String(init.body)))), { status: 200 });
    }
    const id = decodeURIComponent(path.split("/post/")[1] ?? "");
    return new Response(JSON.stringify(final[id]), { status: 200 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const accepted = (id: string) => () => ({ id, status: "SCHEDULED", error: null, errors: null, externalData: null });
const bodies = (fetch: ReturnType<typeof bundle>) =>
  fetch.mock.calls.filter(([url, init]) => String(url).endsWith("/post/") && init?.method === "POST").map(([, init]) => JSON.parse(String(init!.body)));

async function saved(id: string) {
  const [row] = await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  return { ...row, dest: readDestinations(row.destinations) };
}

describe("which platforms can take a video", () => {
  it("never sends a Story where there are none, nor anything over a platform's limit", () => {
    expect(compatibility({ format: "story", duration: 30, platforms: ["instagram", "facebook", "tiktok", "youtube", "pinterest", "linkedin", "x"], xAvailable: true })).toEqual({
      ok: ["instagram", "facebook"],
      problems: { tiktok: "no_story", youtube: "no_story", pinterest: "no_story", linkedin: "no_story", x: "no_story" },
    });
    expect(compatibility({ format: "story", duration: "60-90", platforms: ["instagram"] }).problems).toEqual({ instagram: "too_long" });
    expect(compatibility({ format: "story", duration: 2, platforms: ["facebook"] }).problems).toEqual({ facebook: "too_short" });
    expect(compatibility({ format: "reel", duration: 150, platforms: ["x", "youtube"], xAvailable: true }).problems).toEqual({ x: "too_long" });
    expect(compatibility({ format: "carousel", duration: null, platforms: ["linkedin", "instagram"] }).problems).toEqual({ linkedin: "no_carousel" });
    expect(compatibility({ format: "reel", duration: 30, platforms: ["x"] }).problems).toEqual({ x: "x_not_configured" });
  });

  it("fits X's 280 characters with whole hashtags", () => {
    const caption = `${"Light sells and a plain wall keeps the eye on the product. ".repeat(5)}#photo #light #ecommerce`;
    const fitted = fitCaption(caption, 280);
    expect([...fitted].length).toBeLessThanOrEqual(280);
    expect(fitted.endsWith("…")).toBe(true);
    // Room for the text and some tags: whole tags only, as many as fit.
    expect(fitCaption(`${"Light sells. ".repeat(20)}#photo #light #ecommerce`, 280)).toBe(`${"Light sells. ".repeat(20).trim()} #photo #light`);
    expect(fitCaption("Short #photo #light", 13)).toBe("Short #photo");
  });
});

describe("Stories", () => {
  it("go to Instagram and Facebook as real Stories (one file, no caption), and are left out elsewhere", async () => {
    const { websiteId, row } = await ready({ platforms: ["instagram", "facebook", "tiktok"], idea: { format: "story", durationMs: 20_000 } });
    // The customer's explicit choice of TikTok for a Story is refused.
    expect(await publishVideoIdea(websiteId, row.id, { platforms: ["instagram", "tiktok"], when: "now" })).toEqual({ ok: false, error: "incompatible", problems: { tiktok: "no_story" } });
    // Scheduled automatically with the website's platforms: TikTok is skipped with the reason.
    await test.db.update(videoIdeas).set({ status: "scheduled", platforms: ["instagram", "facebook", "tiktok"], scheduledFor: NOW }).where(eq(videoIdeas.id, row.id));
    const fetch = bundle([accepted("post_s")]);
    expect((await publishVideo(row.id, NOW)).outcome).toBe("posting");
    const [body] = bodies(fetch);
    expect(body.socialAccountTypes.sort()).toEqual(["FACEBOOK", "INSTAGRAM"]);
    expect(body.data.INSTAGRAM).toEqual({ type: "STORY", uploadIds: ["up:https://files.example/reel.mp4"] });
    expect(body.data.FACEBOOK).toEqual({ type: "STORY", uploadIds: ["up:https://files.example/reel.mp4"] });
    expect((await saved(row.id)).dest.tiktok).toMatchObject({ status: "skipped", error: "no_story" });
  });
});

describe("LinkedIn", () => {
  it("gets a video post on the chosen page, and is refused without one", async () => {
    const { websiteId, row } = await ready({ platforms: ["linkedin"], targets: { linkedin: null } });
    expect(await publishVideoIdea(websiteId, row.id, { platforms: ["linkedin"], when: "now" })).toEqual({ ok: false, error: "linkedin_no_target" });
    await test.db.update(socialAccounts).set({ target: "organization" }).where(eq(socialAccounts.websiteId, websiteId));
    expect(await publishVideoIdea(websiteId, row.id, { platforms: ["linkedin"], when: "now" })).toMatchObject({ ok: true });
    const fetch = bundle([accepted("post_l")], {
      post_l: { id: "post_l", status: "POSTED", error: null, errors: null, externalData: { LINKEDIN: { id: "urn:li:share:1", permalink: "https://www.linkedin.com/feed/update/urn:li:share:1" } } },
    });
    await publishVideo(row.id, NOW, { manual: true });
    expect(bodies(fetch)[0].data.LINKEDIN).toEqual({
      text: "Light sells. See https://example.test/blog #photo #light",
      uploadIds: ["up:https://files.example/reel.mp4"],
      mediaTitle: "Three mistakes",
      privacy: "PUBLIC",
    });
    expect(await checkVideoPublished(row.id, NOW)).toBe("posted");
    expect((await saved(row.id)).postedUrls).toEqual({ linkedin: "https://www.linkedin.com/feed/update/urn:li:share:1" });
  });
});

describe("X", () => {
  const configure = (limit: string) => {
    vi.stubEnv("X_VIDEO_POSTS_ENABLED", "1");
    vi.stubEnv("X_VIDEO_MONTHLY_LIMIT_USD", limit);
    vi.stubEnv("X_VIDEO_COST_PER_POST_USD", "0.02");
  };

  it("is refused while X is not set up for videos", async () => {
    const { websiteId, row } = await ready({ platforms: ["x", "instagram"] });
    expect(await publishVideoIdea(websiteId, row.id, { platforms: ["instagram", "x"], when: "now" })).toEqual({ ok: false, error: "incompatible", problems: { x: "x_not_configured" } });
  });

  it("goes as its own post, without a link, and its cost is charged once posted", async () => {
    await test.db.delete(providerSpendEvents);
    await test.db.delete(providerSpend);
    configure("1");
    const { websiteId, orgId, row } = await ready({ platforms: ["x", "instagram"] });
    expect(await publishVideoIdea(websiteId, row.id, { platforms: ["instagram", "x"], when: "now" })).toMatchObject({ ok: true });
    const fetch = bundle([accepted("post_main"), accepted("post_x")], {
      post_main: { id: "post_main", status: "POSTED", error: null, errors: null, externalData: { INSTAGRAM: { id: "1", permalink: "https://instagram.com/reel/1" } } },
      post_x: { id: "post_x", status: "POSTED", error: null, errors: null, externalData: { TWITTER: { id: "9", permalink: "https://x.com/i/status/9" } } },
    });
    expect((await publishVideo(row.id, NOW, { manual: true })).outcome).toBe("posting");
    const [main, x] = bodies(fetch);
    expect(main.socialAccountTypes).toEqual(["INSTAGRAM"]);
    expect(x.socialAccountTypes).toEqual(["TWITTER"]);
    expect(x.data.TWITTER).toEqual({ text: "Light sells. See #photo #light", uploadIds: ["up:https://files.example/reel.mp4"] });
    expect(await checkVideoPublished(row.id, NOW)).toBe("posted");
    const after = await saved(row.id);
    expect(after.dest.x).toMatchObject({ status: "posted", bundlePostId: "post_x", url: "https://x.com/i/status/9", attempts: 1 });
    expect(after.postedUrls).toEqual({ instagram: "https://instagram.com/reel/1", x: "https://x.com/i/status/9" });
    const [spend] = await test.db.select().from(providerSpend);
    expect(Number(spend.spentUsd)).toBeCloseTo(0.02, 6);
    expect(Number(spend.reservedUsd)).toBeCloseTo(0, 6);
    const usage = await test.db.select().from(usageEvents).where(and(eq(usageEvents.organizationId, orgId), eq(usageEvents.kind, "social_api")));
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ provider: "x", costUsd: "0.020000" });
  });

  it("with its limit used up, is left out and never holds back the others", async () => {
    await test.db.delete(providerSpendEvents);
    await test.db.delete(providerSpend);
    configure("0.01");
    const { row } = await ready({ platforms: ["x", "instagram"], idea: { status: "scheduled", platforms: ["instagram", "x"], scheduledFor: NOW } });
    const fetch = bundle([accepted("post_main2")], {
      post_main2: { id: "post_main2", status: "POSTED", error: null, errors: null, externalData: { INSTAGRAM: { id: "1", permalink: "https://instagram.com/reel/2" } } },
    });
    await publishVideo(row.id, NOW);
    expect(bodies(fetch)).toHaveLength(1);
    expect(await checkVideoPublished(row.id, NOW)).toBe("partly");
    const after = await saved(row.id);
    expect(after).toMatchObject({ status: "posted", error: "x_limit_reached" });
    expect(after.dest.x).toMatchObject({ status: "skipped", error: "x_limit_reached" });
    const accounts = await test.db.select().from(socialAccounts).where(eq(socialAccounts.websiteId, row.websiteId));
    expect(accounts.every((account) => account.pausedAt === null)).toBe(true);
  });
});

describe("trying again", () => {
  it("only sends to the destinations that failed, never twice to one that posted", async () => {
    const { websiteId, row } = await ready({ platforms: ["instagram", "tiktok"] });
    await publishVideoIdea(websiteId, row.id, { platforms: ["instagram", "tiktok"], when: "now" });
    bundle([accepted("post_1")], {
      post_1: { id: "post_1", status: "ERROR", error: null, errors: { TIKTOK: "Server busy" }, externalData: { INSTAGRAM: { id: "1", permalink: "https://instagram.com/reel/1" } } },
    });
    await publishVideo(row.id, NOW, { manual: true });
    expect(await checkVideoPublished(row.id, NOW)).toBe("partly");
    await test.db.update(socialAccounts).set({ pausedAt: null }).where(eq(socialAccounts.websiteId, websiteId));

    expect(await publishVideoIdea(websiteId, row.id, { platforms: ["instagram", "tiktok"], when: "now" })).toMatchObject({ ok: true });
    const fetch = bundle([accepted("post_2")], {
      post_2: { id: "post_2", status: "POSTED", error: null, errors: null, externalData: { TIKTOK: { id: "2", permalink: "https://tiktok.com/@x/video/2" } } },
    });
    await publishVideo(row.id, NOW, { manual: true });
    const [second] = bodies(fetch);
    expect(second.socialAccountTypes).toEqual(["TIKTOK"]);
    expect(second.referenceKey).toBe(`video:${row.id}:2`);
    expect(await checkVideoPublished(row.id, NOW)).toBe("posted");
    const after = await saved(row.id);
    expect(after.dest.instagram).toMatchObject({ status: "posted", bundlePostId: "post_1", attempts: 1 });
    expect(after.dest.tiktok).toMatchObject({ status: "posted", bundlePostId: "post_2", attempts: 2 });
    expect(after.postedUrls).toEqual({ instagram: "https://instagram.com/reel/1", tiktok: "https://tiktok.com/@x/video/2" });
    // Everything is on its platform: nothing left to send.
    expect(await publishVideoIdea(websiteId, row.id, { platforms: ["instagram", "tiktok"], when: "now" })).toEqual({ ok: false, error: "already_handled" });
  });
});

describe("native Instagram music", () => {
  const track = { audioId: "17900000000000000", title: "Late Night Drive", artist: "Example Artist", volume: 80, originalVolume: 20 };

  it("sends Instagram the version without RepGet's music, with the track; the others keep RepGet's music", async () => {
    const { websiteId, row } = await ready({
      platforms: ["instagram", "tiktok"],
      targets: { instagram: "facebook_login" },
      idea: { altVideoUrl: "https://files.example/reel-no-music.mp4" },
    });
    expect(await setNativeAudio(websiteId, row.id, { ...track, volume: 120 })).toEqual({ ok: false, error: "bad_audio" });
    expect(await setNativeAudio(websiteId, row.id, track)).toMatchObject({ ok: true, data: { nativeAudio: { audioId: track.audioId, trending: false } } });
    await publishVideoIdea(websiteId, row.id, { platforms: ["instagram", "tiktok"], when: "now" });
    const fetch = bundle([accepted("post_a")]);
    await publishVideo(row.id, NOW, { manual: true });
    const [body] = bodies(fetch);
    expect(body.data.INSTAGRAM).toEqual({
      type: "REEL",
      text: "Light sells. See https://example.test/blog #photo #light",
      uploadIds: ["up:https://files.example/reel-no-music.mp4"],
      shareToFeed: true,
      musicSoundInfo: { musicSoundId: track.audioId, musicSoundVolume: 80, videoOriginalSoundVolume: 20 },
    });
    expect(body.data.TIKTOK.uploadIds).toEqual(["up:https://files.example/reel.mp4"]);
  });

  it("needs Facebook Login and a Reel; without the login Instagram fails with the reason and the others go", async () => {
    const { websiteId, row } = await ready({ platforms: ["instagram", "tiktok"], targets: { instagram: "instagram_login" } });
    expect(await setNativeAudio(websiteId, row.id, track)).toEqual({ ok: false, error: "needs_facebook_login" });
    const story = await ready({ platforms: ["instagram"], targets: { instagram: "facebook_login" }, idea: { format: "story" } });
    expect(await setNativeAudio(story.websiteId, story.row.id, track)).toEqual({ ok: false, error: "reel_only" });

    // Chosen while on Facebook Login, the account reconnected with Instagram's own login since.
    await test.db.update(videoIdeas).set({ nativeAudio: { provider: "instagram", ...track, trending: false, selectedAt: NOW.toISOString() } }).where(eq(videoIdeas.id, row.id));
    await publishVideoIdea(websiteId, row.id, { platforms: ["instagram", "tiktok"], when: "now" });
    const fetch = bundle([accepted("post_b")]);
    await publishVideo(row.id, NOW, { manual: true });
    expect(bodies(fetch)[0].socialAccountTypes).toEqual(["TIKTOK"]);
    const after = await saved(row.id);
    expect(after.dest.instagram).toMatchObject({ status: "failed", error: "native_audio_login" });
    const [instagram] = await test.db.select().from(socialAccounts).where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, "instagram")));
    expect(instagram.pausedAt).toBeNull();
  });
});

describe("the review hold", () => {
  it("keeps an automatic post that needs review from going out, but not the customer's own Publish", async () => {
    const { websiteId, row } = await ready({ platforms: ["instagram"], idea: { status: "scheduled", platforms: ["instagram"], scheduledFor: NOW, reviewStatus: "required" } });
    const none = bundle([]);
    expect((await publishVideo(row.id, NOW)).outcome).toBe("skipped");
    expect(none).not.toHaveBeenCalled();
    expect(await saved(row.id)).toMatchObject({ status: "ready", error: "review_required", reviewStatus: "required" });

    expect(await publishVideoIdea(websiteId, row.id, { platforms: ["instagram"], when: "now" })).toMatchObject({ ok: true });
    expect(queue.queueJob).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ manual: true }) }));
    const fetch = bundle([accepted("post_r")]);
    expect((await publishVideo(row.id, NOW, { manual: true })).outcome).toBe("posting");
    expect(bodies(fetch)).toHaveLength(1);
    // Publishing is not an approval.
    expect((await saved(row.id)).reviewStatus).toBe("required");
  });
});

describe("connections read back from bundle.social", () => {
  it("keep LinkedIn's chosen page, Instagram's login method, and one X account for social and videos", async () => {
    const { websiteId } = await seedWebsite(test);
    await test.db.insert(socialTeams).values({ websiteId, teamId: "team_sync" });
    // X connected earlier from the Social page.
    await test.db.insert(socialAccounts).values({ websiteId, platform: "x", username: "brand", bundleAccountId: "acc_x", warmupEndsAt: NOW });
    const team: { socialAccounts: Record<string, unknown>[] } = {
      socialAccounts: [
        {
          id: "acc_li",
          type: "LINKEDIN",
          username: "jane-doe",
          displayName: "Jane Doe",
          externalId: "urn:li:organization:12345",
          userId: "abc",
          channels: [
            { id: "urn:li:person:abc", name: "Jane Doe" },
            { id: "urn:li:organization:12345", name: "Image Studio" },
          ],
        },
        { id: "acc_ig", type: "INSTAGRAM", username: "imagestudio", instagramConnectionMethod: "FACEBOOK", channels: [] },
        { id: "acc_x", type: "TWITTER", username: "brand", twitterSubType: "none", channels: [] },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(team), { status: 200 })));
    const accounts = await syncBundleAccounts(websiteId, NOW);
    const by = (platform: string) => accounts.filter((account) => account.platform === platform);
    expect(by("linkedin")).toEqual([expect.objectContaining({ username: "Image Studio", target: "organization", bundleAccountId: "acc_li" })]);
    expect(by("instagram")).toEqual([expect.objectContaining({ target: "facebook_login" })]);
    expect(by("x")).toEqual([expect.objectContaining({ bundleAccountId: "acc_x", username: "brand" })]);

    // A profile, and a LinkedIn connected without a target chosen yet.
    team.socialAccounts[0] = { ...team.socialAccounts[0], externalId: "urn:li:person:abc" };
    expect((await syncBundleAccounts(websiteId, NOW)).find((account) => account.platform === "linkedin")).toMatchObject({ target: "profile", username: "Jane Doe" });
    team.socialAccounts[0] = { ...team.socialAccounts[0], externalId: null };
    expect((await syncBundleAccounts(websiteId, NOW)).find((account) => account.platform === "linkedin")?.target).toBeNull();
  });
});
