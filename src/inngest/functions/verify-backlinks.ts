import { inngest } from "@/inngest/client";
import {
  applyCheck,
  classifyCheck,
  discoverPublishedPlacements,
  FAILURES_BEFORE_REMOVED,
  placementsDue,
  type Transition,
} from "@/lib/backlinks/placements";
import { checkLink } from "@/lib/backlinks/verify";

/**
 * Checks placements at their published URL, and moves credits only on what
 * it SEES.
 *
 * The client's requirement: if a link is removed we credit it back AND it
 * disappears from the received dashboard. The accounting rules - charge on
 * first sight, refund after repeated definite misses, never on an outage -
 * live in lib/backlinks/placements.ts; this job only schedules the checks.
 *
 * It looks at every placement with a URL that is awaiting first sight
 * ("published") or live, which is what the old selection missed: it only
 * read "live" placements with a liveUrl, and nothing ever wrote one.
 */

/** Placements checked per run. Bounded so one run cannot take hours. */
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
    logger.info(
      { step: "start", batchSize: BATCH_SIZE, recheckAfterHours: RECHECK_AFTER_HOURS },
      "Backlink verification started",
    );

    // Placements whose article went live by a path that did not report it.
    const discovered = await step.run("discover-urls", () => discoverPublishedPlacements());

    const due = await step.run("select-placements", async () => {
      const cutoff = new Date(Date.now() - RECHECK_AFTER_HOURS * 3600 * 1000);
      const rows = await placementsDue(cutoff, BATCH_SIZE);
      logger.info(
        { step: "select-placements", placementCount: rows.length, discovered },
        "Placements due for a check selected",
      );
      return rows;
    });

    if (due.length === 0) {
      logger.info({ step: "select-placements", placementCount: 0 }, "Nothing to verify");
      return { checked: 0, wentLive: 0, removed: 0, unverified: 0 };
    }

    /*
      One step per placement: a retry replays the ones already done from
      Inngest's memo rather than fetching - and possibly moving credits for -
      them again. applyCheck is idempotent on its own as well.
    */
    const transitions: Transition[] = [];
    for (const placement of due) {
      const transition = await step.run(`check-${placement.id}`, async () => {
        const result = await checkLink(placement.liveUrl, placement.targetUrl);
        const outcome = classifyCheck(result);
        const applied = await applyCheck(placement.id, outcome, result.httpStatus, new Date(), {
          rel: result.rel ?? null,
          error: result.error,
        });
        if (outcome !== "alive") {
          logger.warn(
            {
              step: "check",
              placementId: placement.id,
              status: placement.status,
              outcome,
              httpStatus: result.httpStatus,
              transition: applied,
            },
            outcome === "error"
              ? "Page could not be reached - not counted toward removal"
              : "Backlink not found at its URL",
          );
        } else if (applied === "went_live") {
          logger.info(
            { step: "check", placementId: placement.id },
            "Backlink seen live - requester charged, host credited",
          );
        }
        // Spaced out: these are requests to customers' servers.
        await new Promise((resolve) => setTimeout(resolve, 250));
        return applied;
      });
      transitions.push(transition);
    }

    const summary = {
      checked: due.length,
      wentLive: transitions.filter((t) => t === "went_live").length,
      removed: transitions.filter((t) => t === "removed").length,
      unverified: transitions.filter((t) => t === "unverified").length,
    };
    logger.info(
      { step: "done", ...summary, failuresBeforeRemoved: FAILURES_BEFORE_REMOVED },
      "Backlink verification complete",
    );
    return summary;
  },
);
