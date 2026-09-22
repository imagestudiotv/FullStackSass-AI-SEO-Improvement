import { and, eq, isNull, lte, sql as raw } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { networkSites, subscriptions, websites } from "@/lib/db/schema";

/**
 * Switches the backlink exchange on three days after a website subscribes.
 *
 * The client asked for it: "We will automatically toogle this on from the
 * third day to start getting backlinks for our site."
 *
 * WHY A DELAY AND NOT AT CHECKOUT: the exchange is reciprocal. Joining means
 * agreeing to host other members' links, and a site with no published
 * articles has nowhere to put them — so a brand-new member would take links
 * and give none, which is the behaviour that makes an exchange worthless to
 * everyone already in it. Three days is roughly when the first articles have
 * landed, so a site joins with something to offer.
 *
 * NEVER OVERRIDES A CHOICE. It inserts only where no network_sites row
 * exists. Someone who joined on day one already has one; someone who left has
 * one with acceptingLinks false, and leaveNetwork keeps that row precisely so
 * it cannot be silently undone. A customer who opted out must stay out.
 */
export const activateExchange = inngest.createFunction(
  {
    id: "activate-exchange",
    /*
      Daily, an hour after the article scheduler. Nothing here is urgent to
      the minute — "the third day" is a business rule, not a deadline — and
      running after articles means a site that published overnight is already
      worth linking to when it joins.
    */
    triggers: [{ cron: "0 7 * * *" }],
  },
  async ({ step, logger }) => {
    const activated = await step.run("activate-due-websites", async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      /**
       * Websites whose subscription started at least three days ago and that
       * have never had a network_sites row.
       *
       * Keyed on the SUBSCRIPTION's start, not the website's creation date: a
       * site added weeks before anyone paid for it has not been a member of
       * anything, and dating the countdown from creation would enrol it the
       * instant it was paid for.
       */
      const due = await db
        .select({
          websiteId: websites.id,
          industry: websites.industry,
          language: websites.language,
          country: websites.country,
        })
        .from(websites)
        .innerJoin(subscriptions, eq(subscriptions.websiteId, websites.id))
        .leftJoin(networkSites, eq(networkSites.websiteId, websites.id))
        .where(
          and(
            isNull(networkSites.id),
            lte(subscriptions.createdAt, threeDaysAgo),
            raw`${subscriptions.status} in ('active', 'trialing')`,
          ),
        )
        .limit(200);

      if (due.length === 0) {
        logger.info({ step: "activate-due-websites", activated: 0 }, "Nothing due");
        return 0;
      }

      /*
        monthlyCap 3 matches the manual join's default. Starting higher would
        hand a new member more inbound links than they have pages to carry.
      */
      await db
        .insert(networkSites)
        .values(
          due.map((site) => ({
            websiteId: site.websiteId,
            acceptingLinks: true,
            niche: site.industry,
            language: site.language,
            country: site.country,
            monthlyCap: 3,
          })),
        )
        /*
          A row created between the select and this insert wins. The customer
          joining by hand in that window chose their own settings, and this
          job has no business replacing them.
        */
        .onConflictDoNothing({ target: networkSites.websiteId });

      logger.info(
        {
          step: "activate-due-websites",
          activated: due.length,
          websiteIds: due.slice(0, 8).map((s) => s.websiteId),
        },
        "Backlink exchange activated on day three",
      );
      return due.length;
    });

    return { activated };
  },
);
