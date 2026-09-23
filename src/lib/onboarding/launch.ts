import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/lib/db";
import {
  audits,
  brandVoice,
  calendarItems,
  geoPrompts,
  integrationKeys,
  integrations,
  networkSites,
  websites,
} from "@/lib/db/schema";
import { GOOGLE_KIND } from "@/lib/analytics/connection";

/**
 * The launch checklist — what a customer still has to do to be fully live.
 *
 * Distinct from lib/onboarding/steps.ts, which governs the SIGNUP WIZARD: add
 * a website, describe the business, pay. That ends the moment the plan is
 * bought. This begins there.
 *
 * The client asked for it directly:
 *
 *   "we can keep also the Get started but rename it with Set up, and here we
 *    will place the most important steps to running successfully the platform.
 *    Like Connect your site, Connect Google search console, Audit your
 *    website, Configure your article preferences, Activate backlink exchange,
 *    Generate prompts & start AI tracking, Linking Configuration."
 *
 * And, importantly: "On this step people can also already navigate the
 * dashboard, but it will still continue to appear thoose setup steps is
 * missing to complete the integration and activation." So this is a checklist
 * that lives ALONGSIDE the product rather than gating it — nothing here blocks
 * the dashboard, it only says what is not switched on yet.
 *
 * EVERY STEP IS DERIVED FROM REAL STATE, never stored as a "completed" flag.
 * A stored flag drifts the moment somebody disconnects an integration or
 * deletes their prompts, and then the checklist insists a thing is done that
 * plainly is not.
 */

export type LaunchStepId =
  | "site"
  | "search-console"
  | "profile"
  | "audit"
  | "articles"
  | "preferences"
  | "backlinks"
  | "prompts"
  | "launched";

/**
 * Which icon a row carries, as a NAME rather than a component.
 *
 * This module is imported by a server component and the value crosses to the
 * client; a lucide component is not serialisable, so the client maps these to
 * real icons. See components/setup-step-icon.tsx.
 */
export type LaunchStepIcon =
  | "site"
  | "google"
  | "profile"
  | "audit"
  | "article"
  | "link"
  | "settings"
  | "eye"
  | "rocket";

export type LaunchStep = {
  id: LaunchStepId;
  title: string;
  /** One line on why it matters, in the customer's terms. */
  description: string;
  done: boolean;
  /**
   * True when the step is worth doing but nothing breaks without it.
   *
   * Google Search Console is the case this exists for: real ranking data is
   * better than estimates, but a customer who never connects it still gets
   * articles, backlinks and AI visibility. Marking it required would leave a
   * permanent red mark against an account that is working perfectly.
   */
  optional: boolean;
  href: string;
  icon: LaunchStepIcon;
  /**
   * Extra body text, shown when the row is expanded.
   *
   * Only the final row has one: the design expands it to explain that
   * everything is now running by itself, with a button through to the
   * dashboard. The rest are one line each and have nothing to hide.
   */
  detail?: string;
};

export type LaunchState = {
  steps: LaunchStep[];
  /** How many are finished, for the "5/7 done" dial. */
  doneCount: number;
  /** Steps that must be done for the product to run at all. */
  requiredRemaining: number;
  /** True when nothing required is left. */
  live: boolean;
};

/** CMS integrations that count as "your site is connected". */
const CMS_KINDS = [
  "wordpress",
  "ghost",
  "shopify",
  "webflow",
  "wix",
  "webhook",
];

/**
 * Deduplicated per request: the sidebar badge and the setup page both read
 * this on the same render, and without the cache that is two full sets
 * of these queries for one page view.
 */
