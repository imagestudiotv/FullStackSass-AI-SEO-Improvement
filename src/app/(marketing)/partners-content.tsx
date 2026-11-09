import Link from "next/link";
import type { ReactNode } from "react";

import { EarningsCalculator, type CalculatorPlan } from "@/components/partners/earnings-calculator";
import styles from "@/components/partners/partners-page.module.css";
import type { ProgramPolicy } from "@/lib/partners/domain/policies/program";
import { fill, type PartnerCopy } from "@/lib/partners/presentation/copy";
import { policyValues, rateLabel, sortedTiers } from "@/lib/partners/presentation/format";

/**
 * The public partner program page (/partners and its translations), in
 * Daniel's design (repget-partners-paypal-expanded-faq.html, 2026-11-07): the
 * hero with the earnings explorer, the program's figures, how it works, the
 * levels, who it is for, the questions and a closing call to apply. The
 * site's own menu, footer and theme frame it.
 *
 * Every rate, period and threshold on it comes from the program policy in
 * force (partner_program_versions), and every price from the plans table,
 * read per request like the pricing page: the page cannot promise a figure
 * the program does not pay. The explorer's network is an illustration and
 * says so.
 *
 * While the program switch is off the page still explains the program, and
 * says applications are not open yet instead of offering the form.
 *
 * No partner counts, payout totals or testimonials: RepGet has none yet, and
 * a made-up figure would mislead the people it is meant to convince.
 */
