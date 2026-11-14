"use client";

import { ArrowRight, Check, Loader2, MailCheck, ShieldCheck, Star } from "lucide-react";
import { getMessages, type Messages } from "@/lib/i18n/messages";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PayPalMark } from "@/components/paypal-mark";
import { authClient } from "@/lib/auth-client";
import { confirmEmail, type ConfirmEmailResult } from "@/lib/auth/confirm-email-actions";
import { formatPrice } from "@/lib/billing-shared";
import { perMonthOfYear, planDisplayPrice } from "@/lib/billing/display-prices";
import { REPGET_PERCENT_OFF } from "@/lib/billing/repget-offer";
import { format } from "@/lib/i18n/format";
import { planFeatures, TRIAL_DAYS, type PickerPlan } from "@/lib/plans/features";
import { OfferApplied } from "@/components/billing/offer-code-field";
import type { DirectPurchaseCopy } from "@/lib/i18n/direct-purchase";
import type { OfferCodeCopy } from "@/lib/i18n/offer-code";
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
 * THE FREE TRIAL IS REAL (client, 2026-11-13: "3-day free trial is good
 * instead of 3 free articles", with the plan's "normal service"). Card
 * checkout gives a new workspace a Stripe trial of TRIAL_DAYS, PayPal a plan
 * whose first cycle is TRIAL_DAYS free days, and the plan starts and is
 * charged when the trial ends unless it is cancelled before. An offer claimed
 * here but not applied at checkout would be a false statement about money on
 * the screen where the card is entered. The exact first-charge date is left
 * to Stripe's own Checkout page — see the note further down.
 *
 * THE CARD FOLLOWS DANIEL'S CHECKOUT CARD (2026-11-13, "RepGet | Grow Plan
 * Checkout Card"): the plan's regular price large, the REPGET discount in its
 * own box under the yearly switch, "Start free trial", the trial's terms under
 * it, PayPal with its own line, then what the plan includes and the usage
 * note. Every amount is planDisplayPrice's (the same code checkout uses).
 *
 * The email is confirmed first, with a code, when the trial is on offer:
 * checkout refuses without it (lib/stripe/actions.ts), so nobody can collect
 * a second trial under a made-up address.
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
  initialTier,
  monthlyPlans,
  annualPlans,
  paypalAvailable,
  offerCopy = null,
  directPurchase = null,
  paypalPlanIds,
  paypalTrialPlanIds = [],
  websiteId,
  trialEligible = true,
  emailVerified = true,
  email = "",
  t = getMessages("en").app.onboarding,
  benefits = {},
  descriptions = {},
  usageNote = null,
}: {
  /**
   * What each plan includes, by plan id, in the reader's language - the
   * pricing page's lists (lib/plans/benefits.ts), worked out on the server.
   * A plan without one keeps the English list (lib/plans/features.ts).
   */
  benefits?: Record<string, string[]>;
  /**
   * Each plan's one-line description, by plan id, in the reader's language:
   * the pricing page's own line for the tier (lib/i18n/pricing-page.ts).
   * A plan without one keeps the general line.
   */
  descriptions?: Record<string, string>;
  /**
   * The pricing page's usage note (Growth Copilot's free messages a day,
   * lib/chat/config.ts CHAT_FREE_PER_DAY; social actions in credits), under
   * the feature list as the design has it. Null leaves it out.
   */
  usageNote?: string | null;
  /** The tier whose button was pressed on the way here, if it is on sale. */
  initialTier?: string;
  monthlyPlans: PickerPlan[];
  annualPlans: PickerPlan[];
  /** Whether PayPal can complete a checkout at all (lib/paypal/client.ts). */
  paypalAvailable: boolean;
  /** The REPGET notice's words (applied automatically, on every payment), or null while the offer is off. */
  offerCopy?: OfferCodeCopy | null;
  /**
   * Set when the plan on screen is bought outright (the Grow + Visibility
   * bundle, lib/plans/features.ts DIRECT_PURCHASE_TIERS): no free trial,
   * no email code, the first payment taken at checkout.
   */
  directPurchase?: DirectPurchaseCopy | null;
  /** The plans that exist in PayPal; any other gets no PayPal button. */
  paypalPlanIds: string[];
  /**
   * The plans whose PayPal checkout can give the free trial: those with
   * their trial PayPal plan (plans.paypal_trial_plan_id).
   */
  paypalTrialPlanIds?: string[];
  /**
   * Whether checkout will actually give the free trial: only a workspace
   * that has never subscribed (lib/billing/checkouts.ts isTrialEligible).
   * Promising an offer checkout will not give would be a false statement
   * about money on the screen where the card is entered.
   */
  trialEligible?: boolean;
  /** Whether the signed-in address is confirmed; the free trial needs it. */
  emailVerified?: boolean;
  /** The signed-in address, where the confirmation code is sent. */
  email?: string;
  /** The website this plan pays for. Always present: step one created it. */
  websiteId: string;
  /** This step's copy, defaulting to English. */
  t?: Messages["app"]["onboarding"];
}) {
  const [annual, setAnnual] = useState(false);
  /**
   * Which tier is on screen. The mid tier by default — the reference opens on
   * Grow and offers Scale through a link, which is the same judgement: most
   * customers want the middle one, and the cheapest is not the one to lead a
   * paid product with. Unless they pressed a plan's button to get here: then
   * the plan they read about is the one on screen.
   */
  const [tier, setTier] = useState(
    () =>
      monthlyPlans.find((plan) => plan.tier === initialTier)?.tier ??
      monthlyPlans.find((plan) => plan.tier === "grow")?.tier ??
      monthlyPlans[0]?.tier ??
      "",
  );
  const [pending, setPending] = useState<string | null>(null);
  const [verified, setVerified] = useState(emailVerified);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState<"send" | "confirm" | null>(null);

  /**
   * The free trial, as checkout will give it: never on a plan bought
   * outright (lib/billing/checkouts.ts beginCheckout).
   */
  const trial = trialEligible && !directPurchase;
  /** The code step stands between a new workspace and card checkout. */
  const needsEmail = trial && !verified;

  async function sendCode() {
    setChecking("send");
    // Better Auth's own route: rate limited, and the code is hashed and expires (lib/auth.ts).
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    setChecking(null);
    if (error) {
      toast.error("We could not send the code. Please try again in a minute.");
      return;
    }
    setCodeSent(true);
    setCode("");
    toast.success(`We sent a 6-digit code to ${email}.`);
  }

  async function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecking("confirm");
    const result: ConfirmEmailResult = await confirmEmail(code);
    setChecking(null);
    if (result.ok) {
      setVerified(true);
      toast.success("Email confirmed.");
      return;
    }
    toast.error(
      result.error === "INVALID"
        ? "That code is not right. Check the email and try again."
        : result.error === "EXPIRED" || result.error === "TOO_MANY"
          ? "That code no longer works. Send a new one."
          : "We could not check the code. Please try again.",
    );
  }

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
  /*
    The price checkout charges, and the regular one struck beside it only
    when checkout really takes something off (lib/billing/display-prices.ts,
    the same function /pricing and Billing read): REPGET's launch price while
    its notice is on screen, and the Grow + Visibility bundle against EUR 299.
  */
  const repgetOn = Boolean(offerCopy) && offerCopy?.offer !== "winback";
  const shown = plan ? planDisplayPrice(plan, repgetOn) : null;
  const chargedCents = shown?.chargedCents ?? plan?.priceCents ?? 0;
  const yearly = Boolean(annual && annualForTier);
  /** REPGET's launch price applies to this plan: its box says so, under the switch. */
  const repget = shown?.discount === "repget";
  /*
    The large figure, per month. With REPGET it is the REGULAR price, as
    Daniel's card draws it ("€149 /month"), and the discount box right under
    it gives the payment checkout takes ("€89 instead of €149"). Otherwise it
    is what checkout charges - for the Grow + Visibility bundle with its list
    price struck beside it, as /pricing shows it.
  */
  const bigCents = repget ? (plan?.priceCents ?? 0) : chargedCents;
  const perMonthCents = yearly ? perMonthOfYear(bigCents) : bigCents;
  const strikeCents =
    !repget && shown?.strikeCents ? (yearly ? perMonthOfYear(shown.strikeCents) : shown.strikeCents) : null;

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
   * So this page states the RULE — the free days, when the plan starts,
   * then the price — and Stripe states the date.
   */

  async function handleCheckout(provider: "stripe" | "paypal") {
    if (!plan) return;
    // REPGET is applied by the server by itself (2026-11-11), card or PayPal; nothing to send.
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
        {t.plansUnavailable}
        </div>
    );
  }

  const features = benefits[plan.id] ?? planFeatures(plan);
  /*
    PayPal for THIS plan: configured, and the plan mirrored into PayPal. A
    plan without a PayPal plan id used to show the button and answer the
    click with an error.
  */
  const paypal = paypalAvailable && paypalPlanIds.includes(plan.id);
  /*
    PayPal gives the free trial too when this plan has its trial PayPal plan -
    the same offer, so the same confirmed address first (createPayPalCheckout
    refuses without it, as card checkout does).
  */
  const paypalTrial = paypal && trial && paypalTrialPlanIds.includes(plan.id);
  const description =
    descriptions[plan.id] ??
    "Everything you need to grow organic traffic from Google and AI search, on autopilot.";
  const money = (cents: number) => formatPrice(cents, plan.currency);

  /**
   * The badge on the card, per the design.
   *
   * Named by tier rather than by position: an index-based rule silently moves
   * to the wrong plan the first time the line-up changes, which is exactly how
   * the pricing page once highlighted the wrong tier.
   */
  const badge = directPurchase
    ? directPurchase.badge
    : plan.tier === "grow"
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
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        {t.growthEngineReady}
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
          className={`mt-4 grid ${monthlyPlans.length === 3 ? "grid-cols-3" : "grid-cols-2"} gap-1 rounded-2xl border bg-muted/50 p-1 sm:flex sm:rounded-full`}
        >
          {monthlyPlans.map((option) => (
            <button
              key={option.tier}
              type="button"
              role="radio"
              aria-checked={option.tier === tier}
              onClick={() => setTier(option.tier)}
              /*
                The selected tab carries the brand colour, not just a white
                pill. "bg-background shadow-sm" on a muted track is a
                difference you have to look for — the client did, and asked
                to "highlight the box grow plan when you are on that plan".
                On the screen where someone picks what to pay for, which
                option is selected should be unmissable.

                THE UNSELECTED TAB IS text-foreground, NOT text-muted-
                foreground. Muted grey on this near-white track measures
                around 3.3:1, under the 4.5:1 minimum for normal text — the
                client read the two tabs as "the same letters" because the
                unselected one was barely there. Both options are real
                choices with real prices, and the price you are NOT on is
                the one somebody is trying to read when they compare.

                The selection is carried by the filled pill, which is
                unmistakable on its own; dimming the other label adds
                nothing to that and costs legibility.
              */
              className={`rounded-full px-3 py-2 text-sm font-medium transition-colors sm:flex-1 sm:px-4 ${
                option.tier === tier
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-background/70"
              }`}
            >
              {/*
                The price wraps under the name rather than beside it on a
                phone: a nowrap "Scale · €299" is what forced the row wide.
              */}
              <span className="block sm:inline">{option.name}</span>
              <span className="hidden sm:inline"> &middot; </span>
              <span className="block text-xs sm:inline sm:text-sm">
                {formatPrice(planDisplayPrice(option, repgetOn).chargedCents, option.currency)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {/*
        The card, as Daniel's checkout card draws it: a 1.5px ring in the
        brand colour and a 19px corner. The ring also makes the tab and the
        card read as one selected thing - without it the switcher moved but
        the card below looked identical either way. --primary is the design's
        orange (#d84a00) darkened for contrast (globals.css), so the token is
        used rather than the raw hex.
      */}
      <section
        aria-label={`${plan.name} plan`}
        className="mt-5 rounded-[19px] border-[1.5px] border-primary bg-card px-4 pt-5 pb-5 shadow-[0_12px_50px_rgba(19,19,19,0.025)] min-[501px]:px-[22px] min-[501px]:pt-[22px]"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight">{plan.name} plan</h2>
          {/*
            The badge from the design: "Most popular plan" on Grow, "Best
            value" on Scale. Read from the tier rather than position, so it
            cannot follow array order if the line-up changes.
            text-primary-strong: plain --primary on a 10% tint is 4.25:1.
          */}
          {badge ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold whitespace-nowrap text-primary-strong">
              <Star className="size-3 fill-current" aria-hidden="true" />
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {strikeCents !== null ? (
            <del className="text-2xl text-muted-foreground tabular-nums">{money(strikeCents)}</del>
          ) : null}
          <span className="text-5xl leading-none font-extrabold tracking-tight tabular-nums">
            {money(perMonthCents)}
          </span>
          <span className="text-sm text-muted-foreground">/month</span>
        </div>

        {/* The billing switch from the design: a toggle, not two radio pills. */}
        {annualForTier ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={annual}
                aria-label={t.payYearly}
                onClick={() => setAnnual((current) => !current)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-[3px] focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none ${
                  annual ? "bg-primary" : "bg-muted-foreground/25"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-background shadow transition-[left] motion-reduce:transition-none ${
                    annual ? "left-5.5" : "left-0.5"
                  }`}
                  aria-hidden="true"
                />
              </button>
              <span className="text-sm font-medium">
                {t.payYearly}
                {saving ? (
                  <span className="ml-1 font-bold text-primary-strong">
                    &middot; save {saving}%
                  </span>
                ) : null}
              </span>
            </div>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {annual ? "Billed annually" : "Billed monthly"}
            </span>
          </div>
        ) : null}

        {/*
          The discount box from the design ("REPGET 40% OFF applied" / "Each
          monthly payment: €89 instead of €149."): the offer's own notice,
          which states the plan's real payment and renders nothing for a plan
          the offer does not cover.
        */}
        {offerCopy && !directPurchase ? <OfferApplied copy={offerCopy} plan={plan} className="mt-4" /> : null}

        {/*
          The email code, before card checkout gives the free trial. Sent only
          when asked for, so nobody receives a code for a page they merely
          looked at. Right above the button it unlocks.
        */}
        {needsEmail ? (
          <div className="mt-4 rounded-2xl border bg-muted/40 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <MailCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
              Confirm your email to start your {TRIAL_DAYS}-day free trial
            </p>
            {codeSent ? (
              <form onSubmit={submitCode} className="mt-3 flex flex-wrap gap-2">
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  aria-label="Confirmation code"
                  className="h-11 min-w-0 flex-1 rounded-full bg-background px-4 tracking-[0.3em]"
                />
                <Button type="submit" disabled={checking !== null || code.length !== 6} className="h-11 rounded-full px-5">
                  {checking === "confirm" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Confirm
                </Button>
                <p className="w-full text-xs text-muted-foreground">
                  Sent to {email}.{" "}
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={checking !== null}
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    Send a new code
                  </button>
                </p>
              </form>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={sendCode} disabled={checking !== null} className="h-11 rounded-full px-5">
                  {checking === "send" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Email me a code
                </Button>
                <span className="min-w-0 text-xs text-muted-foreground">We send it to {email}.</span>
              </div>
            )}
          </div>
        ) : null}

        <Button
          onClick={() => handleCheckout("stripe")}
          disabled={pending !== null || needsEmail}
          className="mt-4 h-12 w-full rounded-full text-[15px] font-bold focus-visible:ring-primary/30 focus-visible:ring-offset-2"
        >
          {pending === "stripe" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Starting checkout&hellip;
            </>
          ) : (
            <>
              {directPurchase ? directPurchase.button : trial ? "Start free trial" : "Continue to payment"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>

        {/*
          The offer's terms, spelled out under the button.

          TRIAL_DAYS is the constant checkout passes to Stripe, so the promise
          and the charge cannot drift apart. When the plan starts is stated
          plainly rather than left as "cancel any time": someone entering a
          card is owed when money leaves their account, not a reassuring
          phrase. A yearly plan with REPGET leaves the total to checkout, as
          the design does; every other figure is planDisplayPrice's.
        */}
        {directPurchase ? (
          <p className="mt-2.5 text-center text-sm leading-relaxed text-muted-foreground">
            {format(directPurchase.note, { price: money(plan.priceCents) })}
          </p>
        ) : trial ? (
          <p className="mt-2.5 text-center text-sm leading-relaxed text-muted-foreground">
            <strong className="font-semibold text-foreground">
              {money(0)} today &middot; {TRIAL_DAYS} days free.
            </strong>{" "}
            {yearly
              ? repget
                ? "Then your discounted annual plan begins at the total shown at checkout, unless you cancel before the trial ends."
                : `Then ${money(chargedCents)}/year, unless you cancel before the trial ends.`
              : repget
                ? `Then ${money(chargedCents)}/month with your ${REPGET_PERCENT_OFF}% discount, unless you cancel before the trial ends.`
                : `Then ${money(chargedCents)}/month, unless you cancel before the trial ends.`}
          </p>
        ) : (
          <p className="mt-2.5 text-center text-sm leading-relaxed text-muted-foreground">
            {money(chargedCents)} {yearly ? "a year" : "a month"}, charged today. This workspace has
            already had its free trial.
          </p>
        )}

        {/*
          PayPal, per the brief: "We include also PayPal payments, not just
          Cards". Shown only when it can complete — a button that answers "not
          configured" is worse than no button.
        */}
        {paypal ? (
          <Button
            variant="outline"
            onClick={() => handleCheckout("paypal")}
            disabled={pending !== null || (paypalTrial && needsEmail)}
            className="mt-3 h-11 w-full rounded-full bg-background focus-visible:ring-primary/30 focus-visible:ring-offset-2"
          >
            {pending === "paypal" ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Redirecting to PayPal&hellip;
              </>
            ) : (
              <>
                {/*
                  The real mark, not a generic wallet icon. This is the one
                  screen where a customer is deciding whether to hand over
                  money, and a stand-in logo reads as an imitation.
                */}
                <PayPalMark className="size-6" />
                Pay with PayPal
              </>
            )}
          </Button>
        ) : null}

        {/*
          What PayPal does with the trial, said plainly: the same free days
          when this plan has its trial PayPal plan, otherwise charged at once.
          Nothing to add for a workspace that has had its trial: card and
          PayPal both charge today, as the line above says. Both n and days
          are the trial's days, so the line reads right in either wording.
        */}
        {paypal && trial ? (
          <p className="mt-1.5 text-center text-xs leading-relaxed text-muted-foreground">
            {paypalTrial ? format(t.paypalFreeArticles, { n: TRIAL_DAYS, days: TRIAL_DAYS }) : t.paypalNoTrial}
          </p>
        ) : null}

        <p className="mt-2.5 text-center text-xs text-muted-foreground">{t.cancelAnyTime}</p>

        <div className="mt-5 border-t pt-5">
          <h3 className="text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
            {t.whatsIncluded}
          </h3>
          {/*
            Two columns, as the design draws them, down to 366px; one below
            that, where two columns of small print stop being readable.
          */}
          <ul className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 min-[366px]:grid-cols-2">
            {features.map((feature) => (
              <li key={feature} className="flex min-w-0 items-start gap-2 text-sm leading-snug min-[366px]:text-[13px] sm:text-sm">
                {/*
                  A filled circle rather than a bare tick, matching the
                  design's orange check marks.
                */}
                <span
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary"
                  aria-hidden="true"
                >
                  <Check className="size-2.5 text-primary-foreground" strokeWidth={3} />
                </span>
                <span className="min-w-0">{marks(feature)}</span>
              </li>
            ))}
          </ul>
          {/*
            The design's usage note: the pricing page's own sentence, which
            states what the product enforces (CHAT_FREE_PER_DAY free Growth
            Copilot messages a day, then credits; some social actions in
            credits).
          */}
          {usageNote ? (
            <p className="mt-4 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">{usageNote}</p>
          ) : null}
        </div>
      </section>

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
        {t.secureByStripe}
        </p>
    </div>
  );
}

/** The pricing copy's one mark, `**words**` in bold. Never HTML. */
function marks(text: string): ReactNode {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, index) => (index % 2 === 1 ? <strong key={index} className="font-semibold">{part}</strong> : part));
}
