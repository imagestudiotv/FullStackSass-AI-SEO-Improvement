import { and, desc, eq, inArray, isNotNull, lt, or, sql as raw } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { recordCredit } from "@/lib/backlinks/credits";
import { checkLink, FAILURES_BEFORE_REMOVED } from "@/lib/backlinks/verify";
import { db } from "@/lib/db";
import {
  backlinkRequests,
  linkChecks,
  placements,
  websites,
} from "@/lib/db/schema";

/**
 * Re-checks live placements and refunds credits for links that disappeared.
 *
 * The client's requirement, verbatim: if a link is removed we credit it back
 * AND it must disappear from the received dashboard, otherwise customers keep
 * asking about links that no longer exist.
 *
 * A link is only declared removed after several consecutive failed checks. A
 * host being down for an afternoon is not the same as a link being deleted,
 * and refunding on the first failure would destroy real placements.
 */

/** Placements re-checked per run. Bounded so one run cannot take hours. */
const BATCH_SIZE = 50;

/** How stale a check must be before it is worth repeating. */
const RECHECK_AFTER_HOURS = 24;

export const verifyBacklinks = inngest.createFunction(
  {
    id: "verify-backlinks",
    retries: 1,
    triggers: [
      { event: "backlinks/verify.requested" },
      // Daily. Links do not disappear fast enough to justify more, and each
      // check is an HTTP request against a customer's site.
      { cron: "0 3 * * *" },
    ],
  },
  async ({ step, logger }) => {
    /**
     * Structured logs, one per step, so the Inngest timeline explains itself.
     *
     * This job moves credits — a refund to the requester, a deduction from the
     * host — on the strength of several HTTP checks nobody watches. When a
     * customer disputes a refund, or asks why a link vanished from their
     * dashboard, these lines are the record of what was checked and what it
     * returned. Each carries its own `placementId`.
     */
    logger.info(
      { step: "start", batchSize: BATCH_SIZE, recheckAfterHours: RECHECK_AFTER_HOURS },
      "Backlink verification started",
    );

    const due = await step.run("select-placements", async () => {
      const cutoff = new Date(Date.now() - RECHECK_AFTER_HOURS * 3600 * 1000);

      const rows = await db
        .select({
          id: placements.id,
          liveUrl: placements.liveUrl,
          targetUrl: backlinkRequests.targetUrl,
          requestId: placements.requestId,
          credits: placements.credits,
          hostWebsiteId: placements.hostWebsiteId,
          requesterOrgId: websites.organizationId,
        })
        .from(placements)
        .innerJoin(backlinkRequests, eq(placements.requestId, backlinkRequests.id))
        .innerJoin(websites, eq(backlinkRequests.websiteId, websites.id))
        .where(
          and(
            eq(placements.status, "live"),
            isNotNull(placements.liveUrl),
            // Never checked, or not checked recently enough.
            or(
              raw`${placements.lastVerifiedAt} is null`,
              lt(placements.lastVerifiedAt, cutoff),
            ),
          ),
        )
        .limit(BATCH_SIZE);

      logger.info(
        {
          step: "select-placements",
          placementCount: rows.length,
          cappedAtBatch: rows.length === BATCH_SIZE,
          cutoff: cutoff.toISOString(),
        },
        "Live placements due for re-check selected",
      );
      return rows;
    });

    if (due.length === 0) {
      /*
        The expected result on most days — everything was checked within the
        last 24 hours — but also exactly what a broken selection query looks
        like, and this job silently stops refunding anyone if that happens.
      */
      logger.info(
        { step: "select-placements", placementCount: 0 },
        "No placements due for re-check - nothing to verify",
      );
      return { checked: 0, removed: 0 };
    }

    const outcomes = await step.run("check-links", async () => {
      const startedAt = Date.now();
      const results: {
        placementId: string;
        alive: boolean;
        httpStatus: number | null;
      }[] = [];

      for (const placement of due) {
        if (!placement.liveUrl) continue;
        const result = await checkLink(placement.liveUrl, placement.targetUrl);
        results.push({
          placementId: placement.id,
          alive: result.alive,
          httpStatus: result.httpStatus,
        });

        /*
          Per-placement rather than a summary only: a dead link is the first
          step toward taking a credit back off a host, so the individual check
          that started that sequence needs to be findable by placementId.
        */
        if (!result.alive) {
          logger.warn(
            {
              step: "check-links",
              placementId: placement.id,
              requestId: placement.requestId,
              httpStatus: result.httpStatus,
            },
            "Backlink not found at its recorded URL",
          );
        }

        // Spaced out: these are requests to customers' servers.
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      logger.info(
        {
          step: "check-links",
          checked: results.length,
          alive: results.filter((result) => result.alive).length,
          dead: results.filter((result) => !result.alive).length,
          durationMs: Date.now() - startedAt,
        },
        "Link checks finished",
      );
      return results;
    });

    const removed = await step.run("record-and-refund", async () => {
      if (outcomes.length === 0) {
        /*
          Placements were selected but every one lacked a liveUrl, so nothing
          was checked. A data problem rather than a quiet day, and it leaves
          the placements stuck as "live" and never re-verified.
        */
        logger.warn(
          { step: "record-and-refund", selected: due.length, checked: 0 },
          "Placements were due but none had a URL to check",
        );
        return [];
      }

      await db.insert(linkChecks).values(
        outcomes.map((outcome) => ({
          placementId: outcome.placementId,
          alive: outcome.alive,
          httpStatus: outcome.httpStatus,
        })),
      );

      await db
        .update(placements)
        .set({ lastVerifiedAt: new Date(), updatedAt: new Date() })
        .where(
          inArray(
            placements.id,
            outcomes.map((outcome) => outcome.placementId),
          ),
        );

      /**
       * A placement is removed only when its most recent checks ALL failed.
       * Reading the history back rather than trusting this run's single result
       * is what makes a transient outage survivable.
       */
      const failing = outcomes.filter((outcome) => !outcome.alive);
      const confirmed: typeof due = [];

      for (const outcome of failing) {
        const recent = await db
          .select({ alive: linkChecks.alive })
          .from(linkChecks)
          .where(eq(linkChecks.placementId, outcome.placementId))
          .orderBy(desc(linkChecks.checkedAt))
          .limit(FAILURES_BEFORE_REMOVED);

        if (
          recent.length >= FAILURES_BEFORE_REMOVED &&
          recent.every((check) => !check.alive)
        ) {
          const placement = due.find((row) => row.id === outcome.placementId);
          if (placement) confirmed.push(placement);
        }
      }

      /**
       * The gap between `failing` and `confirmed` is the transient-outage
       * guard doing its job. Recording both makes that visible: a run where
       * many links failed but none were confirmed removed is a host having a
       * bad afternoon, not links disappearing.
       */
      logger.info(
        {
          step: "record-and-refund",
          checksWritten: outcomes.length,
          failing: failing.length,
          confirmedRemoved: confirmed.length,
          failuresBeforeRemoved: FAILURES_BEFORE_REMOVED,
        },
        "Check results recorded",
      );

      for (const placement of confirmed) {
        /**
         * The requester gets their credit back, and the host loses what it
         * earned. Keeping the host's credit would pay for a link that is no
         * longer there, which is exactly the loophole a host could farm.
         */
        await recordCredit(placement.requesterOrgId, {
          type: "refund",
          amount: placement.credits,
          referenceId: placement.id,
          note: "Link removed by the host site",
        });

        if (placement.hostWebsiteId) {
          const [host] = await db
            .select({ organizationId: websites.organizationId })
            .from(websites)
            .where(eq(websites.id, placement.hostWebsiteId))
            .limit(1);

          if (host) {
            await recordCredit(host.organizationId, {
              type: "adjustment",
              amount: -placement.credits,
              referenceId: placement.id,
              note: "Link no longer live on your site",
            });
          } else {
            /*
              The requester is refunded but the host keeps what it earned,
              because its website row has gone. Credits are created out of
              nothing on this path, which is the loophole the deduction exists
              to close — so it must never happen silently.
            */
            logger.error(
              {
                step: "record-and-refund",
                placementId: placement.id,
                hostWebsiteId: placement.hostWebsiteId,
                credits: placement.credits,
              },
              "Host website row missing - refunded the requester without deducting from the host",
            );
          }
        } else {
          // Same imbalance by a different route: no host website was ever
          // recorded against this placement, so there is nobody to deduct from.
          logger.warn(
            {
              step: "record-and-refund",
              placementId: placement.id,
              credits: placement.credits,
            },
            "Placement has no host website - refunded the requester with no offsetting deduction",
          );
        }

        await db
          .update(placements)
          .set({ status: "removed", updatedAt: new Date() })
          .where(eq(placements.id, placement.id));

        // The request returns to pending so matching can find a new host —
        // the customer wanted a link, and one disappearing should not end it.
        await db
          .update(backlinkRequests)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(backlinkRequests.id, placement.requestId));

        // Credits moving is a money event, so it gets its own record rather
        // than being inferred from a status column changing.
        logger.info(
          {
            step: "record-and-refund",
            placementId: placement.id,
            requestId: placement.requestId,
            hostWebsiteId: placement.hostWebsiteId,
            credits: placement.credits,
          },
          "Placement marked removed, credits refunded and request returned to pending",
        );
      }

      return confirmed.map((placement) => placement.id);
    });

    /**
     * The one line that answers "was anything actually verified today".
     *
     * `removed` against `checked` is the ratio worth watching: a run that
     * removes an unusual share of its placements is more likely a change in
     * how links are checked than every host deleting them at once.
     */
    logger.info(
      {
        step: "done",
        selected: due.length,
        checked: outcomes.length,
        removed: removed.length,
      },
      "Backlink verification complete",
    );

    return { checked: outcomes.length, removed: removed.length };
  },
);
