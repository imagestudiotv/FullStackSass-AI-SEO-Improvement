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
  async ({ step }) => {
    const due = await step.run("select-placements", async () => {
      const cutoff = new Date(Date.now() - RECHECK_AFTER_HOURS * 3600 * 1000);

      return db
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
    });

    if (due.length === 0) {
      return { checked: 0, removed: 0 };
    }

    const outcomes = await step.run("check-links", async () => {
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
        // Spaced out: these are requests to customers' servers.
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return results;
    });

    const removed = await step.run("record-and-refund", async () => {
      if (outcomes.length === 0) return [];

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
          }
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
      }

      return confirmed.map((placement) => placement.id);
    });

    return { checked: outcomes.length, removed: removed.length };
  },
);
