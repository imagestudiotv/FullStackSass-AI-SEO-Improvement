import "server-only";

import { count, isNotNull } from "drizzle-orm";

import { db, isDatabaseConfigured } from "@/lib/db";
import { articles, socialSuggestions, videoIdeas } from "@/lib/db/schema";

/**
 * How much content RepGet has created: the homepage counter under the
 * platform logos ("Articles, posts and videos created with RepGet").
 *
 * The design drew a number that ticked up by itself from 12,840. That figure
 * was invented, so this counts what is really in the database instead:
 *  - articles with a written body (drafts that were never written are not content);
 *  - social posts and replies drafted for customers;
 *  - videos and slideshows that were actually rendered.
 *
 * The homepage is rebuilt in the background at most hourly, so the number is
 * at most an hour old. A database that fails, or a build with none, returns
 * null and the counter is simply not shown: a counter is never worth failing
 * the homepage for.
 */
export async function countContentCreated(): Promise<number | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const [[written], [posts], [videos]] = await Promise.all([
      db.select({ n: count() }).from(articles).where(isNotNull(articles.bodyHtml)),
      db.select({ n: count() }).from(socialSuggestions),
      db.select({ n: count() }).from(videoIdeas).where(isNotNull(videoIdeas.videoUrl)),
    ]);
    return Number(written?.n ?? 0) + Number(posts?.n ?? 0) + Number(videos?.n ?? 0);
  } catch (error) {
    console.warn("[content-count] could not count content; hiding the counter", error);
    return null;
  }
}
