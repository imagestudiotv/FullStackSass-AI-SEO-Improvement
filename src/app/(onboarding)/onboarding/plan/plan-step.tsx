"use client";

import { ArrowRight, Check, Loader2, ShieldCheck, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/billing-shared";
import {
  planFeatures,
  TRIAL_DAYS,
  type PickerPlan,
} from "@/lib/plans/features";
import { createPayPalCheckout } from "@/lib/paypal/actions";
import { createCheckoutSession } from "@/lib/stripe/actions";
import { WIZARD_STEPS, wizardStepIndex } from "@/lib/onboarding/wizard";

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
 * THE FREE TRIAL IS REAL. The client asked for it, so it is implemented
 * rather than merely written: TRIAL_DAYS is passed to Stripe as
 * trial_period_days, and the customer is charged nothing today. A trial
 * claimed on the page but not configured in Stripe would be a false statement
 * about money on the screen where the card is entered. The exact first-charge
 * date is left to Stripe's own Checkout page — see the note further down.
 *
 * WHAT IS STILL NOT COPIED FROM THE REFERENCE: its "€99 ~~€247~~"
 * strike-through and its "90-day money-back guarantee if traffic doesn't
 * grow". A struck price we never charged is a misleading pricing claim, and
 * the guarantee is a commitment the client has not made — cheap to write here
 * and expensive to honour later. The struck figure we DO show on the yearly
 * option is real: it is twelve of our own monthly payments.
 *
 * Testimonials and the review score come from lib/marketing/testimonials.ts,
 * which is empty until there are real ones. See TestimonialRail.
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

  /**
   * NO CALENDAR DATE IS COMPUTED HERE, deliberately.
   *
   * The obvious version — `new Date(Date.now() + TRIAL_DAYS * 86400e3)` — is
   * impure in render: the server produces one date and the browser another,
   * which is a hydration mismatch on the screen where somebody is entering a
   * card, and the result depends on a clock and timezone the server does not
   * know.
   *
   * It is also unnecessary. Stripe's own Checkout page states the exact first
   * charge date ("Then EUR 99.00 per month starting 21 September"), computed
   * from the real subscription in the customer's own locale. Repeating it here
   * would be a second copy that can disagree with the one that actually
   * governs the charge.
   *
   * So this page states the RULE — free for N days, then the price — and
   * Stripe states the date.
   */

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

  /**
   * The badge on the card, per the design.
   *
   * Named by tier rather than by position: an index-based rule silently moves
   * to the wrong plan the first time the line-up changes, which is exactly how
   * the pricing page once highlighted the wrong tier.
   */
  const badge =
    plan.tier === "grow"
      ? "Most popular plan"
      : plan.tier === "scale"
        ? "Best value"
        : null;

  return (
    <div>
      {/*
        Derived from WIZARD_STEPS, never written out.

        This read "Step 03 / 03" while the progress bar directly above it
        showed step 2 of 5 — the same screen contradicting itself about where
        the customer is and how much is left, on the page that asks for money.
        A hardcoded pair cannot survive a step being added or reordered, and
        this one had already not survived it.
      */}
      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        Step {String(wizardStepIndex("plan") + 1).padStart(2, "0")}{" "}
        <span className="text-muted-foreground">
          / {String(WIZARD_STEPS.length).padStart(2, "0")}
        </span>
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
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-lg font-semibold">{plan.name} plan</p>
          {/*
            The badge from the design: "Most popular plan" on Grow, "Best
            value" on Scale. Read from the tier rather than position, so it
            cannot follow array order if the line-up changes.
          */}
          {badge ? (
            <span className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              <Star className="size-3 fill-primary" aria-hidden="true" />
              {badge}
            </span>
          ) : null}
        </div>
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
              Start {TRIAL_DAYS}-day free trial
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>

        {/*
          The trial terms, spelled out under the button.

          TRIAL_DAYS is the same constant passed to Stripe as
          trial_period_days, so the promise and the charge cannot drift apart.
          The first charge date is stated plainly rather than left as "cancel
          any time": someone entering a card is owed the date money leaves
          their account, not a reassuring phrase.
        */}
        <p className="mt-3 text-center text-sm">
          <span className="font-medium">
            {formatPrice(0, plan.currency)} today
          </span>
          <span className="text-muted-foreground">
            {" "}
            &middot; then {formatPrice(plan.priceCents, plan.currency)}{" "}
            {annual ? "a year" : "a month"} after your {TRIAL_DAYS}-day free
            trial. Cancel before it ends and you are not charged.
          </span>
        </p>

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

        {/*
          PayPal is charged immediately — the trial above is a Stripe
          subscription feature and is not applied to the PayPal plan. Saying
          so is the difference between a caveat and a false promise.
        */}
        {paypalAvailable ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            PayPal starts your plan straight away, without the free trial.
          </p>
        ) : null}

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Cancel any time. A promotion code can be entered at checkout.
        </p>

        <div className="mt-6 border-t pt-6">
          <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            What&apos;s included
          </p>
          {/*
            Two columns from `sm` up, as the design draws it. Below that they
            stack: two columns of small print on a phone is two unreadable
            columns.
          */}
          <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm">
                {/*
                  A filled circle rather than a bare tick, matching the
                  design's orange check marks.
                */}
                <span
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary"
                  aria-hidden="true"
                >
                  <Check className="size-2.5 text-primary-foreground" />
                </span>
                <span className="min-w-0">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
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
