"use server";

import { and, count, desc, eq, isNotNull, isNull, lt, or, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { isUuid } from "@/lib/blog/engagement";
import { blogLocale, blogPath } from "@/lib/blog/locale";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-tables";
import { blogComments, blogPosts } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Admin -> Blog -> Comments (client, 2026-11-11): readers' comments, newest
 * first, to remove one that should not be there - or restore one removed by
 * mistake. Comments go live at once (lib/blog/engagement.ts), so this is
 * where they are moderated. Removing is a soft delete (removed_at,
 * removed_by); every change is in the admin audit log. A comment its author
 * deleted is listed as such and cannot be restored.
 */

export type CommentView = "shown" | "removed" | "all";

export type AdminComment = {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string;
  authorEmail: string;
  postTitle: string;
  postPath: string;
  postLocale: Locale;
  removedAt: Date | null;
  removedBy: string | null;
  deletedAt: Date | null;
};

const PAGE = 100;

const VIEWS: Record<CommentView, SQL | undefined> = {
  shown: and(isNull(blogComments.removedAt), isNull(blogComments.deletedAt)),
  removed: or(isNotNull(blogComments.removedAt), isNotNull(blogComments.deletedAt)),
  all: undefined,
};

/** One page of comments in a view, newest first; `before` (an ISO time) continues after the last one shown. */
export async function listCommentsAdmin(
  view: CommentView = "shown",
  before?: string,
): Promise<{ rows: AdminComment[]; counts: Record<CommentView, number>; more: boolean }> {
  await requireAdmin();
  const chosen = VIEWS[view] ? view : "shown";
  const cursor = before && !Number.isNaN(Date.parse(before)) ? lt(blogComments.createdAt, new Date(before)) : undefined;
  const [rows, [shown], [removed]] = await Promise.all([
    db
      .select({
        id: blogComments.id,
        body: blogComments.body,
        createdAt: blogComments.createdAt,
        removedAt: blogComments.removedAt,
        removedBy: blogComments.removedBy,
        deletedAt: blogComments.deletedAt,
        authorName: user.name,
        authorEmail: user.email,
        postTitle: blogPosts.title,
        postSlug: blogPosts.slug,
        postLocale: blogPosts.locale,
      })
      .from(blogComments)
      .innerJoin(user, eq(user.id, blogComments.userId))
      .innerJoin(blogPosts, eq(blogPosts.id, blogComments.postId))
      .where(and(VIEWS[chosen], cursor))
      .orderBy(desc(blogComments.createdAt), desc(blogComments.id))
      .limit(PAGE + 1),
    db.select({ n: count() }).from(blogComments).where(VIEWS.shown),
    db.select({ n: count() }).from(blogComments).where(VIEWS.removed),
  ]);
  return {
    more: rows.length > PAGE,
    counts: { shown: shown?.n ?? 0, removed: removed?.n ?? 0, all: (shown?.n ?? 0) + (removed?.n ?? 0) },
    rows: rows.slice(0, PAGE).map((row) => {
      const locale = blogLocale(row.postLocale);
      return {
        id: row.id,
        body: row.body,
        createdAt: row.createdAt,
        authorName: row.authorName,
        authorEmail: row.authorEmail,
        postTitle: row.postTitle,
        postPath: blogPath(locale, row.postSlug),
        postLocale: locale,
        removedAt: row.removedAt,
        removedBy: row.removedBy,
        deletedAt: row.deletedAt,
      };
    }),
  };
}

/** Removes a comment from the blog (removed = true) or puts it back (false). */
export async function setCommentRemoved(input: { id: string; removed: boolean }): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!isUuid(input.id)) return { ok: false, error: "Comment not found" };
  const removed = input.removed === true;
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: blogComments.id, body: blogComments.body, removedAt: blogComments.removedAt, deletedAt: blogComments.deletedAt, postTitle: blogPosts.title })
      .from(blogComments)
      .innerJoin(blogPosts, eq(blogPosts.id, blogComments.postId))
      .where(eq(blogComments.id, input.id))
      .for("update", { of: blogComments })
      .limit(1);
    if (!current) return "Comment not found";
    if (!removed && current.deletedAt) return "Its author deleted this comment - it cannot be restored";
    if ((current.removedAt !== null) === removed) return null;
    await tx
      .update(blogComments)
      .set(removed ? { removedAt: new Date(), removedBy: admin.email } : { removedAt: null, removedBy: null })
      .where(and(eq(blogComments.id, current.id)));
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: removed ? "blog.comment_removed" : "blog.comment_restored",
        targetType: "blog_comment",
        targetId: current.id,
        summary: `${removed ? "Removed" : "Restored"} a comment on "${current.postTitle}"`,
        detail: { excerpt: current.body.slice(0, 120) },
      },
      tx,
    );
    return null;
  });
  if (result) return { ok: false, error: result };
  revalidatePath("/admin/blog/comments");
  return { ok: true, data: null };
}
