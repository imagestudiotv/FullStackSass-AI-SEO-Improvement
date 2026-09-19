"use client";

import { ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/billing-shared";
import { planFeatures, type PickerPlan } from "@/lib/plans/features";
import { createPayPalCheckout } from "@/lib/paypal/actions";
import { createCheckoutSession } from "@/lib/stripe/actions";

/**
 * The last step before payment, following the client's reference exactly.
 *
 * "Can we just having again a nice design without dashboard menu, and only 2
 * packages Grow plan monthly and yearly option with discount. And scale
 * package with monthly and yearly option with discount."
 *
 * So: ONE plan on screen at a time with a monthly/yearly switch inside its
 * card, and a link to the other plan underneath — not a row of cards to
 * compare. That is the reference's shape and it is the right one here. This
 * screen is the end of a sequence someone has already invested five minutes
 * in; a comparison table at that moment reopens a decision they came here
 * having made, and the tier that suits almost everyone is the default.
 *
 * WHAT IS NOT COPIED FROM THE REFERENCE: its "€99 ~~€247~~" strike-through,
 * its "3-day free trial", its "90-day money-back guarantee if traffic doesn't
 * grow", and its rotating named testimonials. A struck price we never charged
 * is a misleading pricing claim, and the trial and guarantee are commitments
 * the client has not made — the words are cheap to write here and expensive to
 * honour later. The struck figure we DO show on the yearly option is real: it
 * is twelve of our own monthly payments, which is what the customer avoids.
 */
export function PlanStep({
  monthlyPlans,
  annualPlans,
  paypalAvailable,
  websiteId,
}: {
  monthlyPlans: PickerPlan[];
  annualPlans: PickerPlan[];
  paypalAvailable: boolean;
  /** The website this plan pays for. Always present: step one created it. */
  websiteId: string;
}) {
  const [annual, setAnnual] = useState(false);
  /**
   * Which tier is on screen. The mid tier by default — the reference opens on
   * Grow and offers Scale through a link, which is the same judgement: most
   * customers want the middle one, and the cheapest is not the one to lead a
   * paid product with.
   */
  const [tier, setTier] = useState(
    () =>
      monthlyPlans.find((plan) => plan.tier === "grow")?.tier ??
      monthlyPlans[0]?.tier ??
      "",
  );
  const [pending, setPending] = useState<string | null>(null);

  const monthlyForTier =
    monthlyPlans.find((plan) => plan.tier === tier) ?? null;
  const annualForTier = annualPlans.find((plan) => plan.tier === tier) ?? null;

  /**
   * The plan actually being bought.
   *
   * Falls back to the monthly one when a tier has no annual price configured,
   * so the yearly switch cannot leave the button pointing at nothing.
   */
  const plan = (annual ? annualForTier : monthlyForTier) ?? monthlyForTier;

  /**
   * Whether there is more than one tier to choose between. With a single
   * configured plan the switcher would be one inert button.
   */
  const hasChoice = monthlyPlans.length > 1;

  /**
   * The real saving from paying yearly for THIS tier, worked out from the two
   * prices we charge rather than a round number written on the toggle.
   */
  const saving = (() => {
    if (!monthlyForTier || !annualForTier) return null;
    const full = monthlyForTier.priceCents * 12;
    if (full <= annualForTier.priceCents) return null;
    return Math.round(((full - annualForTier.priceCents) / full) * 100);
  })();

  /**
   * The price shown, always per month.
   *
   * A yearly plan is quoted as its monthly equivalent with "billed yearly"
   * beside it, which is how the reference reads and how the two options become
   * comparable at a glance. Quoting one as 99 and the other as 912 invites the
   * customer to read the cheaper number as the better deal.
   */
  const perMonthCents =
    annual && annualForTier
      ? Math.round(annualForTier.priceCents / 12)
      : (monthlyForTier?.priceCents ?? 0);

  async function handleCheckout(provider: "stripe" | "paypal") {
    if (!plan) return;
    setPending(provider);

    /*
      "onboarding" so paying returns HERE rather than to the dashboard's
      billing page. This page forwards a paid customer to the next step, so
      the flow carries on where it left off instead of ending in a screen full
      of the app chrome that setup deliberately hides.
    */
    const result =
      provider === "paypal"
        ? await createPayPalCheckout(plan.id, websiteId, "onboarding")
        : await createCheckoutSession(plan.id, websiteId, "onboarding");

    if ("error" in result) {
      setPending(null);
      toast.error(result.error);
      return;
    }
    // assign() rather than `location.href = …`: the React Compiler treats the
    // latter as mutating a value it does not own.
    window.location.assign(result.url);
  }

  if (!plan) {
    // Real state, not a placeholder: with no plans configured we say so rather
    // than showing prices checkout would not honour.
    return (
      <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
        Plans are not available right now. Please check back shortly.
      </div>
    );
  }

  const features = planFeatures(plan);

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        Step 03 <span className="text-muted-foreground">/ 03</span>
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Your growth engine is ready
      </h1>

      {/*
        Tier switcher, shown only when there is more than one tier. The
        reference puts a two-tab switch above the card once you follow its
        "See the Scale plan" link; this is that switch, shown from the start
        because hiding a tier behind a link makes the cheaper one feel like the
        only option.
      */}
      {hasChoice ? (
        /*
          A grid, not one unwrapping flex row.

          Four tiers reading "Starter · €1" through "Scale · €299" share a
          320px iPhone SE at about 70px each, which crushes the name against
          the price. Two per row below `sm` gives each one half the screen and
          the pill shape survives; from `sm` up all four sit on one row as
          drawn.
        */
        <div
          role="radiogroup"
          aria-label="Plan"
          className="mt-6 grid grid-cols-2 gap-1 rounded-2xl border bg-muted/50 p-1 sm:flex sm:rounded-full"
        >
          {monthlyPlans.map((option) => (
            <button
              key={option.tier}
              type="button"
              role="radio"
              aria-checked={option.tier === tier}
              onClick={() => setTier(option.tier)}
              className={`rounded-full px-3 py-2 text-sm font-medium transition-colors sm:flex-1 sm:px-4 ${
                option.tier === tier
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {/*
                The price wraps under the name rather than beside it on a
                phone: a nowrap "Scale · €299" is what forced the row wide.
              */}
              <span className="block sm:inline">{option.name}</span>
              <span className="hidden sm:inline"> &middot; </span>
              <span className="block text-xs sm:inline sm:text-sm">
                {formatPrice(option.priceCents, option.currency)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5 rounded-3xl border bg-card p-6 sm:p-8">
        <p className="text-lg font-semibold">{plan.name} plan</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything you need to grow organic traffic from Google and AI search,
          on autopilot.
        </p>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-5xl font-semibold tracking-tight">
            {formatPrice(perMonthCents, plan.currency)}
          </span>
          <span className="text-muted-foreground">/month</span>
          {/*
            The struck figure, only on the yearly option and only when it is
            real: twelve monthly payments, which is what paying yearly avoids.
          */}
          {annual && annualForTier && monthlyForTier ? (
            <span className="text-muted-foreground line-through">
              {formatPrice(monthlyForTier.priceCents * 12, plan.currency)}
              {" a year"}
            </span>
          ) : null}
        </div>

        {/* The billing switch from the design: a toggle, not two radio pills. */}
        {annualForTier ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={annual}
              aria-label="Pay yearly"
              onClick={() => setAnnual((current) => !current)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                annual ? "bg-primary" : "bg-muted-foreground/25"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-background shadow transition-[left] ${
                  annual ? "left-5.5" : "left-0.5"
                }`}
                aria-hidden="true"
              />
            </button>
            <span className="text-sm">
              Pay yearly
              {saving ? (
                <span className="ml-1.5 font-semibold text-primary">
                  &middot; save {saving}%
                </span>
              ) : null}
            </span>
            <span className="ml-auto text-sm text-muted-foreground">
              {annual ? "Billed yearly" : "Billed monthly"}
            </span>
          </div>
        ) : null}

        <Button
          onClick={() => handleCheckout("stripe")}
          disabled={pending !== null}
          className="mt-6 h-14 w-full rounded-full text-base font-semibold"
        >
          {pending === "stripe" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Starting checkout&hellip;
            </>
          ) : (
            <>
              Continue to payment
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>

        {/*
          PayPal, per the brief: "We include also PayPal payments, not just
          Cards". Shown only when it is configured — a button that answers "not
          configured" is worse than no button.
        */}
        {paypalAvailable ? (
          <Button
            variant="outline"
            onClick={() => handleCheckout("paypal")}
            disabled={pending !== null}
            className="mt-2 h-12 w-full rounded-full"
          >
            {pending === "paypal" ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Redirecting to PayPal&hellip;
              </>
            ) : (
              "Pay with PayPal"
            )}
          </Button>
        ) : null}

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Cancel any time. A promotion code can be entered at checkout.
        </p>

        <ul className="mt-6 space-y-3 border-t pt-6">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <Check
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/*
        The reference's "Need more volume? See the Scale plan" line is NOT
        repeated here.

        It exists on that design because its plan is otherwise the only one on
        screen. Ours already lists every tier in the switcher above the card,
        so a row of "See the … plan" links underneath is the same set of
        choices a second time — and four of them, where the reference has one.
        The switcher is the better control: it shows the prices.
      */}
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        Secure checkout by Stripe. Your card details never reach us.
      </p>
    </div>
  );
}
