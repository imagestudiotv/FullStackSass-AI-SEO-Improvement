import { and, desc, eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { articles, publishLogs } from "@/lib/db/schema";
import { loadCredentials } from "@/lib/publishing/actions";
import {
  publishPost,
  updatePost,
  WordPressError,
} from "@/lib/publishing/wordpress";

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

      const integration = await loadCredentials(websiteId);
      if (!integration) throw new Error("WordPress is not connected");

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
        credentials: integration.credentials,
        remoteId: previous?.remoteId ?? null,
        post: {
          title: article.title,
          contentHtml: article.bodyHtml,
          slug: article.slug,
          excerpt: article.metaDescription,
          status,
        },
      };
    });

    const result = await step.run("send-to-wordpress", async () => {
      try {
        return prepared.remoteId
          ? await updatePost(prepared.credentials, prepared.remoteId, prepared.post)
          : await publishPost(prepared.credentials, prepared.post);
      } catch (error) {
        if (error instanceof WordPressError) {
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
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(articles.id, articleId));
    });

    return { articleId, remoteUrl: result.remoteUrl, status: result.status };
  },
);
