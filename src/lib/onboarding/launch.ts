import { and, eq, inArray } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/lib/db";
import {
  audits,
  brandVoice,
  calendarItems,
  geoPrompts,
  integrations,
  networkSites,
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
  | "audit"
  | "articles"
  | "backlinks"
  | "prompts"
  | "linking";

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
 * this on the same render, and without the cache that is two sets of six
 * queries for one page view.
 */
export const getLaunchState = cache(async function getLaunchState(
  websiteId: string,
): Promise<LaunchState> {
  const base = `/websites/${websiteId}`;

  /**
   * One round trip for all six lookups. Each is an existence check —
   * `limit(1)`, not a count — because the question is only ever "is there
   * any?", and counting rows a customer may have thousands of is wasted work.
   */
  const [cms, gsc, audit, voice, network, prompts, planned] = await Promise.all(
    [
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
    ],
  );

  const steps: LaunchStep[] = [
    {
      id: "site",
      title: "Connect your site",
      description:
        "So finished articles can publish themselves to your blog. Nothing goes live until you say so.",
      done: cms.length > 0,
      optional: false,
      href: `${base}/publishing`,
    },
    {
      id: "search-console",
      title: "Connect Google Search Console",
      description:
        "Your real rankings and clicks, measured rather than estimated. Optional, but the numbers are better with it.",
      done: gsc.length > 0,
      optional: true,
      href: `${base}/google`,
    },
    {
      id: "audit",
      title: "Audit your website",
      description:
        "We read every page and list what is holding it back on Google and with AI assistants.",
      done: audit.length > 0,
      optional: false,
      href: base,
    },
    {
      id: "articles",
      title: "Configure your article preferences",
      description:
        "Tone, words to avoid, and the standing rules every article should follow.",
      done: voice.length > 0,
      optional: false,
      href: `${base}/profile`,
    },
    {
      id: "backlinks",
      title: "Activate the backlink exchange",
      description:
        "Host one article for a related business and earn a credit for a link back to you.",
      done: network.length > 0,
      optional: false,
      href: `${base}/backlinks`,
    },
    {
      id: "prompts",
      title: "Generate prompts & start AI tracking",
      description:
        "The questions customers ask assistants, and whether you get named in the answer.",
      done: prompts.length > 0,
      optional: false,
      href: `${base}/ai-visibility`,
    },
    {
      id: "linking",
      title: "Linking configuration",
      description:
        "A publishing calendar, so each article links to the others as it goes out.",
      done: planned.length > 0,
      optional: false,
      href: `${base}/content`,
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  const requiredRemaining = steps.filter(
    (step) => !step.done && !step.optional,
  ).length;

  return {
    steps,
    doneCount,
    requiredRemaining,
    live: requiredRemaining === 0,
  };
});
