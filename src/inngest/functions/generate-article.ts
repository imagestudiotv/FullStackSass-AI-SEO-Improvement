import { and, eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { MODELS } from "@/lib/ai/client";
import { db } from "@/lib/db";
import {
  articles,
  articleVersions,
  brandVoice,
  calendarItems,
  keywords,
  websites,
} from "@/lib/db/schema";
import {
  generateBody,
  generateOutline,
  type ArticleBrief,
} from "@/lib/articles/generate";
import { checkLimit, PRICING, track } from "@/lib/usage";

/**
 * Article generation.
 *
 * The most expensive job in the product, so the step boundaries matter more
 * here than anywhere else: outline and body are separate steps, and a failure
 * writing the body replays with the outline's memoised result rather than
 * paying for it twice. `generationStep` is written as it goes so the UI can
 * show real progress on a job that takes about a minute.
 */

export const generateArticle = inngest.createFunction(
  {
    id: "generate-article",
    retries: 2,
    triggers: [{ event: "article/generate.requested" }],
    // One generation per article. Without this a double-click bills twice and
    // both runs race to write the same row.
    concurrency: { key: "event.data.articleId", limit: 1 },
    onFailure: async ({ event, error }) => {
      const articleId = event.data.event.data.articleId as string;
      await db
        .update(articles)
        .set({
          status: "failed",
          // Surfaced in the UI so a user can see why and retry.
          error: error.message.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(articles.id, articleId));
    },
  },
  async ({ event, step }) => {
    const { articleId, organizationId } = event.data as {
      articleId: string;
      organizationId: string;
    };

    const brief = await step.run("build-brief", async () => {
      const [article] = await db
        .select()
        .from(articles)
        .where(eq(articles.id, articleId))
        .limit(1);
      if (!article) throw new Error(`Article ${articleId} not found`);

      const [site] = await db
        .select()
        .from(websites)
        .where(eq(websites.id, article.websiteId))
        .limit(1);
      if (!site) throw new Error(`Website ${article.websiteId} not found`);

      /**
       * Related keywords come from the article's cluster. They are what makes
       * the article cover a topic rather than a single phrase, which is the
       * whole point of clustering in the first place.
       */
      let relatedKeywords: string[] = [];
      if (article.targetKeyword) {
        const [pillar] = await db
          .select({ clusterId: keywords.clusterId })
          .from(keywords)
          .where(
            and(
              eq(keywords.websiteId, article.websiteId),
              eq(keywords.term, article.targetKeyword),
            ),
          )
          .limit(1);

        if (pillar?.clusterId) {
          const siblings = await db
            .select({ term: keywords.term })
            .from(keywords)
            .where(eq(keywords.clusterId, pillar.clusterId));
          relatedKeywords = siblings
            .map((row) => row.term)
            .filter((term) => term !== article.targetKeyword)
            .slice(0, 8);
        }
      }

      const [voice] = await db
        .select({ tone: brandVoice.tone, avoid: brandVoice.avoid })
        .from(brandVoice)
        .where(eq(brandVoice.websiteId, article.websiteId))
        .limit(1);

      let customInstructions: string | null = null;
      if (article.calendarItemId) {
        const [item] = await db
          .select({ instructions: calendarItems.customInstructions })
          .from(calendarItems)
          .where(eq(calendarItems.id, article.calendarItemId))
          .limit(1);
        customInstructions = item?.instructions ?? null;
      }

      await db
        .update(articles)
        .set({
          status: "generating",
          generationStep: "outline",
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(articles.id, articleId));

      return {
        websiteId: article.websiteId,
        calendarItemId: article.calendarItemId,
        brief: {
          title: article.title,
          targetKeyword: article.targetKeyword ?? article.title,
          intent: null,
          relatedKeywords,
          brandName: site.brandName,
          industry: site.industry,
          country: site.country,
          language: site.language,
          description: site.description,
          targetAudience: site.targetAudience,
          services: Array.isArray(site.services)
            ? (site.services as string[])
            : [],
          customInstructions,
          tone: voice?.tone ?? null,
          avoid: voice?.avoid ?? null,
        } satisfies ArticleBrief,
      };
    });

    const outline = await step.run("write-outline", async () => {
      const result = await generateOutline(brief.brief);

      const price = PRICING.llm[MODELS.GENERATION];
      await track(organizationId, {
        kind: "llm",
        websiteId: brief.websiteId,
        provider: "anthropic",
        model: MODELS.GENERATION,
        costUsd: 1 * price.inputPer1k + 1.2 * price.outputPer1k,
        metadata: { purpose: "article_outline", articleId },
      });

      await db
        .update(articles)
        .set({ generationStep: "body", updatedAt: new Date() })
        .where(eq(articles.id, articleId));

      return result;
    });

    const written = await step.run("write-body", async () => {
      const result = await generateBody(brief.brief, outline);

      const price = PRICING.llm[MODELS.GENERATION];
      // Roughly 2k in / 2.5k out for a 1,000-word article.
      await track(organizationId, {
        kind: "llm",
        websiteId: brief.websiteId,
        provider: "anthropic",
        model: MODELS.GENERATION,
        costUsd: 2 * price.inputPer1k + 2.5 * price.outputPer1k,
        metadata: {
          purpose: "article_body",
          articleId,
          words: result.wordCount,
        },
      });

      return result;
    });

    await step.run("save-article", async () => {
      await db
        .update(articles)
        .set({
          bodyHtml: written.bodyHtml,
          metaDescription: written.metaDescription,
          slug: written.slug,
          wordCount: written.wordCount,
          status: "draft",
          generationStep: null,
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(articles.id, articleId));

      /**
       * First version snapshot. Every later edit adds another, so a user who
       * regenerates or edits badly can see what the original said.
       */
      await db.insert(articleVersions).values({
        articleId,
        bodyHtml: written.bodyHtml,
      });

      if (brief.calendarItemId) {
        await db
          .update(calendarItems)
          .set({ status: "generated", updatedAt: new Date() })
          .where(eq(calendarItems.id, brief.calendarItemId));
      }
    });

    return {
      articleId,
      words: written.wordCount,
      sections: outline.sections.length,
    };
  },
);

/**
 * Creates the article row for a calendar item and queues generation.
 *
 * Separate from the generation function so the limit check and row creation
 * happen once, in the caller's request, where an error can be shown — rather
 * than inside a background job the user cannot see.
 */
export async function queueArticleForCalendarItem(
  organizationId: string,
  websiteId: string,
  calendarItemId: string,
): Promise<{ ok: true; articleId: string } | { ok: false; error: string }> {
  const [item] = await db
    .select()
    .from(calendarItems)
    .where(
      and(
        eq(calendarItems.id, calendarItemId),
        eq(calendarItems.websiteId, websiteId),
      ),
    )
    .limit(1);
  if (!item) return { ok: false, error: "Calendar item not found" };

  // Reuse an existing article for this item rather than creating a second one.
  const [existing] = await db
    .select({ id: articles.id, status: articles.status })
    .from(articles)
    .where(eq(articles.calendarItemId, calendarItemId))
    .limit(1);

  if (existing && existing.status === "generating") {
    return { ok: false, error: "This article is already being written" };
  }

  const limit = await checkLimit(organizationId, "articles");
  if (!limit.allowed && !existing) {
    return {
      ok: false,
      error:
        limit.reason === "limit_reached"
          ? `Your plan includes ${limit.limit} articles per month (${limit.used} used)`
          : "This workspace has no active subscription",
    };
  }

  let articleId: string;
  if (existing) {
    articleId = existing.id;
  } else {
    const [created] = await db
      .insert(articles)
      .values({
        websiteId,
        calendarItemId,
        title: item.title,
        targetKeyword: item.targetKeyword,
        status: "queued",
      })
      .returning({ id: articles.id });
    articleId = created.id;
  }

  await inngest.send({
    name: "article/generate.requested",
    data: { articleId, organizationId },
  });

  return { ok: true, articleId };
}