export function PartnersContent({
  copy,
  policy,
  open,
  locale,
  href,
  plans = [],
  intlLocale = "en-IE",
}: {
  copy: PartnerCopy["page"];
  policy: ProgramPolicy;
  open: boolean;
  locale: string;
  href: (path: string) => string;
  /** Active monthly plans, for the earnings estimate (none: no estimate). */
  plans?: CalculatorPlan[];
  intlLocale?: string;
}) {
  const tiers = sortedTiers(policy);
  const low = rateLabel(tiers[0].rateBasisPoints);
  const high = rateLabel(tiers[tiers.length - 1].rateBasisPoints);
  const values = {
    ...policyValues(policy, locale),
    top: high,
    // "25–35%": one percent sign, as the design writes it.
    range: low === high ? low : `${low.replace(/\s*%$/, "")}–${high}`,
  };
  const faqValues = {
    ...values,
    tiers: tiers
      .filter((tier) => tier.minCustomers > 0)
      .map((tier) => fill(copy.tierPhrase, { rate: rateLabel(tier.rateBasisPoints), count: tier.minCustomers }))
      .join(", "),
  };
  const faq = copy.faq.map((item) => ({ question: item.question, answer: fill(item.answer, faqValues) }));
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
  };

  /** An apply button while the program is open; the "not open yet" note otherwise. */
  const apply = (label: string, className = "") =>
    open ? (
      <Link href="/partner/apply" className={`${styles.btn} ${styles.btnBrand} ${className}`}>
        {label} <span aria-hidden="true">↗</span>
      </Link>
    ) : (
      <p role="status" className={styles.closed}>
        {copy.closed}
      </p>
    );

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        // Serialised from our own copy and the program policy, never user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }}
      />

      <section className={styles.hero} aria-labelledby="partners-title">
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>
            <span className={styles.mark} aria-hidden="true" />
            {copy.eyebrow}
            <span className={styles.slash} aria-hidden="true">
              /
            </span>
            {open ? copy.eyebrowOpen : copy.eyebrowClosed}
          </p>
          <div className={styles.heroTop}>
            <h1 id="partners-title" className={styles.title}>
              {copy.titleLead}
              <br />
              <em>{copy.titleEm}</em> {copy.titleRest}
            </h1>
            <div className={styles.intro}>
              <p>{rich(fill(copy.intro, values))}</p>
              <div className={styles.ctas}>
                {apply(copy.ctaApply)}
                <a href="#calculator" className={`${styles.btn} ${styles.btnOutline}`}>
                  {copy.ctaExplore} <span aria-hidden="true">↓</span>
                </a>
              </div>
              <p className={styles.fineLine}>
                {copy.fineLine} {copy.portalQuestion} <Link href="/partner">{copy.portalLink}</Link>
              </p>
            </div>
          </div>

          <EarningsCalculator
            plans={plans}
            tiers={tiers.map((tier) => ({ name: tier.name, rateBasisPoints: tier.rateBasisPoints, minCustomers: tier.minCustomers }))}
            months={policy.eligibilityMonths}
            copy={copy.calculator}
            intlLocale={intlLocale}
          />
          {plans.length > 0 ? (
            <p className={styles.disclaimer}>
              <InfoIcon />
              <span>{fill(copy.disclaimer, values)}</span>
            </p>
          ) : null}

          <ul className={styles.trustStrip} aria-label={copy.eyebrow}>
            <li className={styles.trustItem}>
              <strong>{low}</strong>
              <span>{copy.trust.start}</span>
            </li>
            <li className={styles.trustItem}>
              <strong>{high}</strong>
              <span>{copy.trust.top}</span>
            </li>
            <li className={styles.trustItem}>
              <strong>{fill(copy.trust.monthsValue, values)}</strong>
              <span>{copy.trust.months}</span>
            </li>
            <li className={styles.trustItem}>
              <strong>{fill(copy.trust.daysValue, values)}</strong>
              <span>{copy.trust.days}</span>
            </li>
          </ul>
          {open ? <div className={styles.afterStats}>{apply(copy.ctaStart, styles.statsBtn)}</div> : null}
        </div>
      </section>

      <section className={styles.section} id="how-it-works" aria-labelledby="partners-steps">
        <div className={styles.wrap}>
          <p className={styles.kicker}>{copy.stepsKicker}</p>
          <div className={styles.sectionHead}>
            <h2 id="partners-steps" className={styles.heading}>
              {lines(copy.stepsTitle)}
            </h2>
            <p>{copy.stepsIntro}</p>
          </div>
          <ol className={styles.steps}>
            {copy.steps.map((step, index) => (
              <li key={step.title} className={styles.stepCard}>
                <span className={styles.stepNum}>{fill(copy.stepLabel, { n: String(index + 1).padStart(2, "0") })}</span>
                {index < copy.steps.length - 1 ? <ArrowIcon /> : null}
                <div className={styles.art} aria-hidden="true">
                  {STEP_ICONS[index % STEP_ICONS.length]}
                </div>
                <h3>{step.title}</h3>
                <p>{fill(step.body, values)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`${styles.section} ${styles.tiersSection}`} id="commission-tiers" aria-labelledby="partners-tiers">
        <div className={styles.wrap}>
          <p className={styles.kicker}>{copy.tiersKicker}</p>
          <div className={styles.sectionHead}>
            <h2 id="partners-tiers" className={styles.heading}>
              {lines(copy.tiersTitle)}
            </h2>
            <p>{copy.tiersIntro}</p>
          </div>
          <ul className={styles.tiersTable}>
            {tiers.map((tier, index) => {
              const top = index === tiers.length - 1 && tiers.length > 1;
              return (
                <li key={tier.key} className={top ? `${styles.bigTier} ${styles.featured}` : styles.bigTier}>
                  <div className={styles.cornerCirc} aria-hidden="true" />
                  {top ? <span className={styles.btTag}>{copy.tierTop}</span> : null}
                  <p className={styles.btLevel}>{fill(copy.tierLevel, { n: String(index + 1).padStart(2, "0"), name: tier.name })}</p>
                  <p className={styles.btNum}>{rateLabel(tier.rateBasisPoints)}</p>
                  <h3>{tier.minCustomers === 0 ? copy.tierStartTitle : fill(copy.tierFromTitle, { count: tier.minCustomers })}</h3>
                  <p className={styles.tierBody}>{tier.minCustomers === 0 ? copy.tierStartBody : top ? copy.tierTopBody : fill(copy.tierNextBody, { count: tier.minCustomers })}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className={styles.section} id="for-whom" aria-labelledby="partners-audience">
        <div className={`${styles.wrap} ${styles.audience}`}>
          <div>
            <p className={styles.kicker}>{copy.audienceKicker}</p>
            <div className={`${styles.sectionHead} ${styles.stacked}`}>
              <h2 id="partners-audience" className={styles.heading}>
                {copy.audienceTitle}
              </h2>
              <p>{copy.audienceIntro}</p>
            </div>
            <ul className={styles.audienceList}>
              {copy.audience.map((group, index) => (
                <li key={group.title} className={styles.audCard}>
                  {AUDIENCE_ICONS[index % AUDIENCE_ICONS.length]}
                  <h3>{group.title}</h3>
                  <p>{group.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <figure className={styles.quote}>
            <figcaption className={styles.mini}>{copy.quoteKicker}</figcaption>
            <blockquote>
              {copy.quoteLead} <em>{copy.quoteEm}</em>
            </blockquote>
            <p className={styles.quoteBottom}>
              <span className={styles.roundIcon} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 17 9 11l4 4 8-8" />
                </svg>
              </span>
              <span>
                {copy.quoteFoot}
                <br />
                {copy.quoteFoot2}
              </span>
            </p>
          </figure>
        </div>
      </section>

      <section className={`${styles.section} ${styles.faq}`} id="faq" aria-labelledby="partners-faq">
        <div className={`${styles.wrap} ${styles.faqLayout}`}>
          <div>
            <p className={styles.kicker}>{copy.faqKicker}</p>
            <div className={`${styles.sectionHead} ${styles.stacked}`}>
              <h2 id="partners-faq" className={styles.heading}>
                {lines(copy.faqTitle)}
              </h2>
              <p>{copy.faqIntro}</p>
            </div>
          </div>
          {/* Native details/summary, as on the homepage: answers are in the HTML whether or not they are open. */}
          <div className={styles.faqItems}>
            {faq.map((item, index) => (
              <details key={item.question} open={index === 0}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalCta} aria-labelledby="partners-cta">
        <div className={styles.wrap}>
          <div className={styles.ctaShell}>
            <div>
              <p className={styles.kicker}>{copy.ctaKicker}</p>
              <h2 id="partners-cta">{copy.ctaTitle}</h2>
            </div>
            <div className={styles.ctaActions}>
              {apply(copy.ctaButton)}
              {open ? <small>{copy.ctaSmall}</small> : null}
            </div>
          </div>
          {/* Customers' own referral program, for credit: separate, and still linked from here. */}
          <p className={styles.credit}>
            <span>{copy.creditBody}</span>
            <Link href={href("/affiliate")}>{copy.creditLink}</Link>
          </p>
        </div>
      </section>
    </div>
  );
}

/** "**bold**" in a sentence. */
function rich(text: string): ReactNode[] {
  return text.split("**").map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part));
}

/** A heading's "\n" as a line break. */
function lines(text: string): ReactNode[] {
  return text.split("\n").flatMap((line, index) => (index === 0 ? [line] : [<br key={index} />, line]));
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v1" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className={styles.corner} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

/** The design's step pictures: join, share a link, earn. */
const STEP_ICONS = [
  <svg key="join" width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none">
    <path d="M15 7a4 4 0 1 0-6 0M5 20v-3a7 7 0 0 1 14 0v3H5Z" />
    <path d="M15.5 3.5 18 6l4-4" />
  </svg>,
  <svg key="link" width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none">
    <path d="M10 13a5 5 0 0 0 7 .3l3-3a5 5 0 1 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7-.3l-3 3a5 5 0 1 0 7 7l1.7-1.7" />
  </svg>,
  <svg key="earn" width="28" height="28" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none">
    <path d="M2 17 9 10l4 4 9-9" />
    <path d="M16 5h6v6" />
    <path d="M2 21h20" />
  </svg>,
];

/** In the order of `copy.audience`: agencies, creators, bloggers, consultants. */
const AUDIENCE_ICONS = [
  <svg key="agency" width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M8 16v-4m4 4V8m4 8v-6" />
  </svg>,
  <svg key="creator" width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="m10 8 5 4-5 4V8Z" />
  </svg>,
  <svg key="blogger" width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M8 7h8M8 12h8M8 17h5" />
  </svg>,
  <svg key="consultant" width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="3" />
    <circle cx="17" cy="8" r="3" />
    <path d="M2 20v-2a6 6 0 0 1 12 0v2m0 0v-2a6 6 0 0 1 8-5.65" />
  </svg>,
];

/** The earnings estimate's choices: the active monthly plans that cost something. */
export function calculatorPlans(plans: { id: string; name: string; interval: string; priceCents: number; currency: string }[]): CalculatorPlan[] {
  return plans
    .filter((plan) => plan.interval === "month" && plan.priceCents > 0)
    .map((plan) => ({ id: plan.id, name: plan.name, priceCents: plan.priceCents, currency: plan.currency }));
}
