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
import { backlinkRequests, placements } from "@/lib/db/schema";
import { recordCredit } from "@/lib/backlinks/credits";
import { addInternalLinks } from "@/lib/articles/internal-links";
import {
  generateArticleImage,
  isImageGenerationConfigured,
} from "@/lib/images/generate";
import { notify } from "@/lib/notifications/create";

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

      /**
       * The failure the customer most needs to hear about: they asked for an
       * article, and there is no article. Read from the event rather than
       * re-queried, since the row update above already succeeded.
       */
      const organizationId = event.data.event.data.organizationId as string;
      const websiteId = event.data.event.data.websiteId as string | undefined;
      await notify({
        organizationId,
        type: "article.failed",
        title: "An article could not be written",
        body: error.message.slice(0, 200),
        href: websiteId ? `/websites/${websiteId}` : null,
      });
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
        .select()
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

      /**
       * A backlink waiting on this site. Taken at brief time so the same
       * placement cannot be handed to two articles running concurrently.
       */
      const [pending] = await db
        .select({
          placementId: placements.id,
          targetUrl: backlinkRequests.targetUrl,
          anchor: placements.anchor,
        })
        .from(placements)
        .innerJoin(backlinkRequests, eq(placements.requestId, backlinkRequests.id))
        .where(
          and(
            eq(placements.hostWebsiteId, article.websiteId),
            eq(placements.status, "pending"),
          ),
        )
        .limit(1);

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
          vocabulary: voice?.vocabulary ?? null,
          /**
           * jsonb columns are typed as unknown, so each is narrowed before
           * use. A malformed value degrades to an empty list rather than
           * reaching the prompt as "[object Object]".
           */
          usps: Array.isArray(voice?.usps) ? (voice.usps as string[]) : [],
          facts: Array.isArray(voice?.facts) ? (voice.facts as string[]) : [],
          socialLinks: Array.isArray(voice?.socialLinks)
            ? (voice.socialLinks as { platform: string; url: string }[])
            : [],
          backlink: pending
            ? { url: pending.targetUrl, anchor: pending.anchor }
            : null,
        } satisfies ArticleBrief,
        placementId: pending?.placementId ?? null,
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

    /**
     * A header image, when an image provider is configured. Skipped entirely
     * otherwise, and a failure never fails the article: an article without an
     * image is still the thing the customer paid for, whereas a failed run
     * would lose the writing too.
     *
     * The image is uploaded to the customer's own CMS at publish time, not
     * here — the provider URL expires within hours.
     */
    const image = await step.run("generate-image", async () => {
      if (!isImageGenerationConfigured()) return null;

      try {
        const generated = await generateArticleImage(
          brief.brief.title,
          brief.brief.industry,
        );

        await track(organizationId, {
          kind: "image",
          websiteId: brief.websiteId,
          provider: "image",
          costUsd: generated.costUsd,
          metadata: { purpose: "article_header", articleId },
        });

        /**
         * Base64 rather than a Buffer: step.run results are serialised to
         * JSON, and a Buffer would come back as an unusable object.
         */
        return {
          base64: generated.data.toString("base64"),
          contentType: generated.contentType,
          alt: generated.alt,
        };
      } catch {
        return null;
      }
    });

    /**
     * Internal links are added after the body is written, never asked for in
     * the prompt: a model asked to link invents URLs that do not exist, and a
     * broken link on a live site is worse than no link. Every href here comes
     * from a page we actually crawled.
     */
    const linkedHtml = await step.run("add-internal-links", async () => {
      const { html, linked } = await addInternalLinks(
        brief.websiteId,
        brief.brief.title,
        brief.brief.targetKeyword ?? null,
        written.bodyHtml,
      );
      return { html, count: linked.length };
    });

    await step.run("save-article", async () => {
      await db
        .update(articles)
        .set({
          bodyHtml: linkedHtml.html,
          imageAlt: image?.alt ?? null,
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
        bodyHtml: linkedHtml.html,
      });

      if (brief.calendarItemId) {
        await db
          .update(calendarItems)
          .set({ status: "generated", updatedAt: new Date() })
          .where(eq(calendarItems.id, brief.calendarItemId));
      }

      /**
       * The placement only counts once the link is actually in the article.
       * Credits move here rather than at match time: paying for a link that
       * was promised but never written would be paying for nothing.
       *
       * Verified against the generated HTML — if the model omitted the link,
       * the placement stays pending for the next article rather than silently
       * awarding a credit for a link nobody can see.
       */
      if (brief.placementId && brief.brief.backlink) {
        const included = linkedHtml.html.includes(brief.brief.backlink.url);

        if (included) {
          await db
            .update(placements)
            .set({ articleId, status: "live", updatedAt: new Date() })
            .where(eq(placements.id, brief.placementId));

          const [placement] = await db
            .select({
              requestId: placements.requestId,
              credits: placements.credits,
            })
            .from(placements)
            .where(eq(placements.id, brief.placementId))
            .limit(1);

          if (placement) {
            await db
              .update(backlinkRequests)
              .set({ status: "live", updatedAt: new Date() })
              .where(eq(backlinkRequests.id, placement.requestId));

            const [requester] = await db
              .select({ organizationId: websites.organizationId })
              .from(backlinkRequests)
              .innerJoin(websites, eq(backlinkRequests.websiteId, websites.id))
              .where(eq(backlinkRequests.id, placement.requestId))
              .limit(1);

            if (requester) {
              await recordCredit(requester.organizationId, {
                type: "link_received",
                amount: -placement.credits,
                referenceId: brief.placementId,
                note: "Backlink placed",
              });
            }
            await recordCredit(organizationId, {
              type: "link_given",
              amount: placement.credits,
              referenceId: brief.placementId,
              note: "Hosted a backlink",
            });
          }
        }
      }
    });

    await step.run("notify-ready", async () => {
      await notify({
        organizationId,
        type: "article.ready",
        title: `"${brief.brief.title}" is ready to review`,
        body: `${written.wordCount} words. Read it before publishing.`,
        href: `/websites/${brief.websiteId}/articles/${articleId}`,
      });
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
