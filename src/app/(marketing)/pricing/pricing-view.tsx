import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { formatPrice, type PlanRow } from "@/lib/billing-shared";
import { localePath, type Locale } from "@/lib/i18n/config";
import { assistantWords, notCheckedWords } from "@/lib/geo/engine-words";
import { format } from "@/lib/i18n/format";
import { pricingPageCopy, type PricingTierId } from "@/lib/i18n/pricing-page";
import type { Testimonial } from "@/lib/marketing/testimonials";
import { GROW_VISIBILITY_TIER, signUpForPlan } from "@/lib/plans/features";
import { freePlanCopy } from "@/lib/i18n/free-plan";
import { FREE_PLAN, freePlanDisplay, freePlanValues, type FreePlanCounter } from "@/lib/plans/free-plan";

import { Reviews } from "../_home/sections/reviews";
import { PlansBilling } from "./plans-billing";
import { cardPrices } from "./prices";
import styles from "./pricing.module.css";

/** The design's class names, through the module: c("plan popular"). */
const c = (names: string) =>
  names
    .split(" ")
    .map((name) => styles[name] ?? name)
    .join(" ");

/**
 * The copy's two marks: `**words**` bold, `*words*` the accent (an <em> the
 * stylesheet colours). The strings never carry HTML.
 */
function marks(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(/\*\*([^*]+)\*\*|\*([^*]+)\*/g)) {
    const at = match.index ?? 0;
    if (at > last) parts.push(<Fragment key={key++}>{text.slice(last, at)}</Fragment>);
    parts.push(match[1] !== undefined ? <strong key={key++}>{match[1]}</strong> : <em key={key++}>{match[2]}</em>);
    last = at + match[0].length;
  }
  if (last < text.length) parts.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return parts;
}

/**
 * The paid tiers ON SALE, in order. Launch is not one any more: the Free plan
 * replaced it (2026-11-19, lib/plans/free-plan.ts) and its card comes first.
 * Its words stay in lib/i18n/pricing-page.ts for its subscribers' Billing.
 */
const TIERS: PricingTierId[] = ["grow", "scale"];

/** The design's icon for each plan. */
const ICONS: Record<PricingTierId, ReactNode> = {
  launch: (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 19 6-6 4 4 5-8" />
      <path d="M15 9h5v5" />
    </svg>
  ),
  grow: (
    <svg fill="none" stroke="#ec693b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.65" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" />
    </svg>
  ),
  scale: (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6z" />
      <path d="m19 2 .8 2.2L22 5l-2.2.8L19 8l-.8-2.2L16 5l2.2-.8z" />
    </svg>
  ),
};

/** A figure in one billing period only; the switch shows one of the two (plans-billing.tsx). */
function Both({ monthly, yearly }: { monthly: string; yearly: string }) {
  return (
    <>
      <span className={styles.monthly}>{monthly}</span>
      <span className={styles.yearly}>{yearly}</span>
    </>
  );
}

/**
 * The pricing page body (client's design of 2026-11-11), the same for every
 * language: the hero, the Grow + Visibility bundle, the three plans with their
 * Monthly / Yearly switch, the comparison, the homepage's customer stories,
 * the questions and the free trial. The site's own header and footer frame it.
 *
 * EVERY FIGURE IS A PLAN ROW'S: the prices, articles, social posts and search
 * terms are the rows checkout charges (scripts/plan-catalog.mjs), so the price
 * read here is the price paid. The offer prices are the regular ones less 40%,
 * as the design rounds them (prices.ts), shown only while the REPGET offer is
 * on - checkout applies it by itself, on every payment, so these are the
 * prices charged (lib/billing/repget-offer.ts). A plan not
 * on sale is left out rather than shown with a price nobody can pay; the bundle
 * appears once its row is on sale.
 */
