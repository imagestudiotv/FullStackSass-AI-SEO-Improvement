import { and, asc, eq, isNotNull, isNull, lte, or, sql as raw } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, calendarItems, publishLogs, websites } from "@/lib/db/schema";
import { isFirstArticle } from "@/lib/publishing/policy";

/**
 * Articles the WordPress plugin should create now, for one website.
 *
 * Only articles that are DUE, with the post status to create them as.
 *
 * This used to hand over every written article that was not yet live, and
 * the plugin published each one on its next check - so articles written two
 * days ahead went live early, a site with auto-publish OFF published anyway,
 * and "Publish as: Draft" was ignored. The plugin must follow exactly the
 * rules the direct WordPress connection follows (see publishDueDrafts in
 * inngest/functions/scheduled-articles.ts):
 *
 *  - it is the website's FIRST article, which goes out as soon as it is
 *    written whatever the setting (lib/publishing/policy.ts), or
 *  - somebody pressed Publish on it (publish_requested), or
 *  - the site has auto-publish on AND the article's planned date has come -
 *    an article with no planned date is due as soon as it is written.
 *
 * The status comes from the Publish press, or else the site's "Publish as"
 * setting. Plugins before 1.3.2 ignore it and always publish live; they
 * still only receive due articles.
 */
export function dueArticlesForPlugin(
  websiteId: string,
  limit: number,
  now: Date = new Date(),
) {
  return db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      bodyHtml: articles.bodyHtml,
      metaDescription: articles.metaDescription,
      imageUrl: articles.imageUrl,
      imageAlt: articles.imageAlt,
      publishRequested: articles.publishRequested,
      publishAs: websites.publishAs,
      autoPublish: websites.autoPublish,
      // Goes out live whatever the mode. See FIRST_ARTICLE_STATUS.
      isFirst: raw<boolean>`coalesce((${isFirstArticle}), false)`,
    })
    .from(articles)
    .innerJoin(websites, eq(websites.id, articles.websiteId))
    .leftJoin(calendarItems, eq(calendarItems.id, articles.calendarItemId))
    .where(
      and(
        eq(articles.websiteId, websiteId),
        // Written but not yet live. A published row already has its post.
        eq(articles.status, "draft"),
        isNull(articles.publishedUrl),
        or(
          // The first article: nothing sent for this site yet, and this is
          // its earliest article. Same rule as pendingFirstArticle.
          isFirstArticle,
          isNotNull(articles.publishRequested),
          and(
            eq(websites.autoPublish, true),
            or(
              isNull(calendarItems.scheduledFor),
              lte(calendarItems.scheduledFor, now),
            ),
          ),
        ),
      ),
    )
    // Oldest first: the queue should drain in the order it filled.
    .orderBy(asc(articles.createdAt))
    .limit(limit);
}

/**
 * The WordPress posts the plugin has created for a website, with the article
 * each one is. The plugin uses this to move them when the customer changes
 * which content type RepGet articles are published as (1.5.0+) - including
 * posts created before the plugin tagged them itself.
 *
 * Plugin publishes carry no integration id; direct CMS publishes do, and are
 * not the plugin's to move.
 */
export function pluginPostsForWebsite(websiteId: string) {
  return db
    .selectDistinct({
      articleId: publishLogs.articleId,
      postId: publishLogs.remoteId,
    })
    .from(publishLogs)
    .innerJoin(articles, eq(articles.id, publishLogs.articleId))
    .where(
      and(
        eq(articles.websiteId, websiteId),
        eq(publishLogs.status, "published"),
        isNull(publishLogs.integrationId),
        isNotNull(publishLogs.remoteId),
      ),
    )
    .limit(500);
}
