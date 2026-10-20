import { inngest } from "@/inngest/client";
import { translateLiveArticle, translationsDue } from "@/lib/articles/translations";
import { nudgePluginIfDue } from "@/lib/plugin/sync";

/**
 * Live articles in their website's other languages (lib/articles/
 * translations.ts; client, 2026-10-20). Every 20 minutes: the originals
 * still missing a chosen language, one translation per step - so a retry
 * never pays for one twice - then each website's plugin is asked to check
 * at once rather than at its next hourly check.
 */
export const translateLiveArticles = inngest.createFunction(
  {
    id: "translate-live-articles",
    retries: 1,
    concurrency: { limit: 1 },
    triggers: [{ cron: "*/20 * * * *" }],
  },
  async ({ step, logger }) => {
    const due = await step.run("select-translations", () => translationsDue());
    const websites = new Set<string>();
    let made = 0;
    for (const item of due) {
      const outcome = await step.run(`translate-${item.articleId}-${item.language}`, () => translateLiveArticle(item));
      logger.info({ step: "translate", articleId: item.articleId, websiteId: item.websiteId, language: item.language, ...outcome }, "Article translation");
      if (outcome.status === "made") {
        made += 1;
        websites.add(item.websiteId);
      }
    }
    for (const websiteId of websites) {
      await step.run(`nudge-${websiteId}`, () => nudgePluginIfDue(websiteId).catch(() => "unreachable" as const));
    }
    return { due: due.length, made };
  },
);
