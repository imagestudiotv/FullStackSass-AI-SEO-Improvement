"use client";

import { CheckCircle2, Clapperboard, Lock, MessagesSquare, PenLine, Sparkles, Wrench, type LucideIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FocusEvent, type ReactNode } from "react";

import { JoinWithGoogle } from "@/app/(marketing)/_home/join-with-google";
import { ConversionEvents } from "@/components/conversion-events";
import { fill, type GrowthPlanCopy } from "@/lib/i18n/growth-plan";
import type { Locale } from "@/lib/i18n/config";
import type { FreePlanDisplay } from "@/lib/plans/free-plan";
import type { SiteCard } from "@/lib/websites/site-card";

import { AccountStep, type AccountAuthCopy, type SignedInAccount } from "./account-step";
import { auditForPlan, suggestSite, type PlanAudit } from "./actions";
import { prepareGrowthPlanBilling } from "./billing-actions";
import type { BillingAppCopy, BillingState } from "./billing-step";
import {
  autoAdvanceTarget,
  compactLogStep,
  countdownRuns,
  DWELL_MS,
  flowReturnPath,
  flowSteps,
  initialStep,
  nextStep,
  previousStep,
  READ_STEPS,
  scrollsToStage,
  showsLog,
  startLinks,
  stepViews,
  type BillingPeriod,
  type Progress,
  type ReadStepId,
  type StepChange,
  type StepId,
} from "./flow-steps";
import styles from "./growth-plan.module.css";
import { defaultTier, offerOrder, type FreePlanOption, type GrowthPlanOffer } from "./plan-offers";
import { SiteIcon } from "./site-icon";

/*
  The billing step loads when it is opened: it carries the payment and email
  code code (and the auth client behind it), which most visitors never reach.
*/
const BillingStep = dynamic(() => import("./billing-step").then((module) => module.BillingStep), {
  loading: () => <Skeleton label="" />,
});

/** Research, check, plan; then done. */
type Phase = 0 | 1 | 2 | 3;
type Tone = "plain" | "good" | "warn";
/** A line of the work log, written for one read step (flow-steps.ts showsLog). */
type Line = { id: number; step: ReadStepId; text: string; tone: Tone };

/** Each step stays on screen at least this long, so it can be read before the next one. */
const MIN_STEP_MS = 1400;
/** Writing the plan: nothing to wait for, a beat for the eye. */
const PLAN_MS = 1500;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type GrowthPlanLinks = {
  /** Sign-up then the website step, no plan chosen (the fallback when no plan can be shown). */
  signUp: string;
  googleNext: string;
  plans: string;
  home: string;
  /** Locale-aware /sign-up and /onboarding/website, for the old way round (flow-steps.ts startLinks). */
  signUpPath: string;
  onboardingPath: string;
  /** This page (locale-aware), for the flow's own return at billing (flowReturnPath). */
  growthPlanPath: string;
  /** /sign-in, one address for every language. */
  signInPath: string;
};

/**
 * The growth plan's moving part (growth-plan-page.tsx says why it exists),
 * in explee.com's shape (Daniel: "all the background is white and many
 * information there that catch the eyes, all the steps filled, you can
 * choose any step, if you stop on any step it's auto continue, and finally
 * the details to insert the billing information").
 *
 * Two requests start together on arrival: the site's suggestion card (fast)
 * and the free audit (up to a minute). RepGet works through the three read
 * steps as each real answer arrives, never before, and the log writes out
 * what was actually found: no invented progress, no percentage. A failed
 * request is said once in the log and the plan goes on without it.
 *
 * What the visitor sees is separate from that work (flow-steps.ts has the
 * rules): a step list with every step's state and a line of what it found,
 * EVERY step one press away at any time (a step still loading says what
 * RepGet is doing for it and fills in when its answer arrives), and a card
 * for the step on screen. Since 2026-11-21 the log is written under its own
 * step in that list, as explee.com does it (✓ for a line done, › for the
 * newest while RepGet is on it), not in a box at the bottom nobody saw. An
 * answered read step continues by itself after a few seconds, a thin bar
 * filling as it goes, and reading the page never stops it or starts it
 * again (Daniel: "If I scroll it's reloading the step"): only Pause, the
 * keyboard in the card or a hidden tab hold it, and continuing by itself
 * never scrolls the page. Under reduced motion it never moves by itself:
 * Continue does it.
 *
 * Since 2026-11-20 the flow ends in the page itself: the plan choice, the
 * account (sign-up as /sign-up does it, account-step.tsx; skipped by someone
 * already signed in), then billing (billing-step.tsx): the website added to
 * the account, then Free started, or the order and the existing Stripe or
 * PayPal checkout, whose own pages take the card and billing details. Once
 * paid (or Free started) the visitor lands on the dashboard, not in the
 * onboarding steps (billing-step.tsx).
 */
