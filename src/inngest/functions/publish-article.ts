import { and, desc, eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { articles, publishLogs, websites } from "@/lib/db/schema";
import { loadCredentials } from "@/lib/publishing/actions";
import { notify } from "@/lib/notifications/create";
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
    onFailure: async ({ event, error }) => {
      const articleId = event.data.event.data.articleId as string;
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
  async ({ event, step }) => {
    const { articleId, websiteId, status } = event.data as {
      articleId: string;
      websiteId: string;
      organizationId: string;
      status: "publish" | "draft";
    };

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
      if (!isImageGenerationConfigured()) return null;

      try {
        const generated = await generateArticleImage(
          prepared.post.title,
          prepared.industry,
        );
        const provider = getProvider(prepared.providerId);
        // Not every CMS takes uploads. Shopify and the webhook adapter both
        // reference an image by URL instead, so publishing continues without
        // one rather than failing on a step that is optional by design.
        if (!provider?.uploadMedia) return null;

        const media = await provider.uploadMedia(prepared.credentials, {
          data: generated.data,
          contentType: generated.contentType,
          filename: `${prepared.post.slug ?? "header"}.png`,
          alt: generated.alt,
        });
        return { id: media.id, url: media.url };
      } catch {
        return null;
      }
    });

    const result = await step.run("send-to-cms", async () => {
      const provider = getProvider(prepared.providerId);
      if (!provider) {
        throw new Error(
          `No integration named ${prepared.providerId} is available`,
        );
      }

      try {
        return prepared.remoteId
          ? await provider.updatePost(prepared.credentials, prepared.remoteId, {
              ...prepared.post,
              featuredMediaId: featuredMedia?.id ?? null,
            })
          : await provider.createPost(prepared.credentials, {
              ...prepared.post,
              featuredMediaId: featuredMedia?.id ?? null,
            });
      } catch (error) {
        if (error instanceof ProviderError) {
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

    return { articleId, remoteUrl: result.remoteUrl, status: result.status };
  },
);
