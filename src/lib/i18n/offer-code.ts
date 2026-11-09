import type { Locale } from "@/lib/i18n/config";

/** The REPGET field on the plan screens (lib/billing/repget-offer.ts). */
export type OfferCodeCopy = { label: string; help: string };

export const OFFER_CODE: Record<Locale, OfferCodeCopy> = {
  en: {
    label: "REPGET code",
    help: "Enter REPGET for 40% off your first paid month. On an annual plan, the same amount comes off your first annual payment. Other promotion codes go on the card payment page.",
  },
  es: {
    label: "Código REPGET",
    help: "Introduzca REPGET para obtener un 40 % de descuento en su primer mes de pago. En un plan anual, se descuenta el mismo importe de su primer pago anual. Los demás códigos promocionales se introducen en la página de pago con tarjeta.",
  },
  fr: {
    label: "Code REPGET",
    help: "Saisissez REPGET pour bénéficier de 40 % de réduction sur votre premier mois payant. Avec une formule annuelle, le même montant est déduit de votre premier paiement annuel. Les autres codes promotionnels se saisissent sur la page de paiement par carte.",
  },
  it: {
    label: "Codice REPGET",
    help: "Inserisca REPGET per avere il 40% di sconto sul primo mese a pagamento. Con un piano annuale, lo stesso importo viene scalato dal primo pagamento annuale. Gli altri codici promozionali si inseriscono nella pagina di pagamento con carta.",
  },
  de: {
    label: "REPGET-Code",
    help: "Geben Sie REPGET ein und erhalten Sie 40 % Rabatt auf Ihren ersten bezahlten Monat. Bei einem Jahrestarif wird derselbe Betrag von Ihrer ersten Jahreszahlung abgezogen. Andere Aktionscodes geben Sie auf der Kartenzahlungsseite ein.",
  },
};
