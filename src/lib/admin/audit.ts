import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { adminAuditLog } from "@/lib/db/schema";

/**
 * Recording what an administrator did.
 *
 * Every admin action that changes something calls this. Reads do not: a log
 * of who looked at what would bury the entries that matter under noise.
 *
 * Unlike notifications, this is NOT best effort. notify() swallows its own
 * failure because a missing courtesy message is better than a failed article;
 * here the write IS part of the action. An operator who refunds money and
 * leaves no trace has done something worse than not refunding, so the caller
 * writes the log first and only then performs the irreversible half.
 */

export type AdminAction =
  | "payment.refunded"
  | "credits.adjusted"
  | "organization.limits_changed"
  | "organization.deactivated"
  | "organization.reactivated"
  | "article.updated"
  | "article.deleted"
  | "user.deleted"
  | "organization.deleted";

export type AuditEntry = {
  actorEmail: string;
  action: AdminAction;
  /** "payment", "organization", "article", "user". */
  targetType: string;
  targetId?: string | null;
  organizationId?: string | null;
  /** One line a human can read months later. Written for a person. */
  summary: string;
  detail?: Record<string, unknown> | null;
};

/**
 * Writes one entry. Throws on failure, deliberately — see above.
 */
export async function recordAdminAction(entry: AuditEntry): Promise<void> {
  await db.insert(adminAuditLog).values({
    actorEmail: entry.actorEmail,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    organizationId: entry.organizationId ?? null,
    summary: entry.summary.slice(0, 500),
    detail: entry.detail ?? null,
  });
}

export type AuditRow = {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  organizationId: string | null;
  summary: string;
  createdAt: Date;
};

/** Most recent entries, newest first. */
export async function listAdminActions(
  limit = 100,
  organizationId?: string,
): Promise<AuditRow[]> {
  const query = db
    .select({
      id: adminAuditLog.id,
      actorEmail: adminAuditLog.actorEmail,
      action: adminAuditLog.action,
      targetType: adminAuditLog.targetType,
      targetId: adminAuditLog.targetId,
      organizationId: adminAuditLog.organizationId,
      summary: adminAuditLog.summary,
      createdAt: adminAuditLog.createdAt,
    })
    .from(adminAuditLog);

  const rows = organizationId
    ? await query
        .where(eq(adminAuditLog.organizationId, organizationId))
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(limit)
    : await query.orderBy(desc(adminAuditLog.createdAt)).limit(limit);

  return rows;
}
