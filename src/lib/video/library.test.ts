import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { creditSettings, socialAccounts, socialTeams, videoIdeas, videoMedia, videoScheduleSlots, videoSettings, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Daniel's 24 Nov ticket on PGlite: deleting videos (every status, against
 * the make and publish jobs, files that stay), a Short's tags, and failures
 * the customer never sees (the idea back in Today's ideas, the video ready).
 */

const state = vi.hoisted(() => ({ db: null as unknown, editor: true }));
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
vi.mock("@/lib/websites/require-editor", () => ({
  requireEditor: vi.fn(async (id: string) => (state.editor ? { ok: true, context: await contextFor(id) } : { ok: false, error: "view_only" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const queue = vi.hoisted(() => ({ queueJob: vi.fn(async () => true) }));
vi.mock("@/inngest/send", () => queue);
vi.mock("@/lib/ai/client", () => ({ anthropic: { messages: { create: vi.fn() } }, isAiConfigured: () => true, MODELS: { GENERATION: "claude-sonnet-5" } }));
const email = vi.hoisted(() => ({ sendEmail: vi.fn(async () => ({ ok: true })), emailVideoViews: vi.fn(async () => ({ status: "skipped" })) }));
vi.mock("@/lib/email/send", () => ({ sendEmail: email.sendEmail }));
vi.mock("@/lib/email/lifecycle-triggers", () => ({ emailVideoViews: email.emailVideoViews }));
/** Supabase Storage, in memory: what is listed, and what was removed. */
const storage = vi.hoisted(() => ({ files: [] as string[], removed: [] as string[], broken: false }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      getBucket: async () => ({ data: {} }),
      from: () => ({
        list: async (path: string) =>
          storage.broken ? { data: null, error: { message: "down" } } : { data: storage.files.filter((file) => file.startsWith(`${path}/`)).map((file) => ({ name: file.slice(path.length + 1) })), error: null },
        remove: async (paths: string[]) => {
          if (storage.broken) return { data: null, error: { message: "down" } };
          storage.removed.push(...paths);
          return { data: [], error: null };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://files.example/storage/v1/object/public/video-files/${path}` } }),
      }),
    },
  }),
}));

import { recordCredit } from "@/lib/backlinks/credits";
import { walletOf } from "@/lib/credits/spend";
import { pauseKind } from "@/lib/social/pause";

import { approveVideoIdea, editVideoIdea, restoreVideoIdea, skipVideoIdea } from "./actions";
import { dailyWritten, ideaAllowance } from "./batches";
import { customerDestinations, customerNote, customerStatus, isReturned } from "./customer-view";
import { deleteVideo } from "./delete";
import { readDestinations } from "./destinations";
import { deleteOldFiles, latePublishing, refreshStats, videosToFollow } from "./followup";
import type { VideoScript } from "./formats";
import { deleteVideoIdeas, saveYoutubeTags } from "./library-actions";
import { savedVideosWhere, todaysIdeasWhere } from "./lists";
import { claimMaking, failMaking, finishMaking, isMaking } from "./make";
import { checkVideoPublished, publishVideo } from "./publish";
import { markVideoPosted } from "./publish-actions";
import { claimScheduleSlot } from "./schedule";

let test: TestDb;
const NOW = new Date("2026-11-24T10:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  state.editor = true;
  storage.files = [];
  storage.removed = [];
  storage.broken = false;
  email.sendEmail.mockClear();
  email.emailVideoViews.mockClear();
  queue.queueJob.mockClear();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://files.example");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
  await test.db.delete(creditSettings);
  await test.db.insert(creditSettings).values({ key: "price:video_post", value: 1 });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const SCRIPT: VideoScript = {
  hook: "Three mistakes in product photos",
  points: [
    { title: "Dark shots", detail: "Light sells.", stat: null },
    { title: "Busy backgrounds", detail: "Keep it plain.", stat: null },
  ],
  proof: "300 products a month.",
  cta: "Follow for more",
};

async function site(platforms: string[] = []) {
  const seeded = await seedWebsite(test, { status: "active" });
  await test.db.update(websites).set({ brandName: "Image Studio", language: "English", country: "Ireland", status: "ready" }).where(eq(websites.id, seeded.websiteId));
  for (const platform of platforms) {
    await test.db.insert(socialAccounts).values({
      websiteId: seeded.websiteId,
      platform,
      username: `${platform}_user`,
      bundleAccountId: `acc_${platform}`,
      target: platform === "linkedin" ? "organization" : null,
      warmupEndsAt: new Date(NOW.getTime() - DAY),
    });
  }
  if (platforms.length > 0) await test.db.insert(socialTeams).values({ websiteId: seeded.websiteId, teamId: `team_${seeded.websiteId.slice(0, 6)}` });
  return seeded;
}
async function idea(websiteId: string, values: Partial<typeof videoIdeas.$inferInsert> = {}) {
  const [row] = await test.db
    .insert(videoIdeas)
    .values({ websiteId, day: "2026-11-24", style: "bold", language: "en", title: "Three mistakes", script: SCRIPT, caption: "Light sells. #photo #SmallBusiness", ...values })
    .returning();
  return row;
}
const row = async (id: string) => (await test.db.select().from(videoIdeas).where(eq(videoIdeas.id, id)))[0];
const available = async (orgId: string) => (await walletOf(test.db, orgId)).available;
const file = (path: string) => `https://files.example/storage/v1/object/public/video-files/${path}`;
const ids = async (where: Parameters<ReturnType<ReturnType<TestDb["db"]["select"]>["from"]>["where"]>[0]) => (await test.db.select().from(videoIdeas).where(where)).map((item) => item.id);

describe("deleting a video", () => {
  it("needs edit rights, and only reaches the website's own videos", async () => {
    const mine = await site();
    const other = await site();
    const theirs = await idea(other.websiteId, { status: "ready" });
    const own = await idea(mine.websiteId, { status: "ready" });
    expect(await deleteVideoIdeas(mine.websiteId, [theirs.id])).toEqual({ ok: false, error: "not_found" });
    expect((await row(theirs.id)).status).toBe("ready");
    expect(await deleteVideoIdeas(mine.websiteId, ["not-an-id", "'; drop table"])).toEqual({ ok: false, error: "not_found" });
    state.editor = false;
    expect(await deleteVideoIdeas(mine.websiteId, [own.id])).toEqual({ ok: false, error: "view_only" });
    expect((await row(own.id)).status).toBe("ready");
  });

  it("deletes several at once, leaving the one being published, and is the same when asked twice", async () => {
    const { websiteId } = await site();
    const a = await idea(websiteId, { status: "ready" });
    const b = await idea(websiteId, { status: "failed", error: "x" });
    const c = await idea(websiteId, { status: "posting", updatedAt: NOW });
    expect(await deleteVideoIdeas(websiteId, [a.id, b.id, c.id, a.id])).toEqual({ ok: true, data: { deleted: [a.id, b.id], busy: 1 } });
    expect((await row(c.id)).status).toBe("posting");
    expect(await deleteVideoIdeas(websiteId, [a.id])).toEqual({ ok: true, data: { deleted: [a.id], busy: 0 } });
    // A "posting" no job has followed for hours can go.
    expect(await deleteVideo(websiteId, c.id, new Date(NOW.getTime() + 3 * HOUR))).toBe("deleted");
  });

  it("returns the credit of a video whose making has not started, never of one being made or made", async () => {
    const { orgId, websiteId } = await site();
    await recordCredit(orgId, { type: "adjustment", amount: 3, note: "test" });
    const waiting = await idea(websiteId);
    const started = await idea(websiteId);
    const made = await idea(websiteId);
    for (const item of [waiting, started, made]) expect((await approveVideoIdea(websiteId, item.id)).ok).toBe(true);
    expect(await available(orgId)).toBe(0);
    await claimMaking(started.id, "run_1");
    await claimMaking(made.id, "run_2");
    await finishMaking(made.id, { videoUrl: "https://elsewhere.example/v.mp4" }, NOW);
    await deleteVideoIdeas(websiteId, [waiting.id, started.id, made.id]);
    expect(await available(orgId)).toBe(1);
    expect(await row(waiting.id)).toMatchObject({ status: "deleted", approvedAt: null });
    // Asked again: refunded once.
    await deleteVideoIdeas(websiteId, [waiting.id]);
    expect(await available(orgId)).toBe(1);
    // Its job finds nothing to make.
    expect(await claimMaking(waiting.id, "run_3")).toBeNull();
    // A failure of the deleted one's job neither brings it back nor refunds it.
    await failMaking(started.id, "The render machine stopped");
    expect((await row(started.id)).status).toBe("deleted");
    expect(await available(orgId)).toBe(1);
  });

  it("is not brought back by a make job that ends after it: the files it stored go, and no hour is kept", async () => {
    const { websiteId } = await site(["instagram"]);
    await test.db.insert(videoSettings).values({ websiteId, publishMode: "auto", frequency: "1_day", platforms: ["instagram"] }).onConflictDoNothing();
    const item = await idea(websiteId, { status: "making" });
    expect(await isMaking(item.id)).toBe(true);
    await deleteVideoIdeas(websiteId, [item.id]);
    expect(await isMaking(item.id)).toBe(false);
    const path = `${websiteId}/ideas/${item.id}/late.mp4`;
    expect(await finishMaking(item.id, { videoUrl: file(path) }, NOW)).toEqual({ autoAt: null });
    expect(await row(item.id)).toMatchObject({ status: "deleted", videoUrl: null, scheduledFor: null });
    expect(storage.removed).toContain(path);
    expect(await test.db.select().from(videoScheduleSlots).where(eq(videoScheduleSlots.ideaId, item.id))).toHaveLength(0);
    // Whatever else the job left in the folder goes with the daily sweep.
    expect((await row(item.id)).filesDeletedAt).toBeNull();
    storage.files = [`${websiteId}/ideas/${item.id}/voice.wav`];
    await deleteOldFiles(new Date(NOW.getTime() + 3 * HOUR));
    expect(storage.removed).toContain(`${websiteId}/ideas/${item.id}/voice.wav`);
    expect((await row(item.id)).filesDeletedAt).not.toBeNull();
  });

  it("takes a scheduled video off the schedule: the publish job sends nothing", async () => {
    const { websiteId } = await site(["instagram"]);
    vi.stubEnv("BUNDLE_SOCIAL_API_KEY", "test");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const item = await idea(websiteId, { status: "scheduled", platforms: ["instagram"], scheduledFor: NOW, videoUrl: "https://elsewhere.example/v.mp4" });
    await claimScheduleSlot(websiteId, item.id, NOW);
    await deleteVideoIdeas(websiteId, [item.id]);
    expect(await publishVideo(item.id, NOW, { manual: true })).toEqual({ outcome: "skipped" });
    expect(fetch).not.toHaveBeenCalled();
    expect(await row(item.id)).toMatchObject({ status: "deleted", scheduledFor: null });
    expect(await test.db.select().from(videoScheduleSlots).where(eq(videoScheduleSlots.ideaId, item.id))).toHaveLength(0);
    // Nor can it be marked as posted, edited or restored afterwards.
    expect(await markVideoPosted(websiteId, item.id, "tiktok", true)).toMatchObject({ ok: false });
    expect(await editVideoIdea(websiteId, item.id, { title: "Again" })).toMatchObject({ ok: false });
    expect(await approveVideoIdea(websiteId, item.id)).toMatchObject({ ok: false });
    await restoreVideoIdea(websiteId, item.id);
    await skipVideoIdea(websiteId, item.id);
    expect((await row(item.id)).status).toBe("deleted");
  });

  it("never comes back into the day's twenty, the lists or the numbers", async () => {
    const { websiteId } = await site();
    const fresh = await idea(websiteId);
    const made = await idea(websiteId, { status: "ready", videoUrl: "https://elsewhere.example/v.mp4" });
    const out = await idea(websiteId, { status: "posted", postedAt: NOW, bundlePostId: "post_1", platforms: ["instagram"], videoUrl: "https://elsewhere.example/v.mp4", destinations: { instagram: { status: "posted", bundlePostId: "post_1", url: null, error: null, attempts: 1 } } });
    const before = await dailyWritten(websiteId, "2026-11-24");
    const allowance = await ideaAllowance(websiteId, NOW);
    expect(await videosToFollow(NOW)).toContain(out.id);
    await deleteVideoIdeas(websiteId, [fresh.id, made.id, out.id]);
    expect(await dailyWritten(websiteId, "2026-11-24")).toBe(before);
    expect(await ideaAllowance(websiteId, NOW)).toEqual(allowance);
    expect(await ids(todaysIdeasWhere(websiteId, NOW))).toEqual([]);
    expect(await ids(savedVideosWhere(websiteId, NOW))).toEqual([]);
    expect(await videosToFollow(NOW)).not.toContain(out.id);
    expect(await refreshStats(out.id, NOW)).toEqual({ views: 0 });
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(email.emailVideoViews).not.toHaveBeenCalled();
    // What it was posted to is kept: it is still out there.
    expect(readDestinations((await row(out.id)).destinations).instagram?.status).toBe("posted");
  });

  it("sends no milestone email for a video deleted while its numbers are read", async () => {
    const { websiteId } = await site();
    const out = await idea(websiteId, { status: "posted", postedAt: NOW, bundlePostId: "post_1", platforms: ["instagram"] });
    vi.stubEnv("BUNDLE_SOCIAL_API_KEY", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await deleteVideo(websiteId, out.id, NOW);
        return new Response(JSON.stringify({ items: [{ views: 5000, likes: 1, comments: 0, shares: 0, createdAt: "2026-11-24" }] }), { status: 200 });
      }),
    );
    await refreshStats(out.id, NOW);
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(email.emailVideoViews).not.toHaveBeenCalled();
    expect((await row(out.id)).milestoneAt).toBeNull();
  });

  it("removes the video's own files and keeps the library's, the shared ones and what another idea uses", async () => {
    const { websiteId } = await site();
    const own = file(`${websiteId}/media/own.jpg`);
    const library = file(`${websiteId}/media/library.mp4`);
    const reused = file(`${websiteId}/media/reused.jpg`);
    const logo = file(`${websiteId}/media/logo.png`);
    const stock = file("shared/stock/clip.mp4");
    await test.db.insert(videoMedia).values({ websiteId, url: library, kind: "video", name: "clip" });
    await test.db.insert(videoSettings).values({ websiteId, logoUrl: logo }).onConflictDoUpdate({ target: videoSettings.websiteId, set: { logoUrl: logo } });
    const item = await idea(websiteId, { status: "ready", media: [own, library, reused, logo].map((url) => ({ url, kind: "image" })) });
    const folder = `${websiteId}/ideas/${item.id}`;
    const borrowed = file(`${folder}/ai.png`);
    await idea(websiteId, { media: [{ url: reused, kind: "image" }], assets: [{ url: borrowed, sceneIndex: 0 }] });
    await test.db
      .update(videoIdeas)
      .set({ videoUrl: file(`${folder}/v.mp4`), coverUrl: file(`${folder}/c.jpg`), voiceUrl: file(`${folder}/a.wav`), assets: [{ url: stock }, { url: borrowed }] })
      .where(eq(videoIdeas.id, item.id));
    storage.files = [`${folder}/v.mp4`, `${folder}/c.jpg`, `${folder}/a.wav`, `${folder}/ai.png`, `${folder}/orphan.mp4`];
    await deleteVideoIdeas(websiteId, [item.id]);
    const removed = new Set(storage.removed);
    expect([...removed].sort()).toEqual([`${folder}/v.mp4`, `${folder}/c.jpg`, `${folder}/a.wav`, `${folder}/orphan.mp4`, `${websiteId}/media/own.jpg`].sort());
    expect((await row(item.id)).filesDeletedAt).not.toBeNull();
  });

  it("leaves the files to the daily job when storage does not answer", async () => {
    const { websiteId } = await site();
    const item = await idea(websiteId, { status: "ready" });
    const path = `${websiteId}/ideas/${item.id}/v.mp4`;
    await test.db.update(videoIdeas).set({ videoUrl: file(path) }).where(eq(videoIdeas.id, item.id));
    storage.broken = true;
    expect(await deleteVideoIdeas(websiteId, [item.id])).toMatchObject({ ok: true, data: { deleted: [item.id] } });
    expect((await row(item.id)).filesDeletedAt).toBeNull();
    storage.broken = false;
    storage.files = [path];
    await deleteOldFiles(new Date(NOW.getTime() + 3 * HOUR));
    expect(storage.removed).toContain(path);
    expect((await row(item.id)).filesDeletedAt).not.toBeNull();
  });
});

describe("failures the customer does not see", () => {
  it("a failed make goes back to Today's ideas, its credit returned once, the real error kept", async () => {
    const { orgId, websiteId } = await site();
    await recordCredit(orgId, { type: "adjustment", amount: 1, note: "test" });
    const item = await idea(websiteId);
    await approveVideoIdea(websiteId, item.id);
    await claimMaking(item.id, "run_1");
    await failMaking(item.id, "voice_unavailable");
    await failMaking(item.id, "voice_unavailable");
    expect(await available(orgId)).toBe(1);
    const failed = await row(item.id);
    expect(failed).toMatchObject({ status: "failed", error: "voice_unavailable" });
    expect([customerStatus(failed), isReturned(failed), customerNote(failed.error)]).toEqual(["new", true, null]);
    expect(await ids(todaysIdeasWhere(websiteId, NOW))).toEqual([item.id]);
    expect(await ids(savedVideosWhere(websiteId, NOW))).toEqual([]);
    // Approved again: charged once more, under its own key, and it leaves the deck.
    expect(await approveVideoIdea(websiteId, item.id)).toMatchObject({ ok: true });
    expect(await available(orgId)).toBe(0);
    expect(await ids(todaysIdeasWhere(websiteId, NOW))).toEqual([]);
    expect(await ids(savedVideosWhere(websiteId, NOW))).toEqual([item.id]);
  });

  it("an idea of yesterday that failed is back for a day, can be skipped and brought back; older failures are gone", async () => {
    const { websiteId } = await site();
    const yesterday = await idea(websiteId, { day: "2026-11-23", status: "failed", error: "x", updatedAt: new Date(NOW.getTime() - 2 * HOUR) });
    await idea(websiteId, { day: "2026-11-10", status: "failed", error: "x", updatedAt: new Date(NOW.getTime() - 13 * DAY) });
    await idea(websiteId, { day: "2026-11-23", status: "new", updatedAt: NOW });
    expect(await ids(todaysIdeasWhere(websiteId, NOW))).toEqual([yesterday.id]);
    await skipVideoIdea(websiteId, yesterday.id);
    expect(await ids(todaysIdeasWhere(websiteId, NOW))).toEqual([]);
    await restoreVideoIdea(websiteId, yesterday.id);
    expect(await ids(todaysIdeasWhere(websiteId, NOW))).toEqual([yesterday.id]);
  });

  it("a failed publish is ready to publish again or by hand, never made and charged again", async () => {
    const { orgId, websiteId } = await site(["pinterest"]);
    await recordCredit(orgId, { type: "adjustment", amount: 1, note: "test" });
    const reason = "bundle.social POST /post/ failed (403): Monthly post limit reached. Limit for this month is 20 posts.";
    const item = await idea(websiteId, {
      status: "failed",
      error: `Pinterest: ${reason}`,
      videoUrl: "https://elsewhere.example/v.mp4",
      destinations: { pinterest: { status: "failed", bundlePostId: null, url: null, error: reason, attempts: 1 } },
    });
    expect([customerStatus(item), isReturned(item)]).toEqual(["ready", false]);
    expect(customerDestinations(item.destinations)).toEqual({});
    expect(await ids(savedVideosWhere(websiteId, NOW))).toEqual([item.id]);
    expect(await ids(todaysIdeasWhere(websiteId, NOW))).toEqual([]);
    expect(await approveVideoIdea(websiteId, item.id)).toEqual({ ok: false, error: "already_handled" });
    expect(await available(orgId)).toBe(1);
    expect(await markVideoPosted(websiteId, item.id, "pinterest", true)).toEqual({ ok: true, data: { status: "posted" } });
    // A carousel's files are its slides.
    expect(customerStatus({ status: "failed", videoUrl: null, slideUrls: ["a"] })).toBe("ready");
    expect(customerStatus({ status: "failed", videoUrl: null, slideUrls: [] })).toBe("new");
  });

  it("shows where a video is, and only that", () => {
    const raw = {
      instagram: { status: "posted", bundlePostId: "p", url: "https://i.example", error: "dropped tags", attempts: 1 },
      tiktok: { status: "failed", bundlePostId: null, url: null, error: "Server busy", attempts: 1 },
      x: { status: "skipped", bundlePostId: null, url: null, error: "x_limit_reached", attempts: 0 },
      youtube: { status: "posting", bundlePostId: "p", url: null, error: null, attempts: 1 },
    };
    const shown = customerDestinations(raw);
    expect(Object.keys(shown).sort()).toEqual(["instagram", "youtube"]);
    expect(JSON.stringify(shown)).not.toMatch(/busy|dropped|limit/);
    expect(customerNote("no_board · Pinterest: refused")).toBeNull();
    expect(customerNote("review_required")).toBe("review_required");
  });
});

describe("RepGet's own provider limits", () => {
  it("a limit reached while publishing leaves the video ready for the customer, the error for the team", async () => {
    const { websiteId } = await site(["instagram"]);
    vi.stubEnv("BUNDLE_SOCIAL_API_KEY", "test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/upload/")
          ? new Response(JSON.stringify({ id: "up_1" }), { status: 200 })
          : new Response(JSON.stringify({ message: "Monthly post limit reached. Limit for this month is 20 posts." }), { status: 403 }),
      ),
    );
    const item = await idea(websiteId, { status: "scheduled", scheduledFor: NOW, platforms: ["instagram"], videoUrl: "https://elsewhere.example/v.mp4" });
    expect((await publishVideo(item.id, NOW, { manual: true })).outcome).toBe("failed");
    const after = await row(item.id);
    expect(after.error).toMatch(/Instagram: .*Monthly post limit/);
    expect(customerStatus(after)).toBe("ready");
    const [account] = await test.db.select().from(socialAccounts).where(eq(socialAccounts.websiteId, websiteId));
    expect(account.pausedReason).toMatch(/Monthly post limit/);
    // A provider limit: started again by itself, and nothing for the customer to resume (lib/social/pause.ts).
    expect(pauseKind(account.pausedReason)).toBe("quota");
  });

  it("a post settled late is looked at again, and never overwrites a deleted video", async () => {
    const { websiteId } = await site(["instagram"]);
    vi.stubEnv("BUNDLE_SOCIAL_API_KEY", "test");
    vi.stubGlobal("fetch", bundleAnswers({ status: "POSTED", errors: null, externalData: { INSTAGRAM: { id: "1", permalink: "https://i.example/1" } } }));
    const posting = { status: "posting", platforms: ["instagram"], bundlePostId: "post_1", destinations: { instagram: { status: "posting", bundlePostId: "post_1", url: null, error: null, attempts: 1 } }, updatedAt: new Date(NOW.getTime() - 5 * HOUR) };
    const late = await idea(websiteId, posting);
    const gone = await idea(websiteId, posting);
    expect(await latePublishing(NOW)).toEqual(expect.arrayContaining([late.id, gone.id]));
    await deleteVideoIdeas(websiteId, [gone.id]);
    expect(await checkVideoPublished(gone.id, NOW)).toBe("skipped");
    expect(await checkVideoPublished(late.id, NOW)).toBe("posted");
    expect((await row(gone.id)).status).toBe("deleted");
    expect((await row(late.id)).status).toBe("posted");
  });
});

/** bundle.social: every upload and post accepted, every post read back as `post`. */
function bundleAnswers(post: Record<string, unknown>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url);
    if (path.includes("/upload/")) return new Response(JSON.stringify({ id: "up_1" }), { status: 200 });
    if (init?.method === "POST") return new Response(JSON.stringify({ id: "post_1", error: null, ...post }), { status: 200 });
    return new Response(JSON.stringify({ id: "post_1", error: null, ...post }), { status: 200 });
  });
}

