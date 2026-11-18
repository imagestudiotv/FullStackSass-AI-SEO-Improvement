import type { Locale } from "@/lib/i18n/config";

/**
 * The REPGET notice on the plan screens (lib/billing/repget-offer.ts). Since
 * 2026-11-11 the discount is applied automatically, so the screens say it is
 * applied instead of asking for a code. Shown only while the offer is on.
 *
 * REPGET is the launch price (2026-11-11), on every payment, so for it
 * `{price}` is what each payment costs - the only figure its words give: no
 * regular price and no percentage off it (conservative copy, 2026-11-18, as
 * nothing shows the regular price was ever charged). For the win-back offer
 * `{price}` is the first payment and `{regular}` the plan's price on screen,
 * the price that account pays otherwise.
 */
export type OfferCodeCopy = {
  /** Which discount the words are for: REPGET when absent, or the win-back offer (lib/billing/winback-offer.ts). */
  offer?: "winback";
  label: string;
  help: string;
  /** The monthly plan's discounted payment (the key names date from the first-payment-only offer). */
  firstMonth: string;
  /** The yearly plan's discounted payment. */
  firstYear: string;
};

export const OFFER_CODE: Record<Locale, OfferCodeCopy> = {
  en: {
    label: "REPGET launch price applied",
    help: "Applied automatically at checkout on Launch, Grow and Scale, together with your free trial. The launch price applies to every payment, monthly or yearly.",
    firstMonth: "Each monthly payment: {price}.",
    firstYear: "Each yearly payment: {price}.",
  },
  es: {
    label: "Precio de lanzamiento REPGET aplicado",
    help: "Se aplica automáticamente al pagar en Launch, Grow y Scale, junto con su prueba gratuita. El precio de lanzamiento se aplica a cada pago, mensual o anual.",
    firstMonth: "Cada pago mensual: {price}.",
    firstYear: "Cada pago anual: {price}.",
  },
  fr: {
    label: "Prix de lancement REPGET appliqué",
    help: "Appliqué automatiquement au paiement sur Launch, Grow et Scale, avec votre essai gratuit. Le prix de lancement s’applique à chaque paiement, mensuel ou annuel.",
    firstMonth: "Chaque paiement mensuel : {price}.",
    firstYear: "Chaque paiement annuel : {price}.",
  },
  it: {
    label: "Prezzo di lancio REPGET applicato",
    help: "Applicato automaticamente al pagamento su Launch, Grow e Scale, insieme alla prova gratuita. Il prezzo di lancio vale per ogni pagamento, mensile o annuale.",
    firstMonth: "Ogni pagamento mensile: {price}.",
    firstYear: "Ogni pagamento annuale: {price}.",
  },
  de: {
    label: "REPGET-Einführungspreis angewendet",
    help: "Wird beim Bezahlen für Launch, Grow und Scale automatisch angewendet, zusammen mit Ihrer kostenlosen Testphase. Der Einführungspreis gilt für jede Zahlung, monatlich oder jährlich.",
    firstMonth: "Jede Monatszahlung: {price}.",
    firstYear: "Jede Jahreszahlung: {price}.",
  },
};

/**
 * The win-back notice (lib/billing/winback-offer.ts): shown in its place for an
 * account that was sent the win-back email and has not used it, when REPGET
 * (which is bigger, and wins) does not apply. The figures are WINBACK_PERCENT_OFF and
 * WINBACK_BONUS_CREDITS.
 */
export const WINBACK_OFFER_CODE: Record<Locale, OfferCodeCopy> = {
  en: {
    offer: "winback",
    label: "Welcome back: 20% OFF applied",
    help: "Applied automatically at checkout on Launch, Grow and Scale: 20% off your first payment, monthly or yearly, plus 100 extra credits once that payment goes through. One use per account.",
    firstMonth: "Your first monthly payment: {price} instead of {regular}.",
    firstYear: "Your first yearly payment: {price} instead of {regular}.",
  },
  es: {
    offer: "winback",
    label: "Bienvenido de nuevo: 20 % de descuento aplicado",
    help: "Se aplica automáticamente al pagar en Launch, Grow y Scale: un 20 % de descuento en su primer pago, mensual o anual, y 100 créditos extra en cuanto se realice ese pago. Un uso por cuenta.",
    firstMonth: "Su primer pago mensual: {price} en lugar de {regular}.",
    firstYear: "Su primer pago anual: {price} en lugar de {regular}.",
  },
  fr: {
    offer: "winback",
    label: "Bon retour : 20 % de réduction appliquée",
    help: "Appliquée automatiquement au paiement sur Launch, Grow et Scale : 20 % de réduction sur votre premier paiement, mensuel ou annuel, et 100 crédits offerts dès que ce paiement est effectué. Une utilisation par compte.",
    firstMonth: "Votre premier paiement mensuel : {price} au lieu de {regular}.",
    firstYear: "Votre premier paiement annuel : {price} au lieu de {regular}.",
  },
  it: {
    offer: "winback",
    label: "Bentornato: sconto del 20% applicato",
    help: "Applicato automaticamente al pagamento su Launch, Grow e Scale: 20% di sconto sul primo pagamento, mensile o annuale, e 100 crediti extra non appena quel pagamento va a buon fine. Un utilizzo per account.",
    firstMonth: "Il Suo primo pagamento mensile: {price} invece di {regular}.",
    firstYear: "Il Suo primo pagamento annuale: {price} invece di {regular}.",
  },
  de: {
    offer: "winback",
    label: "Willkommen zurück: 20 % Rabatt angewendet",
    help: "Wird beim Bezahlen für Launch, Grow und Scale automatisch angewendet: 20 % Rabatt auf Ihre erste Zahlung, monatlich oder jährlich, und 100 zusätzliche Credits, sobald diese Zahlung eingegangen ist. Einmal pro Konto.",
    firstMonth: "Ihre erste Monatszahlung: {price} statt {regular}.",
    firstYear: "Ihre erste Jahreszahlung: {price} statt {regular}.",
  },
};
