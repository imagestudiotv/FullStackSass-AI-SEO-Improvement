import type { Environment } from "./repositories";

/**
 * Deployment configuration the use cases need, read by infrastructure from
 * the environment. Three independent switches govern the program
 * (platform_controls, changed by administrators with a reason):
 *
 *   partner_program      - partner-facing visibility: the public page,
 *                          applications, new tracking. Approved partners
 *                          keep their portal and history either way.
 *   partner_commissions  - commission processing. While off, affiliate work
 *                          from Stripe events is still RECORDED, and waits.
 *   partner_payouts      - new money movement (settlements, transfers, new
 *                          bank payouts). Switching it off never stops
 *                          status ingestion or reconciliation of operations
 *                          already submitted to Stripe.
 *
 * and, for LIVE money only, a fourth key held outside the database:
 * PARTNER_LIVE_PAYOUTS=enabled in the deployment environment. Test-mode
 * payouts need only the database switch.
 */
export interface ProgramSettings {
  /** The environment of the configured Stripe key, or null when none is configured. */
  environment(): Environment | null;
  /** The deployment allows real money to move in this environment. */
  moneyMovementAllowed(environment: Environment): boolean;
  appUrl(): string;
  /** The countries the platform's Connect configuration supports for partner accounts. */
  payoutCountries(): string[];
}
