import { and, eq, isNull, lte, or, sql as raw } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { queueArticleForCalendarItem } from "@/inngest/functions/generate-article";
import { db } from "@/lib/db";
import { articles, calendarItems, websites } from "@/lib/db/schema";
import { notify } from "@/lib/notifications/create";
import {
  automaticStatus,
  batchStillAhead,
  FIRST_ARTICLE_STATUS,
  pendingFirstArticle,
  websitesAwaitingFirstArticle,
} from "@/lib/publishing/policy";
import { checkLimit } from "@/lib/usage";
import { UNLIMITED } from "@/lib/usage-shared";

/**
 * Writes the articles that are due, for websites set to generate
 * automatically.
 *
 * Until this existed the product was only half an autopilot: an article could
 * publish itself once written, but somebody still had to press a button to
 * write it. A customer on a thirty-article plan had thirty clicks a month to
 * remember.
 *
 * Queues through queueArticleForCalendarItem — the same function the button
 * calls. Scheduled and manual generation therefore cannot drift apart: a fix
 * to one is a fix to both, and there is no second code path that quietly
 * skips a check.
 *
 * Daily rather than hourly. The calendar schedules by date, not time, so
 * running more often would find the same items and do nothing.
 */

/** How many websites one run will look at. */
const WEBSITE_BATCH = 200;
/**
 * How many days after today a calendar item may be written.
 *
 * Articles are written before their date, not on it, so a customer always has
 * finished work waiting rather than an empty page while a job runs. The
 * window is today plus the next TWO days - the client's "next-2-day
 * articles". Everything beyond stays planned and can still be reordered,
 * retitled or dropped.
 *
 * It was 3, which with the end-of-day rounding below reached FOUR calendar
 * days (today to today+3), one more than the product promised.
 */
const LOOKAHEAD_DAYS = 2;

/**
 * Days of articles written per batch: the next two days' worth.
 *
 * With publishing automatic, a website gets one batch at a time - the next
 * batch is written only once the previous one has been published (see
 * batchStillAhead). The client's rule: "the other next-2-day articles have to
 * be generated as drafts and published on their scheduled days, and then
 * another next-2-day batch generated after the previous ones are published".
 */
const BATCH_DAYS = 2;

/**
 * Drafts one release pass will publish per website: enough for a calendar
 * that was paused for a while, without emptying a month in a morning.
 */
const MAX_RELEASE_PER_WEBSITE = 3;

/** 0 = Sunday, matching Date.getUTCDay(). */
function isPublishingDay(days: unknown, today: number): boolean {
  // Null or malformed means every day: a website with no preference set
  // should generate, not silently stop.
  if (!Array.isArray(days) || days.length === 0) return true;
  return days.includes(today);
}

/**
 * Publishes the drafts whose calendar date has now arrived.
 *
 * The other half of writing ahead. generate-article holds an article back
 * when it is finished before its date, so without this it would sit as a
 * draft forever — the customer would have swapped publishing too early for
 * never publishing at all.
 *
 * Only articles that are still drafts, attached to a calendar item whose date
 * has passed, on a site with auto-publish on and a CMS connected: the same
 * conditions generate-article checks, so nothing can reach a customer's site
 * through this path that would not have reached it through the other one.
 */
async function publishDueDrafts(): Promise<number> {
  let released = 0;

  /*
    First articles still waiting. Normally the first article goes out the
    moment it is written; this catches one written before the website was
    connected, and one whose publish failed. See lib/publishing/policy.ts.
  */
  for (const site of await websitesAwaitingFirstArticle()) {
    const first = await pendingFirstArticle(site.websiteId);
    if (!first) continue;
    await inngest.send({
      name: "article/publish.requested",
      data: {
        articleId: first.id,
        websiteId: site.websiteId,
        organizationId: site.organizationId,
        status: FIRST_ARTICLE_STATUS,
      },
    });
    released += 1;
  }

  const rows = await db
    .select({
      id: articles.id,
      websiteId: articles.websiteId,
      organizationId: websites.organizationId,
      autoPublish: websites.autoPublish,
      publishAs: websites.publishAs,
    })
    .from(articles)
    .innerJoin(calendarItems, eq(calendarItems.id, articles.calendarItemId))
    .innerJoin(websites, eq(websites.id, articles.websiteId))
    .where(
      and(
        eq(articles.status, "draft"),
        eq(websites.autoPublish, true),
        lte(calendarItems.scheduledFor, new Date()),
        raw`exists (
          select 1 from integrations i
          where i.website_id = ${articles.websiteId}
            and i.status = 'connected'
        )`,
      ),
    )
    .limit(MAX_RELEASE_PER_WEBSITE * WEBSITE_BATCH);

  for (const row of rows) {
    await inngest.send({
      name: "article/publish.requested",
      data: {
        articleId: row.id,
        websiteId: row.websiteId,
        organizationId: row.organizationId,
        // Live or a CMS draft, as the customer chose. This always published
        // live before, whatever "Publish as" said.
        status: automaticStatus(row),
      },
    });
  }

  return released + rows.length;
}

