import "server-only";

import { and, desc, eq, isNull, ne, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, sitePosts, websites } from "@/lib/db/schema";

import { coveredBy, type CoveredTopics } from "./covered-match";

export { coveredBy, type CoveredTopics } from "./covered-match";

/**
 * What a website already covers, so planning moves on to new ideas (client,
 * 2026-10-20, Image Studio: "it should search for the actual blog posts
 * first, and come with a new article idea"):
 *  - the articles its own site has (site_posts, read by lib/sites/inventory.ts),
 *    in its main language;
 *  - the articles RepGet has written for it, whatever came of them except a
 *    failure - a re-plan used to be free to choose a keyword already written.
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
    .select({ title: articles.title, keyword: articles.targetKeyword })
    .from(articles)
    .where(and(eq(articles.websiteId, websiteId), ne(articles.status, "failed")))
    .orderBy(desc(articles.createdAt))
    .limit(2000);
  return {
    siteTitles: posts.map((post) => post.title),
    writtenTitles: written.map((article) => article.title),
    writtenKeywords: written.map((article) => article.keyword).filter((keyword): keyword is string => Boolean(keyword)),
  };
}

/** Whether a keyword is already covered by the site or by RepGet's own articles. */
export function isCovered(keyword: string, covered: CoveredTopics): boolean {
  return coveredBy(keyword, covered) !== null;
}
