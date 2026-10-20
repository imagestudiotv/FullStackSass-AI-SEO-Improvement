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

export const currencySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{3}$/);

/** A typed amount: digits, an optional dot and decimals, an optional minus. Parsed exactly by Money.parseDecimal. */
export const amountTextSchema = z
  .string()
  .trim()
  .regex(/^-?\d{1,15}(\.\d{1,3})?$/);

/** "12.5" (percent) -> 1250 basis points, read as text - no float. */
export function percentToBasisPoints(text: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** "2026-11-01" -> that day 00:00 UTC; empty -> null; anything else -> undefined (invalid). */
export function utcDateFrom(text: string | null | undefined): Date | null | undefined {
  const value = (text ?? "").trim();
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : date;
}

/**
 * A report's period from ?from=YYYY-MM-DD&to=YYYY-MM-DD (UTC, both days
 * included): `to` becomes the next day's midnight, exclusive. Invalid or
 * reversed dates are ignored rather than guessed.
 */
export function reportPeriod(from: unknown, to: unknown): { from?: Date; to?: Date; fromText?: string; toText?: string } {
  const start = typeof from === "string" ? utcDateFrom(from) : null;
  const end = typeof to === "string" ? utcDateFrom(to) : null;
  const period: { from?: Date; to?: Date; fromText?: string; toText?: string } = {};
  if (start) {
    period.from = start;
    period.fromText = start.toISOString().slice(0, 10);
  }
  if (end) {
    period.to = new Date(end.getTime() + 86_400_000);
    period.toText = end.toISOString().slice(0, 10);
  }
  if (period.from && period.to && period.from >= period.to) return {};
  return period;
}

export const couponFormSchema = z.object({
  code: z.string().trim().min(4).max(24),
  campaign: z.string().trim().min(3).max(60),
  discountType: z.enum(["percent_first_payment", "percent_first_3_months", "fixed_amount"]),
  percent: z.string().trim().max(6).optional(),
  amount: z.string().trim().max(20).optional(),
  currency: z.string().trim().max(3).optional(),
  startsAt: z.string().trim().max(10).optional(),
  expiresAt: z.string().trim().max(10).optional(),
  maxRedemptions: z.string().trim().max(9).optional(),
  acknowledgeAnnualBehaviour: z.boolean().optional(),
});
export type CouponForm = z.infer<typeof couponFormSchema>;
