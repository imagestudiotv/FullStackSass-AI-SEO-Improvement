import Link from "next/link";

import { formatPrice, type PlanRow } from "@/lib/billing-shared";
import { pricingCopy, type HomePackageId } from "@/lib/i18n/home/pricing";
import { signUpForPlan } from "@/lib/plans/features";
import { freePlanDisplay, isRetiredFromSale, type FreePlanCounter } from "@/lib/plans/free-plan";
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
 *
 * THE FREE PLAN COMES FIRST, where Launch was (Daniel, 2026-11-19: "We will
 * replace it with our basic Launch plan"): its words and figures are
 * freePlanDisplay's (lib/plans/free-plan.ts), the card /pricing and onboarding
 * draw too, with the launch counter when the page could read it. This page
 * is built ahead and refreshed in the background, so the counter can trail
 * by up to the page's refresh time.
 */
export function Pricing({ locale, href, plans, freeCounter = null }: SectionProps & { plans: PlanRow[]; freeCounter?: FreePlanCounter | null }) {
  const t = pricingCopy(locale);
  const packages = plans.filter((plan) => plan.interval === "month" && plan.tier in t.packages && !isRetiredFromSale(plan.tier));
  const free = freePlanDisplay(locale, freeCounter);
  const plain = (text: string) => text.replaceAll("**", "");

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
            <article className={c("rgp-card rgp-free")} aria-label={free.name}>
              <div className={c("rgp-card-top")}>
                <span className={c("rgp-tier")}>01 / {free.badge}</span>
              </div>
              <h3>{free.name}</h3>
              <p className={c("rgp-intro")}>{free.desc}</p>
              <div className={c("rgp-price")}>
                <span className={c("rgp-euro")}>€</span>
                <strong>0</strong>
                <span className={c("rgp-time")}>{t.perMonth}</span>
              </div>
              <div className={c("rgp-capacity")}>
                <div>
                  <strong>{free.limits.articlesPerMonth}</strong>
                  <small>{t.articles}</small>
                </div>
                <div>
                  <strong>{free.limits.socialPostsPerMonth}</strong>
                  <small>{t.posts}</small>
                </div>
              </div>
              <ul>
                {free.features.slice(2).map((feature) => (
                  <li key={feature}>{plain(feature)}</li>
                ))}
                {free.locked.map((feature) => (
                  <li key={feature} className={c("rgp-locked")}>
                    {plain(feature)}
                  </li>
                ))}
              </ul>
              {free.counter ? (
                <div className={c("rgp-free-counter")}>
                  <span>{free.counter.text}</span>
                  <div role="progressbar" aria-label={free.counter.label} aria-valuemin={0} aria-valuemax={free.counter.cap} aria-valuenow={free.counter.taken}>
                    <i style={{ width: `${free.counter.percent}%` }} />
                  </div>
                </div>
              ) : null}
              <Link prefetch={false} className={c("rgp-action rgp-free-action")} href={free.ctaHref} aria-label={free.ctaLabel}>
                {free.cta} <span aria-hidden="true">↗</span>
              </Link>
            </article>
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
                      {String(index + 2).padStart(2, "0")} / {t.allInOne}
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
