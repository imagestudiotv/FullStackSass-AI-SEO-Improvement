import { and, eq, gte, inArray, isNotNull, isNull, lt, lte, or, sql as raw } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { PACE_REACHED, queueArticleForCalendarItem, retryFailedArticle } from "@/inngest/functions/generate-article";
import { db } from "@/lib/db";
import { agencyWorkspaces, articles, calendarItems, integrationKeys, notifications, subscriptions, websites } from "@/lib/db/schema";
import { DAY_MS } from "@/lib/keywords/cadence";
import { notify } from "@/lib/notifications/create";
import { nudgePluginIfDue } from "@/lib/plugin/sync";
import { PUBLISHING_KINDS } from "@/lib/publishing/kinds";
import {
  automaticStatus,
  FIRST_ARTICLE_STATUS,
  pendingFirstArticle,
  websitesAwaitingFirstArticle,
} from "@/lib/publishing/policy";
import { nextStartDay, startsLeft } from "@/lib/articles/pace";
import { lastDeliveryRefusedSql, releasableSql } from "@/lib/articles/review";
import { onFreePlan } from "@/lib/plans/free-plan-server";
import { isControlEnabled } from "@/lib/publishing/controls";
import { moveMissedTopicsForward, spaceTopics } from "@/lib/publishing/missed-days";
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
 * How many days after today a calendar item may be written: today plus the
 * next two, the client's "next-2-day articles". Everything beyond stays
 * planned and can still be reordered, retitled or dropped.
 *
 * Only WHICH topics may be taken, never how many. Batches of two days' worth
 * were written per run until 2026-11-24, which put three articles on one day
 * for a Free website; how many is now the plan's pace for the day
 * (lib/articles/pace.ts), whatever the number of runs, backlog or retries.
 */
const LOOKAHEAD_DAYS = 2;

/** How long an article whose writing failed is tried again by itself. */
const RETRY_FAILED_FOR_DAYS = 7;

/** Between two automatic tries, so runs woken by other websites' events do not use them up in minutes. */
const RETRY_GAP_MS = 2 * 60 * 60 * 1000;

/** A workspace hears that its articles are used up at most this often. */
const LIMIT_NOTICE_EVERY_DAYS = 14;

