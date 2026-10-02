import { randomUUID } from "node:crypto";

import { and, eq, lt, notInArray, or, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";

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
import { articleAllowanceRule, checkLimit, PRICING, track } from "@/lib/usage";
import { backlinkRequests, placements } from "@/lib/db/schema";
import { markPlacementDrafted } from "@/lib/backlinks/placements";
import {
  linkGeneratedArticle,
  stripUnverifiedLinks,
  summarize,
} from "@/lib/articles/internal-links";
import { applyTableOfContents } from "@/lib/articles/toc";
import { checkReleasable, reviewStatusForNewDraft } from "@/lib/articles/review";
import { ArticleInFlightError, lockForEdit } from "@/lib/publishing/dispatch";
import {
  generateArticleImage,
  isImageGenerationConfigured,
} from "@/lib/images/generate";
import {
  automaticStatus,
  FIRST_ARTICLE_STATUS,
  hasConnectedIntegration,
  pendingFirstArticle,
} from "@/lib/publishing/policy";
import { describeArticleScene } from "@/lib/images/scene";
import { nudgePluginIfDue } from "@/lib/plugin/sync";
import { isImageStorageConfigured, storeArticleImage } from "@/lib/images/storage";
import { notify } from "@/lib/notifications/create";
import {
  paidCall,
  releaseUnspent,
  reserve,
  reserveAll,
  type Reservation,
} from "@/lib/billing/spend-quota";
import { requireEntitledForSpend } from "@/lib/billing/entitled";
import { deliverNow, enqueueJob } from "@/lib/jobs/outbox";

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

      /*
        Hands back only what was never spent. A run that paid for an outline
        and then failed on the body keeps its allowance consumed: failing is
        not the same as not spending. See lib/billing/spend-quota.ts.
      */
      await releaseUnspent(
        event.data.event.data.reservations as Reservation[] | undefined,
        "job_failed_before_spend",
      );

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
    const { articleId, organizationId, reservations } = event.data as {
      articleId: string;
      organizationId: string;
      /** Allowance this run was admitted under; absent on older events. */
      reservations?: Reservation[];
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

      /*
        Entitlement again, at the moment of spending. The queue checked it,
        but a subscription can be cancelled between queueing and running, and
        this is the last point before the model is paid. Not retried: waiting
        will not make a cancelled plan active.
      */
      const entitlement = await checkLimit(article.websiteId, "articles");
      if (
        entitlement.reason === "no_active_plan" ||
        entitlement.reason === "subscription_inactive"
      ) {
        throw new NonRetriableError(
          "This website's subscription is not active, so the article was not written.",
        );
      }

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
          comparisonTable: site.comparisonTable,
          imageStyle: site.imageStyle,
          imageBrief: site.imageBrief,
          imageInstructions: site.imageInstructions,
        } satisfies ArticleBrief,
        placementId: pending?.placementId ?? null,
      };
    });

    const outline = await step.run("write-outline", async () => {
      const startedAt = Date.now();
      // Entitlement and allowance re-checked HERE, inside the paid step, so a
      // retry after cancellation cannot replay build-brief's cached answer.
      const result = await paidCall(
        reservations,
        () => generateOutline(brief.brief),
        { beforeSpend: () => requireEntitledForSpend(brief.websiteId) },
      );

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
      const result = await paidCall(
        reservations,
        () => generateBody(brief.brief, outline),
        { beforeSpend: () => requireEntitledForSpend(brief.websiteId) },
      );

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
     * The header image: one that matches what the article is about, saved
     * with the article so it shows in the preview and goes out with it.
     *
     * The subject comes from the article itself - describeArticleScene reads
     * the title, headings and opening and describes one photograph - because
     * the client asked for an image that matches the content, and a prompt
     * built from the title alone matched the headline's words at best.
     *
     * SAVED HERE, and published as-is by every path: the WordPress plugin
     * sets it as the featured image, and a direct CMS upload uses these same
     * bytes. It used to be generated, logged and thrown away, so plugin posts
     * had no image and direct publishes paid for a second, different one.
     *
     * An article that already has an image keeps it: a rewrite must not
     * replace a picture the customer chose or uploaded. A failure never fails
     * the article - the writing is what they paid for.
     */
    const image = await step.run("generate-image", async () => {
      const [current] = await db
        .select({ imageUrl: articles.imageUrl, imageAlt: articles.imageAlt })
        .from(articles)
        .where(eq(articles.id, articleId))
        .limit(1);
      if (current?.imageUrl) {
        logger.info(
          { step: "generate-image", articleId, websiteId: brief.websiteId },
          "Article already has an image - keeping it",
        );
        return { url: current.imageUrl, alt: current.imageAlt ?? brief.brief.title };
      }

      if (!isImageGenerationConfigured() || !isImageStorageConfigured()) {
        /*
          Not an error: the article is written either way. Logged because an
          article arriving without a header image looks like a bug from the
          outside, and "not configured" is the answer.
        */
        logger.warn(
          {
            step: "generate-image",
            articleId,
            websiteId: brief.websiteId,
            generation: isImageGenerationConfigured(),
            storage: isImageStorageConfigured(),
          },
          "Image generation or storage not configured - article will have no header image",
        );
        return null;
      }

      const startedAt = Date.now();
      try {
        // Both calls are paid; a cancellation between them stops the second.
        const beforeSpend = () => requireEntitledForSpend(brief.websiteId);
        const scene = await paidCall(
          reservations,
          () =>
            describeArticleScene({
              title: brief.brief.title,
              targetKeyword: brief.brief.targetKeyword,
              industry: brief.brief.industry,
              country: brief.brief.country,
              bodyHtml: written.bodyHtml,
            }),
          { beforeSpend },
        );

        const generated = await paidCall(
          reservations,
          () =>
            generateArticleImage(brief.brief.title, brief.brief.industry, null, {
              style: brief.brief.imageStyle,
              brief: brief.brief.imageBrief,
              instructions: brief.brief.imageInstructions,
              scene: scene?.scene,
              alt: scene?.alt,
            }),
          { beforeSpend },
        );

        const url = await storeArticleImage(
          brief.websiteId,
          articleId,
          generated.data,
          generated.contentType,
        );

        await track(organizationId, {
          kind: "image",
          websiteId: brief.websiteId,
          provider: "image",
          costUsd: generated.costUsd,
          metadata: { purpose: "article_header", articleId },
        });

        logger.info(
          {
            step: "generate-image",
            articleId,
            websiteId: brief.websiteId,
            matchedToContent: Boolean(scene),
            imageBytes: generated.data.length,
            costUsd: generated.costUsd,
            durationMs: Date.now() - startedAt,
          },
          "Header image generated and saved",
        );

        return { url, alt: generated.alt };
      } catch (error) {
        /*
          The swallow is the point of this log. The catch is deliberate - an
          image failure must not lose the writing - but it means a provider
          outage, an expired key or a content refusal all end as a silent
          null that nothing else in the run explains.
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
     * Internal links are chosen here, never by the writer: asked to link, a
     * model invents "#" placeholders and paths the site never had. This
     * removes any link to the site it could not verify, then adds up to the
     * website's internalLinkTarget links to pages verified to exist and to be
     * about the same thing (lib/articles/internal-links.ts). No verified,
     * relevant page: no link, and the words stay as plain text.
     *
     * If checking itself fails, every unverified internal link is removed
     * instead - a failure can drop a link, never publish an invented one.
     */
    const linkedHtml = await step.run("add-internal-links", async () => {
      let html: string;
      let linked: unknown[];
      /*
        The contents list first, built from the real headings with unique ids
        (lib/articles/toc.ts), so the link checks below see - and keep - only
        section links that resolve.
      */
      const structured = applyTableOfContents(written.bodyHtml, {
        enabled: brief.brief.tableOfContents,
        language: brief.brief.language,
      });
      try {
        const result = await linkGeneratedArticle({
          websiteId: brief.websiteId,
          articleId,
          title: brief.brief.title,
          targetKeyword: brief.brief.targetKeyword ?? null,
          html: structured,
          internalLinkTarget: brief.brief.internalLinkTarget ?? 0,
          backlinkUrl: brief.brief.backlink?.url ?? null,
        });
        html = result.html;
        linked = result.inserted;
        const summary = summarize(result.findings, result.inserted.length);
        if (summary.unwrapped + summary.trimmed + summary.replaced > 0) {
          logger.info(
            { step: "add-internal-links", articleId, websiteId: brief.websiteId, ...summary },
            "Unverified links removed from the written article",
          );
        }
      } catch (error) {
        const [site] = await db
          .select({ url: websites.url, domain: websites.domain })
          .from(websites)
          .where(eq(websites.id, brief.websiteId))
          .limit(1);
        html = site ? stripUnverifiedLinks(structured, site, brief.brief.backlink?.url) : structured;
        linked = [];
        logger.warn(
          {
            step: "add-internal-links",
            articleId,
            websiteId: brief.websiteId,
            reason: error instanceof Error ? error.message : "unknown",
          },
          "Link checking failed - unverified internal links removed, none added",
        );
      }

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
          "No internal links added - no verified, relevant page on the site to link to",
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
      /*
        The managed Partner Network's review gate: a website accepting network
        links has every new draft held for the RepGet team, who place links
        and approve it before any publishing path may deliver it
        (lib/articles/review.ts). Decided now, from the website as it is
        today. A rewrite of an approved article is held again: it is new text.
      */
      await db.transaction(async (tx) => {
        // Decided in this transaction, under the managed-review lock: see reviewStatusForNewDraft.
        const reviewStatus = await reviewStatusForNewDraft(tx, brief.websiteId);
        await tx
          .update(articles)
          .set({
            reviewStatus,
            reviewApprovedAt: null,
            reviewApprovedBy: null,
            reviewApprovedHash: null,
            reviewVersion: sql`${articles.reviewVersion} + 1`,
            bodyHtml: linkedHtml.html,
            // Saved with the article; see the generate-image step.
            imageUrl: image?.url ?? null,
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
        await tx.insert(articleVersions).values({
          articleId,
          bodyHtml: linkedHtml.html,
      });
      });

      if (brief.calendarItemId) {
        await db
          .update(calendarItems)
          .set({ status: "generated", updatedAt: new Date() })
          .where(eq(calendarItems.id, brief.calendarItemId));
      }

      /**
       * A backlink the article was asked to carry.
       *
       * Written into the DRAFT is not placed: nothing is published yet, and
       * the host may never publish it. So no credits move here - they used
       * to, charging the requester and paying the host for a link that
       * existed only in our database. The placement is marked "drafted";
       * publication records its URL, and the verification job charges only
       * once it has SEEN the link live (lib/backlinks/placements.ts).
       *
       * Checked against the generated HTML: if the model omitted the link,
       * the placement stays pending for the next article.
       */
      if (brief.placementId && brief.brief.backlink) {
        const included = linkedHtml.html.includes(brief.brief.backlink.url);
        if (!included) {
          logger.warn(
            {
              step: "save-article",
              articleId,
              websiteId: brief.websiteId,
              placementId: brief.placementId,
            },
            "Backlink missing from the generated article - placement stays pending",
          );
        } else if (await markPlacementDrafted(brief.placementId, articleId)) {
          logger.info(
            {
              step: "save-article",
              articleId,
              websiteId: brief.websiteId,
              placementId: brief.placementId,
            },
            "Backlink written into the draft - charged only once it is seen live",
          );
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

      /*
        The managed Partner Network's review gate comes before everything
        else here - the first-article exception included. A held article is
        released by its approval (lib/admin/network.ts), not by this step.
      */
      const gate = await checkReleasable(articleId);
      if (!gate.ok) {
        logger.info(
          { step: "auto-publish", articleId, websiteId: brief.websiteId, reason: gate.reason },
          "Held for the RepGet team's review - released when approved",
        );
        return false;
      }

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
          // No CMS - the WordPress plugin may be connected instead. It pulls,
          // so ask it to collect now rather than at its next hourly check.
          const nudged = await nudgePluginIfDue(brief.websiteId);
          logger.info(
            { step: "auto-publish", articleId, websiteId: brief.websiteId, first: true, plugin: nudged },
            nudged === "synced"
              ? "First article - WordPress plugin collected it"
              : "First article written - it goes out as soon as a website is connected",
          );
          return nudged === "synced";
        }
        // Live, in every mode - the first article is the one exception.
        await inngest.send({
          name: "article/publish.requested",
          data: {
            articleId,
            websiteId: brief.websiteId,
            organizationId,
            status: FIRST_ARTICLE_STATUS,
            trigger: "first_article",
          },
        });
        logger.info(
          { step: "auto-publish", articleId, websiteId: brief.websiteId, first: true },
          "First article - publishing live immediately, whatever the setting",
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
        // A plugin-only site: the article is due now, so ask the plugin to
        // collect it now. See nudgePluginIfDue.
        const nudged = await nudgePluginIfDue(brief.websiteId);
        if (nudged === "synced") {
          logger.info(
            { step: "auto-publish", articleId, websiteId: brief.websiteId, plugin: nudged },
            "Due article - WordPress plugin collected it",
          );
          return true;
        }
        /*
          Auto-publish is ON and nothing happens. This is the branch that
          looks broken from the customer's side - they switched the setting on
          and their article still sits as a draft - so it is a warning rather
          than an info line.
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
        data: { articleId, websiteId: brief.websiteId, organizationId, status, trigger: "automatic" },
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
 * Rewrites of an existing article allowed per website per day, counted over
 * a sliding 24 hours.
 *
 * A rewrite creates no new article, so the monthly allowance never sees it:
 * before this, one article could be regenerated without end at a full
 * generation's cost each time. A rewrite that is refused or never dispatched
 * hands its slot back; one that reached the model keeps it, even if the run
 * later failed.
 */
export const REWRITES_PER_WEBSITE_PER_DAY = 10;

/**
 * How long an article may sit "queued" or "generating" before another request
 * may take it over. Generation takes a few minutes; this only matters when a
 * job died without reaching onFailure, which would otherwise pin the article
 * forever.
 */
const STALE_CLAIM_MS = 30 * 60 * 1000;

type QueueOutcome =
  | { ok: true; articleId: string }
  | { ok: false; error: string };

const NOT_ENTITLED =
  "This workspace has no active plan. Choose one to keep writing.";
const ALREADY_WRITING = "This article is already being written";

function isInactive(reason: string | null): boolean {
  return reason === "no_active_plan" || reason === "subscription_inactive";
}

/**
 * The organization that pays for a website: its OWNER.
 *
 * Read from the row rather than taken from the caller. An editor invited to
 * one site acts from their own workspace, and billing, usage and allowances
 * must land on the owner's.
 */
async function ownerOf(websiteId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: websites.organizationId })
    .from(websites)
    .where(eq(websites.id, websiteId))
    .limit(1);
  return row?.organizationId ?? null;
}

/**
 * The generation job for some work, recorded in the outbox (lib/jobs/
 * outbox.ts) inside the caller's transaction. Its id is derived from the
 * reservation, so a repeated delivery of the same work is de-duplicated by
 * Inngest rather than run twice.
 */
function generationJob(data: {
  articleId: string;
  websiteId: string;
  organizationId: string;
  reservations: Reservation[];
  /** For a requeue: what the row goes back to if the job can never be delivered. */
  previousStatus?: string;
}) {
  return {
    id: `article-generate:${data.reservations[0]?.id ?? data.articleId}`,
    name: "article/generate.requested",
    data,
  };
}

/**
 * Creates the article row for a calendar item and queues generation.
 *
 * Separate from the generation function so the limit check and row creation
 * happen once, in the caller's request, where an error can be shown — rather
 * than inside a background job the user cannot see.
 *
 * ENTITLEMENT FIRST, FOR EVERY PATH: an existing article is rewritten only on
 * a live plan, exactly like a new one.
 */
export async function queueArticleForCalendarItem(
  websiteId: string,
  calendarItemId: string,
): Promise<QueueOutcome> {
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

  const entitlement = await checkLimit(websiteId, "articles");
  if (isInactive(entitlement.reason)) {
    return { ok: false, error: NOT_ENTITLED };
  }

  // Reuse an existing article for this item rather than creating a second one.
  const [existing] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.calendarItemId, calendarItemId))
    .limit(1);

  if (existing) {
    return requeueArticle({ websiteId, articleId: existing.id, status: "queued" });
  }

  /**
   * A NEW article: one slot of this period's allowance, reserved in the same
   * transaction that creates the row.
   *
   * The allowance is a ledger entry, not the row: deleting the article later
   * does not give the slot back. The per-item lock stops two simultaneous
   * presses on one calendar item from creating two rows.
   */
  const created = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`article-item:${calendarItemId}`}, 0))`,
    );

    // Another request may have created it while this one waited.
    const [raced] = await tx
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.calendarItemId, calendarItemId))
      .limit(1);
    if (raced) return { ok: false as const, error: ALREADY_WRITING };

    const allowance = await articleAllowanceRule(websiteId, tx);
    if (!allowance.ok) return { ok: false as const, error: NOT_ENTITLED };

    /*
      The id is chosen here so the reservation can name the article it pays
      for: that is what keeps the historical baseline (usage.ts) from ever
      counting this article a second time.
    */
    const articleId = randomUUID();
    const slot = await reserve(
      allowance.rule,
      {
        operation: "article.generate",
        organizationId: allowance.organizationId,
        websiteId,
        subjectId: articleId,
        metadata: { calendarItemId, articleId },
      },
      { executor: tx },
    );
    if (!slot) {
      return {
        ok: false as const,
        error: `Your plan includes ${allowance.rule.limit} articles per month, and they have all been used.`,
      };
    }

    const [row] = await tx
      .insert(articles)
      .values({
        id: articleId,
        websiteId,
        calendarItemId,
        title: item.title,
        targetKeyword: item.targetKeyword,
        status: "queued",
      })
      .returning({ id: articles.id });

    /*
      The job is recorded in the same transaction as the article and its
      reservation: the three commit together or not at all, so there is no
      moment at which an article is "queued" with nothing behind it.
    */
    const job = generationJob({
      articleId: row.id,
      websiteId,
      organizationId: allowance.organizationId,
      reservations: [slot],
    });
    await enqueueJob(tx, job);
    return { ok: true as const, articleId: row.id, eventId: job.id };
  });
  if (!created.ok) return created;

  /*
    Delivered now if the queue is up. If not, the work is accepted all the
    same - the article shows "queued" - and the outbox retries delivery; if
    it can never be delivered the slot is returned and the article marked
    failed (outbox giveUp).
  */
  await deliverNow(created.eventId);
  return { ok: true, articleId: created.articleId };
}

/**
 * Queues another generation of an article that already exists: a retry, a
 * regeneration or a refresh.
 *
 * Three guards, in order:
 *  1. entitlement — a live subscription, whatever state the article is in;
 *  2. a rewrite slot, reserved atomically before anything is queued
 *     (REWRITES_PER_WEBSITE_PER_DAY);
 *  3. an atomic claim of the row. The UPDATE matches only while the article
 *     is not already queued or generating, and Postgres re-checks that after
 *     a concurrent press's write, so of two simultaneous presses exactly one
 *     queues a job.
 */
export async function requeueArticle(input: {
  websiteId: string;
  articleId: string;
  /** What the row shows while waiting: a refresh shows "generating" at once. */
  status: "queued" | "generating";
}): Promise<QueueOutcome> {
  const { websiteId, articleId } = input;

  const entitlement = await checkLimit(websiteId, "articles");
  if (isInactive(entitlement.reason)) {
    return { ok: false, error: NOT_ENTITLED };
  }
  const organizationId = await ownerOf(websiteId);
  if (!organizationId) return { ok: false, error: "Article not found" };

  // Scoped by website as well as id: an id alone came from the client.
  const [current] = await db
    .select({ status: articles.status })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.websiteId, websiteId)))
    .limit(1);
  if (!current) return { ok: false, error: "Article not found" };

  const slot = await reserveAll(
    [
      {
        key: `article-rewrite:${websiteId}`,
        limit: REWRITES_PER_WEBSITE_PER_DAY,
        window: { seconds: 24 * 60 * 60 },
      },
    ],
    {
      operation: "article.rewrite",
      organizationId,
      websiteId,
      metadata: { articleId },
    },
  );
  if (!slot.ok) {
    return {
      ok: false,
      error: `This website has rewritten ${REWRITES_PER_WEBSITE_PER_DAY} articles in the last day. Try again later.`,
    };
  }

  const job = generationJob({
    articleId,
    websiteId,
    organizationId,
    reservations: slot.reservations,
    // If the job can never be delivered, a draft goes back to being a draft.
    previousStatus: current.status,
  });
  const claimed = await db.transaction(async (tx) => {
    /*
      A rewrite replaces what the article delivers, so it waits while a
      revision is being sent to the site (lib/publishing/dispatch.ts).
    */
    try {
      await lockForEdit(tx, articleId);
    } catch (error) {
      if (error instanceof ArticleInFlightError) return "in_flight" as const;
      throw error;
    }
    const rows = await tx
      .update(articles)
      .set({
        status: input.status,
        error: null,
        generationStep: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(articles.id, articleId),
          eq(articles.websiteId, websiteId),
          or(
            notInArray(articles.status, ["queued", "generating"]),
            lt(articles.updatedAt, new Date(Date.now() - STALE_CLAIM_MS)),
          ),
        ),
      )
      .returning({ id: articles.id });
    // The claim and its job commit together (lib/jobs/outbox.ts).
    if (rows.length > 0) await enqueueJob(tx, job);
    return rows.length > 0;
  });

  if (claimed === "in_flight") {
    await releaseUnspent(slot.reservations, "already_running");
    return { ok: false, error: new ArticleInFlightError().message };
  }
  if (!claimed) {
    await releaseUnspent(slot.reservations, "already_running");
    return { ok: false, error: ALREADY_WRITING };
  }

  await deliverNow(job.id);
  return { ok: true, articleId };
}
