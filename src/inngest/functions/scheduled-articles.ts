import { and, eq, isNull, lte, or, sql as raw } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { queueArticleForCalendarItem } from "@/inngest/functions/generate-article";
import { db } from "@/lib/db";
import { calendarItems, websites } from "@/lib/db/schema";
import { notify } from "@/lib/notifications/create";
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
 * How many days ahead of today a calendar item may be written.
 *
 * Articles are written before their date, not on it, so a customer always has
 * finished work waiting rather than an empty page while a job runs. Three
 * days is the window the product promises: today plus the next two are
 * "generating", everything beyond that stays queued and can still be
 * reordered, retitled or dropped.
 *
 * Writing further ahead would take that away — an article already written is
 * an article the customer can no longer change their mind about.
 */
const LOOKAHEAD_DAYS = 3;

/**
 * Articles queued per website per run.
 *
 * A cap rather than "everything due", because a calendar that was paused for
 * a fortnight comes back with fourteen items due at once. Publishing two
 * weeks of articles in one morning is not what the customer asked for, and it
 * would empty their monthly allowance in a single day.
 *
 * Scaled by the plan's daily cadence below: a customer on three a day needs
 * nine in flight to keep three days ahead, where one a day needs three.
 */
const MAX_PER_WEBSITE = 3;

/** 0 = Sunday, matching Date.getUTCDay(). */
function isPublishingDay(days: unknown, today: number): boolean {
  // Null or malformed means every day: a website with no preference set
  // should generate, not silently stop.
  if (!Array.isArray(days) || days.length === 0) return true;
  return days.includes(today);
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
        "No websites have calendar items due — nothing queued this run",
      );
      return { websites: 0, queued: 0 };
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
          "Not a publishing day for this website — skipped",
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
            "Plan does not allow more articles — nothing queued for this website",
          );
          return { queued: 0, limited: limit.reason === "limit_reached" };
        }

        const remaining =
          limit.limit === UNLIMITED
            ? MAX_PER_WEBSITE
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
        const take = Math.min(MAX_PER_WEBSITE * perDay, remaining);
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
            "No article allowance remaining — nothing queued for this website",
          );
          return { queued: 0, limited: true };
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
        limitReachedOrganizations: new Set(limitReached).size,
      },
      "Scheduled article run complete",
    );

    return { websites: due.length, queued };
  },
);