/** An article still "queued" or "generating" after this long has no job behind it any more. */
const DEAD_JOB_MS = 6 * 60 * 60 * 1000;

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
export async function publishDueDrafts(): Promise<number> {
  let released = 0;

  /*
    Publishing is frozen by an operator: queue nothing. (Each job would be
    held at its dispatch claim anyway - this avoids filling the queue with
    work that cannot run. See lib/publishing/controls.ts.)
  */
  if (await isControlEnabled("publication_freeze")) return 0;

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
        trigger: "first_article",
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
        // Held for, or changed since, the RepGet team's review: not released.
        releasableSql,
        // Refused because the post on the website changed: stopped and explained, not tried again tomorrow.
        raw`not ${lastDeliveryRefusedSql}`,
        raw`exists (
          select 1 from integrations i
          where i.website_id = ${articles.websiteId}
            and i.status = 'connected'
            -- A CMS, not the Google connection. See publishing/kinds.ts.
            and i.kind in ${raw.raw(`(${PUBLISHING_KINDS.map((k) => `'${k}'`).join(", ")})`)}
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
        trigger: "automatic",
      },
    });
  }

  /*
    WordPress plugin sites. They pull, and their own hourly check only runs
    when someone visits the site, so each release pass asks every connected
    plugin that has something due to collect it now. Nothing due, nothing
    sent. See nudgePluginIfDue.
  */
  const plugins = await db
    .selectDistinct({ websiteId: integrationKeys.websiteId })
    .from(integrationKeys)
    .where(
      and(
        isNull(integrationKeys.revokedAt),
        isNotNull(integrationKeys.lastUsedAt),
        isNotNull(integrationKeys.syncUrl),
      ),
    )
    .limit(WEBSITE_BATCH);
  let nudged = 0;
  for (const plugin of plugins) {
    const outcome = await nudgePluginIfDue(plugin.websiteId).catch(() => "unreachable" as const);
    if (outcome === "synced") nudged += 1;
  }

  return released + rows.length + nudged;
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
        A second pass in the early afternoon: the second article of the day
        for a plan whose pace is above one a day (a new website's first run
        starts ONE, see firstRun below), a second try of an article that
        failed at 06:00, and drafts whose time has come. It starts nothing a
        website's pace for the day has no room for.
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
     * tomorrow would never be selected.
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
       * every website and filtering in code: a site with an empty calendar
       * never reaches the loop below.
       */
      const rows = await db
        .select({
          websiteId: websites.id,
          organizationId: websites.organizationId,
          publishingDays: websites.publishingDays,
          // The first article is written at once, whatever weekdays were chosen for the rest.
          // (Written out, not ${websites.id}: drizzle drops the table's name in a one-table select.)
          hasArticle: raw<boolean>`exists (select 1 from articles wa where wa.website_id = websites.id and wa.body_html is not null)`,
          // A topic due now: a Free website is also looked at for its spacing alone.
          due: raw<boolean>`exists (
            select 1 from calendar_items di
            where di.website_id = websites.id
              and di.status = 'planned'
              and (di.scheduled_for is null or di.scheduled_for <= ${horizon.toISOString()}::timestamp)
          )`,
        })
        .from(websites)
        .where(
          and(
            eq(websites.generationMode, "automatic"),
            // A site still being analysed has no usable brand profile yet.
            eq(websites.status, "ready"),
            /**
             * Only websites that may write at all. Ended and never-started
             * plans keep their old topics, which are overdue for ever: they
             * filled the batch and could crowd out a paying or new website.
             */
            or(
              raw`exists (
                select 1 from ${subscriptions} s
                where s.website_id = ${websites.id} and s.status in ('active', 'trialing', 'past_due')
              )`,
              raw`exists (select 1 from ${agencyWorkspaces} aw where aw.organization_id = ${websites.organizationId})`,
              onFreePlan(websites.id),
            ),
            /**
             * Due inside the look-ahead window, or undated. An item with no
             * date is one the customer added by hand; leaving those unwritten
             * forever would be a silent failure. A Free website's topics are
             * also checked for their weekly spacing, whatever their date.
             */
            raw`exists (
              select 1 from ${calendarItems} ci
              where ci.website_id = ${websites.id}
                and ci.status = 'planned'
                and (ci.scheduled_for is null or ci.scheduled_for <= ${horizon.toISOString()}::timestamp or ${onFreePlan(websites.id)})
            )`,
          ),
        )
        // Nothing started yet first, then whoever has waited longest: a full batch never leaves the same websites out.
        .orderBy(raw`(select max(la.created_at) from articles la where la.website_id = ${websites.id}) asc nulls first`)
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
      if (site.hasArticle && !isPublishingDay(site.publishingDays, today)) {
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
        const now = new Date();
        const room = await startsLeft(site.websiteId, now);

        /*
          Days missed while writing was stopped (a pause, a used-up plan) are
          skipped, not caught up: the topics move forward so the calendar
          restarts from today (lib/publishing/missed-days.ts). A Free
          website's topics are laid out a week apart instead, from the next
          day its pace allows.
        */
        if (room.pace && room.pace.days > 1) {
          const spaced = await spaceTopics(site.websiteId, room.pace.days, await nextStartDay(site.websiteId, room.pace, now), now, {
            startNow: !site.hasArticle && room.left > 0,
          });
          if (spaced.moved > 0) {
            logger.info({ step: `queue-${site.websiteId}`, websiteId: site.websiteId, topicsMoved: spaced.moved }, "Planned topics spaced to the plan's pace");
          }
        } else {
          const missed = await moveMissedTopicsForward(site.websiteId, now);
          if (missed.moved > 0) {
            logger.info(
              { step: `queue-${site.websiteId}`, websiteId: site.websiteId, daysSkipped: missed.days, topicsMoved: missed.moved },
              "Missed days skipped - planned topics moved forward to restart from today",
            );
          }
        }

        /*
          Articles whose writing failed come first: their allowance is spent,
          so the customer is owed them. One that failed today may be tried
          again today; an older one takes the day's place. Bounded
          (AUTO_RETRIES); past that the topic waits for a person, and no longer
          keeps the topics after it from being written.
        */
        const failed = await db
          .select({ id: articles.id })
          .from(articles)
          .innerJoin(calendarItems, eq(calendarItems.id, articles.calendarItemId))
          .where(
            and(
              eq(articles.websiteId, site.websiteId),
              eq(calendarItems.status, "planned"),
              isNull(articles.bodyHtml),
              gte(articles.createdAt, new Date(now.getTime() - RETRY_FAILED_FOR_DAYS * DAY_MS)),
              or(
                and(eq(articles.status, "failed"), lt(articles.updatedAt, new Date(now.getTime() - RETRY_GAP_MS))),
                and(inArray(articles.status, ["queued", "generating"]), lt(articles.updatedAt, new Date(now.getTime() - DEAD_JOB_MS))),
              ),
            ),
          )
          .orderBy(articles.createdAt)
          .limit(Math.max(room.pace?.articles ?? 0, 1));
        let retried = 0;
        for (const article of failed) {
          const outcome = await retryFailedArticle(site.websiteId, article.id, now);
          if (outcome.ok) retried += 1;
          logger.info(
            { step: `queue-${site.websiteId}`, websiteId: site.websiteId, articleId: article.id, retried: outcome.ok, reason: outcome.ok ? null : outcome.error },
            "Article whose writing failed - automatic retry",
          );
        }

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
          return { queued: retried, limited: limit.reason === "limit_reached" && site.due && room.left > 0 };
        }

        const remaining =
          limit.limit === UNLIMITED
            ? Number.MAX_SAFE_INTEGER
            : Math.max(limit.limit - limit.used, 0);

        /**
         * ONE article on a website's very first run, whatever the plan size.
         *
         * The client was explicit about the first one: "Just one... but we
         * want it like instant, in this way people can start using instantly
         * this feature." A larger plan's second article of the day comes with
         * the next run.
         *
         * `limit.used === 0` is the signal: articles are counted per billing
         * period, so it means this website has not produced anything this
         * period.
         */
        const firstRun = limit.used === 0;

        /*
          The pace: what the plan may start today (a week, on Free) less what
          was started, and an administrator's "Articles per day" when lower
          (lib/articles/pace.ts). Counted again here, after the retries, and
          once more under the lock as each article is reserved.
        */
        const { left, pace, cap, started } = await startsLeft(site.websiteId, now);
        const take = Math.min(left, remaining, firstRun ? 1 : left);
        if (left === 0) {
          logger.info(
            { step: `queue-${site.websiteId}`, websiteId: site.websiteId, organizationId: site.organizationId, pace, perDay: cap, started },
            "Pace reached for this website - nothing more queued for now",
          );
          return { queued: retried, limited: false };
        }
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
          return { queued: retried, limited: true };
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
              // Not started: one being written, or whose writing failed, is not a new topic (see the retries above).
              raw`not exists (select 1 from articles sa where sa.calendar_item_id = ${calendarItems.id})`,
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
            site.websiteId,
            item.id,
            { automatic: true, now },
          );
          if (outcome.ok) {
            count += 1;
          } else {
            // The topic stays planned and is taken by a later run; the log below says why it was passed over.
            rejected.push(outcome.error);
            // Another run took the day's place first: nothing after this one can be started either.
            if (outcome.error === PACE_REACHED) break;
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
            retried,
            rejected: rejected.length,
          },
          "Calendar items queued for generation",
        );

        return { queued: count + retried, limited: false };
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
        // Once while it lasts, not on every run until the plan renews.
        const [told] = await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.organizationId, organizationId),
              eq(notifications.type, "articles.limit_reached"),
              gte(notifications.createdAt, new Date(Date.now() - LIMIT_NOTICE_EVERY_DAYS * DAY_MS)),
            ),
          )
          .limit(1);
        if (told) continue;
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