export const scheduledArticles = inngest.createFunction(
  {
    id: "scheduled-articles",
    retries: 1,
    triggers: [
      { event: "articles/scheduled.requested" },
      // 6am UTC: before the working day in Europe, so an article is waiting
      // rather than appearing while someone is looking at the page.
      { cron: "0 6 * * *" },
      /*
        A second pass in the early afternoon.

        The first run of a brand-new website queues ONE article deliberately
        (see firstRun below), so without this the customer's second and third
        would not arrive until 6am the next day. The client asked for them
        "in next hours", not the next morning.

        14:00 UTC rather than something closer: the first article has to
        finish generating and be read before more are useful, and a run every
        hour would re-scan every website on the platform for no gain - the
        calendar schedules by DATE, so a second pass finds the same items.
      */
      { cron: "0 14 * * *" },
    ],
  },
  async ({ step, logger }) => {
    const today = new Date().getUTCDay();

    /**
     * End of the look-ahead window: today plus the next two days.
     *
     * Used by BOTH queries below. The outer one decides which websites are
     * worth looking at, so if it asked for items due now while the inner one
     * accepted anything inside the window, a site whose next article was due
     * tomorrow would never be selected — and the look-ahead would only ever
     * apply to sites that were already overdue.
     */
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + LOOKAHEAD_DAYS);
    horizon.setHours(23, 59, 59, 999);

    /**
     * Structured logs, one per step, so the Inngest timeline explains itself.
     *
     * Nobody watches this run — it happens at 6am and its only visible output
     * is articles appearing, or not. When they do not, the question is always
     * which filter removed the site: the wrong weekday, an exhausted plan, or
     * simply nothing due. These lines record each of those separately.
     *
     * There is no single entity id here: the run spans every website, so each
     * line inside the loop carries its own `websiteId`.
     */
    logger.info(
      {
        step: "start",
        today,
        horizon: horizon.toISOString(),
        lookaheadDays: LOOKAHEAD_DAYS,
        websiteBatch: WEBSITE_BATCH,
      },
      "Scheduled article run started",
    );

    const due = await step.run("select-websites", async () => {
      /**
       * One query for websites that have something to do, rather than reading
       * every website and filtering in code. The join means a site with an
       * empty calendar never reaches the loop below.
       */
      const rows = await db
        .selectDistinct({
          websiteId: websites.id,
          organizationId: websites.organizationId,
          domain: websites.domain,
          publishingDays: websites.publishingDays,
          autoPublish: websites.autoPublish,
        })
        .from(websites)
        .innerJoin(
          calendarItems,
          eq(calendarItems.websiteId, websites.id),
        )
        .where(
          and(
            eq(websites.generationMode, "automatic"),
            // A site still being analysed has no usable brand profile yet.
            eq(websites.status, "ready"),
            eq(calendarItems.status, "planned"),
            /**
             * Due inside the look-ahead window, or undated. An item with no
             * date is one the customer added by hand; leaving those unwritten
             * forever would be a silent failure.
             */
            or(
              isNull(calendarItems.scheduledFor),
              lte(calendarItems.scheduledFor, horizon),
            ),
          ),
        )
        .limit(WEBSITE_BATCH);

      logger.info(
        {
          step: "select-websites",
          websiteCount: rows.length,
          cappedAtBatch: rows.length === WEBSITE_BATCH,
          horizon: horizon.toISOString(),
        },
        "Websites with due calendar items selected",
      );
      return rows;
    });

    if (due.length === 0) {
      /*
        A legitimate quiet day, but also what a broken selection query looks
        like. Saying it explicitly is the difference between "nothing was due"
        and a silent run nobody can interpret months later.
      */
      logger.warn(
        { step: "select-websites", websiteCount: 0, today },
        "No websites have calendar items due - nothing queued this run",
      );

      /*
        Still release anything already written and now due. Nothing NEW being
        due says nothing about drafts written on an earlier run, and returning
        here without this is how a held article would wait for a day on which
        the calendar happened to have something new to write.
      */
      const releasedOnly = await step.run("publish-due-drafts", publishDueDrafts);
      logger.info(
        { step: "publish-due-drafts", released: releasedOnly },
        "Held drafts released for publishing",
      );
      return { websites: 0, queued: 0, released: releasedOnly };
    }

    let queued = 0;
    const limitReached: string[] = [];

    for (const site of due) {
      if (!isPublishingDay(site.publishingDays, today)) {
        /*
          Skipped by the customer's own weekday preference, not a fault. It is
          logged because "my articles stopped on Tuesdays" is otherwise
          indistinguishable from the job failing to see the site at all.
        */
        logger.info(
          { step: "select-websites", websiteId: site.websiteId, today },
          "Not a publishing day for this website - skipped",
        );
        continue;
      }

      const result = await step.run(`queue-${site.websiteId}`, async () => {
        /**
         * The plan limit is checked here as well as inside the queue
         * function. Checking first means a customer who is out of articles
         * gets one notification rather than one failed queue attempt per
         * calendar item.
         */
        const limit = await checkLimit(site.websiteId, "articles");
        if (!limit.allowed) {
          /*
            Nothing is queued and the run still succeeds. `reason` separates a
            used-up monthly allowance from a workspace with no plan at all —
            one resolves itself at renewal, the other never will.
          */
          logger.warn(
            {
              step: `queue-${site.websiteId}`,
              websiteId: site.websiteId,
              organizationId: site.organizationId,
              reason: limit.reason,
              planUsed: limit.used,
              planLimit: limit.limit === UNLIMITED ? "unlimited" : limit.limit,
            },
            "Plan does not allow more articles - nothing queued for this website",
          );
          return { queued: 0, limited: limit.reason === "limit_reached" };
        }

        const remaining =
          limit.limit === UNLIMITED
            ? BATCH_DAYS
            : Math.max(limit.limit - limit.used, 0);

        /**
         * Articles per day this plan pays for, derived the same way the
         * calendar spaces them: a monthly allowance over a 30-day month. A
         * customer on three a day needs three times as many in flight to
         * stay the same number of days ahead.
         */
        const perDay =
          limit.limit === UNLIMITED
            ? 1
            : Math.max(1, Math.ceil(limit.limit / 30));

        /**
         * ONE article on a website's very first run, whatever the plan size.
         *
         * The client was explicit about the first one: "Just one... but we
         * want it like instant, in this way people can start using instantly
         * this feature. And in next hours it generates 2 more days ahead."
         *
         * Without this a Scale customer's first run queues nine at once -
         * three a day across the three-day window - so the first thing they
         * see is nine articles appearing together, minutes after paying, on
         * a site they have not reviewed a single word of. One arrives, they
         * read it, and the normal cadence takes over from the next run.
         *
         * `limit.used === 0` is the signal, and it is exactly right: articles
         * are counted per billing period, so it means this website has not
         * produced anything this period. A returning customer whose period
         * just rolled over gets the same gentle restart, which is no bad
         * thing; an established site mid-month never hits it.
         */
        const firstRun = limit.used === 0;

        /*
          One batch at a time when publishing is automatic: nothing new is
          written while any article from the previous batch is still waiting
          for its date. Due articles do not count - this same run releases
          them - so the next batch starts on the day the last one goes out.

          Not applied when the customer reviews articles themselves: those are
          never published automatically, so the batch would never finish and
          writing would stop for good. They get the plain two-day window.
        */
        if (site.autoPublish && !firstRun) {
          const ahead = await batchStillAhead(site.websiteId);
          if (ahead > 0) {
            logger.info(
              {
                step: `queue-${site.websiteId}`,
                websiteId: site.websiteId,
                waitingToPublish: ahead,
              },
              "Previous batch not published yet - next batch waits",
            );
            return { queued: 0, limited: false };
          }
        }
        const take = firstRun
          ? Math.min(1, remaining)
          : Math.min(BATCH_DAYS * perDay, remaining);
        if (take === 0) {
          // Allowed by the plan check above but with no headroom left, which
          // is the same outcome for the customer and needs the same record.
          logger.warn(
            {
              step: `queue-${site.websiteId}`,
              websiteId: site.websiteId,
              organizationId: site.organizationId,
              remaining: 0,
              planUsed: limit.used,
              planLimit: limit.limit === UNLIMITED ? "unlimited" : limit.limit,
            },
            "No article allowance remaining - nothing queued for this website",
          );
          return { queued: 0, limited: true };
        }

        if (firstRun) {
          logger.info(
            {
              step: `queue-${site.websiteId}`,
              websiteId: site.websiteId,
              organizationId: site.organizationId,
              take,
            },
            "First run for this website - queueing one article only",
          );
        }

        const items = await db
          .select({ id: calendarItems.id })
          .from(calendarItems)
          .where(
            and(
              eq(calendarItems.websiteId, site.websiteId),
              eq(calendarItems.status, "planned"),
              /**
               * Inside the look-ahead window, not merely overdue. Picking
               * only `<= now` meant nothing was ever written in advance, so
               * an article was generating on the morning it was due and the
               * customer had nothing ready to read.
               */
              or(
                isNull(calendarItems.scheduledFor),
                lte(calendarItems.scheduledFor, horizon),
              ),
            ),
          )
          // Oldest first: a topic scheduled for last week is more overdue
          // than one scheduled for today.
          .orderBy(raw`${calendarItems.scheduledFor} asc nulls last`)
          .limit(take);

        let count = 0;
        const rejected: string[] = [];
        for (const item of items) {
          const outcome = await queueArticleForCalendarItem(
            site.organizationId,
            site.websiteId,
            item.id,
          );
          if (outcome.ok) {
            count += 1;
          } else {
            /*
              A rejected item is dropped on the floor: the loop continues, the
              run succeeds, and the calendar item stays "planned" forever with
              nothing recording why it was passed over on each daily run.
            */
            rejected.push(outcome.error);
          }
        }

        if (rejected.length > 0) {
          logger.warn(
            {
              step: `queue-${site.websiteId}`,
              websiteId: site.websiteId,
              organizationId: site.organizationId,
              rejectedCount: rejected.length,
              reasons: rejected.slice(0, 8),
            },
            "Some calendar items could not be queued",
          );
        }

        logger.info(
          {
            step: `queue-${site.websiteId}`,
            websiteId: site.websiteId,
            organizationId: site.organizationId,
            itemsFound: items.length,
            take,
            queued: count,
            rejected: rejected.length,
          },
          "Calendar items queued for generation",
        );

        return { queued: count, limited: false };
      });

      queued += result.queued;
      if (result.limited) limitReached.push(site.organizationId);
    }

    /**
     * Tell people who ran out, once.
     *
     * Silence would look like the product had stopped working: articles were
     * appearing every day and then they were not, with nothing to explain it.
     */
    await step.run("notify-limits", async () => {
      const organizations = new Set(limitReached);
      for (const organizationId of organizations) {
        await notify({
          organizationId,
          type: "articles.limit_reached",
          title: "You have used this month's articles",
          body: "Scheduled writing continues when your plan renews. Upgrade to keep going now.",
          href: "/billing",
        });
      }

      logger.info(
        { step: "notify-limits", organizationsNotified: organizations.size },
        "Limit-reached notifications sent",
      );
    });

    /**
     * Publish the drafts whose day has now arrived.
     *
     * The other half of writing ahead. generate-article holds an article back
     * when it is finished before its calendar date, so without this step it
     * would sit as a draft forever — the customer would have swapped
     * publishing too early for never publishing at all.
     *
     * Runs on the same daily cron, so an article dated the 24th is written on
     * the 21st and published by the first run on the 24th.
     *
     * Only articles that are still drafts, still attached to a calendar item
     * whose date has passed, on a site with auto-publish on and a CMS
     * connected — the same conditions generate-article checks, so an article
     * cannot reach the customer's site through this path that would not have
     * reached it through the other one.
     */
    /**
     * Publish the drafts whose day has now arrived. See publishDueDrafts.
     *
     * Runs on the same daily cron, so an article dated the 24th is written on
     * the 21st and published by the first run on the 24th.
     */
    const released = await step.run("publish-due-drafts", publishDueDrafts);
    logger.info(
      { step: "publish-due-drafts", released },
      "Held drafts released for publishing",
    );

    /**
     * The one line that answers "why did no articles appear today".
     *
     * `queued: 0` against a non-zero `websites` means every site was filtered
     * out below, and the per-website lines above say by what — the weekday
     * check, the plan limit, or an empty window.
     */
    logger.info(
      {
        step: "done",
        websites: due.length,
        queued,
        released,
        limitReachedOrganizations: new Set(limitReached).size,
      },
      "Scheduled article run complete",
    );

    return { websites: due.length, queued, released };
  },
);
