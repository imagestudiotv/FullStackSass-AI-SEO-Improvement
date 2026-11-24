import { inngest } from "@/inngest/client";
import { BROADCAST_EVENT, requeueStalledBroadcasts, sendBroadcastBatch, startDueBroadcasts } from "@/lib/broadcasts/engine";
import { db } from "@/lib/db";
import { deliverJobs } from "@/lib/jobs/outbox";

/**
 * Email broadcasts (lib/broadcasts/engine.ts holds every rule).
 *
 *  - email-broadcast-send: one step per batch, until nobody is left. ONE AT A
 *    TIME across every broadcast, so the pace in the engine is the pace.
 *  - email-broadcast-due: every five minutes, starts the scheduled broadcasts
 *    whose time has come and queues again one whose job was lost.
 */

/** Batches one run sends before handing over to a fresh one (Inngest bounds a run's steps). */
const BATCHES_PER_RUN = 200;

export const sendEmailBroadcast = inngest.createFunction(
  { id: "email-broadcast-send", retries: 5, concurrency: { limit: 1 }, triggers: [{ event: BROADCAST_EVENT }] },
  async ({ event, step, logger }) => {
    const broadcastId = String(event.data.broadcastId ?? "");
    if (!broadcastId) return { skipped: "no_broadcast" };
    const totals = { sent: 0, skipped: 0, failed: 0 };
    for (let index = 0; index < BATCHES_PER_RUN; index++) {
      const batch = await step.run(`batch-${index}`, () => sendBroadcastBatch(broadcastId));
      totals.sent += batch.sent;
      totals.skipped += batch.skipped;
      totals.failed += batch.failed;
      if (batch.done) {
        logger.info({ broadcastId, ...totals }, "Email broadcast finished");
        return { finished: true, ...totals };
      }
      if (batch.waitMs > 0) await step.sleep(`wait-${index}`, batch.waitMs);
    }
    // Named after this run, so a retried hand-over is one event.
    await step.sendEvent("continue", { id: `${event.id ?? broadcastId}:next`, name: BROADCAST_EVENT, data: { broadcastId } });
    return { finished: false, ...totals };
  },
);

export const emailBroadcastsDue = inngest.createFunction(
  { id: "email-broadcast-due", retries: 1, triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    const due = await step.run("start-due", () => startDueBroadcasts());
    const resumed = await step.run("requeue-stalled", () => requeueStalledBroadcasts());
    if (due.started.length > 0 || resumed.length > 0) await step.run("deliver", () => deliverJobs(db, { limit: 20 }));
    return { ...due, resumed };
  },
);
