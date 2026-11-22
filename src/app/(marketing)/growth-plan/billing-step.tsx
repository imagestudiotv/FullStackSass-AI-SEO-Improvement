"use client";

import { Loader2, Lock, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useEmailCode, useStartFree, type EmailCodeNotice } from "@/app/(site)/(onboarding)/onboarding/plan/free-step";
import { OfferApplied } from "@/components/billing/offer-code-field";
import { PayPalMark } from "@/components/paypal-mark";
import { PayPalPendingNotice } from "@/components/paypal-pending-notice";
import { PayPalPendingPrompt } from "@/components/paypal-pending-prompt";
import { formatPrice } from "@/lib/billing-shared";
import { REPGET_PERCENT_OFF } from "@/lib/billing/repget-offer";
import { readConsent } from "@/lib/consent";
import { fill, type GrowthPlanCopy } from "@/lib/i18n/growth-plan";
import type { OfferCodeCopy } from "@/lib/i18n/offer-code";
import type { PayPalPendingCopy } from "@/lib/i18n/paypal-pending";
import { trackMetaCheckout } from "@/lib/meta-pixel";
import { createPayPalCheckout } from "@/lib/paypal/actions";
import type { FreePlanDisplay } from "@/lib/plans/free-plan";
import { createCheckoutSession } from "@/lib/stripe/actions";

import type { GrowthPlanBilling } from "./billing-actions";
import { checkoutTerms, pickCheckoutPlan, type CheckoutTerms } from "./checkout-terms";
import type { BillingPeriod } from "./flow-steps";
import styles from "./growth-plan.module.css";
import type { FreePlanOption, GrowthPlanOffer } from "./plan-offers";

/** The words this step borrows from the app, in the flow's language (growth-plan-page.tsx). */
export type BillingAppCopy = {
  /** lib/i18n/messages.ts app.onboarding: PayPal without and with the trial, and the plan step's last line. */
  paypalNoTrial: string;
  paypalFreeArticles: string;
  cancelAnyTime: string;
  paypalPending: PayPalPendingCopy;
  /** The plan step's offer notices (lib/i18n/offer-code.ts). */
  offer: { repget: OfferCodeCopy; winback: OfferCodeCopy };
};

/** What prepareGrowthPlanBilling answered for a tier, or null while it is asked. */
export type BillingState = { tier: string; result: GrowthPlanBilling | null } | null;

type Ready = Extract<GrowthPlanBilling, { ok: true }>;
type Paid = Extract<GrowthPlanBilling, { kind: "paid" }>;

/**
 * The flow's last step (Daniel: "and finally the details to insert the
 * billing information"), like explee.com's, which ends on Stripe's hosted
 * checkout:
 *
 *  1. Without an account: the order as it stands and the way to the account
 *     step (the step can always be opened; it cannot be finished yet).
 *  2. With one: the typed website is added to the account
 *     (prepareGrowthPlanBilling, billing-actions.ts, with the onboarding
 *     website step's own addWebsite), shown as it happens.
 *  3. Free: the onboarding plan step's Free start (free-step.tsx useEmailCode
 *     and useStartFree: the email code, then startFreePlanAction), then the
 *     dashboard for the website (billing-actions.ts `next`).
 *     Paid: the order with the plan step's terms (checkout-terms.ts) and its
 *     two buttons, calling createCheckoutSession and createPayPalCheckout
 *     with the plan and website and the "growth-plan" origin, so paying
 *     returns to the dashboard, which waits there for the webhook
 *     (lib/billing/return-to.ts). Card and PayPal details are entered on
 *     Stripe's or PayPal's own page.
 *
 * Daniel, 2026-11-21: "once payment is made they are redirect to the
 * dashboard and not on the other steps reinsert website, connect google,
 * mentions and other options we have. All those can be added on the
 * dashboard we have tasks page." The onboarding steps after the plan are
 * the Tasks page's set-up rows (lib/tasks/tasks.ts ONBOARDING_STEP_TASKS).
 *
 * Anything refused is said here, with a retry where one helps and the usual
 * setup pages as the way round.
 */
