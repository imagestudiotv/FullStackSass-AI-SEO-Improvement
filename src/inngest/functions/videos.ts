import { and, eq, inArray } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { videoIdeas, websites } from "@/lib/db/schema";
import { deleteOldFiles, refreshStats, videosToFollow } from "@/lib/video/followup";
import { suggestVideoIdeas } from "@/lib/video/ideas";
import { MAKE_WAIT } from "@/lib/video/formats";
import { chooseMusic, failMaking, finishMaking, makeCarousel, makeReelLocally, prepareVoice, reelProps } from "@/lib/video/make";
import { abandonVideoPublishing, checkVideoPublished, publishVideo } from "@/lib/video/publish";
import { collectReel, onVercel, reelRenderProgress, startReelRender, stopRender, type RenderHandle } from "@/lib/video/render";
import { storeVideoFile } from "@/lib/video/storage";

/**
 * Videos (docs/videos.md):
 *  - video-ideas-daily: every morning, each ready website with a plan gets
 *    its day's ideas (the Videos page also asks for them when opened);
 *  - suggest-video-ideas: one website's ideas, topped up to the day's 20;
 *  - make-video: an approved idea - voice, render, stored - ready;
 *  - publish-video: a ready video, published at its time and followed until
 *    the platforms have it;
 *  - video-followup-daily: the posted videos' numbers, the 1,000-views
 *    email, and old files deleted.
 */

export const videoIdeasDaily = inngest.createFunction(
  { id: "video-ideas-daily", retries: 1, triggers: [{ cron: "0 6 * * *" }] },
  async ({ step, logger }) => {
    // Websites that used videos in the last two weeks: the others get theirs when the page is opened.
    const targets = await step.run("select-websites", async () =>
      db
        .selectDistinct({ websiteId: videoIdeas.websiteId })
        .from(videoIdeas)
        .innerJoin(websites, eq(videoIdeas.websiteId, websites.id))
        .where(and(eq(websites.status, "ready"), inArray(videoIdeas.status, ["approved", "making", "ready", "scheduled", "posting", "posted", "skipped"]))),
    );
    if (targets.length > 0) {
      await step.sendEvent(
        "queue-ideas",
        targets.map((target) => ({ name: "video/ideas.requested", data: { websiteId: target.websiteId } })),
      );
    }
    logger.info({ step: "queue-ideas", websiteCount: targets.length }, "Video ideas queued");
    return { queued: targets.length };
  },
);

export const suggestVideoIdeasJob = inngest.createFunction(
  {
    id: "suggest-video-ideas",
    retries: 1,
    concurrency: { key: "event.data.websiteId", limit: 1 },
    triggers: [{ event: "video/ideas.requested" }],
  },
  async ({ event, step, logger }) => {
    const websiteId = String(event.data.websiteId);
    const result = await step.run("suggest", () => suggestVideoIdeas(websiteId));
    logger.info({ step: "suggest", websiteId, created: result.created, reason: result.reason }, "Video ideas written");
    return result;
  },
);

/** How often, and how long, a render is followed. */
const RENDER_CHECK_EVERY = "10s";
const RENDER_CHECKS = 90;

