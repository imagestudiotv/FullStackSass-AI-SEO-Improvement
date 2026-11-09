import type { CreditPack } from "../application/ports/repositories";
import type { PartnerDeps } from "../application/use-cases/deps";
import { payableCountries } from "../application/use-cases/paypal-payouts";

/**
 * What the public partner pages (/partners, /partner/apply) may say about how
 * partners are paid: the configuration that is actually running, never a
 * promise of a method that is switched off.
 *
 *   credits  the owner's decision of 2026-11-07, "credits now, cash later"
 *            (PARTNER_PAYOUT_FORM unset or "credits"): commissions become
 *            RepGet credits at the smallest credit pack's price.
 *   cash     PARTNER_PAYOUT_FORM=cash: Daniel's payout wording - bank
 *            payouts through Stripe Connect, or PayPal where available -
 *            exactly as he wrote it.
 *
 * `countries` are the ones an application is accepted from: Stripe's, plus
 * PayPal's while PayPal payouts can run (use-cases/paypal-payouts.ts), the
 * same list the server checks.
 */
export type PublicPayoutTerms =
  | { form: "credits"; pack: CreditPack | null; countries: string[] }
  | { form: "cash"; countries: string[] };

export async function publicPayoutTerms(deps: PartnerDeps): Promise<PublicPayoutTerms> {
  const countries = payableCountries(deps);
  if ((deps.settings.payoutForm?.() ?? "cash") === "cash") return { form: "cash", countries };
  return { form: "credits", pack: await deps.uow.repositories.credits.smallestPack(), countries };
}
