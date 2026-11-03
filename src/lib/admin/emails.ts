"use server";

import { desc, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { lifecycleEmails, platformControls } from "@/lib/db/schema";
import { LIFECYCLE_CONTROL_KEY } from "@/lib/email/lifecycle";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Admin -> Emails: the lifecycle emails' kill switch and what they did
 * (docs/emails.md). The switch is a platform_controls row like the
 * publication freeze; a missing row is OFF, which is how a deploy ships
 * them silent. Every change is recorded in the admin audit log.
 */

export type LifecycleEmailRow = {
  id: string;
  kind: string;
  recipient: string | null;
  status: string;
  reason: string | null;
  createdAt: Date;
};

export type LifecycleEmailsAdmin = {
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: Date | null;
  /** The last 30 days, by kind and status. */
  totals: { kind: string; status: string; count: number }[];
  recent: LifecycleEmailRow[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getLifecycleEmailsAdmin(): Promise<LifecycleEmailsAdmin> {
  await requireAdmin();
  const [control] = await db
    .select()
    .from(platformControls)
    .where(eq(platformControls.key, LIFECYCLE_CONTROL_KEY))
    .limit(1);
  const since = new Date(Date.now() - 30 * DAY_MS);
  const [totals, recent] = await Promise.all([
    db
      .select({ kind: lifecycleEmails.kind, status: lifecycleEmails.status, count: sql<number>`count(*)::int` })
      .from(lifecycleEmails)
      .where(gte(lifecycleEmails.createdAt, since))
      .groupBy(lifecycleEmails.kind, lifecycleEmails.status),
    db
      .select({
        id: lifecycleEmails.id,
        kind: lifecycleEmails.kind,
        recipient: lifecycleEmails.recipient,
        status: lifecycleEmails.status,
        reason: lifecycleEmails.reason,
        createdAt: lifecycleEmails.createdAt,
      })
      .from(lifecycleEmails)
      .orderBy(desc(lifecycleEmails.createdAt))
      .limit(50),
  ]);
  return {
    enabled: control?.enabled ?? false,
    updatedBy: control?.updatedBy ?? null,
    updatedAt: control?.updatedAt ?? null,
    totals: totals.map((row) => ({ ...row, count: Number(row.count) })),
    recent,
  };
}

/** Turns every lifecycle email on or off, at once, for every customer. */
export async function setLifecycleEmails(enabled: boolean): Promise<ActionResult<{ enabled: boolean }>> {
  const admin = await requireAdmin();
  const now = new Date();
  const on = Boolean(enabled);
  await db.transaction(async (tx) => {
    await tx
      .insert(platformControls)
      .values({ key: LIFECYCLE_CONTROL_KEY, enabled: on, updatedBy: admin.email, updatedAt: now })
      .onConflictDoUpdate({
        target: platformControls.key,
        set: { enabled: on, updatedBy: admin.email, updatedAt: now },
      });
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "platform.control_changed",
        targetType: "platform_control",
        targetId: LIFECYCLE_CONTROL_KEY,
        summary: on ? "Turned lifecycle emails on" : "Turned lifecycle emails off",
        detail: { key: LIFECYCLE_CONTROL_KEY, enabled: on },
      },
      tx,
    );
  });
  revalidatePath("/admin/emails");
  return { ok: true, data: { enabled: on } };
}
