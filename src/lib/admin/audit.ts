import { and, desc, eq, gte, sql as raw } from "drizzle-orm";

import { ADMIN_PAGE_SIZE, type Page } from "@/lib/admin/shared";
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

/**
 * Entries, newest first, one page at a time.
 *
 * This took a bare limit(100) and returned an array, the same silent
 * truncation every other admin list was fixed for — and it matters most here.
 * An operator checking whether a refund was issued reads this page; an entry
 * that exists but is past the hundredth row tells them it never happened.
 *
 * Filterable by actor and by action, because the questions asked of an audit
 * log are "what did this person do" and "show me every refund", and neither
 * is answerable by scrolling.
 */
export async function listAdminActions(
  options: {
    page?: number;
    organizationId?: string;
    actor?: string;
    action?: string;
    since?: Date | null;
  } = {},
): Promise<Page<AuditRow>> {
  const conditions = [];

  if (options.organizationId) {
    conditions.push(eq(adminAuditLog.organizationId, options.organizationId));
  }
  if (options.actor && options.actor !== "all") {
    conditions.push(eq(adminAuditLog.actorEmail, options.actor));
  }
  if (options.action && options.action !== "all") {
    conditions.push(eq(adminAuditLog.action, options.action));
  }
  if (options.since) {
    conditions.push(gte(adminAuditLog.createdAt, options.since));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const page = options.page ?? 1;

  const [counted] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(adminAuditLog)
    .where(where);

  const rows = await db
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
    .from(adminAuditLog)
    .where(where)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(ADMIN_PAGE_SIZE)
    .offset((page - 1) * ADMIN_PAGE_SIZE);

  return { rows, total: counted?.n ?? 0, page, pageSize: ADMIN_PAGE_SIZE };
}

/**
 * Who has ever appeared in the log, for the actor filter.
 *
 * Read from the log itself rather than from ADMIN_EMAILS: the allowlist is
 * who can act now, while this is who did act — someone removed from the
 * allowlist still has entries, and filtering by them must stay possible.
 */
export async function listAuditActors(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ email: adminAuditLog.actorEmail })
    .from(adminAuditLog)
    .orderBy(adminAuditLog.actorEmail);
  return rows.map((row) => row.email);
}
