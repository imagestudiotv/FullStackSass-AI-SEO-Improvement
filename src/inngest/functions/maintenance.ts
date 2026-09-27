import { inngest } from "@/inngest/client";
import { processCancellations } from "@/lib/billing/cancellations";
import { cancellationOps, checkoutProviderOps } from "@/lib/billing/checkout-providers";
import { reconcileCheckouts } from "@/lib/billing/checkouts";
import { sweepAbandonedReservations } from "@/lib/billing/spend-quota";
import { recoverWebhookEvents } from "@/lib/billing/webhook-recovery";
import { db } from "@/lib/db";
import { deliverJobs } from "@/lib/jobs/outbox";

/**
 * Scheduled recovery: the work that must happen whether or not any request
 * or provider event ever arrives again.
 *
 * Each part is idempotent and claims its rows with a token, so overlapping
 * runs - or a run overlapping a request doing the same thing - never do one
 * piece of work twice. Each step is separate so one failing does not stop
 * the others, and Inngest retries a failed step on its own.
 */

/** Delivers outbox jobs that could not be sent when they were recorded. */
export const deliverOutbox = inngest.createFunction(
  { id: "job-outbox-deliver", retries: 1, triggers: [{ cron: "* * * * *" }] },
  async ({ step }) => {
    const result = await step.run("deliver", () => deliverJobs(db, { limit: 100 }));
    return { sent: result.sent.length, retrying: result.retrying.length, failed: result.failed.length };
  },
);

export const billingMaintenance = inngest.createFunction(
  { id: "billing-maintenance", retries: 1, triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    /*
      Webhook events whose worker died, or that failed and are due a retry,
      processed from their stored verified payload - including events whose
      duplicate delivery was acknowledged with 200 while the first worker was
      still running.
    */
    const webhooks = await step.run("recover-webhooks", () => recoverWebhookEvents());

    // Provider cancellations owed for deleted websites and workspaces.
    const cancellations = await step.run("owed-cancellations", () =>
      processCancellations(db, cancellationOps),
    );

    /*
      Checkouts nobody is waiting on: crashed creates are looked up, expired
      sessions confirmed with Stripe. Read-only at the provider.
    */
    const checkouts = await step.run("reconcile-checkouts", () =>
      reconcileCheckouts(db, checkoutProviderOps),
    );

    // Reservations abandoned mid-request (spent ones are consumed, not freed).
    await step.run("sweep-reservations", () => sweepAbandonedReservations());

    return {
      webhooksRecovered: webhooks.recovered.length,
      webhooksFailed: webhooks.failed.length,
      cancellationsCompleted: cancellations.completed.length,
      cancellationsAbandoned: cancellations.abandoned.length,
      checkoutsSettled: checkouts,
    };
  },
);