export function BillingStep({
  t,
  app,
  host,
  name,
  trialDays,
  tier,
  period,
  offers,
  free,
  freeCard,
  signedIn,
  state,
  fallbackHref,
  onRetry,
  onNeedAccount,
  onChangePlan,
  onChoose,
}: {
  t: GrowthPlanCopy;
  app: BillingAppCopy;
  host: string;
  name: string;
  trialDays: number;
  tier: string | null;
  period: BillingPeriod;
  offers: GrowthPlanOffer[];
  free: FreePlanOption | null;
  /** The Free card's full display (counter, the note when spots are gone), or null. */
  freeCard: FreePlanDisplay | null;
  signedIn: boolean;
  state: BillingState;
  /** The usual setup pages, carrying the website and the plan. */
  fallbackHref: string;
  onRetry: () => void;
  onNeedAccount: () => void;
  onChangePlan: () => void;
  onChoose: (tier: string) => void;
}) {
  const offer = offers.find((option) => option.tier === tier) ?? null;
  const freeChosen = Boolean(free && tier === free.tier);

  if (!signedIn) {
    return (
      <div className={styles.checkout}>
        <Intro t={t} name={name} />
        <div className={styles.checkoutCard}>
          <OrderPreview t={t} host={host} trialDays={trialDays} period={period} offer={offer} free={freeChosen ? free : null} />
          <p className={styles.checkoutNote}>{fill(t.checkout.needAccount, { host })}</p>
          <button type="button" className={styles.primaryButton} onClick={onNeedAccount}>
            {t.flow.toAccount} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    );
  }

  const result = state && state.tier === tier ? state.result : null;
  if (!result) {
    return (
      <div className={styles.checkout} aria-busy="true">
        <Intro t={t} name={name} />
        <div className={styles.checkoutCard}>
          <p className={styles.waiting}>
            <span className={styles.spinner} aria-hidden="true" />
            {fill(t.checkout.preparing, { host })}
          </p>
          <p className={styles.checkoutNote}>{t.checkout.preparingDetail}</p>
          <span className={styles.bar} />
          <span className={styles.bar} data-short />
        </div>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className={styles.checkout}>
        <Intro t={t} name={name} />
        <div className={styles.checkoutCard}>
          <p className={styles.formError} role="alert">
            {fill(t.checkout.failed, { message: result.error })}
          </p>
          <div className={styles.checkoutActions}>
            {result.reason === "signed_out" ? (
              <button type="button" className={styles.primaryButton} onClick={onNeedAccount}>
                {t.flow.toAccount}
              </button>
            ) : (
              <button type="button" className={styles.primaryButton} onClick={onRetry}>
                {t.checkout.retry}
              </button>
            )}
            <Link prefetch={false} href={fallbackHref} className={styles.plansLink}>
              {t.checkout.fallback}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (result.hasPlan) {
    return (
      <div className={styles.checkout}>
        <Intro t={t} name={name} />
        <div className={styles.checkoutCard}>
          <p className={styles.signedIn}>{fill(t.checkout.hasPlan, { host })}</p>
          <Link prefetch={false} href={result.next} className={styles.primaryButton}>
            {t.checkout.hasPlanContinue} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.checkout}>
      <Intro t={t} name={name} />
      {result.kind === "free" && free ? (
        <FreeStart
          key={result.websiteId}
          t={t}
          host={host}
          free={free}
          freeCard={freeCard}
          ready={result}
          fallbackHref={fallbackHref}
          onChangePlan={onChangePlan}
          onPaid={() => {
            const paid = offers.find((option) => option.popular) ?? offers[0];
            if (paid) onChoose(paid.tier);
          }}
        />
      ) : result.kind === "paid" ? (
        <PaidCheckout
          key={`${result.websiteId}-${period}`}
          t={t}
          app={app}
          host={host}
          trialDays={trialDays}
          period={period}
          ready={result}
          fallbackHref={`/onboarding/plan?site=${encodeURIComponent(result.websiteId)}${tier ? `&plan=${encodeURIComponent(tier)}` : ""}`}
          onChangePlan={onChangePlan}
        />
      ) : null}
    </div>
  );
}

function Intro({ t, name }: { t: GrowthPlanCopy; name: string }) {
  return (
    <div className={styles.billingIntro}>
      <p className={styles.kicker}>{t.checkout.heading}</p>
      <p className={styles.billingLead}>{fill(t.checkout.intro, { name })}</p>
    </div>
  );
}

/** Before the account: the order as the plan choice states it (plan-offers.ts), nothing to press but the account. */
function OrderPreview({
  t,
  host,
  trialDays,
  period,
  offer,
  free,
}: {
  t: GrowthPlanCopy;
  host: string;
  trialDays: number;
  period: BillingPeriod;
  offer: GrowthPlanOffer | null;
  free: FreePlanOption | null;
}) {
  const yearly = period === "year" && offer?.yearly ? offer.yearly : null;
  return (
    <>
      <dl className={styles.orderRows}>
        <div>
          <dt>{t.billing.website}</dt>
          <dd>{host}</dd>
        </div>
        <div>
          <dt>{t.billing.plan}</dt>
          <dd>{free ? free.name : (offer?.name ?? "-")}</dd>
        </div>
        {offer && !free ? (
          <div>
            <dt>{yearly ? t.checkout.billedYearly : t.checkout.billedMonthly}</dt>
            <dd>
              {yearly ? yearly.perMonth : offer.price}
              {t.billing.perMonth}
            </dd>
          </div>
        ) : null}
      </dl>
      {free ? (
        <p className={styles.orderTrial}>
          {t.billing.noCard} · {free.priceNote}
        </p>
      ) : offer ? (
        <p className={styles.orderTrial}>{fill(t.billing.trial, { days: trialDays })}</p>
      ) : null}
    </>
  );
}

/** The email code box, the plan step's, in the flow's words. */
function EmailCode({
  t,
  title,
  email,
  code,
}: {
  t: GrowthPlanCopy;
  title: string;
  email: string;
  code: ReturnType<typeof useEmailCode>;
}) {
  return (
    <div className={styles.emailCode}>
      <p className={styles.emailTitle}>
        <MailCheck size={16} aria-hidden="true" />
        {title}
      </p>
      {code.codeSent ? (
        <form onSubmit={(event: FormEvent<HTMLFormElement>) => void code.submitCode(event)} className={styles.codeForm}>
          <input
            value={code.code}
            onChange={(event) => code.setCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t.checkout.codePlaceholder}
            aria-label={t.checkout.codeLabel}
            className={styles.codeInput}
          />
          <button type="submit" className={styles.secondaryButton} disabled={code.busy !== null || code.code.length !== 6}>
            {code.busy === "confirm" ? <Loader2 size={15} className={styles.spin} aria-hidden="true" /> : null}
            {t.checkout.confirm}
          </button>
          <p className={styles.codeHelp}>
            {fill(t.checkout.sentTo, { email })}{" "}
            <button type="button" className={styles.textButton} onClick={() => void code.sendCode()} disabled={code.busy !== null}>
              {t.checkout.resend}
            </button>
          </p>
        </form>
      ) : (
        <div className={styles.codeForm}>
          <button type="button" className={styles.secondaryButton} onClick={() => void code.sendCode()} disabled={code.busy !== null}>
            {code.busy === "send" ? <Loader2 size={15} className={styles.spin} aria-hidden="true" /> : null}
            {t.checkout.sendCode}
          </button>
          <span className={styles.codeHelp}>{fill(t.checkout.sendTo, { email })}</span>
        </div>
      )}
    </div>
  );
}

/** What the email code did, said in the step (role=status) rather than as a toast. */
function useNotice(t: GrowthPlanCopy, email: string) {
  const [notice, setNotice] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const onNotice = (kind: EmailCodeNotice) => {
    const words: Record<EmailCodeNotice, [string, "good" | "bad"]> = {
      sent: [fill(t.checkout.noticeSent, { email }), "good"],
      confirmed: [t.checkout.noticeConfirmed, "good"],
      send_failed: [t.checkout.noticeSendFailed, "bad"],
      invalid: [t.checkout.noticeInvalid, "bad"],
      expired: [t.checkout.noticeExpired, "bad"],
    };
    const [text, tone] = words[kind];
    setNotice({ text, tone });
  };
  return { notice, setNotice, onNotice };
}

function Notice({ notice }: { notice: { text: string; tone: "good" | "bad" } | null }) {
  return (
    <p className={styles.notice} data-tone={notice?.tone} role="status">
      {notice?.text ?? ""}
    </p>
  );
}

/** Free: the onboarding plan step's start, here (free-step.tsx hooks). */
function FreeStart({
  t,
  host,
  free,
  freeCard,
  ready,
  fallbackHref,
  onChangePlan,
  onPaid,
}: {
  t: GrowthPlanCopy;
  host: string;
  free: FreePlanOption;
  freeCard: FreePlanDisplay | null;
  ready: Ready;
  fallbackHref: string;
  onChangePlan: () => void;
  onPaid: () => void;
}) {
  const router = useRouter();
  const { notice, setNotice, onNotice } = useNotice(t, ready.email);
  const emailCode = useEmailCode({ email: ready.email, emailVerified: ready.emailVerified, onNotice });
  const freeStart = useStartFree({
    websiteId: ready.websiteId,
    full: freeCard?.counter?.full ?? false,
    // To the dashboard (ready.next), not the onboarding steps the plan step's own start names.
    onStarted: () => router.push(ready.next),
    onRefused: (error, reason) => {
      if (reason === "email_unverified") emailCode.setVerified(false);
      setNotice({ text: error, tone: "bad" });
    },
  });
  const busy = emailCode.busy !== null || freeStart.starting;

  return (
    <div className={styles.checkoutCard} data-free>
      <div className={styles.checkoutHead}>
        <div>
          <p className={styles.checkoutPlan}>{free.name}</p>
          <p className={styles.checkoutPrice}>
            <strong>{free.price}</strong> <span>{t.billing.perMonth}</span>
          </p>
          <p className={styles.optionNote}>{free.priceNote}</p>
        </div>
        <button type="button" className={styles.textButton} onClick={onChangePlan}>
          {t.checkout.changePlan}
        </button>
      </div>
      <dl className={styles.orderRows}>
        <div>
          <dt>{t.billing.website}</dt>
          <dd>{host}</dd>
        </div>
        <div className={styles.orderToday}>
          <dt>{t.billing.today}</dt>
          <dd>{free.price}</dd>
        </div>
      </dl>
      {freeCard?.counter ? <p className={styles.optionNote}>{freeCard.counter.text}</p> : null}

      {freeStart.full ? (
        <>
          <p className={styles.checkoutNote}>{freeCard?.fullNote}</p>
          <button type="button" className={styles.primaryButton} onClick={onPaid}>
            {t.checkout.freeFull} <span aria-hidden="true">→</span>
          </button>
        </>
      ) : (
        <>
          {!emailCode.verified ? <EmailCode t={t} title={fill(t.checkout.emailFree, { plan: free.name })} email={ready.email} code={emailCode} /> : null}
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              setNotice(null);
              void freeStart.start();
            }}
            disabled={busy || !emailCode.verified}
            aria-label={freeCard?.ctaLabel}
          >
            {freeStart.starting ? (
              <>
                <Loader2 size={16} className={styles.spin} aria-hidden="true" />
                {fill(t.checkout.startingFree, { plan: free.name })}
              </>
            ) : (
              <>
                {free.cta} <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </>
      )}
      <Notice notice={notice} />
      {notice?.tone === "bad" ? (
        <Link prefetch={false} href={fallbackHref} className={styles.plansLink}>
          {t.checkout.fallback}
        </Link>
      ) : null}
    </div>
  );
}

/** The sentence under the card button: the plan step's, by the same rule (checkout-terms.ts). */
function termsLine(t: GrowthPlanCopy, terms: CheckoutTerms, money: (cents: number) => string, trialDays: number) {
  const price = money(terms.line.cents);
  const then: Record<CheckoutTerms["line"]["kind"], string> = {
    trialMonth: fill(t.checkout.thenMonth, { price }),
    trialMonthRepget: fill(t.checkout.thenMonthRepget, { price, percent: REPGET_PERCENT_OFF }),
    trialYear: fill(t.checkout.thenYear, { price }),
    trialYearRepget: t.checkout.thenYearRepget,
    chargedMonth: fill(t.checkout.chargedMonth, { price }),
    chargedYear: fill(t.checkout.chargedYear, { price }),
  };
  return terms.trial ? (
    <>
      <strong>{fill(t.checkout.trialLine, { zero: money(0), days: trialDays })}</strong> {then[terms.line.kind]}
    </>
  ) : (
    then[terms.line.kind]
  );
}

/** A paid plan: the order, then the existing checkouts, as the plan step calls them. */
function PaidCheckout({
  t,
  app,
  host,
  trialDays,
  period,
  ready,
  fallbackHref,
  onChangePlan,
}: {
  t: GrowthPlanCopy;
  app: BillingAppCopy;
  host: string;
  trialDays: number;
  period: BillingPeriod;
  ready: Paid;
  fallbackHref: string;
  onChangePlan: () => void;
}) {
  const { notice, onNotice } = useNotice(t, ready.email);
  const emailCode = useEmailCode({ email: ready.email, emailVerified: ready.emailVerified, onNotice });
  const [pending, setPending] = useState<"stripe" | "paypal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Paying was refused because of an unfinished PayPal payment: the prompt to cancel it (as the plan step). */
  const [paypalBlock, setPayPalBlock] = useState<{ provider: "stripe" | "paypal"; failed: boolean } | null>(null);

  const plan = pickCheckoutPlan(ready.plans, period);
  if (!plan) {
    return (
      <div className={styles.checkoutCard}>
        <p className={styles.formError} role="alert">
          {fill(t.checkout.failed, { message: "-" })}
        </p>
        <Link prefetch={false} href={fallbackHref} className={styles.plansLink}>
          {t.checkout.fallback}
        </Link>
      </div>
    );
  }
  const checkoutPlan = plan;
  const terms = checkoutTerms(plan, { trialEligible: ready.trialEligible, emailVerified: emailCode.verified });
  const money = (cents: number) => formatPrice(cents, plan.currency);
  const yearly = plan.interval === "year";
  const offerCopy = ready.offer === "repget" ? app.offer.repget : ready.offer === "winback" ? app.offer.winback : null;

  async function handleCheckout(provider: "stripe" | "paypal", afterCancel = false) {
    setPending(provider);
    setError(null);
    // The plan step's call, with this flow's return: paid, straight to the dashboard (lib/billing/return-to.ts).
    const result =
      provider === "paypal"
        ? await createPayPalCheckout(checkoutPlan.id, ready.websiteId, "growth-plan").catch(() => ({ error: "", pendingPayPal: false }))
        : await createCheckoutSession(checkoutPlan.id, ready.websiteId, "growth-plan").catch(() => ({ error: "", pendingPayPal: false }));
    if ("error" in result) {
      setPending(null);
      if (result.pendingPayPal) {
        setPayPalBlock({ provider, failed: afterCancel });
        return;
      }
      setPayPalBlock(null);
      setError(result.error || "-");
      return;
    }
    // Meta's InitiateCheckout, for a visitor who accepted, as the plan step sends it.
    await trackMetaCheckout(result.metaCheckout, readConsent());
    window.location.assign(result.url);
  }

  return (
    <div className={styles.checkoutCard}>
      <div className={styles.checkoutHead}>
        <div>
          <p className={styles.checkoutPlan}>{plan.name}</p>
          <p className={styles.checkoutPrice}>
            {terms.strikePerMonthCents !== null ? <s>{money(terms.strikePerMonthCents)}</s> : null}
            <strong>{money(terms.perMonthCents)}</strong> <span>{t.billing.perMonth}</span>
          </p>
          <p className={styles.optionNote}>{yearly ? t.checkout.billedYearly : t.checkout.billedMonthly}</p>
        </div>
        <button type="button" className={styles.textButton} onClick={onChangePlan}>
          {t.checkout.changePlan}
        </button>
      </div>

      {offerCopy ? (
        <div className={styles.lightKit}>
          <OfferApplied copy={offerCopy} plan={{ tier: plan.tier, interval: plan.interval, currency: plan.currency, priceCents: plan.priceCents }} />
        </div>
      ) : null}

      <dl className={styles.orderRows}>
        <div>
          <dt>{t.billing.website}</dt>
          <dd>{host}</dd>
        </div>
        <div className={styles.orderToday}>
          {/* "by card" when PayPal would charge today: €0 is the card's trial, never PayPal's without one. */}
          <dt>{terms.paypal === "now" ? t.checkout.todayCard : t.billing.today}</dt>
          <dd>{money(terms.todayCents)}</dd>
        </div>
      </dl>

      {ready.unfinishedPayPal ? (
        <div className={styles.lightKit}>
          <PayPalPendingNotice websiteId={ready.websiteId} copy={app.paypalPending} />
        </div>
      ) : null}

      {terms.needsEmail ? <EmailCode t={t} title={fill(t.checkout.emailTrial, { days: trialDays })} email={ready.email} code={emailCode} /> : null}

      <button
        type="button"
        className={styles.primaryButton}
        onClick={() => void handleCheckout("stripe")}
        disabled={pending !== null || terms.needsEmail}
      >
        {pending === "stripe" ? (
          <>
            <Loader2 size={16} className={styles.spin} aria-hidden="true" />
            {t.checkout.starting}
          </>
        ) : (
          <>
            {terms.trial ? t.checkout.startTrial : t.checkout.pay} <span aria-hidden="true">→</span>
          </>
        )}
      </button>
      <p className={styles.terms}>{termsLine(t, terms, money, trialDays)}</p>

      {plan.paypal ? (
        <button
          type="button"
          className={styles.paypalButton}
          onClick={() => void handleCheckout("paypal")}
          disabled={pending !== null || terms.paypalNeedsEmail}
        >
          {pending === "paypal" ? (
            <>
              <Loader2 size={16} className={styles.spin} aria-hidden="true" />
              {t.checkout.paypalStarting}
            </>
          ) : (
            <>
              <PayPalMark className={styles.paypalMark} />
              {t.checkout.paypal}
            </>
          )}
        </button>
      ) : null}
      {terms.paypal ? (
        <p className={styles.terms} data-small>
          {terms.paypal === "trial" ? fill(app.paypalFreeArticles, { n: trialDays, days: trialDays }) : app.paypalNoTrial}
        </p>
      ) : null}

      {paypalBlock ? (
        <div className={styles.lightKit}>
          <PayPalPendingPrompt
            websiteId={ready.websiteId}
            copy={app.paypalPending}
            failed={paypalBlock.failed}
            onContinue={() => void handleCheckout(paypalBlock.provider, true)}
          />
        </div>
      ) : null}

      {error ? (
        <div className={styles.formError} role="alert">
          <p>{error}</p>
          <Link prefetch={false} href={fallbackHref}>
            {t.checkout.fallback}
          </Link>
        </div>
      ) : null}
      <Notice notice={notice} />

      <p className={styles.terms} data-small>
        {app.cancelAnyTime}
      </p>
      <p className={styles.secure}>
        <Lock size={14} aria-hidden="true" /> {t.billing.secure}
      </p>
    </div>
  );
}
