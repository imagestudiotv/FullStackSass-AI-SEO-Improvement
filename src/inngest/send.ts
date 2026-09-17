import "server-only";

import { inngest } from "@/inngest/client";

/**
 * Queues a background job without letting the queue take the request down.
 *
 * inngest.send() performs a network call. When Inngest is unreachable — the
 * dev server is not running, INNGEST_DEV points at a port with nothing behind
 * it, the event key is wrong, their API is briefly down — it THROWS.
 *
 * Every caller awaited it directly, and all of them send the event AFTER
 * writing the row the job is about. So an unreachable queue turned a
 * successful action into a thrown server action: the row was created, the
 * client received neither `ok` nor an error, and the button appeared to do
 * nothing. That is exactly the "add website button is not working" report —
 * the website was in fact being created every time.
 *
 * The row is the source of truth and the job is an optimisation on top of it:
 * a website sits at status "pending" until the crawl runs, an article stays
 * queued until generation picks it up. Losing the event costs a delay, and the
 * work can be re-triggered. Losing the customer's action costs the customer.
 *
 * Returns whether the event actually went out, so a caller that wants to say
 * "analysis will start shortly" versus "we will pick this up soon" can tell
 * the difference. Most callers ignore it, which is correct.
 */
export async function queueJob(
  event: Parameters<typeof inngest.send>[0],
): Promise<boolean> {
  try {
    await inngest.send(event);
    return true;
  } catch (error) {
    /**
     * Logged loudly rather than swallowed silently. A queue that is down is a
     * real problem worth finding in the logs — it just must not be the
     * customer's problem in the moment.
     */
    const name =
      Array.isArray(event) ? event.map((e) => e.name).join(", ") : event.name;
    console.error(
      `[inngest] could not queue "${name}"; the row is written and the job can be re-triggered`,
      error,
    );
    return false;
  }
}
