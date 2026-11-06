import type { Locale } from "@/lib/i18n/config";

/** The REPGET field on the plan screens (lib/billing/repget-offer.ts). */
export type OfferCodeCopy = { label: string; help: string; cardOnly: string };

export const OFFER_CODE: Record<Locale, OfferCodeCopy> = {
  en: {
    label: "REPGET code",
    help: "Enter REPGET for 40% off your first paid month on a monthly plan. Other promotion codes go on the card payment page.",
    cardOnly: "The REPGET code works with card payments only.",
  },
  es: {
    label: "Código REPGET",
    help: "Introduzca REPGET para obtener un 40 % de descuento en su primer mes de pago en un plan mensual. Los demás códigos promocionales se introducen en la página de pago con tarjeta.",
    cardOnly: "El código REPGET solo funciona con pagos con tarjeta.",
  },
  fr: {
    label: "Code REPGET",
    help: "Saisissez REPGET pour bénéficier de 40 % de réduction sur votre premier mois payant avec une formule mensuelle. Les autres codes promotionnels se saisissent sur la page de paiement par carte.",
    cardOnly: "Le code REPGET ne fonctionne qu’avec un paiement par carte.",
  },
  it: {
    label: "Codice REPGET",
    help: "Inserisca REPGET per avere il 40% di sconto sul primo mese a pagamento di un piano mensile. Gli altri codici promozionali si inseriscono nella pagina di pagamento con carta.",
    cardOnly: "Il codice REPGET funziona solo con i pagamenti con carta.",
  },
  de: {
    label: "REPGET-Code",
    help: "Geben Sie REPGET ein und erhalten Sie 40 % Rabatt auf Ihren ersten bezahlten Monat bei einem Monatstarif. Andere Aktionscodes geben Sie auf der Kartenzahlungsseite ein.",
    cardOnly: "Der REPGET-Code gilt nur für Kartenzahlungen.",
  },
};
