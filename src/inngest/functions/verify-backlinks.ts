import { inngest } from "@/inngest/client";
import {
  applyCheck,
  classifyCheck,
  discoverPublishedPlacements,
  FAILURES_BEFORE_REMOVED,
  placementsDue,
  type DuePlacement,
  type Transition,
} from "@/lib/backlinks/placements";
import { isUnfollowed } from "@/lib/backlinks/follow";
import { alertIfNewlyUnfollowed } from "@/lib/backlinks/nofollow";
import { checkLinks } from "@/lib/backlinks/verify";

/**
 * Checks placements at their published URL, and moves credits only on what
 * it SEES.
 *
 * The accounting rules - charge on first sight, never refund automatically
 * (a link gone on every recent check is listed for an administrator, who
 * removes and refunds it by hand; client, 2026-10-01) - live in
 * lib/backlinks/placements.ts; this job only schedules the checks.
 *
 * It looks at every placement with a URL that is awaiting first sight
 * ("published") or live, which is what the old selection missed: it only
 * read "live" placements with a liveUrl, and nothing ever wrote one.
 */

/**
 * Placements checked per run. Bounded so one run cannot take hours; each
 * page is its own step, so a run is well inside Inngest's step limit.
 *
 * 300 every six hours (it was 50 a day): with up to 15 network links per
 * article and no cap on how many links a website hosts, 50 a day for the
 * whole platform fell behind - and credits move only once a link has been
 * SEEN live, so a backlog delayed every charge and every host reward.
 */
const BATCH_SIZE = 300;

/** How stale a check must be before it is worth repeating. */
const RECHECK_AFTER_HOURS = 24;

export const verifyBacklinks = inngest.createFunction(
  {
    id: "verify-backlinks",
    retries: 1,
    /*
      One run at a time. A run can outlast the six-hour interval, or meet an
      admin's "verify now": two runs would select the same placements and
      fetch every page twice. applyCheck would still move credits only once,
      but each check also counts toward removal (FAILURES_BEFORE_REMOVED), so
      duplicate misses must not pile up.
    */
    concurrency: { limit: 1 },
    triggers: [
      { event: "backlinks/verify.requested" },
      /*
        Every six hours, to work through new links promptly. Each placement is
        still re-checked at most once a day (RECHECK_AFTER_HOURS): links do
        not disappear fast enough to justify more, and each check is an HTTP
        request against a customer's site.
      */
      { cron: "0 */6 * * *" },
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
      return { checked: 0, wentLive: 0, missing: 0, unverified: 0 };
    }

    /*
      One step per PAGE: an article can carry up to 15 network links, all on
      the same published page, so the page is fetched once and every
      placement on it is judged from that one fetch. A retry replays the
      pages already done from Inngest's memo rather than fetching - and
      possibly moving credits for - them again. applyCheck is idempotent on
      its own as well.
    */
    const pages = new Map<string, DuePlacement[]>();
    for (const placement of due) {
      const group = pages.get(placement.liveUrl);
      if (group) group.push(placement);
      else pages.set(placement.liveUrl, [placement]);
    }

    const transitions: Transition[] = [];
    for (const group of pages.values()) {
      const applied = await step.run(`check-page-${group[0].id}`, async () => {
        const results = await checkLinks(
          group[0].liveUrl,
          group.map((placement) => placement.targetUrl),
        );
        const out: Transition[] = [];
        for (const [index, placement] of group.entries()) {
          const result = results[index];
          const outcome = classifyCheck(result);
          const transition = await applyCheck(placement.id, outcome, result.httpStatus, new Date(), {
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
                transition,
              },
              outcome === "error"
                ? "Page could not be reached - not counted toward removal"
                : "Backlink not found at its URL",
            );
          } else if (transition === "went_live") {
            logger.info(
              { step: "check", placementId: placement.id },
              "Backlink seen live - requester charged, host credited",
            );
          }
          // Live but not counted by search engines: tell both sides, once.
          if (outcome === "alive" && isUnfollowed(result.rel) && (await alertIfNewlyUnfollowed(placement.id))) {
            logger.warn(
              { step: "check", placementId: placement.id, rel: result.rel },
              "Backlink is marked nofollow on the live page - host and beneficiary alerted",
            );
          }
          out.push(transition);
        }
        // Spaced out: these are requests to customers' servers.
        await new Promise((resolve) => setTimeout(resolve, 250));
        return out;
      });
      transitions.push(...applied);
    }

    const summary = {
      checked: due.length,
      wentLive: transitions.filter((t) => t === "went_live").length,
      // Gone on every recent check: listed for an administrator, nothing refunded.
      missing: transitions.filter((t) => t === "missing").length,
      unverified: transitions.filter((t) => t === "unverified").length,
    };
    logger.info(
      { step: "done", ...summary, failuresBeforeRemoved: FAILURES_BEFORE_REMOVED },
      "Backlink verification complete",
    );
    return summary;
  },
);
