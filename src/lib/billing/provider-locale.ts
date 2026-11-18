import { actionLocale } from "@/lib/i18n/action-locale";
import type { Locale } from "@/lib/i18n/config";

/**
 * The language a payment page opens in (2026-11-18). Somebody who read the
 * site, signed up and set up a website in Italian was sent to an English or
 * browser-language Stripe or PayPal page at the step that asks for a card.
 *
 * Only the four translated languages are passed on. English, no session or
 * any failure gives null and the provider chooses as before ("auto" at Stripe,
 * the buyer's country at PayPal), which keeps en-GB and en-US apart: passing
 * "en" would lose that. Display only: nothing about the amount, the trial,
 * the plan or where the buyer returns depends on it.
 */
export async function payerLocale(): Promise<Exclude<Locale, "en"> | null> {
  const locale = await actionLocale();
  return locale === "en" ? null : locale;
}

/** PayPal wants a language with a country (BCP 47); the country of each language's market. */
const PAYPAL_LOCALE: Record<Exclude<Locale, "en">, string> = {
  it: "it-IT",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
};

export function payPalLocale(locale: Exclude<Locale, "en"> | null): string | undefined {
  return locale ? PAYPAL_LOCALE[locale] : undefined;
}