export function PricingView({
  locale,
  plans,
  testimonials,
  offer,
  freeCounter = null,
}: {
  locale: Locale;
  /** The plans on sale (lib/billing.ts listPlans). */
  plans: PlanRow[];
  /** The published reviews (Admin -> Testimonials), for the homepage's customer stories. */
  testimonials: Testimonial[];
  /** Whether the REPGET offer is on (REPGET_OFFER_ENABLED). */
  offer: boolean;
  /** The Free plan's launch counter (lib/plans/free-plan-server.ts getFreePlanCounter), or null to leave it out. */
  freeCounter?: FreePlanCounter | null;
}) {
  const t = pricingPageCopy(locale);
  // The assistants the AI visibility check asks on this deployment, for the FAQ (lib/geo/engine-words.ts).
  const assistants = assistantWords(locale);
  const notChecked = notCheckedWords(locale);
  const free = freePlanDisplay(locale);
  const href = (path: string) => localePath(locale, path);
  const number = (n: number) => n.toLocaleString(locale === "en" ? "en-IE" : locale);

  const monthly = new Map(plans.filter((plan) => plan.interval === "month").map((plan) => [plan.tier, plan]));
  const annual = new Map(plans.filter((plan) => plan.interval === "year").map((plan) => [plan.tier, plan]));
  const tiers = TIERS.filter((tier) => monthly.has(tier));
  const bundle = monthly.get(GROW_VISIBILITY_TIER) ?? null;
  const bundlePrice = bundle ? formatPrice(bundle.priceCents, bundle.currency) : null;

  const counts = (plan: PlanRow) => ({
    articles: plan.articleLimit,
    posts: plan.socialPostLimit,
    terms: number(plan.keywordLimit),
  });

  // The questions about the bundle, and answers that name it, only while it is on sale.
  const groups = t.faq.groups
    .map((group) => ({ ...group, items: group.items.filter((item) => bundle || !`${item.q} ${item.a}`.includes("Grow + Visibility")) }))
    .filter((group) => group.items.length > 0);
  const questions = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className={styles.pricing}>
      {/* Hero */}
      <section className={c("hero")}>
        <div className={c("container hero-content")}>
          <h1>
            {t.hero.titleLead}
            <br />
            <span>{t.hero.titleAccent}</span>
          </h1>
          <p>{t.hero.body}</p>
          <div className={c("hero-trust")}>
            {t.hero.pills.map((pill) => (
              <span key={pill} className={c("trust-pill")}>
                <i>✓</i> {pill}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Grow + Visibility: a direct purchase (lib/plans/features.ts GROW_VISIBILITY_TIER) */}
      {bundle && bundlePrice ? (
        <section aria-labelledby="growth-offer-title" className={c("container lifetime-section")} id="lifetime">
          <article className={c("lifetime-offer growth-offer")}>
            <div className={c("growth-grid")}>
              <div className={c("growth-main")}>
                <div className={c("lifetime-flag-row")}>
                  <span className={c("lifetime-flag")}>{t.bundle.flag}</span>
                  {/* What it includes, never a saving: no struck EUR 299 and no "save 57%" (owner, 2026-11-27). */}
                  <span className={c("lifetime-sale")}>{t.bundle.includes}</span>
                </div>
                <h2 className={c("lifetime-title")} id="growth-offer-title">
                  Grow <span className={c("growth-plus")}>+</span>
                  <br />
                  Visibility<span className={c("growth-period")}>.</span>
                </h2>
                <p className={c("growth-lede")}>{t.bundle.lede}</p>
                <div
                  className={c("lifetime-price")}
                  aria-label={format(t.bundle.priceLabel, { price: bundlePrice })}
                >
                  <strong>{bundlePrice}</strong>
                  <span>{t.bundle.perMonth}</span>
                </div>
                <div className={c("growth-left-feature")}>
                  <div className={c("growth-left-feature-kicker")}>
                    <span className={c("growth-left-feature-spark")}>✦</span> {t.bundle.featureKicker}
                  </div>
                  <h3>{marks(t.bundle.featureTitle)}</h3>
                  <p>{t.bundle.featureBody}</p>
                </div>
                {/* Through sign-up (or straight on, signed in) to this plan's paid checkout, with no free trial. */}
                <Link
                  prefetch={false}
                  aria-label={format(t.bundle.ctaLabel, { price: bundlePrice })}
                  className={c("lifetime-cta")}
                  href={signUpForPlan(GROW_VISIBILITY_TIER)}
                >
                  {t.bundle.cta}{" "}
                  <span aria-hidden="true" className={c("arrow")}>
                    ↗
                  </span>
                </Link>
                <p className={c("growth-purchase-note")}>
                  <span className={c("purchase-info")} aria-hidden="true">
                    ⓘ
                  </span>
                  <span>
                    <strong>{t.bundle.noteStrong}</strong> {format(t.bundle.note, { price: bundlePrice })}
                  </span>
                </p>
              </div>
              <div className={c("growth-details")}>
                <div className={c("growth-core-card")}>
                  <div className={c("growth-card-heading")}>
                    <span className={c("growth-eyebrow")}>{t.bundle.coreEyebrow}</span>
                    <span className={c("growth-card-pill")}>{t.bundle.corePill}</span>
                  </div>
                  <div className={c("growth-stats")}>
                    {[bundle.articleLimit, bundle.socialPostLimit, bundle.keywordLimit].map((value, index) => (
                      <div key={t.bundle.stats[index].strong} className={c("growth-stat")}>
                        <strong>{number(value)}</strong>
                        <span>
                          {t.bundle.stats[index].strong} <small>{t.bundle.stats[index].small}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className={c("growth-features")}>
                    {t.bundle.coreFeatures.map((feature) => (
                      <div key={feature}>
                        <i aria-hidden="true">✓</i> <span>{marks(feature)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={c("growth-bonus-card")}>
                  <div className={c("growth-card-heading")}>
                    <span className={c("growth-eyebrow")}>{t.bundle.bonusEyebrow}</span>
                    <span className={c("growth-bonus-pill")}>{t.bundle.bonusPill}</span>
                  </div>
                  <p className={c("growth-bonus-intro")}>{t.bundle.bonusIntro}</p>
                  <div className={c("growth-bonuses")}>
                    {t.bundle.bonuses.map((bonus) => (
                      <div key={bonus.strong} className={c("growth-bonus")}>
                        <span className={c("growth-star")} aria-hidden="true">
                          ✦
                        </span>
                        <span>
                          <strong>{bonus.strong}</strong>
                          <small>{bonus.small}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {/* The three plans and the billing switch */}
      {tiers.length > 0 ? (
        <PlansBilling
          sectionLabel={t.billing.sectionLabel}
          label={t.billing.label}
          monthly={t.billing.monthly}
          yearly={t.billing.yearly}
          saving={offer ? t.billing.saving : t.billing.savingPlain}
        >
          <div className={c("plans")}>
            <FreeCard locale={locale} counter={freeCounter} />
            {tiers.map((tier) => {
              const plan = monthly.get(tier)!;
              const yearRow = annual.get(tier) ?? null;
              const words = t.plans[tier];
              const popular = tier === "grow";
              const prices = cardPrices(plan, yearRow, offer);
              const year = prices.yearly ?? { regular: prices.monthly.regular, price: prices.monthly.price, total: "", regularTotal: "" };
              const yearlyCaption = prices.yearly
                ? format(offer ? t.card.yearlyCaption : t.card.plainYearlyCaption, { price: year.total, regular: year.regularTotal })
                : offer
                  ? t.card.monthlyCaption
                  : t.card.plainMonthlyCaption;
              const values = counts(plan);
              return (
                <article key={plan.id} className={c(popular ? "plan popular" : "plan")}>
                  {popular ? (
                    <div className={c("popular-badge")}>
                      <b>✦</b> {t.card.popular}
                    </div>
                  ) : null}
                  <div className={c("plan-top")}>
                    <div className={c("plan-icon")}>{ICONS[tier]}</div>
                    <span className={c("plan-tag")}>{words.tag}</span>
                  </div>
                  <h2>{plan.name}</h2>
                  <p className={c("plan-desc")}>{words.desc}</p>
                  <div className={c("price-area")}>
                    {offer ? (
                      <div className={c("price-offer-row")}>
                        <span className={c("price-offer-badge")}>{t.card.offerBadge}</span>
                        <del className={c("price-original")}>
                          <Both monthly={prices.monthly.regular} yearly={year.regular} />
                        </del>
                        <span className={c("was-label")}>{t.card.wasLabel}</span>
                      </div>
                    ) : null}
                    <div className={c("price")}>
                      <strong>
                        <Both monthly={prices.monthly.price} yearly={year.price} />
                      </strong>
                      <span>{t.card.perMonth}</span>
                    </div>
                    <div className={c("billing-caption")}>
                      <Both monthly={offer ? t.card.monthlyCaption : t.card.plainMonthlyCaption} yearly={yearlyCaption} />
                    </div>
                  </div>
                  <Link prefetch={false} className={c(popular ? "btn btn-dark plan-cta" : "btn btn-light plan-cta")} href={signUpForPlan(tier)}>
                    {words.cta} <span aria-hidden="true">↗</span>
                  </Link>
                  <div className={c("plan-divider")} />
                  <div className={c("included-label")}>{words.includedLabel}</div>
                  <ul className={c("features")}>
                    {words.features.map((feature) => (
                      <li key={feature}>
                        <span className={c("check")} aria-hidden="true">
                          ✓
                        </span>
                        <span>{marks(format(feature, values))}</span>
                      </li>
                    ))}
                  </ul>
                  {words.perks ? (
                    <div className={c("plan-visibility")} aria-label={t.card.perksLabel}>
                      <div className={c("plan-visibility-head")}>
                        <span className={c("plan-visibility-title")}>
                          <span className={c("vis-spark")} aria-hidden="true">
                            ✦
                          </span>{" "}
                          {t.card.perksTitle}
                        </span>
                        {tier === "scale" ? <span className={c("plan-visibility-priority")}>{t.card.priority}</span> : null}
                      </div>
                      <ul>
                        {words.perks.map((perk) => (
                          <li key={perk.strong}>
                            <span>
                              <strong>{perk.strong}</strong>
                              <small>{perk.small}</small>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className={c("plan-more")}>
                    <a href="#compare">
                      {t.card.more} <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </PlansBilling>
      ) : null}

      {/* Compare */}
      {tiers.length > 0 ? (
        <section className={c("compare container")} id="compare">
          <div className={c("section-title")}>
            <div className={c("eyebrow")}>
              <span className={c("dot")} /> {t.compare.eyebrow}
            </div>
            <h2>{t.compare.title}</h2>
            <p>{t.compare.body}</p>
          </div>
          <div className={c("compare-table-wrap")}>
            <table className={c("compare-table")}>
              <thead>
                <tr>
                  <th>{t.compare.included}</th>
                  <th>{free.name}</th>
                  {tiers.map((tier) => (
                    <th key={tier} className={tier === "grow" ? c("featured-col") : undefined}>
                      {monthly.get(tier)!.name}
                      {tier === "grow" ? " ✦" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows(t.compare, freePlanCopy(locale).compare, freePlanValues(locale)).map((row) => (
                  <tr key={row.key}>
                    <td>
                      {row.sub ? (
                        <>
                          <strong>{row.label}</strong>
                          <small className={c("table-sub")}>{row.sub}</small>
                        </>
                      ) : (
                        row.label
                      )}
                    </td>
                    <td>{cell(row.free, t.compare, number)}</td>
                    {tiers.map((tier) => (
                      <td key={tier} className={tier === "grow" ? c("featured-col") : undefined}>
                        {cell(row.value(tier, monthly.get(tier)!), t.compare, number)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={c("usage-note")}>{t.compare.usageNote}</p>
        </section>
      ) : null}

      {/* Customer stories: the homepage's section, from the published reviews (nothing while none is published). */}
      <Reviews locale={locale} href={href} testimonials={testimonials} />

      {/* Questions */}
      <section className={c("faq-home")} id="faq" aria-labelledby="faq-title">
        <div className={c("faq-home-inner")}>
          <div className={c("faq-intro")}>
            <div className={c("faq-eyebrow")}>{t.faq.eyebrow}</div>
            <h2 id="faq-title">
              {t.faq.titleLines
                .filter(Boolean)
                .map((line, index) => (
                  <Fragment key={line}>
                    {index > 0 ? <br /> : null}
                    {line}
                  </Fragment>
                ))}
            </h2>
            <p className={c("faq-description")}>{t.faq.description}</p>
            <p className={c("faq-contact")}>
              {t.faq.contactLead}{" "}
              <Link prefetch={false} href={href("/contact")}>
                {t.faq.contact}
              </Link>
            </p>
          </div>
          <div className={c("faq-panel")}>
            <div className={c("faq-panel-top")}>
              <span>{t.faq.panelTop}</span>
              <span>
                {t.faq.scrollMore} <span aria-hidden="true">↓</span>
              </span>
            </div>
            <div className={c("faq-scroll")} role="region" aria-label={t.faq.regionLabel} tabIndex={0}>
              {groups.map((group) => (
                <Fragment key={group.title}>
                  <div className={c("faq-group-heading")}>
                    <span>{group.title}</span>
                  </div>
                  <div className={c("faqs")}>
                    {group.items.map((item) => (
                      <details key={item.q}>
                        <summary>
                          {item.q}
                          <span className={c("plus")} aria-hidden="true">
                            +
                          </span>
                        </summary>
                        <p>
                          {format(item.a, { price: bundlePrice ?? "", assistants, notChecked })}
                          {item.link ? (
                            <>
                              {" "}
                              <Link prefetch={false} href={href("/refunds")}>
                                {item.link}
                              </Link>
                            </>
                          ) : null}
                        </p>
                      </details>
                    ))}
                  </div>
                </Fragment>
              ))}
            </div>
            <div className={c("faq-panel-bottom")}>
              <span>{format(t.faq.count, { n: questions })}</span>
              <span>
                {t.faq.scrollInside} <span aria-hidden="true">↕</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Free trial */}
      <section className={c("trial container")} id="trial">
        <div className={c("trial-box")}>
          <div className={c("trial-left")}>
            <div className={c("eyebrow")}>
              <span className={c("dot")} /> {t.trial.eyebrow}
            </div>
            <h2>
              {t.trial.titleLines[0]}
              <br />
              {t.trial.titleLines[1]}
            </h2>
            <p>{t.trial.body}</p>
            <div className={c("trial-points")}>
              {t.trial.points.map((point) => (
                <span key={point}>{point}</span>
              ))}
            </div>
            <Link prefetch={false} className={c("btn btn-orange")} href="/sign-up">
              {t.trial.cta} ↗
            </Link>
          </div>
          <div aria-hidden="true" className={c("trial-right")}>
            <div className={c("mini-card mini-card-one")}>
              <div className={c("mc-kicker")}>{t.trial.card1Kicker}</div>
              <h4>{t.trial.card1Title}</h4>
              <div className={c("lines")}>
                <i />
                <i />
                <i />
              </div>
              <div className={c("status")}>{t.trial.card1Status}</div>
            </div>
            <div className={c("mini-card mini-card-two")}>
              <div className={c("mc-kicker")}>{t.trial.card2Kicker}</div>
              <h4>{t.trial.card2Title}</h4>
              <div className={c("stat-grid")}>
                {t.trial.card2Stats.map((stat) => (
                  <div key={stat.small} className={c("stat")}>
                    <b>{stat.strong}</b>
                    <small>{stat.small}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <p className={c("trial-note")}>
          {t.trial.note}{" "}
          <Link prefetch={false} href={href("/refunds")}>
            {t.trial.noteLink}
          </Link>
          {t.trial.noteEnd}
        </p>
      </section>
    </div>
  );
}

type CompareCopy = ReturnType<typeof pricingPageCopy>["compare"];
type CellValue = { kind: "count"; n: number } | { kind: "text"; text: string } | { kind: "yes" } | { kind: "no" } | { kind: "priority" };

const count = (n: number): CellValue => ({ kind: "count", n });
const YES: CellValue = { kind: "yes" };
const NO: CellValue = { kind: "no" };
/** The visibility perks: Priority on Scale, none on Launch or Grow (client, 2026-11-24: with Grow they are sold as Grow + Visibility). */
const perk = (tier: PricingTierId): CellValue => (tier === "scale" ? { kind: "priority" } : NO);
const scaleOnly = (tier: PricingTierId): CellValue => (tier === "scale" ? YES : NO);

/**
 * The design's rows, in its order. Counts come from the plan rows; the Free
 * column (`free`) from lib/plans/free-plan.ts FREE_PLAN, the numbers its
 * allowances enforce: no backlinks and no visibility perks on Free.
 */
function compareRows(
  t: CompareCopy,
  f: ReturnType<typeof freePlanCopy>["compare"],
  values: ReturnType<typeof freePlanValues>,
): { key: string; label: string; sub?: string; free: CellValue; value: (tier: PricingTierId, plan: PlanRow) => CellValue }[] {
  const text = (words: string): CellValue => ({ kind: "text", text: format(words, values) });
  return [
    { key: "articles", label: t.articles, free: count(FREE_PLAN.articlesPerMonth), value: (_tier, plan) => count(plan.articleLimit) },
    { key: "posts", label: t.posts, free: count(FREE_PLAN.socialPostsPerMonth), value: (_tier, plan) => count(plan.socialPostLimit) },
    { key: "terms", label: t.terms, free: count(FREE_PLAN.searchTerms), value: (_tier, plan) => count(plan.keywordLimit) },
    // One website per subscription, on every plan (lib/plans/features.ts ONE_WEBSITE).
    { key: "websites", label: t.websites, free: count(FREE_PLAN.websites), value: () => count(1) },
    { key: "copilot", label: t.copilot.strong, sub: t.copilot.small, free: text(f.copilotPerDay), value: () => YES },
    { key: "social", label: t.social.strong, sub: t.social.small, free: YES, value: () => YES },
    { key: "cms", label: t.cms, free: YES, value: () => YES },
    { key: "audits", label: t.audits, free: text(f.audits), value: () => YES },
    { key: "visibility", label: t.visibility, free: text(f.snapshot), value: () => YES },
    { key: "backlinks", label: t.backlinks, free: NO, value: () => YES },
    { key: "blog", label: t.blog.strong, sub: t.blog.small, free: NO, value: (tier) => perk(tier) },
    { key: "channels", label: t.channels.strong, sub: t.channels.small, free: NO, value: (tier) => perk(tier) },
    { key: "email", label: t.email.strong, sub: t.email.small, free: NO, value: (tier) => perk(tier) },
    { key: "custom", label: t.custom, free: NO, value: (tier) => scaleOnly(tier) },
  ];
}

function cell(value: CellValue, t: CompareCopy, number: (n: number) => string): ReactNode {
  switch (value.kind) {
    case "count":
      return number(value.n);
    case "text":
      return value.text;
    case "yes":
      return <span className={styles.yes}>✓</span>;
    case "no":
      return <span className={styles.no}>—</span>;
    case "priority":
      return <span className={c("compare-status compare-status-priority")}>{t.statusPriority}</span>;
  }
}

/** The Free card's asterisk tile, as the card draws it. */
const ASTERISK = (
  <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 4v16M5.1 8l13.8 8M5.1 16l13.8-8" />
  </svg>
);

/**
 * The Free plan's card (Daniel, 2026-11-19, free-plan-card.png), in the card
 * system Grow and Scale use, first in the row where Launch was. Every word
 * and figure is freePlanDisplay's (lib/plans/free-plan.ts), which the
 * homepage, onboarding and the growth-plan flow draw too.
 *
 * The launch counter ("430 / 500 free spots taken", with its bar) sits under
 * the button; at the cap the card says the spots are taken and the button
 * leads to Grow's free trial instead. The price is the same monthly and
 * yearly, so the billing switch leaves it alone.
 */
function FreeCard({ locale, counter }: { locale: Locale; counter: FreePlanCounter | null }) {
  const card = freePlanDisplay(locale, counter);
  return (
    <article className={c("plan free-plan")}>
      <div className={c("plan-top")}>
        <div className={c("plan-icon")}>{ASTERISK}</div>
      </div>
      <h2>{card.name}</h2>
      <p className={c("plan-desc")}>{card.desc}</p>
      <div className={c("price-area")}>
        <div className={c("price-offer-row")}>
          <span className={c("price-offer-badge")}>{card.badge}</span>
        </div>
        <div className={c("price")}>
          <strong>{card.price}</strong>
          <span>{card.perMonth}</span>
        </div>
        <div className={c("billing-caption free-caption")}>{card.caption}</div>
      </div>
      <Link prefetch={false} className={c("btn btn-orange plan-cta free-cta")} href={card.ctaHref} aria-label={card.ctaLabel}>
        {card.cta} <span aria-hidden="true">↗</span>
      </Link>
      {card.counter ? (
        <div className={c("free-counter")}>
          <div className={c("free-counter-text")}>
            <span>{card.counter.text}</span>
          </div>
          <div
            className={c("free-counter-bar")}
            role="progressbar"
            aria-label={card.counter.label}
            aria-valuemin={0}
            aria-valuemax={card.counter.cap}
            aria-valuenow={card.counter.taken}
          >
            <div className={c("free-counter-fill")} style={{ width: `${card.counter.percent}%` }} />
          </div>
          {card.fullNote ? <p className={c("free-full-note")}>{card.fullNote}</p> : null}
        </div>
      ) : null}
      <div className={c("plan-divider")} />
      <div className={c("included-label")}>{card.includedLabel}</div>
      <ul className={c("features")}>
        {card.features.map((feature) => (
          <li key={feature}>
            <span className={c("check")} aria-hidden="true">
              ✓
            </span>
            <span>{marks(feature)}</span>
          </li>
        ))}
        {card.locked.map((feature) => (
          <li key={feature} className={c("locked")}>
            <span className={c("lock-mark")} aria-hidden="true">
              ~
            </span>
            <span>{marks(feature)}</span>
          </li>
        ))}
      </ul>
      <div className={c("plan-more")}>
        <a href="#compare">
          {card.more} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}
