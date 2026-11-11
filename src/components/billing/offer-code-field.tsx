import { BadgePercent } from "lucide-react";

import { formatPrice } from "@/lib/billing-shared";
import { repgetFirstPaymentCents, type OfferPlan } from "@/lib/billing/repget-offer";
import { winbackFirstPaymentCents } from "@/lib/billing/winback-offer";
import { format } from "@/lib/i18n/format";
import type { OfferCodeCopy } from "@/lib/i18n/offer-code";

/**
 * The REPGET discount, said to be applied (lib/billing/repget-offer.ts): since
 * 2026-11-11 checkout carries it by itself, so there is no code to type.
 *
 * With a plan, the plan's own discounted payment is stated - every payment for
 * REPGET's launch price, the first one for the win-back offer - and nothing is
 * shown for a plan the offer does not cover (the Grow + Visibility bundle, an
 * older price). Without one (the billing page's list of plans) the general terms.
 */
export function OfferApplied({
  copy,
  plan,
  className,
}: {
  copy: OfferCodeCopy;
  plan?: OfferPlan | null;
  className?: string;
}) {
  // The win-back discount when the words are its own (lib/billing/winback-offer.ts), else REPGET (the price of every payment).
  const firstPayment = copy.offer === "winback" ? winbackFirstPaymentCents : repgetFirstPaymentCents;
  const first = plan ? firstPayment(plan) : null;
  if (plan && first === null) return null;

  return (
    <div className={`rounded-2xl border border-primary/30 bg-primary/5 p-4 ${className ?? ""}`} role="status">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <BadgePercent className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {copy.label}
      </p>
      {plan && first !== null ? (
        <p className="mt-1.5 text-sm text-foreground">
          {format(plan.interval === "year" ? copy.firstYear : copy.firstMonth, {
            price: formatPrice(first, plan.currency),
            regular: formatPrice(plan.priceCents, plan.currency),
          })}
        </p>
      ) : null}
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{copy.help}</p>
    </div>
  );
}
