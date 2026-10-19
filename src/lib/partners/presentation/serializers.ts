import { Money } from "../domain/value-objects/money";

/**
 * What crosses to the browser. Money is ALWAYS a decimal string with its
 * currency (never a bigint and never a float), dates are ISO strings, and
 * nothing here carries a provider secret, a raw error, an email of a
 * referred customer or a bank detail.
 */

export type MoneyView = { amount: string; currency: string; display: string };

const LOCALE_TAGS: Record<string, string> = { en: "en-GB", es: "es-ES", fr: "fr-FR", it: "it-IT", de: "de-DE" };

/** "€24.75" from minor units, in the viewer's locale - formatting only, no arithmetic. */
export function moneyView(amount: bigint, currency: string, locale = "en"): MoneyView {
  const money = Money.of(amount, currency);
  const decimal = money.toDecimalString();
  let display = `${decimal} ${currency.toUpperCase()}`;
  try {
    display = new Intl.NumberFormat(LOCALE_TAGS[locale] ?? "en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: money.currency.exponent,
      maximumFractionDigits: money.currency.exponent,
      // A string keeps every digit: no float conversion on the way.
    }).format(decimal as unknown as number);
  } catch {
    // Unknown to Intl: the plain form above.
  }
  return { amount: amount.toString(), currency, display };
}

export function isoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
