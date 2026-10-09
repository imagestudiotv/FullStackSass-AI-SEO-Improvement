"use server";

import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction, type AdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { blogPosts, blogSponsorships } from "@/lib/db/schema";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Admin -> Blog -> Featured placements: the "Get Featured" requests from the
 * blog (lib/blog/sponsorship.ts) and what has been done with them. Paid
 * requests wait for review, oldest first; an administrator places the
 * mention in the article by hand, then marks it published - or declines it.
 * Both are recorded in the activity log and can be undone.
 */

export type PlacementView = "review" | "unpaid" | "published" | "declined" | "all";

export type PlacementRow = {
  id: string;
  postSlug: string;
  /** Null when the article has since been unpublished or deleted. */
  postTitle: string | null;
  email: string;
  websiteUrl: string;
  message: string;
  status: string;
  checkoutId: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const STATUS_OF: Record<Exclude<PlacementView, "all">, string> = {
  review: "paid",
  unpaid: "pending",
  published: "published",
  declined: "declined",
};

/** One view of the requests (at most 200), and how many requests each status holds. */
export async function listPlacements(view: PlacementView): Promise<{ rows: PlacementRow[]; counts: Record<string, number> }> {
  await requireAdmin();
  const status = view === "all" ? null : STATUS_OF[view];
  const rows = await db
    .select({
      id: blogSponsorships.id,
      postSlug: blogSponsorships.postSlug,
      postTitle: blogPosts.title,
      email: blogSponsorships.email,
      websiteUrl: blogSponsorships.websiteUrl,
      message: blogSponsorships.message,
      status: blogSponsorships.status,
      checkoutId: blogSponsorships.checkoutId,
      paidAt: blogSponsorships.paidAt,
      createdAt: blogSponsorships.createdAt,
      updatedAt: blogSponsorships.updatedAt,
    })
    .from(blogSponsorships)
    .leftJoin(blogPosts, and(eq(blogPosts.slug, blogSponsorships.postSlug), eq(blogPosts.status, "published")))
    .where(status ? eq(blogSponsorships.status, status) : undefined)
    // Paid requests are a queue: the longest-waiting first. Everything else newest first.
    .orderBy(...(view === "review" ? [asc(blogSponsorships.paidAt)] : [desc(blogSponsorships.createdAt)]))
    .limit(200);

  const totals = await db
    .select({ status: blogSponsorships.status, n: count() })
    .from(blogSponsorships)
    .groupBy(blogSponsorships.status);
  return { rows, counts: Object.fromEntries(totals.map((row) => [row.status, row.n])) };
}

/** Paid requests waiting for a decision: the count on the blog page's button. */
export async function placementsToReview(): Promise<number> {
  await requireAdmin();
  const [row] = await db.select({ n: count() }).from(blogSponsorships).where(eq(blogSponsorships.status, "paid"));
  return row?.n ?? 0;
}

const MOVES: Record<"published" | "declined" | "paid", { from: string[]; action: AdminAction; verb: string }> = {
  published: { from: ["paid"], action: "blog.placement_published", verb: "Marked as published" },
  declined: { from: ["paid"], action: "blog.placement_declined", verb: "Declined" },
  // Undo: back to the review queue.
  paid: { from: ["published", "declined"], action: "blog.placement_reopened", verb: "Moved back to review" },
};

/**
 * Records the decision on a paid request. Only moves a request from the
 * status the button was shown for, so two administrators cannot overwrite
 * each other's decision, and an unpaid request can never be "published".
 */
export async function setPlacementStatus(input: { id: string; status: "published" | "declined" | "paid" }): Promise<ActionResult<{ status: string }>> {
  const admin = await requireAdmin();
  const move = MOVES[input.status];
  if (!move || !/^[0-9a-f-]{36}$/i.test(input.id)) return { ok: false, error: "Request not found" };

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(blogSponsorships)
      .set({ status: input.status, updatedAt: new Date() })
      .where(and(eq(blogSponsorships.id, input.id), inArray(blogSponsorships.status, move.from)))
      .returning({ id: blogSponsorships.id, postSlug: blogSponsorships.postSlug, email: blogSponsorships.email });
    if (!updated) return null;
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: move.action,
        targetType: "blog_placement",
        targetId: updated.id,
        summary: `${move.verb}: the paid placement for ${updated.email} in /blog/${updated.postSlug}`,
        detail: { postSlug: updated.postSlug, status: input.status },
      },
      tx,
    );
    return updated;
  });

  if (!result) return { ok: false, error: "This request changed in the meantime. Reload the page to see its current status." };
  revalidatePath("/admin/blog/sponsorships");
  revalidatePath("/admin/blog");
  return { ok: true, data: { status: input.status } };
}