export function GrowthPlanFlow({
  domain,
  locale,
  copy: t,
  maxPages,
  trialDays,
  links,
  offers = [],
  free = null,
  freeCard = null,
  account: initialAccount = null,
  auth = null,
  app = null,
  initial = {},
}: {
  domain: string;
  locale: Locale;
  copy: GrowthPlanCopy;
  maxPages: number;
  trialDays: number;
  links: GrowthPlanLinks;
  /** The plans on sale (plan-offers.ts), empty when they could not be read. */
  offers?: GrowthPlanOffer[];
  /** The Free plan's card, drawn after the paid plans; null when it is not offered. */
  free?: FreePlanOption | null;
  /** The Free card's full display (counter, the note once spots are gone), for the billing step. */
  freeCard?: FreePlanDisplay | null;
  /** Who is signed in on arrival: they skip the account step. */
  account?: SignedInAccount | null;
  /** The sign-up form's words; without them the account step falls back to the usual sign-up page. */
  auth?: AccountAuthCopy | null;
  /** The app's words the billing step borrows. */
  app?: BillingAppCopy | null;
  /** The flow's own return (?plan=, ?period=, ?step=billing): the plan and the step to open. */
  initial?: { tier?: string | null; period?: BillingPeriod; step?: string | null };
}) {
  const [steps] = useState<StepId[]>(() => flowSteps(Boolean(initialAccount)));
  const [phase, setPhase] = useState<Phase>(0);
  const [viewing, setViewing] = useState<number>(() => initialStep(steps, initial.step));
  const [site, setSite] = useState<SiteCard | null | undefined>(undefined);
  const [audit, setAudit] = useState<PlanAudit | undefined>(undefined);
  const [lines, setLines] = useState<Line[]>([]);
  const [tier, setTier] = useState<string | null>(() => {
    const asked = initial.tier ?? null;
    if (asked && (offers.some((offer) => offer.tier === asked) || free?.tier === asked)) return asked;
    return defaultTier(offers) ?? free?.tier ?? null;
  });
  const [period, setPeriod] = useState<BillingPeriod>(initial.period ?? "month");
  /** The visitor has moved on from the plan choice (or came back to billing with one). */
  const [chose, setChose] = useState(initial.step === "billing");
  const [account, setAccount] = useState<SignedInAccount | null>(initialAccount);
  const [billing, setBilling] = useState<BillingState>(null);
  // What holds the countdown (flow-steps.ts Holds). Reading the page is not one of them.
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const started = useRef(false);
  const asking = useRef<string | null>(null);
  const stage = useRef<HTMLElement>(null);

  const host = domain.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "");
  const name = site?.name || (audit?.ok ? audit.siteName : null) || host;
  const languageCode = site?.language || (audit?.ok ? audit.language : null);
  const language = languageCode ? languageName(languageCode, locale) : null;

  useEffect(() => {
    // Once per page: React's development double effect must not ask twice.
    if (started.current) return;
    started.current = true;
    const began = performance.now();
    let id = 0;
    // Each line is written for the read step it belongs to, and drawn under that step.
    const log = (step: ReadStepId, text: string, tone: Tone = "plain") => setLines((all) => [...all, { id: id++, step, text, tone }]);

    const auditing = auditForPlan(domain, locale).catch((): PlanAudit => ({ ok: false, message: "" }));
    void (async () => {
      log("business", fill(t.log.open, { domain: host }));
      const card = await suggestSite(domain).catch(() => null);
      await wait(Math.max(0, MIN_STEP_MS - (performance.now() - began)));
      setSite(card);
      if (card) {
        log("business", fill(t.log.found, { name: card.name }), "good");
        if (card.platform) log("business", fill(t.log.platform, { platform: card.platform }));
        if (card.language) log("business", fill(t.log.language, { language: languageName(card.language, locale) }));
      } else {
        log("business", t.log.noPreview, "warn");
      }

      setPhase(1);
      const checking = performance.now();
      log("pages", fill(t.log.auditStart, { pages: maxPages }));
      log("pages", t.log.auditWaiting);
      const result = await auditing;
      await wait(Math.max(0, MIN_STEP_MS - (performance.now() - checking)));
      setAudit(result);
      if (result.ok) {
        log("pages", fill(t.log.pages, { count: result.pagesChecked }));
        log("pages", fill(t.log.score, { score: result.score }), result.score >= 80 ? "good" : "warn");
        log("pages", fill(t.log.problems, { critical: result.counts.critical, warnings: result.counts.warning }), result.counts.critical ? "warn" : "plain");
        if (result.crawlersChecked > 0) {
          log(
            "pages",
            result.blockedCrawlers.length ? fill(t.log.crawlersBlocked, { owners: result.blockedCrawlers.join(", ") }) : t.log.crawlersOpen,
            result.blockedCrawlers.length ? "warn" : "good",
          );
        }
      } else {
        log("pages", fill(t.log.auditFailed, { message: result.message || "-" }), "warn");
      }

      setPhase(2);
      log("plan", t.log.planStart);
      await wait(PLAN_MS);
      log("plan", t.log.planDone, "good");
      setPhase(3);
    })();
  }, [domain, host, locale, maxPages, t]);

  // Reduced motion and a hidden tab both stop the countdown (flow-steps.ts Holds).
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const readMotion = () => setReducedMotion(motion.matches);
    const readHidden = () => setHidden(document.visibilityState === "hidden");
    readMotion();
    readHidden();
    motion.addEventListener("change", readMotion);
    document.addEventListener("visibilitychange", readHidden);
    return () => {
      motion.removeEventListener("change", readMotion);
      document.removeEventListener("visibilitychange", readHidden);
    };
  }, []);

  const current = steps[viewing];

  /**
   * Billing, once there is an account and billing is on screen: the website
   * added and what the payment buttons need (billing-actions.ts), asked once
   * per plan tier (monthly and yearly come together), again only on Retry.
   */
  const loadBilling = useCallback(
    (forTier: string) => {
      if (asking.current === forTier) return;
      asking.current = forTier;
      setBilling({ tier: forTier, result: null });
      void prepareGrowthPlanBilling(domain, forTier)
        .catch(() => ({ ok: false as const, reason: "website" as const, error: "-" }))
        .then((result) => {
          if (asking.current !== forTier) return;
          setBilling({ tier: forTier, result });
        });
    },
    [domain],
  );
  useEffect(() => {
    if (current !== "billing" || !account || !tier) return;
    if (billing?.tier === tier) return;
    loadBilling(tier);
  }, [current, account, tier, billing, loadBilling]);

  const progress: Progress = {
    ready: { business: site !== undefined, pages: audit !== undefined, plan: phase === 3 },
    working: phase === 3 ? null : READ_STEPS[phase],
    chose,
    signedIn: Boolean(account),
  };
  const views = stepViews(steps, viewing, progress);
  const holds = { reducedMotion, focused, hidden, paused };
  const target = autoAdvanceTarget(steps, viewing, progress);
  const runs = countdownRuns(steps, viewing, progress, holds);
  const dwell = DWELL_MS[current];
  const items = planItems(t, name, language, audit);
  const chosen = offers.find((offer) => offer.tier === tier) ?? null;
  const freeChosen = Boolean(free && tier === free.tier);
  const chooseIndex = steps.indexOf("choose");

  const go = useCallback(
    (index: number, change: StepChange = "visitor") => {
      const id = steps[index];
      if (!id) return;
      setViewing(index);
      // Moving on from the plan choice is making it (a jump past it from elsewhere is not).
      if (viewing === chooseIndex && index > chooseIndex) setChose(true);
      setAnnouncement(fill(t.nav.announce, { index: index + 1, total: steps.length, label: t.phases[id] }));
      // A step the visitor opened below the fold (a phone, read from further down): its card's top back in view. Never on auto-continue.
      if (scrollsToStage(change, stage.current?.getBoundingClientRect().top ?? 0)) {
        stage.current?.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
      }
    },
    [chooseIndex, reducedMotion, steps, t, viewing],
  );
  const goTo = (id: StepId) => go(Math.max(0, steps.indexOf(id)));

  const choiceSummary = freeChosen && free
    ? `${free.name} · ${free.price}`
    : chosen
      ? period === "year" && chosen.yearly
        ? fill(t.flow.chosenYearly, { plan: chosen.name, price: chosen.yearly.perMonth })
        : fill(t.summary.billingChosen, { plan: chosen.name, price: chosen.price })
      : t.summary.billingPick;
  const summaries: Record<StepId, string> = {
    business: site === undefined ? t.summary.working : (site?.name ?? host),
    pages:
      audit === undefined
        ? phase >= 1
          ? t.summary.working
          : t.summary.waiting
        : audit.ok
          ? audit.counts.critical + audit.counts.warning > 0
            ? fill(t.summary.pages, { score: audit.score, count: audit.counts.critical + audit.counts.warning })
            : fill(t.summary.pagesClean, { score: audit.score })
          : t.summary.pagesSkipped,
    plan: phase === 3 ? fill(t.summary.plan, { count: items.length }) : phase === 2 ? t.summary.working : t.summary.waiting,
    choose: choiceSummary,
    account: account ? fill(t.flow.accountDone, { email: account.email }) : t.flow.accountTodo,
    billing: account ? t.flow.checkoutReady : t.flow.checkoutLocked,
  };

  const done = phase === 3;
  const barStyle = { "--dwell": `${dwell ?? 0}ms`, animationPlayState: runs ? "running" : "paused" } as CSSProperties;
  const showBar = target !== null && !reducedMotion;
  // The work log under its steps (flow-steps.ts showsLog), and on a phone one step's lines under the row.
  const working = progress.working;
  const written = new Set(lines.map((line) => line.step));
  const compact = compactLogStep(current, working, written);
  const returnPath = flowReturnPath(links.growthPlanPath, domain, tier, period);
  const signUpReturn = `${links.signUpPath}?next=${encodeURIComponent(returnPath)}`;
  const signInReturn = `${links.signInPath}?next=${encodeURIComponent(returnPath)}`;
  const oldWay = startLinks(links.signUpPath, links.onboardingPath, domain, tier);
  const after = nextStep(steps, viewing);
  // Continue on the account step only once there is an account: billing needs one.
  const showContinue = after !== null && !(current === "account" && !account);
  const continueLabel =
    after === null
      ? ""
      : steps[after] === "choose"
        ? t.nav.toBilling
        : steps[after] === "account"
          ? t.flow.toAccount
          : steps[after] === "billing"
            ? t.flow.toCheckout
            : t.nav.continue;
  const conversions = billing?.result?.ok ? billing.result.conversions : null;

  return (
    <div className={styles.page}>
      {/* The new account's sign-up, reported as the onboarding layout reports it (once per browser). */}
      {conversions && conversions.length > 0 ? <ConversionEvents events={conversions} /> : null}
      <div className={styles.wrap}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>
            <span className={styles.pulse} data-busy={!done || undefined} aria-hidden="true" />
            {t.eyebrow}
          </p>
          <h1 className={styles.title}>{done ? fill(t.titleDone, { name }) : fill(t.title, { domain: host })}</h1>
          <p className={styles.intro}>{t.intro}</p>
        </header>

        <div className={styles.layout}>
          <aside className={styles.side}>
            {/* Every step, its state and what it found; on a phone, a compact progress header. */}
            <nav aria-label={t.phasesLabel}>
              <p className={styles.compactLabel} aria-hidden="true">
                <span>{fill(t.stepOf, { index: viewing + 1, total: steps.length })}</span>
                <strong>{t.phases[current]}</strong>
              </p>
              <ol className={styles.steps} style={{ "--count": steps.length } as CSSProperties}>
                {views.map((view, index) => (
                  <li key={view.id} className={styles.step} data-state={view.state} data-busy={view.busy || undefined} data-queued={view.queued || undefined}>
                    <button
                      type="button"
                      className={styles.stepButton}
                      aria-current={viewing === index ? "step" : undefined}
                      aria-label={`${t.phases[view.id]} (${fill(t.stepOf, { index: index + 1, total: steps.length })}): ${summaries[view.id]}`}
                      onClick={() => go(index)}
                    >
                      <span className={styles.stepMark} aria-hidden="true">
                        {view.state === "done" ? "✓" : index + 1}
                      </span>
                      <span className={styles.stepText} aria-hidden="true">
                        <span className={styles.stepLabel}>{t.phases[view.id]}</span>
                        <span className={styles.stepSummary}>{summaries[view.id]}</span>
                      </span>
                      <span className={styles.stepTrack} aria-hidden="true">
                        {viewing === index && showBar ? (
                          /*
                            One bar per step: keyed by the step alone, so
                            nothing but a change of step starts it again
                            from empty (a scroll used to).
                          */
                          <span
                            key={view.id}
                            className={styles.stepFill}
                            style={barStyle}
                            onAnimationEnd={() => {
                              if (target !== null) go(target, "auto");
                            }}
                          />
                        ) : null}
                      </span>
                    </button>
                    {showsLog(view.id, current, working) && written.has(view.id as ReadStepId) ? (
                      <StepLog lines={lines.filter((line) => line.step === view.id)} busy={view.busy} className={styles.stepLog} />
                    ) : null}
                  </li>
                ))}
              </ol>
              {/* A phone has no room under each segment: one step's newest lines under the row. */}
              {compact ? (
                <StepLog lines={lines.filter((line) => line.step === compact).slice(-4)} busy={working === compact} className={styles.compactLog} />
              ) : null}
            </nav>

            {/* The whole log for screen readers, as it is written (the lines on screen are drawn for the eye). */}
            <ol className={styles.srOnly} role="log" aria-label={t.logLabel}>
              {lines.map((line) => (
                <li key={line.id}>{line.text}</li>
              ))}
            </ol>
            <Link prefetch={false} href={links.home} className={styles.another}>
              {t.another}
            </Link>
          </aside>

          <section ref={stage} className={styles.stage} aria-labelledby="growth-plan-step">
            <div className={styles.stageHead}>
              <span className={styles.stageKicker}>{fill(t.stepOf, { index: viewing + 1, total: steps.length })}</span>
              <h2 id="growth-plan-step" className={styles.stageTitle}>
                {t.phases[current]}
              </h2>
              <span className={styles.hostChip}>
                <SiteIcon site={site} host={host} size={18} className={styles.chipIcon} letterClassName={styles.chipLetter} />
                {host}
              </span>
            </div>

            {/*
              The card the countdown watches: only the keyboard in it holds
              it. Reading it - the pointer over it, a scroll, a wheel, a
              touch - neither holds the bar nor starts it again (flow-steps.ts
              Holds). The buttons under it are outside, so pressing Continue
              never holds the next step.
            */}
            <div
              key={current}
              className={styles.scene}
              onFocus={(event: FocusEvent<HTMLDivElement>) => {
                if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) setFocused(true);
              }}
              onBlur={(event: FocusEvent<HTMLDivElement>) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
              }}
            >
              {current === "business" ? <Research t={t} host={host} site={site} language={language} /> : null}
              {current === "pages" ? <Audit t={t} audit={audit} queued={phase < 1} host={host} maxPages={maxPages} /> : null}
              {current === "plan" ? <Plan t={t} items={items} ready={done} queued={phase < 2} /> : null}
              {current === "choose" ? (
                <Choose
                  t={t}
                  host={host}
                  name={name}
                  trialDays={trialDays}
                  links={links}
                  offers={offers}
                  free={free}
                  tier={tier}
                  period={period}
                  signedIn={Boolean(account)}
                  googleNext={returnPath}
                  googleSignUp={signUpReturn}
                  onChoose={setTier}
                  onPeriod={setPeriod}
                  onContinue={() => goTo(account ? "billing" : "account")}
                />
              ) : null}
              {current === "account" ? (
                auth ? (
                  <AccountStep
                    t={t}
                    auth={auth}
                    host={host}
                    account={account}
                    links={{ flowReturn: returnPath, signUp: signUpReturn, signIn: signInReturn }}
                    onSignedIn={(person) => {
                      setAccount(person);
                      goTo("billing");
                    }}
                    onContinue={() => goTo("billing")}
                    free={freeChosen}
                  />
                ) : (
                  <Fallback t={t} trialDays={trialDays} links={links} />
                )
              ) : null}
              {current === "billing" ? (
                app ? (
                  <BillingStep
                    t={t}
                    app={app}
                    host={host}
                    name={name}
                    trialDays={trialDays}
                    tier={tier}
                    period={period}
                    offers={offers}
                    free={free}
                    freeCard={freeCard}
                    signedIn={Boolean(account)}
                    state={billing}
                    fallbackHref={oldWay.googleNext}
                    onRetry={() => {
                      asking.current = null;
                      setBilling(null);
                    }}
                    onNeedAccount={() => goTo("account")}
                    onChangePlan={() => goTo("choose")}
                    onChoose={setTier}
                  />
                ) : (
                  <Fallback t={t} trialDays={trialDays} links={links} />
                )
              ) : null}
            </div>

            <div className={styles.stageFoot}>
              {previousStep(viewing) !== null ? (
                <button type="button" className={styles.back} onClick={() => go(previousStep(viewing)!)}>
                  <span aria-hidden="true">←</span> {t.nav.back}
                </button>
              ) : (
                <span />
              )}
              <p className={styles.status} aria-hidden="true">
                {views[viewing]?.busy || views[viewing]?.queued ? (
                  <>
                    <span className={styles.spinnerSmall} />
                    {t.nav.working}
                  </>
                ) : showBar ? (
                  runs ? t.nav.auto : t.nav.held
                ) : null}
              </p>
              <div className={styles.footActions}>
                {showBar ? (
                  <button type="button" className={styles.pause} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
                    {paused ? t.nav.resume : t.nav.pause}
                  </button>
                ) : null}
                {showContinue && after !== null ? (
                  <button type="button" className={styles.continue} onClick={() => go(after)}>
                    {continueLabel} <span aria-hidden="true">→</span>
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

/** The language's name in the page's language ("Italian", "italiano"...), or the code if the browser cannot say. */
function languageName(code: string, locale: Locale): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(code);
    return name ? name.charAt(0).toLocaleUpperCase(locale) + name.slice(1) : code;
  } catch {
    return code;
  }
}

