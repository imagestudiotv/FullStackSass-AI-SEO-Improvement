import { and, asc, eq, inArray, or } from "drizzle-orm";

import { GIVEN_UP_WITH_HOST, withdrawPlacement } from "@/lib/backlinks/placements";
import { db } from "@/lib/db";
import { articles, placements } from "@/lib/db/schema";
import { lockForEdit } from "@/lib/publishing/dispatch";

/**
 * Deleting an article, and what the backlinks it carries held.
 *
 * WHAT WAS WRONG. The row was simply deleted. placements.article_id is ON DELETE
 * SET NULL, so a placed link lost its article and stayed "drafted", its request
 * stayed "matched", and the partner's credits stayed reserved. Nothing could
 * release them any more: an administrator's withdrawal needs the article.
 *
 * NOW, by the state of each placement on the article and its translations (the
 * translations go with it, ON DELETE CASCADE):
 *
 *   pending, drafted  The link never reached the website. Withdrawn: placement
 *                     and request "cancelled", hold released, no ledger row,
 *                     because nothing was charged. The same as an administrator
 *                     withdrawing it (lib/backlinks/placements.ts).
 *   unverified        Sent, never seen, and now nobody can correct it. Withdrawn
 *                     the same way, unless another placement has taken over its
 *                     request, whose hold is then that placement's.
 *   published         The post is on the website and this deletes nothing there,
 *                     so the link may well be up. Left to the verifier, which
 *                     does not need the article: it holds liveUrl. Seen: charged
 *                     and rewarded as usual. Never seen: released (applyCheck).
 *   live              Settled. Nothing moves: the charge and reward stand, and
 *                     the post is still on the website. The verifier keeps
 *                     checking it, and if it goes, an administrator removes it
 *                     and refunds it like any other missing link.
 *   removed, cancelled  Already finished. Nothing moves.
 *
 * ONE TRANSACTION, so the article and the holds go together or not at all, and a
 * retry after a failure finds everything as it was. Repeating a finished deletion
 * finds no article and does nothing.
 *
 * LOCKS. Placement rows, then the article, as an administrator's withdrawal
 * takes them; the placements are read again under the article's lock, which
 * stops any more being attached (a new one needs a key share on that row).
 * The article's lock also means a delivery cannot race this: while a revision is
 * being sent, lockForEdit refuses with ArticleInFlightError and nothing changes.
 * A link that may have got out without being recorded (a send whose outcome is
 * unknown, a draft in the CMS) is released like any unpublished one: at worst the
 * host carries a link nobody is charged for.
 *
 * Takes the website the caller was authorised for: an id for an article of any
 * other website touches nothing, not even a lock. Not a "use server" module: it
 * trusts its arguments.
 */
export async function deleteArticleAndSettleLinks(
  websiteId: string,
  articleId: string,
  now: Date = new Date(),
): Promise<{ deleted: boolean; released: number }> {
  return db.transaction(async (tx) => {
    const [own] = await tx
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.id, articleId), eq(articles.websiteId, websiteId)))
      .limit(1);
    if (!own) return { deleted: false, released: 0 };

    const family = tx
      .select({ id: articles.id })
      .from(articles)
      .where(or(eq(articles.id, articleId), eq(articles.translationOf, articleId)));
    await tx
      .select({ id: placements.id })
      .from(placements)
      .where(inArray(placements.articleId, family))
      .orderBy(asc(placements.id))
      .for("update");

    await lockForEdit(tx, articleId, now);
    // Read under the lock: a new translation needs a key share on the original.
    const translations = await tx
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.translationOf, articleId))
      .orderBy(asc(articles.id));
    for (const translation of translations) await lockForEdit(tx, translation.id, now);

    const carried = await tx
      .select({ id: placements.id, requestId: placements.requestId })
      .from(placements)
      .where(inArray(placements.articleId, [articleId, ...translations.map((row) => row.id)]))
      .orderBy(asc(placements.id))
      .for("update");
    let released = 0;
    for (const placement of carried) {
      if (await withdrawPlacement(tx, placement, GIVEN_UP_WITH_HOST, now)) released++;
    }

    const deleted = await tx
      .delete(articles)
      .where(and(eq(articles.id, articleId), eq(articles.websiteId, websiteId)))
      .returning({ id: articles.id });
    return { deleted: deleted.length > 0, released };
  });
}
