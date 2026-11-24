import { NonRetriableError } from "inngest";
import { eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { videoIdeas } from "@/lib/db/schema";
import { MAKE_WAIT } from "@/lib/video/formats";
import {
  chooseMusic,
  claimMaking,
  coverRequest,
  failMaking,
  finishMaking,
  hasRepgetMusic,
  holdProductionBudget,
  holdSecondRender,
  isMaking,
  makeCarousel,
  makeNoMusicVersion,
  makeReelLocally,
  prepareAssets,
  prepareVoice,
  ProductionError,
  recordRender,
  reelProps,
  storeCover,
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
 *
 * A render that breaks is made once more, on the voice and pictures already
 * there and only within the video's budget: no AI call and no credit twice.
 * A video its customer deletes meanwhile stops before the next step.
 */

/** How often, and how long, a render is followed. */
const RENDER_CHECK_EVERY = "10s";
const RENDER_CHECKS = 90;
/** The first render, and one more when it broke. */
const RENDER_ATTEMPTS = 2;

/**
 * Runs a step's work, turning a ProductionError into a failure Inngest does
 * not retry - and not at all once the video was deleted (failMaking then
 * changes nothing: it is not being made any more).
 */
async function final<T>(id: string, work: () => Promise<T>): Promise<T> {
  if (!(await isMaking(id))) throw new NonRetriableError("The video is not being made any more");
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

    await step.run("budget", () => final(id, () => holdProductionBudget(id)));
    const assets = await step.run("assets", () => final(id, () => prepareAssets(id)));
    if (assets.notes.length) logger.info({ ideaId: id, notes: assets.notes }, "Video assets");
    await step.run("voice", () =>
      final(id, async () => {
        await prepareVoice(id);
        return null;
      }),
    );
    await step.run("music", async () => {
      await chooseMusic(await loadIdea(id));
      return null;
    });

    if (started.format === "carousel") {
      const slideUrls = await step.run("slides", () => final(id, async () => makeCarousel(await loadIdea(id))));
      const done = await step.run("finish", () => finishMaking(id, { slideUrls }));
      if (done.autoAt) await step.sendEvent("schedule", { name: "video/publish.scheduled", data: { ideaId: id, at: done.autoAt } });
      return { outcome: "ready", slides: slideUrls.length };
    }

    let videoUrl: string;
    let altVideoUrl: string | null = null;
    let coverUrl: string | null = null;
    let localCopy = false;
    if (!onVercel()) {
      const local = await step.run("render-here", () => final(id, async () => makeReelLocally(await loadIdea(id))));
      videoUrl = local.videoUrl;
      coverUrl = local.coverUrl;
      localCopy = wantsNoMusicCopy(await loadIdea(id));
    } else {
      const stop = async (handle: RenderHandle) => {
        await stopRender(handle);
        await recordRender(id, handle.startedAt ? Date.now() - handle.startedAt : null, handle.vcpus ?? 4);
      };
      let rendered: RenderHandle | null = null;
      for (let attempt = 1; attempt <= RENDER_ATTEMPTS && !rendered; attempt += 1) {
        // The first attempt keeps the step names a run started before 2026-11-24 knows.
        const name = (id: string) => (attempt === 1 ? id : `${id}-again`);
        const handle: RenderHandle = await step.run(name("start-render"), () => final(id, async () => startReelRender(await reelProps(await loadIdea(id)))));
        let broke: string | null = null;
        for (let check = 1; check <= RENDER_CHECKS && !rendered && !broke; check += 1) {
          await step.sleep(name(`wait-${check}`), RENDER_CHECK_EVERY);
          const state = await step.run(name(`check-${check}`), async () => ((await isMaking(id)) ? reelRenderProgress(handle) : { stage: "deleted" as const }));
          if (state.stage === "deleted") {
            await step.run(name("stop-render"), () => stop(handle));
            return { outcome: "deleted" };
          }
          if (state.stage === "error") broke = state.message || "The render machine stopped";
          else if (state.stage === "done") rendered = handle;
        }
        if (rendered) break;
        await step.run(name("stop-render"), () => stop(handle));
        // Too long would be too long again; a break is worth one more try, when the budget has room for it.
        if (!broke) throw new NonRetriableError("The video took too long to make");
        const again = attempt < RENDER_ATTEMPTS && (await step.run("hold-second-render", () => holdSecondRender(id)));
        if (!again) throw new NonRetriableError(broke);
        logger.warn({ ideaId: id, error: broke }, "The render broke: made once more");
      }
      if (!rendered) throw new NonRetriableError("The video could not be rendered");
      const handle = rendered;
      const collected = await step.run("collect", async () => {
        const idea = await loadIdea(id);
        if (idea.status === "deleted") {
          await stop(handle);
          return null;
        }
        // The cover still is made on the same machine before it stops: its seconds are in the render's runtime.
        const result = await collectRender(handle, wantsNoMusicCopy(idea) ? { voiceUrl: idea.voiceUrl, durationMs: idea.durationMs ?? 0 } : null, coverRequest(await reelProps(idea)));
        await recordRender(id, result.runtimeMs, result.vcpus);
        const url = await storeVideoFile(idea.websiteId, `ideas/${id}`, result.video, "video/mp4");
        const alt = result.noMusic ? await storeNoMusicVersion(id, result.noMusic) : null;
        const cover = await storeCover(id, idea.websiteId, result.cover, result.coverError);
        return { url, alt, altError: result.noMusicError, cover };
      });
      if (!collected) return { outcome: "deleted" };
      videoUrl = collected.url;
      altVideoUrl = collected.alt;
      coverUrl = collected.cover;
      if (collected.altError) logger.warn({ ideaId: id, error: collected.altError }, "The version without music was not made");
    }

    const done = await step.run("finish", () => finishMaking(id, { videoUrl, altVideoUrl, coverUrl }));
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