type PlanItem = { title: string; detail: string; icon: LucideIcon };

/** What the plan will do, from what was found: the same lines as before the redesign. */
function planItems(t: GrowthPlanCopy, name: string, language: string | null, audit: PlanAudit | undefined): PlanItem[] {
  const items: PlanItem[] = [];
  if (audit?.ok) {
    const problems = audit.counts.critical + audit.counts.warning;
    items.push(problems > 0 ? { title: fill(t.plan.fix[0], { count: problems }), detail: t.plan.fix[1], icon: Wrench } : { title: t.plan.healthy[0], detail: t.plan.healthy[1], icon: CheckCircle2 });
  }
  items.push({ title: language ? fill(t.plan.articlesIn, { language }) : t.plan.articles[0], detail: fill(t.plan.articles[1], { name }), icon: PenLine });
  items.push({ title: t.plan.videos[0], detail: fill(t.plan.videos[1], { name }), icon: Clapperboard });
  if (audit?.ok && audit.crawlersChecked > 0) {
    items.push(
      audit.blockedCrawlers.length
        ? { title: t.plan.aiBlocked[0], detail: fill(t.plan.aiBlocked[1], { owners: audit.blockedCrawlers.join(", "), name }), icon: Sparkles }
        : { title: t.plan.aiOpen[0], detail: fill(t.plan.aiOpen[1], { name }), icon: Sparkles },
    );
  }
  items.push({ title: t.plan.conversations[0], detail: t.plan.conversations[1], icon: MessagesSquare });
  return items;
}

