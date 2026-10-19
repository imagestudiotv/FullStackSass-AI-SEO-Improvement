import { z } from "zod";

import { APPLICATION_LIMITS } from "../domain/entities/application";

/**
 * Shapes of what browsers send. Validation of MEANING (allowed countries,
 * minimum lengths, ownership) happens in the use cases; this only refuses
 * anything that is not even the right shape, before it reaches them.
 */

export const applicationSchema = z.object({
  website: z.string().trim().min(1).max(APPLICATION_LIMITS.website),
  audience: z.string().trim().min(1).max(APPLICATION_LIMITS.audience),
  promotion: z.string().trim().min(1).max(APPLICATION_LIMITS.promotion),
  country: z.string().trim().length(2),
  /** Must be ticked: the partner terms. */
  terms: z.literal(true),
});

export const reasonSchema = z.string().trim().min(5).max(500);

export const idSchema = z.string().uuid();

export const controlKeySchema = z.enum(["partner_program", "partner_commissions", "partner_payouts"]);