describe("manual publishing with no account and no provider", () => {
  it("marks a ready video as posted, and takes it back", async () => {
    vi.stubEnv("BUNDLE_SOCIAL_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { websiteId } = await site();
    const item = await idea(websiteId, { status: "ready", videoUrl: "https://elsewhere.example/v.mp4" });
    expect(await markVideoPosted(websiteId, item.id, "youtube", true)).toEqual({ ok: true, data: { status: "posted" } });
    expect(await markVideoPosted(websiteId, item.id, "youtube", false)).toEqual({ ok: true, data: { status: "ready" } });
    expect(await saveYoutubeTags(websiteId, item.id, "a, b")).toEqual({ ok: true, data: { tags: "a, b" } });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("a Short's tags", () => {
  it("are kept with the idea, apart from its other overrides, which an edit leaves", async () => {
    const { websiteId } = await site();
    const item = await idea(websiteId, { overrides: { tone: "calm" } });
    expect(await saveYoutubeTags(websiteId, item.id, " seo, #SEO ,small   business,, ")).toEqual({ ok: true, data: { tags: "seo, small business" } });
    const saved = await row(item.id);
    expect(saved.overrides).toEqual({ tone: "calm", youtubeTags: "seo, small business" });
    expect(saved.updatedAt.getTime()).toBe(item.updatedAt.getTime());
    expect(await editVideoIdea(websiteId, item.id, { overrides: { audience: "owners" } })).toMatchObject({ ok: true });
    expect((await row(item.id)).overrides).toEqual({ audience: "owners", youtubeTags: "seo, small business" });
    // Emptied on purpose stays empty.
    expect(await saveYoutubeTags(websiteId, item.id, "")).toEqual({ ok: true, data: { tags: "" } });
    expect((await row(item.id)).overrides).toEqual({ audience: "owners", youtubeTags: "" });
    state.editor = false;
    expect(await saveYoutubeTags(websiteId, item.id, "x")).toEqual({ ok: false, error: "view_only" });
  });
});
