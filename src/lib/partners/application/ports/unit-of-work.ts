import type { UserDirectory } from "./directory";
import type { Outbox } from "./outbox";
import type {
  ApplicationRepository,
  AttributionRepository,
  AuditLog,
  CommissionRepository,
  ControlsRepository,
  CouponRepository,
  PartnerRepository,
  ProgramRepository,
  ProviderEventRepository,
  ReconciliationRepository,
  ReportingRepository,
  ReviewCaseRepository,
  SettlementRepository,
  StripeAccountRepository,
  TierRepository,
  TrackingRepository,
} from "./repositories";

/** Every repository, bound to one database transaction (or to none, for reads). */
export type PartnerRepositories = {
  programs: ProgramRepository;
  controls: ControlsRepository;
  applications: ApplicationRepository;
  partners: PartnerRepository;
  tiers: TierRepository;
  tracking: TrackingRepository;
  attributions: AttributionRepository;
  commissions: CommissionRepository;
  settlements: SettlementRepository;
  stripeAccounts: StripeAccountRepository;
  coupons: CouponRepository;
  reviews: ReviewCaseRepository;
  providerEvents: ProviderEventRepository;
  reconciliation: ReconciliationRepository;
  reporting: ReportingRepository;
  /** The app's identity tables (users, workspaces, invitations), read in the same transaction. */
  directory: UserDirectory;
  /** Jobs recorded here commit with the transaction (the transactional outbox). */
  outbox: Outbox;
  audit: AuditLog;
};

/**
 * Transactions, without the database.
 *
 * Keep them SHORT: no provider call ever runs inside one (Stripe is called
 * between transactions, and its answer re-checked in the next). The app's
 * connection pool is small, and a lock held across a network call stalls
 * every other partner operation behind it.
 */
export interface UnitOfWork {
  /** Repositories outside any transaction, for reads and single-statement writes. */
  readonly repositories: PartnerRepositories;
  transaction<T>(work: (repositories: PartnerRepositories) => Promise<T>): Promise<T>;
}
