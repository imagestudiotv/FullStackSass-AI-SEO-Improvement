"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-tables";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { format } from "@/lib/i18n/format";
import { freePlanCopy } from "@/lib/i18n/free-plan";
import { freePlanValues } from "@/lib/plans/free-plan";
import { recordFreePlanEvent, startFreePlan, type StartFreePlanRefusal } from "@/lib/plans/free-plan-server";
import { requireOrg } from "@/lib/tenant";

/**
 * The Free plan's server actions. A server action is a public endpoint, so
 * each one reads who is asking from the session and checks the website
 * belongs to their workspace (startFreePlan) - nothing the browser sends
 * decides it.
 */

export type StartFreePlanActionResult =
  /** Free is on for this website (or already was): go on to `next`. */
  | { ok: true; next: string }
  /**
   * `reason` "full": the cap is reached - offer the paid plans' free trial.
   * "email_unverified": ask for the email code first. `error` is in the
   * reader's language.
   */
  | { ok: false; reason: StartFreePlanRefusal; error: string };

/**
 * Starts the Free plan for one of the signed-in workspace's websites: no
 * card, no checkout. The onboarding plan step's "Start Free" calls it, and
 * so may the growth-plan flow's last step. Idempotent: pressing it twice, or
 * after Free started, answers ok again.
 *
 * `next` is where setup continues, as after a paid plan's checkout: Connect
 * Google (/onboarding/google), for this website.
 */
export async function startFreePlanAction(websiteId: string): Promise<StartFreePlanActionResult> {
  const { orgId, userId } = await requireOrg();
  const { locale } = await getAppMessages(userId);

  // Read from the database, not the session cookie: the code may have been confirmed a moment ago.
  const [person] = await db.select({ emailVerified: user.emailVerified }).from(user).where(eq(user.id, userId)).limit(1);

  const result = await startFreePlan({
    organizationId: orgId,
    userId,
    websiteId,
    emailVerified: person?.emailVerified === true,
  });

  if (result.ok) {
    revalidatePath("/dashboard");
    return { ok: true, next: `/onboarding/google?site=${encodeURIComponent(websiteId)}` };
  }

  const t = freePlanCopy(locale);
  const error = {
    email_unverified: t.app.verifyEmail,
    not_found: "Website not found",
    has_plan: "This website already has a plan.",
    other_website: t.app.oneWebsite,
    domain_taken: t.app.domainTaken,
    full: format(t.card.fullNote, freePlanValues(locale)),
  }[result.reason];
  return { ok: false, reason: result.reason, error };
}

/**
 * Records that a Free workspace pressed an upgrade prompt (`source`: where),
 * for the launch dashboard. Never fails the click: the link goes on anyway.
 */
export async function recordUpgradeClickAction(source: string): Promise<void> {
  const { orgId, userId } = await requireOrg();
  await recordFreePlanEvent({ organizationId: orgId, userId, kind: "upgrade_click", source: String(source ?? "") });
}

