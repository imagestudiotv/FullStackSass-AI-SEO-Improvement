import { and, eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { socialAccounts, websites } from "@/lib/db/schema";
import { abandonPublishing, checkPublished, publishSuggestion } from "@/lib/social/publish";
import { suggestForWebsite } from "@/lib/social/suggest";

/**
 * Social media (docs/social-media.md):
 *  - social-suggestions-daily: every morning, each website with a connected
 *    account gets its day's suggestions;
 *  - suggest-social: one website's suggestions (also queued when an account
 *    is connected, so the first ones arrive at once);
 *  - publish-social-post: one own post, published at its time and followed
 *    until the platform has it.
 */

export const socialSuggestionsDaily = inngest.createFunction(
  { id: "social-suggestions-daily", retries: 1, triggers: [{ cron: "0 7 * * *" }] },
  async ({ step, logger }) => {
    const targets = await step.run("select-websites", async () =>
      db
        .selectDistinct({ websiteId: socialAccounts.websiteId })
        .from(socialAccounts)
        .innerJoin(websites, eq(socialAccounts.websiteId, websites.id))
        .where(and(eq(websites.status, "ready"))),
    );
    if (targets.length === 0) {
      logger.info({ step: "select-websites", websiteCount: 0 }, "No websites with social accounts");
      return { queued: 0 };
    }
    await step.sendEvent(
      "queue-suggestions",
      targets.map((target) => ({ name: "social/suggest.requested", data: { websiteId: target.websiteId } })),
    );
    logger.info({ step: "queue-suggestions", websiteCount: targets.length }, "Social suggestions queued");
    return { queued: targets.length };
  },
);

export const suggestSocial = inngest.createFunction(
  {
    id: "suggest-social",
    retries: 1,
    concurrency: { key: "event.data.websiteId", limit: 1 },
    triggers: [{ event: "social/suggest.requested" }],
  },
  async ({ event, step, logger }) => {
    const websiteId = String(event.data.websiteId);
    const result = await step.run("suggest", () => suggestForWebsite(websiteId));
    if (result.scheduled.length > 0) {
      await step.sendEvent(
        "schedule-posts",
        result.scheduled.map((post) => ({
          name: "social/post.scheduled",
          data: { suggestionId: post.id, at: new Date(post.at).toISOString() },
        })),
      );
    }
    logger.info(
      { step: "suggest", websiteId, created: result.created, scheduled: result.scheduled.length, reason: result.reason },
      "Social suggestions written",
    );
    return { created: result.created, scheduled: result.scheduled.length, reason: result.reason ?? null };
  },
);

/** How often, and how long, a post bundle.social accepted is followed. */
const CHECKS = 6;
const CHECK_EVERY = "2m";

export const publishSocialPost = inngest.createFunction(
  {
    id: "publish-social-post",
    retries: 2,
    concurrency: { key: "event.data.suggestionId", limit: 1 },
    triggers: [{ event: "social/post.scheduled" }],
    onFailure: async ({ event }) => {
      const id = event.data.event.data?.suggestionId;
      if (typeof id === "string") await abandonPublishing(id);
    },
  },
  async ({ event, step, logger }) => {
    const id = String(event.data.suggestionId);
    const at = new Date(String(event.data.at));
    if (at.getTime() > Date.now()) await step.sleepUntil("wait-until-due", at);

    let outcome = await step.run("publish", () => publishSuggestion(id));
    for (let check = 1; outcome === "posting" && check <= CHECKS; check += 1) {
      await step.sleep(`wait-${check}`, CHECK_EVERY);
      outcome = await step.run(`check-${check}`, () => checkPublished(id));
    }
    logger.info({ step: "publish", suggestionId: id, outcome }, "Social post handled");
    return { outcome };
  },
);
