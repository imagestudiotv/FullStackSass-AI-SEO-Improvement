import { and, eq, inArray } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { videoIdeas } from "@/lib/db/schema";
import { MAKE_WAIT } from "@/lib/video/formats";
import { chooseMusic, failMaking, finishMaking, makeCarousel, makeReelLocally, prepareVoice, reelProps } from "@/lib/video/make";
import { collectReel, onVercel, reelRenderProgress, startReelRender, stopRender, type RenderHandle } from "@/lib/video/render";
import { storeVideoFile } from "@/lib/video/storage";

/** Split from videos.ts (2026-11-12) so each part has one owner; docs/videos.md. */

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

