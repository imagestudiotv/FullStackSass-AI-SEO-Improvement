"use server";

import { and, desc, eq, isNull, sql as raw } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { requireOrg } from "@/lib/tenant";
import type { NotificationView } from "@/lib/notifications/shared";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Reading and clearing notifications.
 *
 * Every query is scoped by requireOrg(), so one workspace can never see or
 * clear another's. Notification bodies quote real error messages and article
 * titles, so a leak here would be a genuine disclosure rather than cosmetic.
 */

/** Most recent notifications for the caller's workspace. */
export async function listNotifications(
  limit = 15,
): Promise<{ items: NotificationView[]; unread: number }> {
  const { orgId } = await requireOrg();

  const [items, [count]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        href: notifications.href,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.organizationId, orgId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    db
      .select({ n: raw<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.organizationId, orgId),
          isNull(notifications.readAt),
        ),
      ),
  ]);

  /**
   * The unread count is queried separately rather than derived from `items`:
   * with more unread than the page limit, counting the page would under-report
   * and the badge would say 15 when there were 40.
   */
  return { items, unread: count?.n ?? 0 };
}

/** Marks everything in this workspace as read. */
export async function markAllRead(): Promise<ActionResult<null>> {
  const { orgId } = await requireOrg();

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.organizationId, orgId), isNull(notifications.readAt)),
    );

  revalidatePath("/dashboard");
  return { ok: true, data: null };
}

/**
 * Marks one as read.
 *
 * Scoped by organisation as well as id, so an id from another workspace
 * updates nothing rather than clearing someone else's notification.
 */
export async function markRead(id: string): Promise<ActionResult<null>> {
  const { orgId } = await requireOrg();

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.id, id), eq(notifications.organizationId, orgId)),
    );

  return { ok: true, data: null };
}
