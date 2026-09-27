import "server-only";

import type { inngest } from "@/inngest/client";
import { queueJobDurably } from "@/lib/jobs/outbox";

/**
 * Queues a background job that stands on its own - nothing else needs to
 * commit with it.
 *
 * Every job now goes through the outbox (lib/jobs/outbox.ts): it is recorded
 * durably first and then delivered, and delivery is retried with backoff by
 * the job-outbox cron until Inngest accepts it. A queue outage therefore
 * delays the work instead of losing it, and never fails the customer's
 * action - the row stays in its waiting state, honestly, until it runs.
 *
 * A job that belongs to a business change (an article queued, a reservation
 * taken) must instead be recorded with enqueueJob INSIDE that change's
 * transaction, then delivered with deliverNow after commit.
 *
 * Returns whether the event went out immediately. Most callers ignore it.
 */
export async function queueJob(
  event: Parameters<typeof inngest.send>[0],
): Promise<boolean> {
  const events = Array.isArray(event) ? event : [event];
  let all = true;
  for (const one of events) {
    try {
      const sent = await queueJobDurably({
        id: one.id,
        name: one.name,
        data: (one.data ?? {}) as Record<string, unknown>,
      });
      all = all && sent;
    } catch (error) {
      // Recording failed - the database, not the queue. Nothing was promised.
      console.error(`[inngest] could not record "${one.name}"`, error);
      all = false;
    }
  }
  return all;
}
