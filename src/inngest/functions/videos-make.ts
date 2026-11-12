import { NonRetriableError } from "inngest";
import { eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { videoIdeas } from "@/lib/db/schema";
import { MAKE_WAIT } from "@/lib/video/formats";
import {
  chooseMusic,
  claimMaking,
  failMaking,
  finishMaking,
  hasRepgetMusic,
  holdProductionBudget,
  makeCarousel,
  makeNoMusicVersion,
  makeReelLocally,
  prepareAssets,
  prepareVoice,
  ProductionError,
  recordRender,
  reelProps,
  storeNoMusicVersion,
} from "@/lib/video/make";
import { collectRender, onVercel, reelRenderProgress, startReelRender, stopRender, type RenderHandle } from "@/lib/video/render";
import { storeVideoFile } from "@/lib/video/storage";

/**
 * Making a video (split from videos.ts 2026-11-12 so each part has one
 * owner; docs/videos.md): claim -> budget -> pictures and clips -> voice
 * (none for Text + Music) -> music -> render (reel/Story) or slides
 * (carousel) -> store -> finish. A step that cannot succeed by trying again
 * (over budget, unsupported voice language, too long, no footage) fails at
 * once; onFailure gives the credit back. The cost ledger keeps every attempt.
 */

/** How often, and how long, a render is followed. */
const RENDER_CHECK_EVERY = "10s";
const RENDER_CHECKS = 90;

/** Runs a step's work, turning a ProductionError into a failure Inngest does not retry. */
async function final<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ProductionError) throw new NonRetriableError(error.message);
    throw error;
  }
}

async function loadIdea(id: string) {
  const [idea] = await db.select().from(videoIdeas).where(eq(videoIdeas.id, id));
  if (!idea) throw new NonRetriableError("The idea is gone");
  return idea;
}

/** Whether to make the version without RepGet's music with the render: it has our music and goes to Instagram (native audio). */
function wantsNoMusicCopy(idea: Awaited<ReturnType<typeof loadIdea>>): boolean {
  return hasRepgetMusic(idea) && (idea.platforms ?? []).includes("instagram");
}

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
  async ({ event, step, logger, runId }) => {
    const id = String(event.data.ideaId);
    // Time for Undo (a make by mistake): an idea taken back is "new" again, and the claim skips it.
    await step.sleep("undo-window", MAKE_WAIT);
    // Only one run makes an idea: a duplicate event finds it claimed by another run and stops.
    const started = await step.run("claim", () => claimMaking(id, runId));
    if (!started) return { outcome: "skipped" };

    await step.run("budget", () => final(() => holdProductionBudget(id)));
    const assets = await step.run("assets", () => final(() => prepareAssets(id)));
    if (assets.notes.length) logger.info({ ideaId: id, notes: assets.notes }, "Video assets");
    await step.run("voice", () =>
      final(async () => {
        await prepareVoice(id);
        return null;
      }),
    );
    await step.run("music", async () => {
      await chooseMusic(await loadIdea(id));
      return null;
    });

    if (started.format === "carousel") {
      const slideUrls = await step.run("slides", async () => makeCarousel(await loadIdea(id)));
      const done = await step.run("finish", () => finishMaking(id, { slideUrls }));
      if (done.autoAt) await step.sendEvent("schedule", { name: "video/publish.scheduled", data: { ideaId: id, at: done.autoAt } });
      return { outcome: "ready", slides: slideUrls.length };
    }

    let videoUrl: string;
    let altVideoUrl: string | null = null;
    let localCopy = false;
    if (!onVercel()) {
      videoUrl = await step.run("render-here", async () => makeReelLocally(await loadIdea(id)));
      localCopy = wantsNoMusicCopy(await loadIdea(id));
    } else {
      const handle: RenderHandle = await step.run("start-render", async () => startReelRender(await reelProps(await loadIdea(id))));
      let finished = false;
      for (let check = 1; check <= RENDER_CHECKS && !finished; check += 1) {
        await step.sleep(`wait-${check}`, RENDER_CHECK_EVERY);
        const state = await step.run(`check-${check}`, () => reelRenderProgress(handle));
        if (state.stage === "error") {
          await step.run("stop-render", async () => {
            await stopRender(handle);
            await recordRender(id, handle.startedAt ? Date.now() - handle.startedAt : null, handle.vcpus ?? 4);
          });
          throw new Error(state.message);
        }
        finished = state.stage === "done";
      }
      if (!finished) {
        await step.run("stop-render", async () => {
          await stopRender(handle);
          await recordRender(id, handle.startedAt ? Date.now() - handle.startedAt : null, handle.vcpus ?? 4);
        });
        throw new Error("The video took too long to make");
      }
      const collected = await step.run("collect", async () => {
        const idea = await loadIdea(id);
        const result = await collectRender(handle, wantsNoMusicCopy(idea) ? { voiceUrl: idea.voiceUrl, durationMs: idea.durationMs ?? 0 } : null);
        await recordRender(id, result.runtimeMs, result.vcpus);
        const url = await storeVideoFile(idea.websiteId, `ideas/${id}`, result.video, "video/mp4");
        const alt = result.noMusic ? await storeNoMusicVersion(id, result.noMusic) : null;
        return { url, alt, altError: result.noMusicError };
      });
      videoUrl = collected.url;
      altVideoUrl = collected.alt;
      if (collected.altError) logger.warn({ ideaId: id, error: collected.altError }, "The version without music was not made");
    }

    const done = await step.run("finish", () => finishMaking(id, { videoUrl, altVideoUrl }));
    if (localCopy) {
      // Development: the version without music, remuxed on this machine (best effort).
      await step.run("no-music", async () => {
        try {
          return await makeNoMusicVersion(id);
        } catch (error) {
          logger.warn({ ideaId: id, error: (error as Error).message }, "The version without music was not made");
          return null;
        }
      });
    }
    if (done.autoAt) await step.sendEvent("schedule", { name: "video/publish.scheduled", data: { ideaId: id, at: done.autoAt } });
    logger.info({ step: "finish", ideaId: id, auto: Boolean(done.autoAt) }, "Video made");
    return { outcome: "ready" };
  },
);
