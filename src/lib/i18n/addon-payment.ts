import type { Locale } from "@/lib/i18n/config";

/** The notification when a delayed payment for credits fails. {name} is the credit pack's. */
export const ADDON_PAYMENT_FAILED: Record<Locale, { title: string; body: string }> = {
  en: { title: "{name} - payment failed", body: "No credits were added. You can buy them again from Billing." },
  es: { title: "{name}: el pago no se ha completado", body: "No se han añadido créditos. Puede comprarlos de nuevo en Facturación." },
  fr: { title: "{name} : le paiement a échoué", body: "Aucun crédit n’a été ajouté. Vous pouvez les racheter depuis la page Facturation." },
  it: { title: "{name}: pagamento non riuscito", body: "Nessun credito è stato aggiunto. Può acquistarli di nuovo dalla pagina Fatturazione." },
  de: { title: "{name}: Zahlung fehlgeschlagen", body: "Es wurden keine Credits hinzugefügt. Sie können sie unter „Abrechnung“ erneut kaufen." },
};
