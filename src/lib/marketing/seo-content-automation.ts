import { formatPrice, type PlanRow } from "@/lib/billing-shared";
import type { Locale } from "@/lib/i18n/config";
import { planDisplayPrice } from "@/lib/billing/display-prices";
import { trialAllowance } from "@/lib/billing/entitlement-period";
import { TRIAL_DAYS } from "@/lib/plans/features";
import { SUPPORTED_LANGUAGES } from "@/lib/websites/languages";

import { SEO_CONTENT_AUTOMATION_TRANSLATIONS } from "./seo-content-automation.translations";

/**
 * The SEO-content-automation landing page, /seo-content-automation: the
 * destination prepared for the English (US/UK) Google Ads candidate
 * (review-reports/2026-11-17/google-ads/english-pilot), and its Italian,
 * German, Spanish and French versions at /it|de|es|fr/seo-content-automation
 * (seo-content-automation.translations.ts; 2026-11-18, five languages, six
 * markets). Not indexed, not in the sitemap; no ad runs until the owner
 * approves one.
 *
 * EVERY CLAIM IS ONE THE PRODUCT BACKS, checked against the code on
 * 2026-11-17 (commercial-readiness-result.txt):
 *  - Research: search terms researched and clustered into topics
 *    (lib/keywords), the plan's keywordLimit; a dated content calendar of
 *    editable items (lib/keywords/calendar.ts). Search volumes depend on the
 *    keyword provider, so none are promised.
 *  - Writing: AI articles in the website's language (SUPPORTED_LANGUAGES),
 *    with a title, a meta description and internal links only to pages that
 *    exist (lib/articles/internal-links.ts). A cover image is added when
 *    image generation works; when it fails the article is still saved and
 *    published without one (inngest generate-article "generate-image" and
 *    publish-article "upload-image" catch and continue), so images are never
 *    promised. NO schema markup is written for customer articles.
 *  - PUBLISHING IS AUTOMATIC BY DEFAULT and the page says so near the
 *    workflow: new websites publish live on the planned day
 *    (lib/websites/new-site-defaults.ts), and a website's FIRST article is
 *    published live as soon as it is written, in every mode
 *    (lib/publishing/policy.ts FIRST_ARTICLE_STATUS). Draft and review modes
 *    exist; review is not the default and cannot hold back the first article.
 *  - Connections are the registered publishers (lib/publishing/registry.ts)
 *    with the setup each guide asks for (lib/publishing/docs.ts). The plugin
 *    checks hourly through WordPress's own scheduler, so it is not instant.
 *  - Defaults the customer may not expect: a "powered by RepGet" link
 *    (poweredByLink) and Partner Network membership (NEW_SITE_NETWORK); both
 *    can be switched off.
 *  - Offer: the standard Launch plan and its trial. Price and limits are the
 *    plan row's, the price through planDisplayPrice - the function /pricing,
 *    Billing and the plan step use - so it is what checkout charges. Only
 *    the charged price is shown: no struck-through reference price, no
 *    countdown, no annual figure quoted per month. The trial is offered once,
 *    to a workspace that never had a subscription
 *    (lib/billing/checkouts.ts isTrialEligible), with a card or a PayPal
 *    approval taken at checkout; the trial's allowance is trialAllowance().
 *    The refund is the separate first-payment guarantee of /refunds.
 *
 * Not claimed: AI search tracking across assistants (only Claude is asked,
 * lib/geo/check.ts), automatic technical-SEO fixes (the audit is a report),
 * rank tracking, guaranteed rankings, priority processing, customer results.
 */

export const SEO_CONTENT_AUTOMATION_PATH = "/seo-content-automation";

/**
 * The prefixed languages with a version of the page (lib/i18n/config.ts
 * LOCALE_ONLY_PATHS lists the same ones). English is the unprefixed page.
 */
export const SEO_CONTENT_AUTOMATION_LOCALES = ["it", "de", "es", "fr"] as const satisfies readonly Locale[];