/** `**words**` in bold, the plan lists' own marking (lib/plans/benefits.ts). */
function bold(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part,
  );
}

function Skeleton({ label, queued = false }: { label: string; queued?: boolean }) {
  return (
    <div className={styles.skeleton} aria-busy="true">
      {label ? (
        <p className={styles.waiting} data-queued={queued || undefined}>
          <span className={styles.spinner} aria-hidden="true" />
          {label}
        </p>
      ) : null}
      <span className={styles.bar} />
      <span className={styles.bar} data-short />
      <span className={styles.bar} />
    </div>
  );
}

/**
 * A step's lines of the work log, under the step (explee.com's way): ✓ for a
 * line done, › for the newest while RepGet is still on the step, typed in
 * once as it arrives. For the eye only: the screen reader's log is the page's
 * role="log" list.
 */
function StepLog({ lines, busy, className }: { lines: Line[]; busy: boolean; className: string }) {
  return (
    <ol className={className} aria-hidden="true">
      {lines.map((line, index) => {
        const newest = busy && index === lines.length - 1;
        return (
          <li key={line.id} data-tone={line.tone} data-newest={newest || undefined}>
            <span className={styles.logMark}>{newest ? "›" : "✓"}</span>
            <span className={styles.logText}>{line.text}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Research({ t, host, site, language }: { t: GrowthPlanCopy; host: string; site: SiteCard | null | undefined; language: string | null }) {
  if (site === undefined) return <Skeleton label={fill(t.research.loading, { domain: host })} />;
  return (
    <div className={styles.research}>
      <p className={styles.kicker}>{t.research.heading}</p>
      <div className={styles.business}>
        <SiteIcon site={site} host={host} size={72} className={styles.icon} letterClassName={styles.iconLetter} />
        <div className={styles.businessText}>
          <h3 className={styles.businessName}>{site?.name ?? host}</h3>
          <p className={styles.businessAbout} data-missing={!site?.description || undefined}>
            {site?.description ?? t.research.noDescription}
          </p>
        </div>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>{t.research.website}</dt>
          <dd>{host}</dd>
        </div>
        <div>
          <dt>{t.research.platform}</dt>
          <dd>{site?.platform ?? t.research.unknown}</dd>
        </div>
        <div>
          <dt>{t.research.language}</dt>
          <dd>{language ?? t.research.unknown}</dd>
        </div>
      </dl>
    </div>
  );
}

function Audit({
  t,
  audit,
  queued,
  host,
  maxPages,
}: {
  t: GrowthPlanCopy;
  audit: PlanAudit | undefined;
  queued: boolean;
  host: string;
  maxPages: number;
}) {
  if (audit === undefined) {
    return (
      <div>
        <Skeleton label={queued ? fill(t.flow.queuedPages, { pages: maxPages, domain: host }) : t.audit.loading} queued={queued} />
        <ul className={styles.checks} data-queued={queued || undefined}>
          {t.audit.checks.map((check) => (
            <li key={check}>
              <span className={styles.spinnerSmall} aria-hidden="true" />
              {check}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (!audit.ok) {
    return (
      <div className={styles.auditFailed}>
        <p className={styles.kicker}>{t.audit.heading}</p>
        <p>{fill(t.audit.failed, { message: audit.message })}</p>
      </div>
    );
  }
  const problems = audit.counts.critical + audit.counts.warning;
  return (
    <div className={styles.audit}>
      <p className={styles.kicker}>{t.audit.heading}</p>
      <div className={styles.scoreRow}>
        <div className={styles.score} data-tone={audit.score >= 80 ? "good" : audit.score >= 50 ? "mid" : "low"} style={{ "--score": audit.score } as CSSProperties}>
          <strong>{audit.score}</strong>
          <span>/100</span>
        </div>
        <dl className={styles.counts}>
          <div>
            <dt>{t.audit.score}</dt>
            <dd>{audit.score}/100</dd>
          </div>
          <div>
            <dt>{t.audit.pages}</dt>
            <dd>{audit.pagesChecked}</dd>
          </div>
          <div data-tone={audit.counts.critical ? "warn" : undefined}>
            <dt>{t.audit.critical}</dt>
            <dd>{audit.counts.critical}</dd>
          </div>
          <div>
            <dt>{t.audit.warnings}</dt>
            <dd>{audit.counts.warning}</dd>
          </div>
        </dl>
      </div>
      {audit.crawlersChecked > 0 ? (
        <p className={styles.crawlers} data-tone={audit.blockedCrawlers.length ? "warn" : "good"}>
          <span aria-hidden="true">✦</span>
          {audit.blockedCrawlers.length ? fill(t.log.crawlersBlocked, { owners: audit.blockedCrawlers.join(", ") }) : t.log.crawlersOpen}
        </p>
      ) : null}
      {problems === 0 && audit.issues.length === 0 ? (
        <p className={styles.allGood}>{t.audit.none}</p>
      ) : (
        <ul className={styles.issues}>
          {audit.issues.map((issue) => (
            <li key={issue.label} data-severity={issue.severity}>
              <span className={styles.issueDot} aria-hidden="true" />
              <span className={styles.issueLabel}>{issue.label}</span>
              {issue.pageCount > 1 ? <span className={styles.issueCount}>×{issue.pageCount}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {audit.hiddenIssues > 0 ? <p className={styles.more}>{fill(t.audit.more, { count: audit.hiddenIssues })}</p> : null}
    </div>
  );
}

function Plan({ t, items, ready, queued }: { t: GrowthPlanCopy; items: PlanItem[]; ready: boolean; queued: boolean }) {
  if (!ready) return <Skeleton label={queued ? t.flow.queuedPlan : t.log.planStart} queued={queued} />;
  return (
    <div className={styles.plan}>
      <p className={styles.kicker}>{t.plan.heading}</p>
      <ol className={styles.planList}>
        {items.map((item, index) => (
          <li key={item.title} style={{ animationDelay: `${index * 90}ms` }}>
            <span className={styles.planIcon} aria-hidden="true">
              <item.icon size={18} strokeWidth={2} />
            </span>
            <span className={styles.planNum} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <strong>{item.title}</strong>
            <small>{item.detail}</small>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Without the plans or the account's words (the database or the copy did not come): the trial and /pricing, as the page offered before. */
function Fallback({ t, trialDays, links }: { t: GrowthPlanCopy; trialDays: number; links: GrowthPlanLinks }) {
  return (
    <div className={styles.cta}>
      <div>
        <p className={styles.ctaTitle}>{t.cta.title}</p>
        <p className={styles.ctaBody}>
          {fill(t.cta.body, { days: trialDays })} {t.cta.note}
        </p>
      </div>
      <div className={styles.ctaActions}>
        <Link prefetch={false} href={links.signUp} className={styles.primary}>
          {t.cta.start} <span aria-hidden="true">↗</span>
        </Link>
        <JoinWithGoogle className={styles.google} signUpHref={links.signUp} next={links.googleNext}>
          <span>{t.cta.google}</span>
        </JoinWithGoogle>
        <Link prefetch={false} href={links.plans} className={styles.plansLink}>
          {t.cta.plans}
        </Link>
      </div>
    </div>
  );
}

/**
 * The plan choice: the onboarding plan step's plans (plan-offers.ts), the
 * popular one (Grow, chosen when the step opens) first and Free last
 * (offerOrder), with the yearly switch, and an order summary beside them. Choosing
 * only picks: Continue goes on to the account step (or straight to billing
 * for someone signed in), where the plan is started. Without plans to show
 * (the database did not answer): the trial and /pricing, as before.
 */
function Choose({
  t,
  host,
  name,
  trialDays,
  links,
  offers,
  free,
  tier,
  period,
  signedIn,
  googleNext,
  googleSignUp,
  onChoose,
  onPeriod,
  onContinue,
}: {
  t: GrowthPlanCopy;
  host: string;
  name: string;
  trialDays: number;
  links: GrowthPlanLinks;
  offers: GrowthPlanOffer[];
  free: FreePlanOption | null;
  tier: string | null;
  period: BillingPeriod;
  signedIn: boolean;
  /** Back into this flow at billing, with the plan (flowReturnPath). */
  googleNext: string;
  googleSignUp: string;
  onChoose: (tier: string) => void;
  onPeriod: (period: BillingPeriod) => void;
  onContinue: () => void;
}) {
  if (offers.length === 0 && !free) return <Fallback t={t} trialDays={trialDays} links={links} />;

  const chosen = offers.find((offer) => offer.tier === tier) ?? null;
  const freeChosen = Boolean(free && tier === free.tier);
  const steps = freeChosen ? t.billing.next.slice(0, 2) : t.billing.next;
  const yearlyOn = period === "year";
  const anyYearly = offers.some((offer) => offer.yearly);
  const saving = chosen?.yearly ? chosen.yearlySaving : null;

  return (
    <div className={styles.billing}>
      <div className={styles.billingIntro}>
        <p className={styles.kicker}>{t.billing.heading}</p>
        <p className={styles.billingLead}>{fill(t.billing.intro, { name })}</p>
      </div>
      {anyYearly ? (
        <div className={styles.periodRow}>
          <button type="button" role="switch" aria-checked={yearlyOn} className={styles.switch} onClick={() => onPeriod(yearlyOn ? "month" : "year")}>
            <span aria-hidden="true" />
            {t.flow.payYearly}
          </button>
          {saving ? <span className={styles.save}>{fill(t.flow.save, { percent: saving })}</span> : null}
        </div>
      ) : null}
      <div className={styles.billingGrid}>
        <div role="radiogroup" aria-label={t.billing.options} className={styles.options}>
          {offerOrder(offers).map((offer) => {
            const yearly = yearlyOn && offer.yearly ? offer.yearly : null;
            return (
              <label key={offer.tier} className={styles.option} data-chosen={offer.tier === tier || undefined} data-popular={offer.popular || undefined}>
                <input type="radio" name="growth-plan-tier" value={offer.tier} checked={offer.tier === tier} onChange={() => onChoose(offer.tier)} />
                <span className={styles.optionHead}>
                  <span className={styles.optionName}>{offer.name}</span>
                  {offer.popular ? <span className={styles.badge}>✦ {t.billing.popular}</span> : offer.tag ? <span className={styles.tag}>{offer.tag}</span> : null}
                </span>
                {offer.description ? <span className={styles.optionDesc}>{offer.description}</span> : null}
                <span className={styles.optionPrice}>
                  <strong>{yearly ? yearly.perMonth : offer.price}</strong> <span>{t.billing.perMonth}</span>
                  {!yearly && offer.regular ? <s>{offer.regular}</s> : null}
                </span>
                {offer.yearly ? (
                  <span className={styles.optionNote}>
                    {yearly ? `${t.checkout.billedYearly} · ${offer.yearly.total}` : fill(t.billing.yearly, { price: offer.yearly.perMonth, total: offer.yearly.total })}
                  </span>
                ) : null}
                <ul className={styles.optionList}>
                  {offer.features.map((feature) => (
                    <li key={feature}>{bold(feature)}</li>
                  ))}
                </ul>
                <span className={styles.optionCheck} aria-hidden="true">
                  {offer.tier === tier ? `✓ ${t.billing.selected}` : null}
                </span>
              </label>
            );
          })}
          {/* Free last (2026-11-21): first, in green, it read as the plan the order beside it described. */}
          {free ? (
            <label className={styles.option} data-free data-chosen={freeChosen || undefined}>
              <input type="radio" name="growth-plan-tier" value={free.tier} checked={freeChosen} onChange={() => onChoose(free.tier)} />
              <span className={styles.optionHead}>
                <span className={styles.optionName}>{free.name}</span>
                <span className={styles.badge}>{free.badge}</span>
              </span>
              <span className={styles.optionDesc}>{free.description}</span>
              <span className={styles.optionPrice}>
                <strong>{free.price}</strong> <span>{t.billing.perMonth}</span>
              </span>
              <span className={styles.optionNote}>{free.priceNote}</span>
              <ul className={styles.optionList}>
                {free.features.map((feature) => (
                  <li key={feature}>{bold(feature)}</li>
                ))}
              </ul>
              <span className={styles.optionCheck} aria-hidden="true">
                {freeChosen ? `✓ ${t.billing.selected}` : null}
              </span>
            </label>
          ) : null}
        </div>

        <aside className={styles.order} aria-label={t.billing.orderTitle}>
          <p className={styles.orderTitle}>{t.billing.orderTitle}</p>
          <dl className={styles.orderRows}>
            <div>
              <dt>{t.billing.website}</dt>
              <dd>{host}</dd>
            </div>
            <div>
              <dt>{t.billing.plan}</dt>
              <dd>{freeChosen && free ? free.name : (chosen?.name ?? "-")}</dd>
            </div>
            <div className={styles.orderToday}>
              <dt>{t.billing.today}</dt>
              <dd>{freeChosen && free ? free.price : (chosen?.dueToday ?? "-")}</dd>
            </div>
          </dl>
          {freeChosen && free ? (
            <p className={styles.orderTrial}>
              {t.billing.noCard} · {free.priceNote}
            </p>
          ) : chosen ? (
            <>
              <p className={styles.orderTrial}>{fill(t.billing.trial, { days: trialDays })}</p>
              <p className={styles.orderThen}>
                {/* The plan step's rule: a yearly plan at the launch price leaves its total to checkout. */}
                {yearlyOn && chosen.yearly
                  ? chosen.regular
                    ? t.checkout.thenYearRepget
                    : fill(t.checkout.thenYear, { price: chosen.yearly.total })
                  : fill(t.billing.then, { price: chosen.price })}
              </p>
              <p className={styles.methods}>
                <span>{chosen.paypal ? t.billing.methods : t.billing.methodsCard}</span>
                <span className={styles.methodBadges} aria-hidden="true">
                  <span>{t.billing.card}</span>
                  {chosen.paypal ? <span>{t.billing.paypal}</span> : null}
                </span>
              </p>
            </>
          ) : null}
          <button type="button" className={styles.primary} onClick={onContinue}>
            {freeChosen && free ? free.cta : signedIn ? t.flow.toCheckout : t.flow.toAccount} <span aria-hidden="true">→</span>
          </button>
          {signedIn ? null : (
            <JoinWithGoogle className={styles.google} signUpHref={googleSignUp} next={googleNext}>
              <span>{t.cta.google}</span>
            </JoinWithGoogle>
          )}
          {freeChosen ? null : (
            <p className={styles.secure}>
              <Lock size={14} aria-hidden="true" /> {t.billing.secure}
            </p>
          )}
          <div className={styles.nextSteps}>
            <p>{t.billing.nextTitle}</p>
            <ol>
              {(signedIn ? steps.slice(1) : steps).map((step) => (
                <li key={step}>{fill(step, { host })}</li>
              ))}
            </ol>
          </div>
          <Link prefetch={false} href={links.plans} className={styles.plansLink}>
            {t.cta.plans}
          </Link>
        </aside>
      </div>
    </div>
  );
}
