import type { Locale } from "@/lib/i18n/config";

/**
 * The plan step for a plan bought outright (the Grow + Visibility bundle,
 * lib/plans/features.ts DIRECT_PURCHASE_TIERS): no free trial, the first
 * payment taken at checkout. `{price}` is the plan's monthly price.
 */
export type DirectPurchaseCopy = {
  badge: string;
  button: string;
  note: string;
};

export const DIRECT_PURCHASE: Record<Locale, DirectPurchaseCopy> = {
  en: {
    badge: "Direct purchase",
    button: "Continue to payment",
    note: "{price} billed at checkout, then monthly. The 3-day free trial does not apply to this offer.",
  },
  es: {
    badge: "Compra directa",
    button: "Continuar al pago",
    note: "Se cobran {price} al pagar y después cada mes. La prueba gratuita de 3 días no se aplica a esta oferta.",
  },
  fr: {
    badge: "Achat direct",
    button: "Continuer vers le paiement",
    note: "{price} facturés au paiement, puis chaque mois. L'essai gratuit de 3 jours ne s'applique pas à cette offre.",
  },
  it: {
    badge: "Acquisto diretto",
    button: "Continua al pagamento",
    note: "{price} addebitati al pagamento, poi ogni mese. La prova gratuita di 3 giorni non si applica a questa offerta.",
  },
  de: {
    badge: "Direktkauf",
    button: "Weiter zur Zahlung",
    note: "{price} werden beim Bezahlen berechnet, danach monatlich. Die 3-tägige kostenlose Testphase gilt für dieses Angebot nicht.",
  },
};
