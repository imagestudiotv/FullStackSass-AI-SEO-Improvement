import { and, eq, inArray } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { videoIdeas, websites } from "@/lib/db/schema";
import { suggestVideoIdeas } from "@/lib/video/ideas";

/** Split from videos.ts (2026-11-12) so each part has one owner; docs/videos.md. */

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

