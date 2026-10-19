import { inngest } from "@/inngest/client";
import { activateDueCoupons } from "@/lib/partners/application/use-cases/manage-coupon";
import { matureCommissions, rebuildPartnerProjections } from "@/lib/partners/application/use-cases/mature-commissions";
import { processProviderEvents } from "@/lib/partners/application/use-cases/process-provider-events";
import { refreshPartnerTier } from "@/lib/partners/application/use-cases/refresh-partner-tier";
import { partnerDeps } from "@/lib/partners/server";

/**
 * Commission processing for the cash partner program.
 *
 *  - partner-provider-event: the affiliate work one Stripe event recorded,
 *    delivered through the outbox straight after the webhook.
 *  - partner-commissions-sweep (every five minutes): anything due that a
 *    delivery missed or a retry is owed, work deferred while processing was
 *    switched off, commissions that reached Net 30, and affiliate coupons
 *    whose campaign start date has come.
 *  - partner-tiers-daily: re-counts every active partner's qualifying
 *    customers (a subscription that lapsed stops counting) and rebuilds the
 *    balance projections.
 *
 * All of them call the same use cases as every other entry point; each
 * claims its rows, so overlapping runs never process one thing twice.
 */

export const partnerProviderEvent = inngest.createFunction(
  { id: "partner-provider-event", retries: 3, triggers: [{ event: "partners/provider-event.process" }] },
  async ({ event, step }) => {
    const providerEventId = String((event.data as { providerEventId?: unknown }).providerEventId ?? "");
    const result = await step.run("process", () => processProviderEvents(partnerDeps(), { only: [providerEventId], limit: 1 }));
    return { deferred: result.deferred, done: result.done.length, retrying: result.retrying.length, failed: result.failed.length };
  },
);

export const partnerCommissionsSweep = inngest.createFunction(
  { id: "partner-commissions-sweep", retries: 1, concurrency: { limit: 1 }, triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) => {
    const events = await step.run("provider-events", async () => {
      const result = await processProviderEvents(partnerDeps(), { limit: 50 });
      return { deferred: result.deferred, done: result.done.length, retrying: result.retrying.length, failed: result.failed.length };
    });
    const matured = await step.run("mature", () => matureCommissions(partnerDeps()));
    const coupons = await step.run("activate-coupons", () => activateDueCoupons(partnerDeps()));
    return { events, matured: matured.matured, couponsActivated: coupons.activated };
  },
);

export const partnerTiersDaily = inngest.createFunction(
  { id: "partner-tiers-daily", retries: 1, concurrency: { limit: 1 }, triggers: [{ cron: "10 3 * * *" }] },
  async ({ step }) => {
    const ids = await step.run("partners", () => partnerDeps().uow.repositories.partners.listActiveIds());
    let changed = 0;
    for (const partnerId of ids) {
      const result = await step.run(`tier-${partnerId}`, async () => {
        const tier = await refreshPartnerTier(partnerDeps(), partnerId);
        await rebuildPartnerProjections(partnerDeps(), partnerId);
        return tier?.changed ?? false;
      });
      if (result) changed += 1;
    }
    return { partners: ids.length, changed };
  },
);
