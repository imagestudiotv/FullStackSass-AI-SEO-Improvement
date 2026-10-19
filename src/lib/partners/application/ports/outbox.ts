/**
 * Durable follow-up work, implemented by the app's transactional outbox
 * (lib/jobs/outbox.ts): a job recorded in a transaction exists exactly when
 * that transaction commits, and is delivered to the job runner afterwards
 * with retries. Event ids are stable, so recording the same work twice is
 * one job.
 */

export type PartnerJob =
  | { name: "partners/welcome.send"; id: string; data: { partnerId: string } }
  | { name: "partners/provider-event.process"; id: string; data: { providerEventId: string } }
  | { name: "partners/settlement.execute"; id: string; data: { settlementId: string } }
  | { name: "partners/notify"; id: string; data: { partnerId: string; kind: string; detail: Record<string, string> } };

export interface Outbox {
  /** Records the job in the current transaction. */
  enqueue(job: PartnerJob): Promise<void>;
}

/** Delivery after commit (best effort: the outbox cron retries anything left). */
export interface JobDelivery {
  deliver(jobIds: string[]): Promise<void>;
}
