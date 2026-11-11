import type { Locale } from "@/lib/i18n/config";

/**
 * The REPGET notice on the plan screens (lib/billing/repget-offer.ts). Since
 * 2026-11-11 the discount is applied automatically, so the screens say it is
 * applied instead of asking for a code. Shown only while the offer is on and
 * the account has not used it.
 *
 * `{price}` and `{regular}` are filled with the first payment and the regular
 * price of the plan on screen.
 */
export type OfferCodeCopy = {
  /** Which discount the words are for: REPGET when absent, or the win-back offer (lib/billing/winback-offer.ts). */
  offer?: "winback";
  label: string;
  help: string;
  firstMonth: string;
  firstYear: string;
};

export const OFFER_CODE: Record<Locale, OfferCodeCopy> = {
  en: {
    label: "REPGET 40% OFF applied",
    help: "Applied automatically at checkout on Launch, Grow and Scale, together with your free trial: 40% off your first monthly payment, or off your first year on a yearly plan. One use per account.",
    firstMonth: "Your first monthly payment: {price} instead of {regular}.",
    firstYear: "Your first yearly payment: {price} instead of {regular}.",
  },
  es: {
    label: "REPGET: 40 % de descuento aplicado",
    help: "Se aplica automáticamente al pagar en Launch, Grow y Scale, junto con su prueba gratuita: un 40 % de descuento en su primer pago mensual o en su primer año con un plan anual. Un uso por cuenta.",
    firstMonth: "Su primer pago mensual: {price} en lugar de {regular}.",
    firstYear: "Su primer pago anual: {price} en lugar de {regular}.",
  },
  fr: {
    label: "REPGET : 40 % de réduction appliquée",
    help: "Appliquée automatiquement au paiement sur Launch, Grow et Scale, avec votre essai gratuit : 40 % de réduction sur votre premier paiement mensuel, ou sur votre première année avec une formule annuelle. Une utilisation par compte.",
    firstMonth: "Votre premier paiement mensuel : {price} au lieu de {regular}.",
    firstYear: "Votre premier paiement annuel : {price} au lieu de {regular}.",
  },
  it: {
    label: "REPGET: sconto del 40% applicato",
    help: "Applicato automaticamente al pagamento su Launch, Grow e Scale, insieme alla prova gratuita: 40% di sconto sul primo pagamento mensile, o sul primo anno con un piano annuale. Un utilizzo per account.",
    firstMonth: "Il suo primo pagamento mensile: {price} invece di {regular}.",
    firstYear: "Il suo primo pagamento annuale: {price} invece di {regular}.",
  },
  de: {
    label: "REPGET: 40 % Rabatt angewendet",
    help: "Wird beim Bezahlen für Launch, Grow und Scale automatisch angewendet, zusammen mit Ihrer kostenlosen Testphase: 40 % Rabatt auf Ihre erste Monatszahlung oder auf Ihr erstes Jahr bei einem Jahrestarif. Einmal pro Konto.",
    firstMonth: "Ihre erste Monatszahlung: {price} statt {regular}.",
    firstYear: "Ihre erste Jahreszahlung: {price} statt {regular}.",
  },
};

/**
 * The win-back notice (lib/billing/winback-offer.ts): shown in its place for an
 * account that was sent the win-back email, has not used it and cannot have
 * REPGET (which is bigger, and wins). The figures are WINBACK_PERCENT_OFF and
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