export type SeoContentAutomationCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  stepsTitle: string;
  steps: { title: string; body: string }[];
  publishing: { title: string; points: string[] };
  connectionsTitle: string;
  connectionsIntro: string;
  connections: { name: string; setup: string }[];
  connectionsNote: string;
  connectionsLink: string;
  planTitle: string;
  planIntro: string;
  planPoints: string[];
  limitsTitle: string;
  limits: string[];
  termsTitle: string;
  terms: string[];
  /** englishOnly: said next to the refund and terms links where those pages are not translated. */
  termsLinks: { refunds: string; terms: string; pricing: string; englishOnly?: string };
  faqTitle: string;
  faq: { question: string; answer: string }[];
  closingTitle: string;
  closingBody: string;
};

/** What the page needs from the Launch plan row. Null when it cannot be read: the page then names no figures. */
export type LaunchFacts = {
  price: string;
  articles: number;
  terms: number;
  trialArticles: number;
};

/** The monthly Launch row, its charged price (the launch price when that offer is on) and its trial allowance. */
export function launchFacts(plans: PlanRow[], offerOn: boolean): LaunchFacts | null {
  const plan = plans.find((row) => row.tier === "launch" && row.interval === "month");
  if (!plan) return null;
  const { chargedCents } = planDisplayPrice(plan, offerOn);
  return {
    price: formatPrice(chargedCents, plan.currency),
    articles: plan.articleLimit,
    terms: plan.keywordLimit,
    trialArticles: trialAllowance(plan.articleLimit, TRIAL_DAYS),
  };
}

const LANGUAGES = SUPPORTED_LANGUAGES.map((language) => language.value);

function languageList(): string {
  return `${LANGUAGES.slice(0, -1).join(", ")} and ${LANGUAGES.at(-1)}`;
}

/** The page's words in one of the five site languages: every one has a version. */
export function seoContentAutomationCopy(launch: LaunchFacts | null, locale: Locale = "en"): SeoContentAutomationCopy {
  return locale === "en" ? englishCopy(launch) : SEO_CONTENT_AUTOMATION_TRANSLATIONS[locale](launch);
}

