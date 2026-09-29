import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { backlinkRequests, placements } from "@/lib/db/schema";

/**
 * Statuses of a placement whose link is (or is about to be) in the host
 * article's text: withdrawn ("cancelled") and "removed" ones are not.
 */
const IN_TEXT = ["pending", "drafted", "published", "live", "unverified"] as const;

/**
 * The partner (Partner Network) links in one article: the exact target URLs
 * written into its text, so the editors can highlight them. A link placed
 * on words in a paragraph otherwise looks like any other link - and in a
 * preview, like plain text.
 *
 * The caller must already have checked that the viewer may see this
 * article (its page does, before calling).
 */
export async function partnerLinkUrls(articleId: string): Promise<string[]> {
  const rows = await db
    .select({ url: backlinkRequests.targetUrl })
    .from(placements)
    .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
    .where(and(eq(placements.articleId, articleId), inArray(placements.status, [...IN_TEXT])));
  return [...new Set(rows.map((row) => row.url))];
}
