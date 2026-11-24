import "server-only";

import { and, desc, eq, isNull, ne, or } from "drizzle-orm";

import { DROPPED_TOPIC_STATUS } from "@/lib/admin/draft-deletion-rules.mjs";
import { customerTitleSql } from "@/lib/articles/review";
import { PREPARING_TITLE } from "@/lib/i18n/article-delivery";

import { db } from "@/lib/db";
import { articles, calendarItems, sitePosts, websites } from "@/lib/db/schema";

import { coveredBy, type CoveredTopics } from "./covered-match";

export { coveredBy, type CoveredTopics } from "./covered-match";

/**
 * What a website already covers, so planning moves on to new ideas (client,
 * 2026-10-20, Image Studio: "it should search for the actual blog posts
 * first, and come with a new article idea"):
 *  - the articles its own site has (site_posts, read by lib/sites/inventory.ts),
 *    in its main language;
 *  - the articles RepGet has written for it, whatever came of them except a
 *    failure - a re-plan used to be free to choose a keyword already written;
 *  - the topics whose draft the team deleted on purpose (Admin -> Partner
 *    Network, 2026-11-24): a re-plan must not bring them back.
 */
export async function coveredTopics(websiteId: string): Promise<CoveredTopics> {
  const [site] = await db.select({ languages: websites.siteLanguages }).from(websites).where(eq(websites.id, websiteId)).limit(1);
  const main = site?.languages?.[0] ?? null;
  const posts = await db
    .select({ title: sitePosts.title })
    .from(sitePosts)
    .where(and(eq(sitePosts.websiteId, websiteId), main ? or(eq(sitePosts.language, main), isNull(sitePosts.language)) : undefined))
    .orderBy(desc(sitePosts.publishedAt))
    .limit(2000);
  const written = await db
    .select({ title: customerTitleSql, keyword: articles.targetKeyword })
    .from(articles)
    .where(and(eq(articles.websiteId, websiteId), ne(articles.status, "failed")))
    .orderBy(desc(articles.createdAt))
    .limit(2000);
  const dropped = await db
    .select({ title: calendarItems.title, keyword: calendarItems.targetKeyword })
    .from(calendarItems)
    .where(and(eq(calendarItems.websiteId, websiteId), eq(calendarItems.status, DROPPED_TOPIC_STATUS)))
    .orderBy(desc(calendarItems.updatedAt))
    .limit(2000);
  return {
    siteTitles: posts.map((post) => post.title),
    writtenTitles: [...written, ...dropped].map((article) => article.title).filter((title) => title !== PREPARING_TITLE),
    writtenKeywords: [...written, ...dropped].map((article) => article.keyword).filter((keyword): keyword is string => Boolean(keyword)),
  };
}

/** Whether a keyword is already covered by the site or by RepGet's own articles. */
export function isCovered(keyword: string, covered: CoveredTopics): boolean {
  return coveredBy(keyword, covered) !== null;
}
