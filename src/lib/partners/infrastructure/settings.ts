import type { Environment } from "../application/ports/repositories";
import type { ProgramSettings } from "../application/ports/settings";

/**
 * Deployment settings for the partner program, from the environment.
 *
 *   STRIPE_SECRET_KEY            - its prefix says test or live; partner records
 *                                  are kept per environment and never mixed.
 *   PARTNER_LIVE_PAYOUTS         - "enabled" allows LIVE transfers and bank
 *                                  payouts. Anything else (the default) keeps
 *                                  live money still, whatever the database
 *                                  switch says. Test mode does not need it.
 *   PARTNER_PAYOUT_COUNTRIES     - comma-separated ISO countries partners may
 *                                  be paid in. Defaults to the regions where
 *                                  Stripe supports self-serve cross-border
 *                                  transfers between platforms and connected
 *                                  accounts (US, CA, UK, EEA, CH); narrow it
 *                                  to what the platform's Connect settings
 *                                  actually allow.
 *   NEXT_PUBLIC_APP_URL          - where Stripe sends partners back after onboarding.
 */

const EEA = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IE", "IT",
  "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];
export const DEFAULT_PAYOUT_COUNTRIES = ["US", "CA", "GB", "CH", ...EEA].sort();

export function environmentForKey(key: string | undefined): Environment | null {
  if (!key) return null;
  if (/^(sk|rk)_test_/.test(key)) return "test";
  if (/^(sk|rk)_live_/.test(key)) return "live";
  return null;
}

export function settingsFromEnv(env: NodeJS.ProcessEnv = process.env): ProgramSettings {
  return {
    environment: () => environmentForKey(env.STRIPE_SECRET_KEY),
    moneyMovementAllowed: (environment) => environment === "test" || env.PARTNER_LIVE_PAYOUTS === "enabled",
    appUrl: () => (env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
    payoutCountries: () => {
      const configured = (env.PARTNER_PAYOUT_COUNTRIES ?? "")
        .split(",")
        .map((code) => code.trim().toUpperCase())
        .filter((code) => /^[A-Z]{2}$/.test(code));
      return configured.length > 0 ? [...new Set(configured)].sort() : DEFAULT_PAYOUT_COUNTRIES;
    },
  };
}
