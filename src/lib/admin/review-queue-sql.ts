import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import { reviewHashSql, twoStepOffSql } from "@/lib/articles/review";
import { articles } from "@/lib/db/schema";

/**
 * Which articles are in the RepGet team's review queue, shared by the queue
 * page, its counts and the sidebar badge so they can never disagree. For
 * queries with `articles` in scope.
 */

/** In the managed workflow and not on the customer's site yet - or, under the two-step flow, changed by the customer since. */
export const inReviewQueueSql: SQL = or(
  and(inArray(articles.reviewStatus, ["pending", "approved"]), eq(articles.status, "draft"), isNull(articles.publishedUrl)),
  /*
    Under the two-step flow a customer's change to a post already on their
    site comes to the team too (afterCustomerEdit): it waits here for its
    approval, or the customer's Update would wait for ever.
  */
  and(eq(articles.reviewStatus, "pending"), sql`not ${twoStepOffSql}`),
)!;

/** Approved, and still exactly what was approved. */
export const approvedCurrentSql: SQL<boolean> = sql<boolean>`(${articles.reviewStatus} = 'approved' and ${articles.reviewApprovedHash} is not distinct from ${reviewHashSql})`;

/** Waiting for an administrator: in the queue and not approved as it stands. */
export const waitingForReviewSql: SQL = and(inReviewQueueSql, sql`not ${approvedCurrentSql}`)!;

/** Approved and waiting for its planned day. */
export const approvedWaitingSql: SQL = and(inReviewQueueSql, approvedCurrentSql)!;
