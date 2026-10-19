import type { BillingSource, CouponGateway } from "../ports/billing-source";
import type { Clock } from "../ports/clock";
import type { Hasher, Mailer, RateLimiter, SecureRandom, UserDirectory } from "../ports/directory";
import type { ConnectAccountGateway, StripePayoutGateway } from "../ports/payout-gateway";
import type { ProgramSettings } from "../ports/settings";
import type { UnitOfWork } from "../ports/unit-of-work";

/**
 * Everything a use case may depend on - interfaces only. The composition
 * root (server.ts) supplies the concrete adapters; tests supply fakes for
 * the external ones (Stripe, mail) and real repositories on a disposable
 * database.
 *
 * The Stripe ports are null when Stripe is not configured on a deployment:
 * use cases then answer "disabled" instead of throwing.
 */
export type PartnerDeps = {
  uow: UnitOfWork;
  clock: Clock;
  settings: ProgramSettings;
  directory: UserDirectory;
  random: SecureRandom;
  hasher: Hasher;
  mailer: Mailer;
  /** Durable limits (applications): a row per attempt, counted over hours or days. */
  quotaLimiter: RateLimiter;
  /** Cheap burst limits (public tracking): one counter per bucket, windows up to an hour. */
  burstLimiter: RateLimiter;
  /** Connected-account onboarding and readiness. */
  connect: ConnectAccountGateway | null;
  /** Transfers and bank payouts (the same Stripe adapter, wider interface). */
  payouts: StripePayoutGateway | null;
  billing: BillingSource | null;
  couponGateway: CouponGateway | null;
};
