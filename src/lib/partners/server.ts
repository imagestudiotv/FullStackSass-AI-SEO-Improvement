import "server-only";

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe/client";

import type { Clock } from "./application/ports/clock";
import type { Hasher, SecureRandom, UserDirectory } from "./application/ports/directory";
import type { ProgramSettings } from "./application/ports/settings";
import type { UnitOfWork } from "./application/ports/unit-of-work";
import type { PartnerDeps } from "./application/use-cases/deps";
import { systemClock } from "./infrastructure/clock";
import { hasher, secureRandom } from "./infrastructure/crypto";
import { userDirectory } from "./infrastructure/directory";
import { partnerMailer } from "./infrastructure/notifications";
import { drizzleUnitOfWork } from "./infrastructure/persistence/unit-of-work";
import { burstRateLimiter, quotaRateLimiter } from "./infrastructure/rate-limit";
import { settingsFromEnv } from "./infrastructure/settings";
import { connectAccountGateway } from "./infrastructure/stripe/connect-onboarding";

/**
 * THE COMPOSITION ROOT. The only module that constructs concrete adapters
 * (Drizzle repositories, the Stripe gateway, the mailer) and hands them to
 * the application's use cases. Pages, server actions, route handlers,
 * webhooks and Inngest jobs all reach the partner program through here.
 *
 * Built lazily, on first use: importing a route that uses it must not need a
 * database connection or Stripe credentials (`next build` evaluates every
 * route module), the same rule lib/db and lib/stripe/client follow. The
 * Stripe adapters exist only when STRIPE_SECRET_KEY names an environment;
 * otherwise the use cases answer "disabled".
 */

export type PartnerInfrastructure = {
  uow: UnitOfWork;
  clock: Clock;
  settings: ProgramSettings;
  directory: UserDirectory;
  random: SecureRandom;
  hasher: Hasher;
};

let deps: PartnerDeps | null = null;

export function partnerDeps(): PartnerDeps {
  if (!deps) {
    const settings = settingsFromEnv();
    const environment = settings.environment();
    const connect = environment ? connectAccountGateway(stripe, environment) : null;
    deps = {
      uow: drizzleUnitOfWork(db),
      clock: systemClock,
      settings,
      directory: userDirectory(db),
      random: secureRandom,
      hasher,
      mailer: partnerMailer,
      quotaLimiter: quotaRateLimiter(),
      burstLimiter: burstRateLimiter(),
      connect,
      payouts: null,
      billing: null,
      couponGateway: null,
    };
  }
  return deps;
}

/** The infrastructure subset presentation guards need. */
export function partnerInfrastructure(): PartnerInfrastructure {
  return partnerDeps();
}
