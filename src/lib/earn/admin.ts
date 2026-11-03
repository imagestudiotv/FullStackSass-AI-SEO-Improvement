"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { recordCredit } from "@/lib/backlinks/credits";
import { db } from "@/lib/db";
import { organization, user } from "@/lib/db/auth-tables";
import { earnSubmissions } from "@/lib/db/schema";
import { notify } from "@/lib/notifications/create";

/**
 * The RepGet team's side of Earn Credits: the claims customers sent, and
 * approving (credits added) or declining (with a reason the customer sees).
 *
 * THE DECISION AND THE CREDIT COMMIT TOGETHER. The status change is
 * conditional on the claim still being pending, so two administrators
 * pressing Approve at once credit it once; the ledger row also carries the
 * key "earn:<id>". The customer is notified after commit, and a failed
 * notification changes nothing.
 */

export type EarnQueueRow = {
  id: string;
  kind: string;
  link: string | null;
  message: string;
  status: string;
  rewardCredits: number;
  createdAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  organizationId: string;
  organizationName: string;
  userName: string | null;
  userEmail: string | null;
};

/** Waiting claims first (oldest first), then the latest decisions. */
export async function listEarnQueue(): Promise<EarnQueueRow[]> {
  await requireAdmin();
  return db
    .select({
      id: earnSubmissions.id,
      kind: earnSubmissions.kind,
      link: earnSubmissions.link,
      message: earnSubmissions.message,
      status: earnSubmissions.status,
      rewardCredits: earnSubmissions.rewardCredits,
      createdAt: earnSubmissions.createdAt,
      reviewedBy: earnSubmissions.reviewedBy,
      reviewedAt: earnSubmissions.reviewedAt,
      reviewNote: earnSubmissions.reviewNote,
      organizationId: earnSubmissions.organizationId,
      organizationName: organization.name,
      userName: user.name,
      userEmail: user.email,
    })
    .from(earnSubmissions)
    .innerJoin(organization, eq(organization.id, earnSubmissions.organizationId))
    .leftJoin(user, eq(user.id, earnSubmissions.userId))
    .orderBy(
      sql`case when ${earnSubmissions.status} = 'pending' then 0 else 1 end`,
      sql`case when ${earnSubmissions.status} = 'pending' then ${earnSubmissions.createdAt} end asc`,
      desc(earnSubmissions.reviewedAt),
    )
    .limit(200);
}

type Decision = { ok: true } | { ok: false; error: string };

export async function approveEarnClaim(id: string): Promise<Decision> {
  const admin = await requireAdmin();
  const decided = await db.transaction(async (tx) => {
    const [claim] = await tx
      .update(earnSubmissions)
      .set({ status: "approved", reviewedBy: admin.email, reviewedAt: new Date(), reviewNote: null })
      .where(and(eq(earnSubmissions.id, id), eq(earnSubmissions.status, "pending")))
      .returning({ organizationId: earnSubmissions.organizationId, credits: earnSubmissions.rewardCredits, kind: earnSubmissions.kind });
    if (!claim) return null;
    await recordCredit(
      claim.organizationId,
      { type: "reward", amount: claim.credits, referenceId: id, idempotencyKey: `earn:${id}`, note: `Earn Credits: ${claim.kind}` },
      tx,
    );
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "earn.approved",
        targetType: "earn_submission",
        targetId: id,
        organizationId: claim.organizationId,
        summary: `Approved an Earn Credits claim (${claim.kind}): ${claim.credits} credits added`,
        detail: { kind: claim.kind, credits: claim.credits },
      },
      tx,
    );
    return claim;
  });
  if (!decided) return { ok: false, error: "This claim was already decided. Reload the page." };

  try {
    await notify({
      organizationId: decided.organizationId,
      type: "earn.approved",
      title: `You earned ${decided.credits} credits`,
      body: "Thank you - your submission was approved and the credits are in your balance.",
      href: "/earn-credits",
    });
  } catch (error) {
    console.error("[earn] approved, but the notification failed", error);
  }
  revalidatePath("/admin/earn-credits");
  return { ok: true };
}

export async function declineEarnClaim(id: string, reason: string): Promise<Decision> {
  const admin = await requireAdmin();
  const note = reason.trim().slice(0, 500);
  if (note.length < 3) return { ok: false, error: "Give a short reason - the customer sees it" };
  const decided = await db.transaction(async (tx) => {
    const [claim] = await tx
      .update(earnSubmissions)
      .set({ status: "declined", reviewedBy: admin.email, reviewedAt: new Date(), reviewNote: note })
      .where(and(eq(earnSubmissions.id, id), eq(earnSubmissions.status, "pending")))
      .returning({ organizationId: earnSubmissions.organizationId, kind: earnSubmissions.kind });
    if (!claim) return null;
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "earn.declined",
        targetType: "earn_submission",
        targetId: id,
        organizationId: claim.organizationId,
        summary: `Declined an Earn Credits claim (${claim.kind}): ${note}`,
        detail: { kind: claim.kind, reason: note },
      },
      tx,
    );
    return claim;
  });
  if (!decided) return { ok: false, error: "This claim was already decided. Reload the page." };

  try {
    await notify({
      organizationId: decided.organizationId,
      type: "earn.declined",
      title: "Your Earn Credits submission was not approved",
      body: note,
      href: "/earn-credits",
    });
  } catch (error) {
    console.error("[earn] declined, but the notification failed", error);
  }
  revalidatePath("/admin/earn-credits");
  return { ok: true };
}
