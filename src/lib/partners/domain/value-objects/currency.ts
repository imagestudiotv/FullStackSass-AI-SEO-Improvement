import { UnsupportedCurrencyError } from "../errors";

/**
 * Currencies the partner program can account in, with the exponent Stripe
 * uses for their amounts.
 *
 * An explicit allowlist rather than "two decimals unless told otherwise".
 * Stripe's minor units differ from ISO 4217 for a handful of currencies
 * (HUF, ISK, TWD and UGX are special cases in its API), and a wrong exponent
 * would be off by a factor of a hundred in a payout. A currency that is not
 * listed is refused, and the payment becomes a review case.
 *
 * Codes are lower case, as Stripe sends them.
 */
const EXPONENTS: Readonly<Record<string, number>> = {
  eur: 2,
  usd: 2,
  gbp: 2,
  chf: 2,
  cad: 2,
  aud: 2,
  nzd: 2,
  sek: 2,
  nok: 2,
  dkk: 2,
  pln: 2,
  czk: 2,
  ron: 2,
  bgn: 2,
  jpy: 0,
};

export type Currency = {
  /** Lower-case ISO code, e.g. "eur". */
  readonly code: string;
  /** Digits after the decimal point in Stripe amounts. */
  readonly exponent: number;
};

export function isSupportedCurrency(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXPONENTS, code.toLowerCase());
}

/** The validated currency for a code. Throws UnsupportedCurrencyError. */
export function currency(code: string): Currency {
  const normalised = code.trim().toLowerCase();
  if (!isSupportedCurrency(normalised)) throw new UnsupportedCurrencyError(code);
  return { code: normalised, exponent: EXPONENTS[normalised] };
}

export function supportedCurrencyCodes(): string[] {
  return Object.keys(EXPONENTS);
}