export const makeVideo = inngest.createFunction(
  {
    id: "make-video",
    retries: 2,
    concurrency: [{ key: "event.data.ideaId", limit: 1 }, { limit: 5 }],
    triggers: [{ event: "video/make.requested" }],
    onFailure: async ({ event, error }) => {
      const id = event.data.event.data?.ideaId;
      if (typeof id === "string") await failMaking(id, error.message || "The video could not be made");
    },
  },
  async ({ event, step, logger }) => {
    const id = String(event.data.ideaId);
    // Time for Undo (a make by mistake): an idea taken back is "new" again, and the claim skips it.
    await step.sleep("undo-window", MAKE_WAIT);
    const started = await step.run("claim", async () => {
      const [row] = await db
        .update(videoIdeas)
        .set({ status: "making", updatedAt: new Date() })
        .where(and(eq(videoIdeas.id, id), inArray(videoIdeas.status, ["approved", "making"])))
        .returning({ format: videoIdeas.format });
      return row ?? null;
    });
    if (!started) return { outcome: "skipped" };

    await step.run("voice", async () => {
      await prepareVoice(id);
      return null;
    });
    await step.run("music", async () => {
      const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
      await chooseMusic(idea);
      return null;
    });

    if (started.format === "carousel") {
      const slideUrls = await step.run("slides", async () => {
        const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
        return makeCarousel(idea);
      });
      const done = await step.run("finish", () => finishMaking(id, { slideUrls }));
      if (done.autoAt) await step.sendEvent("schedule", { name: "video/publish.scheduled", data: { ideaId: id, at: done.autoAt } });
      return { outcome: "ready", slides: slideUrls.length };
    }

    let videoUrl: string;
    if (!onVercel()) {
      videoUrl = await step.run("render-here", async () => {
        const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
        return makeReelLocally(idea);
      });
    } else {
      const handle: RenderHandle = await step.run("start-render", async () => {
        const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
        return startReelRender(await reelProps(idea));
      });
      let finished = false;
      for (let check = 1; check <= RENDER_CHECKS && !finished; check += 1) {
        await step.sleep(`wait-${check}`, RENDER_CHECK_EVERY);
        const state = await step.run(`check-${check}`, () => reelRenderProgress(handle));
        if (state.stage === "error") {
          await step.run("stop-render", () => stopRender(handle));
          throw new Error(state.message);
        }
        finished = state.stage === "done";
      }
      if (!finished) {
        await step.run("stop-render", () => stopRender(handle));
        throw new Error("The video took too long to make");
      }
      videoUrl = await step.run("collect", async () => {
        const [idea] = await db.select({ websiteId: videoIdeas.websiteId }).from(videoIdeas).where(eq(videoIdeas.id, id));
        return storeVideoFile(idea.websiteId, `ideas/${id}`, await collectReel(handle), "video/mp4");
      });
    }

    const done = await step.run("finish", () => finishMaking(id, { videoUrl }));
    if (done.autoAt) await step.sendEvent("schedule", { name: "video/publish.scheduled", data: { ideaId: id, at: done.autoAt } });
    logger.info({ step: "finish", ideaId: id, auto: Boolean(done.autoAt) }, "Video made");
    return { outcome: "ready" };
  },
);

const PUBLISH_CHECKS = 10;
const PUBLISH_CHECK_EVERY = "3m";

export const publishVideoJob = inngest.createFunction(
  {
    id: "publish-video",
    retries: 2,
    concurrency: { key: "event.data.ideaId", limit: 1 },
    triggers: [{ event: "video/publish.scheduled" }],
    onFailure: async ({ event }) => {
      const id = event.data.event.data?.ideaId;
      if (typeof id === "string") await abandonVideoPublishing(id);
    },
  },
  async ({ event, step, logger }) => {
    const id = String(event.data.ideaId);
    const at = new Date(String(event.data.at));
    if (at.getTime() > Date.now()) await step.sleepUntil("wait-until-due", at);

    // A video moved to another time meanwhile: that time's own event publishes it.
    const due = await step.run("still-due", async () => {
      const [row] = await db.select({ status: videoIdeas.status, at: videoIdeas.scheduledFor }).from(videoIdeas).where(eq(videoIdeas.id, id));
      return row?.status === "scheduled" && (!row.at || row.at.getTime() <= Date.now() + 60_000);
    });
    if (!due) return { outcome: "skipped" };

    const first = await step.run("publish", () => publishVideo(id));
    if (first.outcome === "later" && first.at) {
      await step.sendEvent("later", { name: "video/publish.scheduled", data: { ideaId: id, at: first.at } });
      return { outcome: "later" };
    }
    let outcome = first.outcome;
    for (let check = 1; outcome === "posting" && check <= PUBLISH_CHECKS; check += 1) {
      await step.sleep(`wait-${check}`, PUBLISH_CHECK_EVERY);
      outcome = await step.run(`check-${check}`, () => checkVideoPublished(id));
    }
    logger.info({ step: "publish", ideaId: id, outcome }, "Video publishing handled");
    return { outcome };
  },
);

export const videoFollowupDaily = inngest.createFunction(
  { id: "video-followup-daily", retries: 1, triggers: [{ cron: "30 8 * * *" }] },
  async ({ step, logger }) => {
    const ids = await step.run("select-videos", () => videosToFollow());
    for (const [index, id] of ids.entries()) await step.run(`stats-${index}`, () => refreshStats(id));
    const deleted = await step.run("delete-old-files", () => deleteOldFiles());
    logger.info({ step: "followup", followed: ids.length, filesDeleted: deleted }, "Video follow-up done");
    return { followed: ids.length, filesDeleted: deleted };
  },
);
