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
import {
  automaticStatus,
  hasConnectedIntegration,
  pendingFirstArticle,
} from "@/lib/publishing/policy";
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
    onFailure: async ({ event, error, logger }) => {
      const articleId = event.data.event.data.articleId as string;

      /*
        The terminal record for this article: every retry is spent and the row
        is now "failed". Keyed by the same `articleId` as the rest of the
        function so one filter shows the whole generation history.
      */
      logger.error(
        { step: "on-failure", articleId, reason: error.message },
        "Generation failed after all retries - article marked failed",
      );

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
  async ({ event, step, logger }) => {
    const { articleId, organizationId } = event.data as {
      articleId: string;
      organizationId: string;
    };

    /**
     * Structured logs, one per step, so the Inngest timeline explains itself.
     *
     * This is the job behind "Writing your article…", and the UI only sees
     * `generationStep` — which says where it got to, never what it produced.
     * Each step records its counts, keyed by `articleId`, so a thin or
     * unlinked article can be traced to the stage that made it so.
     *
     * Article text never appears in these logs: only lengths and counts.
     */
    logger.info(
      { step: "start", articleId, organizationId },
      "Article generation started",
    );

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

      /**
       * Which inputs the brief actually has, not their contents.
       *
       * Brand voice and custom instructions are customer-written text, so they
       * stay out of the logs; what matters operationally is whether they were
       * found at all. An empty `relatedKeywords` here is what later produces
       * an article that covers one phrase instead of a topic, and this is the
       * step where that becomes visible.
       */
      logger.info(
        {
          step: "build-brief",
          articleId,
          websiteId: article.websiteId,
          calendarItemId: article.calendarItemId,
          hasTargetKeyword: Boolean(article.targetKeyword),
          relatedKeywords: relatedKeywords.length,
          relatedSample: relatedKeywords.slice(0, 8),
          hasBrandVoice: Boolean(voice),
          hasCustomInstructions: Boolean(customInstructions),
          // A pending backlink changes what the model is asked to write, so
          // its presence belongs in the timeline even though the URL does not.
          placementId: pending?.placementId ?? null,
        },
        "Brief built, status set to generating",
      );

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
          articleInstructions: voice?.articleInstructions ?? null,
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

          /*
            Article settings, read straight off the website row. These are
            what the settings screen writes, so a change there reaches the
            next article without anything else having to know about it.
          */
          articleStyle: site.articleStyle,
          targetWordCount: site.targetWordCount,
          internalLinkTarget: site.internalLinkTarget,
          tableOfContents: site.tableOfContents,
          authorPerspective: site.authorPerspective,
          mentionSimilarProducts: site.mentionSimilarProducts,
          imageStyle: site.imageStyle,
          imageBrief: site.imageBrief,
          imageInstructions: site.imageInstructions,
        } satisfies ArticleBrief,
        placementId: pending?.placementId ?? null,
      };
    });

    const outline = await step.run("write-outline", async () => {
      const startedAt = Date.now();
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

      /**
       * Section count is the strongest early signal of article quality: the
       * prompt asks for four to seven, and an outline that comes back with two
       * produces a short article for a reason nothing later in the run
       * records. durationMs separates a slow model call from a slow step.
       */
      logger.info(
        {
          step: "write-outline",
          articleId,
          websiteId: brief.websiteId,
          sections: result.sections.length,
          metaDescriptionChars: result.metaDescription.length,
          model: MODELS.GENERATION,
          durationMs: Date.now() - startedAt,
        },
        "Outline written",
      );

      return result;
    });

    const written = await step.run("write-body", async () => {
      const startedAt = Date.now();
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

      /**
       * Length, not text. The body is the customer's content and never belongs
       * in a log; `wordCount` and `htmlBytes` answer the only operational
       * question — whether the model produced a full article or a stub — and
       * a word count far below the ~1,000 the prompt targets is the thing
       * worth noticing here rather than after publication.
       */
      logger.info(
        {
          step: "write-body",
          articleId,
          websiteId: brief.websiteId,
          wordCount: result.wordCount,
          htmlBytes: result.bodyHtml.length,
          slug: result.slug,
          sections: outline.sections.length,
          model: MODELS.GENERATION,
          durationMs: Date.now() - startedAt,
        },
        "Article body written",
      );

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
      if (!isImageGenerationConfigured()) {
        /*
          Not an error: the article is written either way. Logged because an
          article arriving without a header image looks like a bug from the
          outside, and "no provider is configured" is the answer.
        */
        logger.warn(
          { step: "generate-image", articleId, websiteId: brief.websiteId },
          "Image generation not configured - article will have no header image",
        );
        return null;
      }

      const startedAt = Date.now();
      try {
        const generated = await generateArticleImage(
          brief.brief.title,
          brief.brief.industry,
          null,
          {
            style: brief.brief.imageStyle,
            brief: brief.brief.imageBrief,
            instructions: brief.brief.imageInstructions,
          },
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
        logger.info(
          {
            step: "generate-image",
            articleId,
            websiteId: brief.websiteId,
            contentType: generated.contentType,
            imageBytes: generated.data.length,
            costUsd: generated.costUsd,
            durationMs: Date.now() - startedAt,
          },
          "Header image generated",
        );

        return {
          base64: generated.data.toString("base64"),
          contentType: generated.contentType,
          alt: generated.alt,
        };
      } catch (error) {
        /*
          The swallow is the point of this log. The catch is deliberate — an
          image failure must not lose the writing — but it means a provider
          outage, an expired key or a content refusal all end as a silent
          `null` that nothing else in the run explains.
        */
        logger.warn(
          {
            step: "generate-image",
            articleId,
            websiteId: brief.websiteId,
            reason: error instanceof Error ? error.message : "unknown",
            durationMs: Date.now() - startedAt,
          },
          "Header image failed - continuing without one",
        );
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

      /*
        Zero links is a legitimate outcome on a site with nothing else crawled
        yet, but it is also what a broken link-target query looks like. Warning
        on it makes the two distinguishable instead of both being silence.
      */
      if (linked.length === 0) {
        logger.warn(
          {
            step: "add-internal-links",
            articleId,
            websiteId: brief.websiteId,
            linksAdded: 0,
          },
          "No internal links added - no matching crawled pages to link to",
        );
      } else {
        logger.info(
          {
            step: "add-internal-links",
            articleId,
            websiteId: brief.websiteId,
            linksAdded: linked.length,
            htmlBytes: html.length,
          },
          "Internal links added",
        );
      }

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

        /*
          The model was asked for this link and did not write it. No credit
          moves and the placement stays pending, which is correct — but it is
          also invisible: the requester keeps waiting on a link that was
          assigned to an article and then quietly dropped.
        */
        if (!included) {
          logger.warn(
            {
              step: "save-article",
              articleId,
              websiteId: brief.websiteId,
              placementId: brief.placementId,
            },
            "Backlink missing from the generated article - placement stays pending, no credit awarded",
          );
        }

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

            // Credits moving is a money event, so it gets its own line rather
            // than being inferred from the placement's status changing.
            logger.info(
              {
                step: "save-article",
                articleId,
                websiteId: brief.websiteId,
                placementId: brief.placementId,
                credits: placement.credits,
              },
              "Backlink verified in the article - placement marked live, credits moved",
            );
          }
        }
      }

      logger.info(
        {
          step: "save-article",
          articleId,
          websiteId: brief.websiteId,
          wordCount: written.wordCount,
          htmlBytes: linkedHtml.html.length,
          internalLinks: linkedHtml.count,
          hasImageAlt: Boolean(image?.alt),
          calendarItemId: brief.calendarItemId,
          versionsWritten: 1,
        },
        "Article saved as draft",
      );
    });

    /**
     * Publish by itself, when the customer asked for that.
     *
     * A separate step rather than part of save-article: publishing calls the
     * customer's CMS, and a failure there must not roll back an article that
     * was written successfully. The article stays a draft and they publish it
     * by hand, which is the same position they would be in with the setting
     * off.
     *
     * Read here rather than passed in the brief because the setting may have
     * been changed while the article was being written.
     */
    const autoPublished = await step.run("auto-publish", async () => {
      const [site] = await db
        .select({
          autoPublish: websites.autoPublish,
          publishAs: websites.publishAs,
        })
        .from(websites)
        .where(eq(websites.id, brief.websiteId))
        .limit(1);
      if (!site) return false;

      // What the customer chose: Live, or a draft in their CMS. Every direct
      // connection used to publish live regardless. See publishing/policy.ts.
      const status = automaticStatus(site);
      const connected = await hasConnectedIntegration(brief.websiteId);

      /**
       * The website's first article goes out now, whatever the setting.
       *
       * The client's rule: the first article after subscribing is published
       * automatically and immediately, with auto-publish on OR off, so the
       * customer sees the product work on their own site at once. Its
       * calendar date is not waited for either.
       *
       * Not connected yet: it waits, and goes the moment a website is
       * connected (connectIntegration and the daily release), or the
       * WordPress plugin collects it on its first check.
       */
      const first = await pendingFirstArticle(brief.websiteId);
      if (first?.id === articleId) {
        if (!connected) {
          logger.info(
            { step: "auto-publish", articleId, websiteId: brief.websiteId, first: true },
            "First article written - it goes out as soon as a website is connected",
          );
          return false;
        }
        await inngest.send({
          name: "article/publish.requested",
          data: { articleId, websiteId: brief.websiteId, organizationId, status },
        });
        logger.info(
          { step: "auto-publish", articleId, websiteId: brief.websiteId, first: true, status },
          "First article - publishing immediately, whatever the setting",
        );
        return true;
      }

      /**
       * Not before the day the calendar says.
       *
       * Articles are written ahead so finished work is always waiting - but
       * publishing inherited that head start, and the whole batch went live
       * the moment it was written. A customer looking at their plan saw
       * tomorrow's and the next day's articles already marked Published,
       * which is not a schedule at all.
       *
       * Compared by DATE, not by instant: the calendar stores noon on the
       * day, and a customer who plans an article "for the 24th" means the
       * day, not 12:00. Publishing at 06:00 on the 24th is on time; at 06:00
       * on the 23rd it is a day early.
       *
       * An article with no calendar item - written from the button, or
       * one-off - has no date to wait for and publishes as it always did.
       */
      if (brief.calendarItemId) {
        const [item] = await db
          .select({ scheduledFor: calendarItems.scheduledFor })
          .from(calendarItems)
          .where(eq(calendarItems.id, brief.calendarItemId))
          .limit(1);

        const due = item?.scheduledFor;
        if (due) {
          const startOfDay = (d: Date) =>
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

          if (startOfDay(new Date()) < startOfDay(due)) {
            logger.info(
              {
                step: "auto-publish",
                articleId,
                websiteId: brief.websiteId,
                scheduledFor: due.toISOString(),
              },
              "Written ahead of its date - holding as a draft until then",
            );
            return false;
          }
        }
      }

      if (!site.autoPublish) {
        logger.info(
          {
            step: "auto-publish",
            articleId,
            websiteId: brief.websiteId,
            autoPublish: false,
          },
          "Set to wait for review - article stays in RepGet",
        );
        return false;
      }

      if (!connected) {
        /*
          Auto-publish is ON and nothing happens. This is the branch that
          looks broken from the customer's side - they switched the setting on
          and their article still sits as a draft - so it is a warning rather
          than an info line. (A plugin-only site is served by the plugin's own
          queue instead; see lib/plugin/due.ts.)
        */
        logger.warn(
          {
            step: "auto-publish",
            articleId,
            websiteId: brief.websiteId,
            autoPublish: true,
          },
          "Auto-publish is on but no CMS is connected - article stays a draft",
        );
        return false;
      }

      await inngest.send({
        name: "article/publish.requested",
        data: { articleId, websiteId: brief.websiteId, organizationId, status },
      });

      logger.info(
        { step: "auto-publish", articleId, websiteId: brief.websiteId, autoPublish: true, status },
        "Publish requested for this article",
      );
      return true;
    });

    await step.run("notify-ready", async () => {
      await notify({
        organizationId,
        type: "article.ready",
        // The message says what actually happened. "Ready to review" on an
        // article already live on their website would be wrong.
        title: autoPublished
          ? `"${brief.brief.title}" is being published`
          : `"${brief.brief.title}" is ready to review`,
        body: autoPublished
          ? `${written.wordCount} words, going live on your website now.`
          : `${written.wordCount} words. Read it before publishing.`,
        href: `/websites/${brief.websiteId}/articles/${articleId}`,
      });
    });

    /**
     * The one line that answers "did this run produce a usable article".
     *
     * Every count that matters in a single record: if the word count is low,
     * or the image and internal links are missing, the step logs above say
     * which stage lost them.
     */
    logger.info(
      {
        step: "done",
        articleId,
        websiteId: brief.websiteId,
        wordCount: written.wordCount,
        sections: outline.sections.length,
        internalLinks: linkedHtml.count,
        hasImage: Boolean(image),
        autoPublished,
      },
      "Article generation complete",
    );

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

  const limit = await checkLimit(websiteId, "articles");
  if (!limit.allowed && !existing) {
    return {
      ok: false,
      error:
        limit.reason === "limit_reached"
          ? `Your plan includes ${limit.limit} articles per month (${limit.used} used)`
          : "This workspace has no active plan. Choose one to keep writing.",
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
