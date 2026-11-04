import Link from "next/link";

import { formatPrice, type PlanRow } from "@/lib/billing-shared";
import { pricingCopy, type HomePackageId } from "@/lib/i18n/home/pricing";
import { signUpForPlan } from "@/lib/plans/features";
import type { SectionProps } from "../types";
import styles from "./pricing.module.css";

/** The design's class names, through the module: c("rgp-card rgp-featured"). */
const c = (names: string) =>
  names
    .split(" ")
    .map((name) => styles[name] ?? name)
    .join(" ");

/**
 * Pricing (client's design, 2026-11-03: "One platform. Everything to grow.";
 * <section class="rgp-packages" id="pricing">), ported as drawn.
 *
 * The figures are the plans on sale, the rows /pricing and checkout read, so
 * the price on this page is the price charged; the design's words for each
 * tier come from lib/i18n/home/pricing.ts. Launch EUR 99, Grow EUR 149 (most
 * popular, raised) and Scale EUR 349 are scripts/plan-catalog.mjs. With no
 * plans to read (a build without a database) the cards are left out rather
 * than showing prices checkout would not honour.
 *
 * Every "Get Started" goes through sign-up to that plan, "Talk to our team" to
 * the contact page.
 */
export function Pricing({ locale, href, plans }: SectionProps & { plans: PlanRow[] }) {
  const t = pricingCopy(locale);
  const packages = plans.filter((plan) => plan.interval === "month" && plan.tier in t.packages);

  return (
    <section className={c("rgp-packages")} id="pricing" aria-labelledby="rgp-title">
      <div className={c("rgp-container")}>
        <header className={c("rgp-heading")}>
          <div className={c("rgp-eyebrow")}>{t.eyebrow}</div>
          <h2 id="rgp-title">
            {t.titleLead} <em>{t.titleAccent}</em>
          </h2>
          <p>{t.sub}</p>
          <div className={c("rgp-unified-row")} aria-label={t.includedLabel}>
            {t.included.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </header>
        {packages.length > 0 ? (
          <div className={c("rgp-grid")} aria-label={t.gridLabel}>
            {packages.map((plan, index) => {
              const words = t.packages[plan.tier as HomePackageId];
              const featured = plan.tier === "grow";
              // "€99" as the design sets it: the symbol small, the amount large.
              const price = formatPrice(plan.priceCents, plan.currency);
              const amount = price.replace(/^\D+/, "");
              return (
                <article key={plan.id} className={c(featured ? "rgp-card rgp-featured" : "rgp-card")} aria-label={words.label}>
                  <div className={c("rgp-card-top")}>
                    <span className={c("rgp-tier")}>
                      {String(index + 1).padStart(2, "0")} / {t.allInOne}
                    </span>
                    {featured ? <span className={c("rgp-popular")}>{t.popular}</span> : null}
                  </div>
                  <h3>{plan.name}</h3>
                  <p className={c("rgp-intro")}>{words.intro}</p>
                  <div className={c("rgp-price")}>
                    <span className={c("rgp-euro")}>{price.slice(0, price.length - amount.length)}</span>
                    <strong>{amount}</strong>
                    <span className={c("rgp-time")}>{t.perMonth}</span>
                  </div>
                  <div className={c("rgp-capacity")}>
                    <div>
                      <strong>{plan.articleLimit}</strong>
                      <small>{t.articles}</small>
                    </div>
                    {plan.socialPostLimit > 0 ? (
                      <div>
                        <strong>{plan.socialPostLimit}</strong>
                        <small>{t.posts}</small>
                      </div>
                  ) : null}
                </div>
                <ul>
                  {words.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
                <Link prefetch={false} className={c("rgp-action")} href={signUpForPlan(plan.tier)}>
                  {t.getStarted} <span aria-hidden="true">↗</span>
                </Link>
              </article>
            );
          })}
        </div>
        ) : null}
        <div className={c("rgp-bottom")}>
          <div className={c("rgp-bottom-left")}>
            <strong>{t.moreTitle}</strong>
            <p>{t.moreBody}</p>
          </div>
          <Link prefetch={false} href={href("/contact")}>{t.talk} ↗</Link>
        </div>
      </div>
    </section>
  );
}
