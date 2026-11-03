import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import Link from "next/link";

import { formatPrice, type PlanRow } from "@/lib/billing-shared";
import { STARTER_TIER } from "@/lib/plans/features";
import styles from "../home.module.css";
import { rich } from "../text";
import type { SectionProps } from "../types";
import local from "./closing.module.css";

/**
 * Pricing (client's design, 2026-11-03: "One platform. Everything to grow.").
 *
 * The plans are the same rows /pricing and checkout read, chosen and marked
 * the same way as the old preview (pricing-preview.tsx): the monthly plans,
 * Grow as the featured one and Starter as "try it first" - by tier, never by
 * position - so the homepage cannot advertise a price the checkout will not
 * honour. Plan names stay in English: they are product names.
 *
 * The design's figures are not its own: each card's two numbers are the
 * plan row's article and keyword limits, as /pricing lists them. Its social
 * post counts are left out (no plan row has one), and so are credit and
 * website counts, which the client asked not to advertise.
 *
 * The capabilities are the same on every plan - the product withholds
 * volume, not features (lib/plans/features.ts) - so the first card lists
 * them and each card after it says it has everything before it with more
 * capacity. Scale's one real extra, priority processing, is named on Scale.
 */
export function Pricing({ c, m, locale, href, plans }: SectionProps & { plans: PlanRow[] }) {
  const t = c.pricing;
  const monthly = plans.filter((plan) => plan.interval === "month");

  return (
    <section id="pricing" className={styles.pricing} aria-labelledby="pricing-title">
      <div className={styles.pricingInner}>
        <header className={`${styles.pricingHead} ${styles.reveal}`} data-reveal="">
          <p className={styles.kicker}>{t.eyebrow}</p>
          <h2 id="pricing-title" className={styles.sectionTitle}>
            {rich(t.title)}
          </h2>
          <p className={styles.sectionSub}>{t.sub}</p>
          <ul className={styles.included}>
            {t.included.map((item) => (
              <li key={item}>
                <Check aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </header>

        {monthly.length === 0 ? (
          // A real state rather than placeholder prices checkout would not honour.
          <p className={`${styles.sectionSub} ${styles.center}`}>{m.home.unavailable}</p>
        ) : (
          <ul className={`${styles.planGrid} ${styles.reveal}`} data-reveal="" data-delay="1">
            {monthly.map((plan, index) => {
              const featured = plan.tier === "grow";
              const isStarter = plan.tier === STARTER_TIER;
              const badge = featured ? m.home.mostPopular : isStarter ? m.home.tryItFirst : null;
              const features = [
                ...(index === 0 ? t.features : [t.everything]),
                ...(plan.tier === "scale" ? t.scaleExtra : []),
              ];
              return (
                <li key={plan.id} className={featured ? `${styles.plan} ${styles.planFeatured}` : styles.plan}>
                  <div className={styles.planTop}>
                    <span>
                      {String(index + 1).padStart(2, "0")} / {t.allInOne}
                    </span>
                    {badge ? <span className={styles.badge}>{badge}</span> : null}
                  </div>
                  <h3>{plan.name}</h3>
                  {isStarter ? <p className={styles.planIntro}>{m.pricing.starterTagline}</p> : null}
                  <p className={styles.price}>
                    <strong>{formatPrice(plan.priceCents, plan.currency)}</strong>
                    <span>{m.home.perMonth.trim()}</span>
                  </p>
                  <div className={styles.capacity}>
                    <div>
                      <strong>{plan.articleLimit.toLocaleString(locale)}</strong>
                      <small>{t.articles}</small>
                    </div>
                    <div>
                      <strong>{plan.keywordLimit.toLocaleString(locale)}</strong>
                      <small>{t.keywords}</small>
                    </div>
                  </div>
                  <ul className={styles.planList}>
                    {features.map((feature) => (
                      <li key={feature}>
                        <Check aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href={href("/sign-up")} className={`${styles.planButton} ${local.focusRing}`}>
                    {m.home.getStartedPlan}
                    <ArrowUpRight className={local.readIcon} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className={styles.pricingMore}>
          <div>
            <strong>{t.moreTitle}</strong>
            <p>{t.moreBody}</p>
          </div>
          <Link href={href("/contact")} className={`${local.withIcon} ${local.focusRing}`}>
            {t.talk} <ArrowUpRight className={local.readIcon} aria-hidden="true" />
          </Link>
        </div>

        <p className={styles.seeAll}>
          <Link href={href("/pricing")} className={`${local.withIcon} ${local.focusRing}`}>
            {m.home.seeAllPlans} <ArrowRight className={local.readIcon} aria-hidden="true" />
          </Link>
        </p>
      </div>
    </section>
  );
}
