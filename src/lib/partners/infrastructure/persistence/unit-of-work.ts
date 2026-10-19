import "server-only";

import { recordAdminAction } from "@/lib/admin/audit";
import type { Database, Executor } from "@/lib/db/types";
import { deliverJobs, enqueueJob } from "@/lib/jobs/outbox";

import type { PartnerJob } from "../../application/ports/outbox";
import { userDirectory } from "../directory";
import type { PartnerRepositories, UnitOfWork } from "../../application/ports/unit-of-work";
import { couponRepository, providerEventRepository, reviewCaseRepository, stripeAccountRepository } from "./repositories/accounts";
import { attributionRepository, trackingRepository } from "./repositories/attribution";
import { commissionRepository } from "./repositories/commissions";
import { applicationRepository, partnerRepository, tierRepository } from "./repositories/partners";
import { controlsRepository, programRepository } from "./repositories/program";
import { reconciliationRepository } from "./repositories/reconciliation";
import { reportingRepository } from "./repositories/reporting";
import { settlementRepository } from "./repositories/settlements";

/**
 * Every repository bound to one executor. `onJob` records the id of each
 * job written to the outbox, so it can be delivered once the transaction
 * has committed.
 */
export function repositoriesFor(
  executor: Executor,
  onJob: (id: string) => void | Promise<void> = () => {},
): PartnerRepositories {
  return {
    programs: programRepository(executor),
    controls: controlsRepository(executor),
    applications: applicationRepository(executor),
    partners: partnerRepository(executor),
    tiers: tierRepository(executor),
    tracking: trackingRepository(executor),
    attributions: attributionRepository(executor),
    commissions: commissionRepository(executor),
    settlements: settlementRepository(executor),
    stripeAccounts: stripeAccountRepository(executor),
    coupons: couponRepository(executor),
    reviews: reviewCaseRepository(executor),
    providerEvents: providerEventRepository(executor),
    reconciliation: reconciliationRepository(executor),
    reporting: reportingRepository(executor),
    directory: userDirectory(executor),
    outbox: {
      async enqueue(job: PartnerJob) {
        await enqueueJob(executor, { id: job.id, name: job.name, data: job.data });
        await onJob(job.id);
      },
    },
    audit: {
      async record(entry) {
        await recordAdminAction(
          {
            actorEmail: entry.actorEmail,
            action: entry.action,
            targetType: entry.targetType,
            targetId: entry.targetId,
            summary: entry.summary,
            detail: entry.detail ?? null,
          },
          executor,
        );
      },
    },
  };
}

/**
 * The Drizzle unit of work. Jobs recorded inside a transaction are delivered
 * to Inngest right after it commits (best effort - the job-outbox cron
 * delivers anything this misses); a rolled-back transaction recorded none.
 */
export function drizzleUnitOfWork(database: Database, options: { deliver?: boolean } = {}): UnitOfWork {
  const deliver = options.deliver ?? true;
  return {
    // Outside a transaction the job row is already committed: deliver it now.
    repositories: repositoriesFor(database, async (id) => {
      if (deliver) await deliverJobs(database, { only: [id] });
    }),
    async transaction(work) {
      const jobs: string[] = [];
      const collect = (id: string) => {
        jobs.push(id);
      };
      const result = await database.transaction((tx) => work(repositoriesFor(tx, collect)));
      if (deliver && jobs.length > 0) await deliverJobs(database, { only: jobs });
      return result;
    },
  };
}
