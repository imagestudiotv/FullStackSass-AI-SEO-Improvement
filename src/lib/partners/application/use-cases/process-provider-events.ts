import type { ProviderEventRecord } from "../ports/repositories";
import type { PartnerDeps } from "./deps";
import { rebuildPartnerProjections } from "./mature-commissions";
import { processChargeAdjustments } from "./process-adjustment";
import { processInvoice } from "./process-payment";
import { refreshPartnerTier } from "./refresh-partner-tier";

/**
 * Works off the affiliate work recorded by the Stripe webhook
 * (partner_provider_events): claimed with a token and a lease, so two
 * workers never process one event at once and a worker that died is taken
 * over when its lease runs out; retried with backoff; after
 * MAX_EVENT_ATTEMPTS it is marked failed and a review case says so - a
 * person decides, nothing is dropped.
 *
 * While commission processing is switched off nothing is claimed: the work
 * stays recorded and waits, without using up its attempts.
 */

export const MAX_EVENT_ATTEMPTS = 12;
const LEASE_MS = 5 * 60 * 1000;

/** 1, 2, 4 ... minutes, capped at two hours. */
export function eventBackoffMs(attempts: number): number {
  return Math.min(60_000 * 2 ** Math.max(attempts - 1, 0), 2 * 60 * 60 * 1000);
}

export type EventRunResult = { deferred: boolean; done: string[]; retrying: string[]; failed: string[] };

export async function processProviderEvents(
  deps: PartnerDeps,
  options: { only?: string[]; limit?: number } = {},
): Promise<EventRunResult> {
  const result: EventRunResult = { deferred: false, done: [], retrying: [], failed: [] };
  const repos = deps.uow.repositories;
  if (!(await repos.controls.isEnabled("partner_commissions"))) return { ...result, deferred: true };

  const now = deps.clock.now();
  const token = deps.random.uuid();
  const claimed = await repos.providerEvents.claimDue(now, token, new Date(now.getTime() + LEASE_MS), options.limit ?? 25, options.only);
  for (const event of claimed) {
    try {
      const { outcome, partnerIds } = await dispatch(deps, event);
      for (const partnerId of partnerIds) {
        await refreshPartnerTier(deps, partnerId);
        await rebuildPartnerProjections(deps, partnerId);
      }
      const ignored = ["not_relevant", "not_attributed", "no_fact", "wrong_environment", "no_partner_transfer"].includes(outcome);
      await repos.providerEvents.complete(event.id, token, { status: ignored ? "ignored" : "done", outcome, at: deps.clock.now() });
      result.done.push(event.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "processing failed";
      const failed = event.attempts >= MAX_EVENT_ATTEMPTS;
      await repos.providerEvents.release(event.id, token, {
        error: message,
        nextAttemptAt: new Date(deps.clock.now().getTime() + eventBackoffMs(event.attempts)),
        failed,
      });
      if (failed) {
        await repos.reviews.open({
          kind: "reconciliation",
          dedupeKey: `provider_event:${event.id}`,
          environment: event.environment,
          partnerId: null,
          attributionId: null,
          commissionId: null,
          settlementId: null,
          paymentFactId: null,
          organizationId: null,
          summary: `Stripe event ${event.stripeEventId} (${event.eventType}) could not be processed after ${event.attempts} attempts`,
          evidence: { providerEventId: event.id, stripeEventId: event.stripeEventId, objectId: event.objectId, error: message.slice(0, 300) },
        });
        result.failed.push(event.id);
      } else {
        result.retrying.push(event.id);
      }
      console.error(`[partners] provider event ${event.stripeEventId} (${event.eventType}) failed`, error);
    }
  }
  return result;
}

async function dispatch(deps: PartnerDeps, event: ProviderEventRecord): Promise<{ outcome: string; partnerIds: string[] }> {
  const kind = event.eventType.split(":")[0];
  switch (kind) {
    case "invoice":
      return processInvoice(deps, event.objectId, event.environment);
    case "charge":
      return processChargeAdjustments(deps, event.objectId, event.environment);
    case "transfer": {
      // A reversal or update of a transfer RepGet made (Part 4 reconciles it); anything else is not ours.
      const attempt = await deps.uow.repositories.settlements.findTransferAttemptByStripeId(event.objectId);
      if (!attempt) return { outcome: "no_partner_transfer", partnerIds: [] };
      return { outcome: "transfer_recorded", partnerIds: [] };
    }
    default:
      return { outcome: "not_relevant", partnerIds: [] };
  }
}

/**
 * Records affiliate work found by reconciliation (a payment whose webhook
 * was missed). The same table and worker as webhook work, under a stable
 * synthetic id so it is recorded once.
 */
export async function recordRecoveredWork(
  deps: PartnerDeps,
  input: { kind: "invoice" | "charge"; objectId: string; environment: "test" | "live"; reason: string },
): Promise<boolean> {
  const repos = deps.uow.repositories;
  const { id, created } = await repos.providerEvents.record({
    environment: input.environment,
    stripeEventId: `reconcile:${input.kind}:${input.objectId}`,
    eventType: `${input.kind}:${input.reason}`,
    objectId: input.objectId,
    connectedAccountId: null,
    eventCreatedAt: deps.clock.now(),
    now: deps.clock.now(),
  });
  if (created) {
    await repos.outbox.enqueue({ name: "partners/provider-event.process", id: `partners/provider-event:${id}`, data: { providerEventId: id } });
  }
  return created;
}
