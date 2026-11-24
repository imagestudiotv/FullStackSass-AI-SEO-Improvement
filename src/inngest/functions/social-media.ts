import { inngest } from "@/inngest/client";
import { dailySuggestionWebsites } from "@/lib/social/daily";
import { abandonPublishing, checkPublished, publishSuggestion } from "@/lib/social/publish";
import { resumeQuotaPauses } from "@/lib/social/recover";
import { suggestForWebsite } from "@/lib/social/suggest";

/**
 * Social media (docs/social-media.md):
 *  - social-suggestions-daily: every morning, accounts paused only by our
 *    posting provider's limits are turned on again (recover.ts), then the
 *    websites due their suggestions get them, with or without connected
 *    accounts (daily.ts);
 *  - suggest-social: one website's suggestions (also queued when an account
 *    is connected, so the first ones arrive at once);
 *  - publish-social-post: one own post, published at its time and followed
 *    until the platform has it.
 */

export const socialSuggestionsDaily = inngest.createFunction(
  { id: "social-suggestions-daily", retries: 1, triggers: [{ cron: "0 7 * * *" }] },
  async ({ step, logger }) => {
    const resumed = await step.run("resume-quota-pauses", () => resumeQuotaPauses());
    if (resumed.length > 0) logger.info({ step: "resume-quota-pauses", resumed }, "Automatic posting resumed after a provider limit");
    const targets = await step.run("select-websites", () => dailySuggestionWebsites());
    if (targets.length === 0) {
      logger.info({ step: "select-websites", websiteCount: 0 }, "No websites due social suggestions");
      return { queued: 0 };
    }
    await step.sendEvent(
      "queue-suggestions",
      targets.map((websiteId) => ({ name: "social/suggest.requested", data: { websiteId, daily: true } })),
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
    const result = await step.run("suggest", () => suggestForWebsite(websiteId, {}, { daily: event.data.daily === true }));
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
      { step: "suggest", websiteId, created: result.created, scheduled: result.scheduled.length, reason: result.reason, discussions: result.discussions },
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
