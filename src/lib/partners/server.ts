import "server-only";

import { db } from "@/lib/db";

import type { Clock } from "./application/ports/clock";
import type { Hasher, SecureRandom, UserDirectory } from "./application/ports/directory";
import type { ProgramSettings } from "./application/ports/settings";
import type { UnitOfWork } from "./application/ports/unit-of-work";
import { systemClock } from "./infrastructure/clock";
import { hasher, secureRandom } from "./infrastructure/crypto";
import { userDirectory } from "./infrastructure/directory";
import { drizzleUnitOfWork } from "./infrastructure/persistence/unit-of-work";
import { settingsFromEnv } from "./infrastructure/settings";

/**
 * THE COMPOSITION ROOT. The only module that constructs concrete adapters
 * (Drizzle repositories, the Stripe gateway, the mailer) and hands them to
 * the application's use cases. Pages, server actions, route handlers,
 * webhooks and Inngest jobs all reach the partner program through here.
 *
 * Built lazily, on first use: importing a route that uses it must not need a
 * database connection or Stripe credentials (`next build` evaluates every
 * route module), the same rule lib/db and lib/stripe/client follow.
 */

export type PartnerInfrastructure = {
  uow: UnitOfWork;
  clock: Clock;
  settings: ProgramSettings;
  directory: UserDirectory;
  random: SecureRandom;
  hasher: Hasher;
};

let infrastructure: PartnerInfrastructure | null = null;

export function partnerInfrastructure(): PartnerInfrastructure {
  if (!infrastructure) {
    infrastructure = {
      uow: drizzleUnitOfWork(db),
      clock: systemClock,
      settings: settingsFromEnv(),
      directory: userDirectory(db),
      random: secureRandom,
      hasher,
    };
  }
  return infrastructure;
}