export const getLaunchState = cache(async function getLaunchState(
  websiteId: string,
): Promise<LaunchState> {
  const base = `/websites/${websiteId}`;

  /**
   * One round trip for every lookup. Each is an existence check —
   * `limit(1)`, not a count — because the question is only ever "is there
   * any?", and counting rows a customer may have thousands of is wasted work.
   */
  const [site, cms, plugin, gsc, audit, voice, network, prompts, planned] =
    await Promise.all([
      /*
        The profile columns analysis fills in. Read as a row rather than an
        existence check, because "has a profile" means specific fields are
        populated, not that a record exists — the website row always does.
      */
      db
        .select({
          description: websites.description,
          country: websites.country,
          language: websites.language,
        })
        .from(websites)
        .where(eq(websites.id, websiteId))
        .limit(1),
      db
        .select({ id: integrations.id })
        .from(integrations)
        .where(
          and(
            eq(integrations.websiteId, websiteId),
            inArray(integrations.kind, CMS_KINDS),
            // Connected, not merely created: a half-finished integration that
            // has never authenticated cannot publish anything.
            eq(integrations.status, "connected"),
          ),
        )
        .limit(1),
      /**
       * The plugin is the OTHER way a site gets connected, and it leaves no
       * row in `integrations` — it authenticates with an integration key,
       * which lives in its own table. Without this the checklist told a
       * customer publishing happily through the plugin that they had still
       * not connected their site, and kept a step they had finished sitting
       * open forever.
       *
       * lastUsedAt, not mere existence: a key that was created and never used
       * means the plugin is not installed yet, which is genuinely incomplete.
       * Revoked keys are excluded for the same reason — they cannot publish.
       */
      db
        .select({ id: integrationKeys.id })
        .from(integrationKeys)
        .where(
          and(
            eq(integrationKeys.websiteId, websiteId),
            isNotNull(integrationKeys.lastUsedAt),
            isNull(integrationKeys.revokedAt),
          ),
        )
        .limit(1),
      db
        .select({ id: integrations.id })
        .from(integrations)
        .where(
          and(
            eq(integrations.websiteId, websiteId),
            eq(integrations.kind, GOOGLE_KIND),
            eq(integrations.status, "connected"),
          ),
        )
        .limit(1),
      db
        .select({ id: audits.id })
        .from(audits)
        .where(eq(audits.websiteId, websiteId))
        .limit(1),
      db
        .select({ id: brandVoice.id })
        .from(brandVoice)
        .where(eq(brandVoice.websiteId, websiteId))
        .limit(1),
      db
        .select({ id: networkSites.id })
        .from(networkSites)
        .where(eq(networkSites.websiteId, websiteId))
        .limit(1),
      db
        .select({ id: geoPrompts.id })
        .from(geoPrompts)
        .where(eq(geoPrompts.websiteId, websiteId))
        .limit(1),
      db
        .select({ id: calendarItems.id })
        .from(calendarItems)
        .where(eq(calendarItems.websiteId, websiteId))
        .limit(1),
    ]);

  /**
   * A profile counts as ready when it has a description AND a language.
   *
   * Those two are what the article generator actually reads; market is
   * allowed to be null, because "global" is a legitimate answer and is stored
   * as null (see lib/websites/markets.ts). Requiring it would leave the row
   * permanently unticked for anyone selling worldwide.
   */
  const profileReady = Boolean(site[0]?.description && site[0]?.language);

  const steps: LaunchStep[] = [
    {
      id: "profile",
      /**
       * Moved out of signup at the client's request — "I think it is better to
       * make the steps that the user input the website profile be included in
       * the dashboard steps."
       *
       * ANALYSIS FILLS THIS IN AUTOMATICALLY, so it is usually already ticked
       * by the time anyone looks: the row exists to invite a check, not to
       * demand typing. It is first in the list because everything below it
       * depends on the answers being right — a wrong industry or market
       * propagates into every article we write.
       */
      title: "Check your business profile",
      description:
        "Your market, language, description and competitors. Every article is written from these, so it is worth a minute.",
      done: profileReady,
      optional: false,
      href: `${base}/profile`,
      icon: "profile",
    },
    {
      id: "site",
      title: "Connect your site",
      description:
        "So finished articles can publish themselves to your blog. Nothing goes live until you say so.",
      // Either route counts: a CMS connection, or a live plugin key.
      done: cms.length > 0 || plugin.length > 0,
      optional: false,
      /*
        /integrations, not /publishing. This step is about connecting a CMS,
        and /publishing is the article GENERATION settings — pressing "Connect
        your site" landed on a form about how articles are written, with
        nothing on it to connect.
      */
      href: `${base}/integrations`,
      icon: "site",
    },
    {
      id: "search-console",
      title: "Connect Google Search Console",
      description:
        "Your real rankings and clicks, measured rather than estimated. Optional, but the numbers are better with it.",
      done: gsc.length > 0,
      optional: true,
      href: `${base}/google`,
      icon: "google",
    },
    {
      id: "audit",
      title: "Audit your website",
      description:
        "We read every page and list what is holding it back on Google and with AI assistants.",
      done: audit.length > 0,
      optional: false,
      href: base,
      icon: "audit",
    },
    {
      id: "articles",
      /**
       * The client's list names this "Linking Configuration" and their
       * screenshot names it "Generate & launch your content plan". They are
       * the same row: the content plan IS the calendar that decides which
       * article links to which as it publishes.
       *
       * Named for what the customer does rather than for the mechanism, since
       * "linking configuration" describes a setting nobody adjusts by hand.
       */
      title: "Generate & launch your content plan",
      description:
        "Search terms, topic clusters and a publishing calendar, so each article links to the others as it goes out.",
      done: planned.length > 0,
      optional: false,
      href: `${base}/content`,
      icon: "article",
    },
    {
      id: "preferences",
      title: "Configure your article preferences",
      description:
        "Tone, words to avoid, and the standing rules every article should follow.",
      done: voice.length > 0,
      optional: false,
      /*
        /publishing — the Article Settings tab — not /profile.

        This pointed at /profile, which is the Business tab and belongs to the
        step ABOVE it. Analysis fills that one in automatically, so clicking
        "Configure your article preferences" landed the customer on a form
        that was already complete, with nothing on the page relating to tone
        or standing rules. Filling it in changed nothing, the step stayed
        open, and the checklist looked broken when it was only pointing at
        the wrong page. ArticleSettingsForm — the form that actually writes
        the brand_voice row this step reads — lives here.
      */
      href: `${base}/publishing`,
      icon: "settings",
    },
    {
      id: "backlinks",
      title: "Activate the backlink exchange",
      description:
        "Host one article for a related business and earn a credit for a link back to you.",
      done: network.length > 0,
      optional: false,
      href: `${base}/backlinks`,
      icon: "link",
    },
    {
      id: "prompts",
      title: "Generate prompts & start AI tracking",
      description:
        "The questions customers ask assistants, and whether you get named in the answer.",
      done: prompts.length > 0,
      optional: false,
      href: `${base}/ai-visibility`,
      icon: "eye",
    },
  ];

  /**
   * The final row: "Launched live".
   *
   * Not a task — there is nothing to click. It is the summary the design ends
   * on, ticked exactly when every required step above it is, so the list
   * finishes on a statement rather than trailing off after the last chore.
   *
   * Computed from the rows above rather than from its own query: a separate
   * source could disagree with them, and a checklist whose last line
   * contradicts the six above it is worse than no last line.
   */
  const requiredRemaining = steps.filter(
    (step) => !step.done && !step.optional,
  ).length;
  const live = requiredRemaining === 0;

  steps.push({
    id: "launched",
    title: "Launched live",
    description: live
      ? "Everything is running. Nothing more to set up."
      : "Finish the steps above and everything starts running by itself.",
    detail:
      "Auto-publishing, AI visibility tracking and the Backlink Exchange are running for your site. Nothing more to set up — watch the results on your dashboard.",
    done: live,
    optional: false,
    href: "/dashboard",
    icon: "rocket",
  });

  return {
    steps,
    // Counted after the final row is pushed, so the dial matches the list.
    doneCount: steps.filter((step) => step.done).length,
    requiredRemaining,
    live,
  };
});
