/**
 * Constants and queries shared between the onboarding actions and the page.
 *
 * Separate from actions.ts because that file carries "use server", where every
 * export must be an async function — a plain constant there is a build error.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { starterTrials } from "@/lib/db/schema";

export type StarterCheckoutResult = { url: string } | { error: string };

/** Slug of the one-off Starter offer in the addons table. */
export const STARTER_TRIAL_SLUG = "starter_trial";

/** True when this workspace has already used its one Starter trial. */
export async function hasStarterTrial(orgId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: starterTrials.id })
    .from(starterTrials)
    .where(eq(starterTrials.organizationId, orgId))
    .limit(1);

  return Boolean(row);
}
