import type { Locale } from "@/lib/i18n/config";

/**
 * PayPal for one-off purchases (reviews P4, P8): the button, and what the
 * customer is told on coming back (app/api/paypal/orders/return). Kept here,
 * beside the other payment wording, rather than in the shared screen copy.
 * Native read pending, as for the rest of the payment copy.
 */
export type PayPalPurchaseCopy = {
  /** The button under a credit pack, or beside "Get Featured"'s card button. */
  payWithPayPal: string;
  /** Captured, but PayPal is still clearing it: nothing granted yet, and nothing to pay again. */
  pending: string;
  /** Declined or refused at PayPal: nothing charged, nothing granted. */
  failed: string;
  /** Under "Get Featured"'s two buttons, in place of its card-only line. */
  secureBoth: string;
};

export const PAYPAL_PURCHASE_COPY: Record<Locale, PayPalPurchaseCopy> = {
  en: {
    payWithPayPal: "Pay with PayPal",
    secureBoth: "Secure payment by Stripe or PayPal. Subject to editorial approval.",
    pending: "PayPal is still processing your payment. Your credits are added as soon as it completes; you do not need to pay again.",
    failed: "PayPal did not complete the payment, so nothing was charged and no credits were added. You can try again or pay by card.",
  },
  es: {
    payWithPayPal: "Pagar con PayPal",
    secureBoth: "Pago seguro con Stripe o PayPal. Sujeto a aprobación editorial.",
    pending: "PayPal todavía está procesando su pago. Sus créditos se añadirán en cuanto se complete; no necesita pagar de nuevo.",
    failed: "PayPal no completó el pago, así que no se ha cobrado nada ni se han añadido créditos. Puede intentarlo de nuevo o pagar con tarjeta.",
  },
  fr: {
    payWithPayPal: "Payer avec PayPal",
    secureBoth: "Paiement sécurisé par Stripe ou PayPal. Sous réserve de validation éditoriale.",
    pending: "PayPal traite encore votre paiement. Vos crédits seront ajoutés dès qu’il sera finalisé ; inutile de payer à nouveau.",
    failed: "PayPal n’a pas finalisé le paiement : rien n’a été débité et aucun crédit n’a été ajouté. Vous pouvez réessayer ou payer par carte.",
  },
  it: {
    payWithPayPal: "Paga con PayPal",
    secureBoth: "Pagamento sicuro con Stripe o PayPal. Soggetto ad approvazione editoriale.",
    pending: "PayPal sta ancora elaborando il pagamento. I crediti verranno aggiunti appena sarà completato: non deve pagare di nuovo.",
    failed: "PayPal non ha completato il pagamento, quindi non è stato addebitato nulla e non sono stati aggiunti crediti. Può riprovare o pagare con carta.",
  },
  de: {
    payWithPayPal: "Mit PayPal bezahlen",
    secureBoth: "Sichere Zahlung über Stripe oder PayPal. Vorbehaltlich redaktioneller Freigabe.",
    pending: "PayPal bearbeitet Ihre Zahlung noch. Ihre Credits werden hinzugefügt, sobald sie abgeschlossen ist; Sie müssen nicht erneut bezahlen.",
    failed: "PayPal hat die Zahlung nicht abgeschlossen. Es wurde nichts abgebucht und es wurden keine Credits hinzugefügt. Sie können es erneut versuchen oder mit Karte bezahlen.",
  },
};
