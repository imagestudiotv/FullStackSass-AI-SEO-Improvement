import { eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { videoIdeas } from "@/lib/db/schema";
import { deleteOldFiles, refreshStats, videosToFollow } from "@/lib/video/followup";
import { abandonVideoPublishing, checkVideoPublished, publishVideo } from "@/lib/video/publish";

/** Split from videos.ts (2026-11-12) so each part has one owner; docs/videos.md. */

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
    /*
      The customer's own Publish (lib/video/publish-actions.ts): a review that
      became required holds only automatic posts. Absent = automatic (the make
      job's event), the safe side.
    */
    const manual = event.data.manual === true;
    if (at.getTime() > Date.now()) await step.sleepUntil("wait-until-due", at);

    // A video moved to another time meanwhile: that time's own event publishes it.
    const due = await step.run("still-due", async () => {
      const [row] = await db.select({ status: videoIdeas.status, at: videoIdeas.scheduledFor }).from(videoIdeas).where(eq(videoIdeas.id, id));
      return row?.status === "scheduled" && (!row.at || row.at.getTime() <= Date.now() + 60_000);
    });
    if (!due) return { outcome: "skipped" };

    const first = await step.run("publish", () => publishVideo(id, new Date(), { manual }));
    if (first.outcome === "later" && first.at) {
      await step.sendEvent("later", { name: "video/publish.scheduled", data: { ideaId: id, at: first.at, manual } });
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