function englishCopy(launch: LaunchFacts | null): SeoContentAutomationCopy {
  const termsLine = launch ? `Launch includes ${launch.terms.toLocaleString("en")} researched search terms.` : "";
  return {
    metaTitle: "SEO Content Automation for Business Websites",
    metaDescription:
      "Plan SEO topics, create AI articles and publish them to WordPress, Shopify, Ghost, Webflow, Wix or a webhook. The Launch plan starts with a 3-day trial.",
    eyebrow: "SEO content automation",
    title: "SEO content automation for your business website",
    intro:
      "RepGet brings topic planning, AI article writing and publishing to your website into one workflow. Connect your website, choose how articles are published, and RepGet writes and delivers them on a schedule.",
    primaryCta: "Start the Launch trial",
    secondaryCta: "Compare all plans",
    stepsTitle: "From research to a published article",
    steps: [
      {
        title: "Research",
        body: `Add your website. RepGet reads it, then researches search terms for your business and groups them into topics. ${termsLine}`.trim(),
      },
      {
        title: "Plan",
        body: "Those topics become a dated content calendar. You can edit, move or remove any planned article.",
      },
      {
        title: "Write",
        body: "Each article is written by AI in your website's language, with a title, a meta description and internal links to pages that exist on your site. A cover image is added when image generation is available; if it is not, the article is still written.",
      },
      {
        title: "Publish",
        body: "Articles go to your connected website on their planned day: published live, sent as drafts to your CMS, or kept in RepGet until you approve them. Read how publishing starts below.",
      },
    ],
    publishing: {
      title: "Publishing is automatic unless you change it",
      points: [
        "A new website starts in automatic mode: each article is published live on its planned day.",
        "Your website's first article is published live as soon as it is written and your website is connected, whichever mode you choose, so you see a real post on your site.",
        "After that, you can send articles to your CMS as drafts, or keep them in RepGet until you approve them, from the website's publishing settings. Review is not the default.",
        "By default, articles carry a small “powered by RepGet” link and your website joins RepGet's Partner Network, so links to other members' websites can be placed in your articles. You can switch off both.",
      ],
    },
    connectionsTitle: "Where RepGet can publish",
    connectionsIntro: "Each connection needs a short setup on your side. These are all the platforms RepGet publishes to directly:",
    connections: [
      {
        name: "WordPress plugin",
        setup:
          "Install the RepGet Connector plugin as a WordPress administrator. It checks for new articles about once an hour using WordPress's own scheduler, which runs when your site has visits, so timing can vary.",
      },
      { name: "WordPress (application password)", setup: "A self-hosted WordPress site and an Editor or Administrator account to create an application password." },
      { name: "Shopify", setup: "An Admin API access token from a custom app in your store, to publish to its blog." },
      { name: "Ghost", setup: "An Admin API key from a custom integration in Ghost admin, self-hosted or Ghost(Pro)." },
      { name: "Webflow", setup: "A Webflow site on a paid plan, a Site API token and a CMS collection for your blog." },
      { name: "Wix", setup: "The Wix Blog app, an API key with blog permissions and your Site ID. The article body arrives as one HTML block." },
      { name: "Custom webhook", setup: "An HTTPS endpoint you build that accepts the finished article as JSON, for platforms not listed here." },
    ],
    connectionsNote: "Other platforms are not connected directly.",
    connectionsLink: "Read the setup guides",
    planTitle: "The Launch plan",
    planIntro: launch
      ? `${launch.price} a month, billed in euros, after a 3-day free trial for new accounts. One subscription covers one website.`
      : "One subscription covers one website. The current price is shown on the pricing page and at checkout.",
    planPoints: [
      ...(launch
        ? [`${launch.articles} SEO articles a month`, `${launch.terms.toLocaleString("en")} search terms researched and grouped into topics`]
        : []),
      "Publishing to one connected website",
      `Articles in ${languageList()}`,
      "Also included: social posts, a site audit, the Growth Copilot and the other tools listed on the pricing page",
    ],
    limitsTitle: "What RepGet does not do",
    limits: [
      "Fix your website's technical SEO for you. The site audit lists the issues it finds and how to fix them.",
      "Add schema markup (structured data) to your articles.",
      "Publish to a platform without one of the connections above.",
      "Guarantee rankings, traffic or customers. Nobody can.",
    ],
    termsTitle: "Trial, payment and cancellation",
    terms: [
      "The 3-day free trial is for a new account that has never had a subscription. If you have had one, the plan starts, and is charged, when you subscribe.",
      "To start the trial you set up a payment method at checkout: a card, or a PayPal approval. Nothing is charged during the trial.",
      launch
        ? `During the trial you get the plan at its daily pace: up to ${launch.trialArticles} articles in the three days.`
        : "During the trial you get the plan at its daily pace.",
      launch
        ? `When the trial ends, ${launch.price} is charged, then every month until you cancel, unless you cancel before the trial ends. Checkout shows the amounts and dates before you confirm.`
        : "When the trial ends, the plan's price is charged, then every month until you cancel, unless you cancel before the trial ends. Checkout shows the amounts and dates before you confirm.",
      "You can cancel any time from the billing page in your account. You keep access until the end of the period you have paid for.",
      "Separate from the trial: if you are not happy, email us within 3 days of your first payment and we refund it in full.",
    ],
    termsLinks: { refunds: "Refund policy", terms: "Terms of service", pricing: "All plans and prices" },
    faqTitle: "Questions",
    faq: [
      {
        question: "Can I read articles before they are published?",
        answer:
          "From the second article on, yes, if you switch the website to draft or review mode. The first article is always published live as soon as it is written, and new websites start in automatic mode.",
      },
      {
        question: "Does RepGet fix my website's SEO?",
        answer:
          "It writes and publishes new articles. For your existing pages, the site audit reports problems such as missing titles or descriptions, and explains the fix; making the change is up to you or your developer.",
      },
      {
        question: "Do I need SEO experience?",
        answer: "No. You add your website and a few details about your business; research, planning, writing and publishing follow from there. You can change any of it.",
      },
      {
        question: "Can I use it for more than one website?",
        answer: "Each subscription covers one website. A second website needs its own subscription.",
      },
    ],
    closingTitle: "Put your blog on a schedule",
    closingBody: "Start with the Launch trial, or compare every plan first.",
  };
}
