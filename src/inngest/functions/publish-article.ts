import { and, desc, eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { articles, publishLogs, websites } from "@/lib/db/schema";
import { loadCredentials } from "@/lib/publishing/credentials";
import { notify } from "@/lib/notifications/create";
import { markFirstArticleSent } from "@/lib/publishing/policy";
import {
  generateArticleImage,
  isImageGenerationConfigured,
} from "@/lib/images/generate";
import { ProviderError } from "@/lib/publishing/provider";
import { getProvider } from "@/lib/publishing/registry";

/**
 * Publishes an article to the connected WordPress site.
 *
 * Runs as a job rather than in the request: the customer's site may be slow,
 * and a publish that takes twenty seconds must not block a form. Every attempt
 * writes a publish_logs row, success or failure, so "did it publish?" has a
 * recorded answer rather than depending on someone watching at the time.
 */

export const publishArticleJob = inngest.createFunction(
  {
    id: "publish-article",
    retries: 2,
    triggers: [{ event: "article/publish.requested" }],
    // One publish per article: two concurrent runs would create two posts.
    concurrency: { key: "event.data.articleId", limit: 1 },
    onFailure: async ({ event, error, logger }) => {
      const articleId = event.data.event.data.articleId as string;

      /*
        The terminal record for this publish: every retry is spent and the
        article is not live on the customer's site. Keyed by the same
        `articleId` as the rest of the function.
      */
      logger.error(
        { step: "on-failure", articleId, reason: error.message },
        "Publish failed after all retries - article is not live",
      );

      await db.insert(publishLogs).values({
        articleId,
        status: "failed",
        error: error.message.slice(0, 500),
      });
      await db
        .update(articles)
        .set({ error: error.message.slice(0, 500), updatedAt: new Date() })
        .where(eq(articles.id, articleId));

      /**
       * Worth telling them about even more than a generation failure: the
       * customer believes their article is live on their own website, and it
       * is not.
       */
      const websiteId = event.data.event.data.websiteId as string | undefined;
      await notify({
        organizationId: event.data.event.data.organizationId as string,
        type: "article.failed",
        title: "An article could not be published",
        body: error.message.slice(0, 200),
        href: websiteId
          ? `/websites/${websiteId}/articles/${articleId}`
          : null,
      });
    },
  },
  async ({ event, step, logger }) => {
    const { articleId, websiteId, status } = event.data as {
      articleId: string;
      websiteId: string;
      organizationId: string;
      status: "publish" | "draft";
    };

    /**
     * Structured logs, one per step, so the Inngest timeline explains itself.
     *
     * `publish_logs` already records the outcome, but only the outcome: when a
     * publish stalls or lands somewhere unexpected, these lines say which
     * stage it reached and what the customer's CMS did about it. Credentials
     * are never logged — only the provider id and the integration row id.
     */
    logger.info(
      { step: "start", articleId, websiteId, requestedStatus: status },
      "Publish started",
    );

    const prepared = await step.run("load-article", async () => {
      const [article] = await db
        .select()
        .from(articles)
        .where(and(eq(articles.id, articleId), eq(articles.websiteId, websiteId)))
        .limit(1);
      if (!article) throw new Error(`Article ${articleId} not found`);
      if (!article.bodyHtml) throw new Error("Article has no content to publish");

      // Industry lives on the website, and steers the header image prompt.
      const [site] = await db
        .select({ industry: websites.industry })
        .from(websites)
        .where(eq(websites.id, websiteId))
        .limit(1);

      const integration = await loadCredentials(websiteId);
      if (!integration) throw new Error("No publishing integration is connected");

      /**
       * A previous successful publish means this is an UPDATE, not a new post.
       * Without this check, re-publishing an edited article would leave the
       * original live and create a duplicate competing with it — which is the
       * exact SEO problem the product exists to avoid.
       */
      const [previous] = await db
        .select({ remoteId: publishLogs.remoteId })
        .from(publishLogs)
        .where(
          and(
            eq(publishLogs.articleId, articleId),
            eq(publishLogs.status, "published"),
          ),
        )
        .orderBy(desc(publishLogs.createdAt))
        .limit(1);

      /**
       * `isUpdate` is the field to check when a customer reports a duplicate
       * post: it says whether this run decided to update an existing remote
       * post or create a new one, which is the decision that produces two
       * competing URLs when it goes wrong. Credentials are deliberately
       * absent — only the provider name and the integration row id.
       */
      logger.info(
        {
          step: "load-article",
          articleId,
          websiteId,
          integrationId: integration.integrationId,
          providerId: integration.providerId,
          isUpdate: Boolean(previous?.remoteId),
          htmlBytes: article.bodyHtml.length,
          hasSlug: Boolean(article.slug),
          hasExcerpt: Boolean(article.metaDescription),
        },
        "Article and integration loaded",
      );

      return {
        integrationId: integration.integrationId,
        providerId: integration.providerId,
        credentials: integration.credentials,
        remoteId: previous?.remoteId ?? null,
        // Used to steer the header image toward the customer's sector.
        industry: site?.industry ?? null,
        post: {
          title: article.title,
          contentHtml: article.bodyHtml,
          slug: article.slug,
          excerpt: article.metaDescription,
          status,
        },
      };
    });

    /**
     * The header image is generated here rather than carried from article
     * generation: image bytes are far too large to hold in a job result, and
     * provider URLs expire within hours. Uploading to the customer's own
     * media library is what makes the image permanent.
     *
     * Entirely optional. No provider, or a failure, publishes the article
     * without an image rather than not publishing it.
     */
    const featuredMedia = await step.run("upload-image", async () => {
      if (!isImageGenerationConfigured()) {
        /*
          Not an error: the post goes up either way. Logged because a post
          appearing without its header image looks like a bug from the
          outside, and "no provider is configured" is the answer.
        */
        logger.warn(
          { step: "upload-image", articleId, websiteId },
          "Image generation not configured - publishing without a header image",
        );
        return null;
      }

      const startedAt = Date.now();
      try {
        const generated = await generateArticleImage(
          prepared.post.title,
          prepared.industry,
        );
        const provider = getProvider(prepared.providerId);
        // Not every CMS takes uploads. Shopify and the webhook adapter both
        // reference an image by URL instead, so publishing continues without
        // one rather than failing on a step that is optional by design.
        if (!provider?.uploadMedia) {
          // Expected for these providers, so info rather than warn — but it
          // does mean an image was generated and paid for, then discarded.
          logger.info(
            {
              step: "upload-image",
              articleId,
              websiteId,
              providerId: prepared.providerId,
              imageBytes: generated.data.length,
            },
            "Provider does not support media upload - publishing without a header image",
          );
          return null;
        }

        const media = await provider.uploadMedia(prepared.credentials, {
          data: generated.data,
          contentType: generated.contentType,
          filename: `${prepared.post.slug ?? "header"}.png`,
          alt: generated.alt,
        });

        logger.info(
          {
            step: "upload-image",
            articleId,
            websiteId,
            providerId: prepared.providerId,
            mediaId: media.id,
            imageBytes: generated.data.length,
            costUsd: generated.costUsd,
            durationMs: Date.now() - startedAt,
          },
          "Header image uploaded to the customer's media library",
        );
        return { id: media.id, url: media.url };
      } catch (error) {
        /*
          The swallow is the point of this log. The catch is deliberate — an
          image must not block a publish — but it hides generation failures
          and CMS upload rejections alike behind the same silent `null`.
        */
        logger.warn(
          {
            step: "upload-image",
            articleId,
            websiteId,
            providerId: prepared.providerId,
            reason: error instanceof Error ? error.message : "unknown",
            durationMs: Date.now() - startedAt,
          },
          "Header image failed - publishing without one",
        );
        return null;
      }
    });

    const result = await step.run("send-to-cms", async () => {
      const provider = getProvider(prepared.providerId);
      if (!provider) {
        /*
          An integration row naming a provider the registry does not have.
          This throws, but the error alone does not say which provider id was
          stored, which is the one fact needed to fix the row.
        */
        logger.error(
          {
            step: "send-to-cms",
            articleId,
            websiteId,
            providerId: prepared.providerId,
          },
          "No provider registered for this integration - cannot publish",
        );
        throw new Error(
          `No integration named ${prepared.providerId} is available`,
        );
      }

      const startedAt = Date.now();
      try {
        const sent = prepared.remoteId
          ? await provider.updatePost(prepared.credentials, prepared.remoteId, {
              ...prepared.post,
              featuredMediaId: featuredMedia?.id ?? null,
            })
          : await provider.createPost(prepared.credentials, {
              ...prepared.post,
              featuredMediaId: featuredMedia?.id ?? null,
            });

        /**
         * `returnedStatus` is read back from the CMS rather than assumed: a
         * WordPress site can accept a publish and store it as a draft (an
         * editorial workflow plugin, or a user without publish rights), and
         * the customer is then told their article is live when it is not.
         */
        logger.info(
          {
            step: "send-to-cms",
            articleId,
            websiteId,
            providerId: prepared.providerId,
            operation: prepared.remoteId ? "update" : "create",
            remoteId: sent.remoteId,
            requestedStatus: status,
            returnedStatus: sent.status,
            durationMs: Date.now() - startedAt,
          },
          "Article sent to the CMS",
        );
        return sent;
      } catch (error) {
        if (error instanceof ProviderError) {
          /*
            `kind` is what separates bad credentials from a site that is down
            or rejecting the post — three very different fixes that otherwise
            reach the timeline as the same "publish failed".
          */
          logger.error(
            {
              step: "send-to-cms",
              articleId,
              websiteId,
              providerId: prepared.providerId,
              operation: prepared.remoteId ? "update" : "create",
              kind: error.kind,
              reason: error.message,
              durationMs: Date.now() - startedAt,
            },
            "CMS rejected the article",
          );

          // Recorded with the reason so the UI can show something actionable
          // rather than "publish failed".
          await db.insert(publishLogs).values({
            articleId,
            integrationId: prepared.integrationId,
            status: "failed",
            error: `${error.kind}: ${error.message}`.slice(0, 500),
          });
          throw new Error(error.message);
        }
        throw error;
      }
    });

    await step.run("record-result", async () => {
      await db.insert(publishLogs).values({
        articleId,
        integrationId: prepared.integrationId,
        status: "published",
        remoteId: result.remoteId,
        remoteUrl: result.remoteUrl,
      });

      await db
        .update(articles)
        .set({
          // A WordPress draft is not live, so the article is not "published".
          status: result.status === "publish" ? "published" : "draft",
          publishedUrl: result.remoteUrl,
          // The CMS's own URL, which does not expire the way the provider's
          // does. Left untouched when no image was uploaded this run.
          ...(featuredMedia ? { imageUrl: featuredMedia.url } : {}),
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(articles.id, articleId));

      /*
        The website's first article is out. Record it, so the first-article
        rule never fires again, and - only for the call that recorded it -
        start writing the next two days' articles now rather than at the next
        scheduled run: "the first article published immediately, and then the
        other next-2-day articles". See lib/publishing/policy.ts.
      */
      if (await markFirstArticleSent(websiteId)) {
        await inngest.send({ name: "articles/scheduled.requested", data: { websiteId } });
      }

      logger.info(
        {
          step: "record-result",
          articleId,
          websiteId,
          remoteId: result.remoteId,
          remoteUrl: result.remoteUrl,
          storedStatus: result.status === "publish" ? "published" : "draft",
          imageUrlUpdated: Boolean(featuredMedia),
          rowsWritten: 1,
        },
        "Publish result recorded",
      );
    });

    await step.run("notify-published", async () => {
      const live = result.status === "publish";
      await notify({
        organizationId: event.data.organizationId as string,
        type: "article.published",
        // A WordPress draft is not live, and saying otherwise would have the
        // customer believing a page exists that nobody can visit.
        title: live
          ? `"${prepared.post.title}" is live`
          : `"${prepared.post.title}" was saved as a draft`,
        body: live ? result.remoteUrl : "Publish it from WordPress when ready.",
        href: `/websites/${websiteId}/articles/${articleId}`,
      });
    });

    /**
     * The one line that answers "is this article actually live".
     *
     * `requestedStatus` and `finalStatus` are logged side by side because they
     * can legitimately differ — a CMS may downgrade a publish to a draft — and
     * that gap is exactly what a customer reporting "you said it was live"
     * needs to be visible.
     */
    logger.info(
      {
        step: "done",
        articleId,
        websiteId,
        requestedStatus: status,
        finalStatus: result.status,
        remoteUrl: result.remoteUrl,
        hasImage: Boolean(featuredMedia),
      },
      "Publish complete",
    );

    return { articleId, remoteUrl: result.remoteUrl, status: result.status };
  },
);
