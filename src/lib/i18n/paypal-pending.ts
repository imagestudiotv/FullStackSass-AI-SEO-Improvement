import type { Locale } from "@/lib/i18n/config";

/**
 * The notice for a PayPal payment started and never finished (review H1,
 * 2026-10-20: closing PayPal's tab left the website unable to pay by card or
 * change plan, with no way out). Five languages, formal address. A page
 * hands the notice only its own language's words.
 */
export type PayPalPendingCopy = {
  title: string;
  body: string;
  cancel: string;
  cancelling: string;
  /** Released: the website can pay again. */
  cancelled: string;
  /** PayPal reported it paid after all: the plan is being recorded. */
  paid: string;
  /** PayPal still has it waiting for approval in another way, or did not answer. */
  failed: string;
  /** Beside the buttons, when paying another way was refused because of it (components/paypal-pending-prompt.tsx). */
  promptBody: string;
  /** Cancels it, then carries on with what the customer clicked. */
  cancelAndContinue: string;
};

export const PAYPAL_PENDING_COPY: Record<Locale, PayPalPendingCopy> = {
  en: {
    title: "A PayPal payment was started but not finished",
    body: "Until it is cancelled, this website cannot be paid by card or moved to another plan. If you did approve it in PayPal, wait a minute and refresh this page instead.",
    cancel: "Cancel the PayPal payment",
    cancelling: "Cancelling…",
    cancelled: "Cancelled. You can now pay by card or choose another plan.",
    paid: "PayPal says this payment went through. Your plan is being recorded.",
    failed: "PayPal did not confirm it. Try again in a moment.",
    promptBody: "You started paying for this website with PayPal and did not finish. To pay another way, cancel that PayPal payment first. If you did not approve it, nothing was charged.",
    cancelAndContinue: "Cancel it and continue",
  },
  es: {
    title: "Se inició un pago con PayPal que no se completó",
    body: "Hasta que se cancele, este sitio web no puede pagarse con tarjeta ni cambiar de plan. Si sí lo aprobó en PayPal, espere un minuto y actualice esta página.",
    cancel: "Cancelar el pago con PayPal",
    cancelling: "Cancelando…",
    cancelled: "Cancelado. Ya puede pagar con tarjeta o elegir otro plan.",
    paid: "PayPal indica que este pago se realizó. Estamos registrando su plan.",
    failed: "PayPal no lo confirmó. Inténtelo de nuevo en un momento.",
    promptBody: "Empezó a pagar este sitio web con PayPal y no terminó. Para pagar de otra forma, cancele primero ese pago de PayPal. Si no lo aprobó, no se le ha cobrado nada.",
    cancelAndContinue: "Cancelarlo y continuar",
  },
  fr: {
    title: "Un paiement PayPal a été commencé mais pas terminé",
    body: "Tant qu’il n’est pas annulé, ce site ne peut pas être payé par carte ni changer de forfait. Si vous l’avez bien approuvé dans PayPal, attendez une minute et actualisez plutôt cette page.",
    cancel: "Annuler le paiement PayPal",
    cancelling: "Annulation…",
    cancelled: "Annulé. Vous pouvez maintenant payer par carte ou choisir un autre forfait.",
    paid: "PayPal indique que ce paiement a abouti. Votre forfait est en cours d’enregistrement.",
    failed: "PayPal ne l’a pas confirmé. Réessayez dans un instant.",
    promptBody: "Vous avez commencé à payer ce site avec PayPal sans terminer. Pour payer autrement, annulez d’abord ce paiement PayPal. Si vous ne l’avez pas approuvé, rien n’a été débité.",
    cancelAndContinue: "L’annuler et continuer",
  },
  it: {
    title: "È stato avviato un pagamento PayPal non completato",
    body: "Finché non viene annullato, questo sito web non può essere pagato con carta né cambiare piano. Se lo ha approvato in PayPal, attenda un minuto e aggiorni questa pagina.",
    cancel: "Annulla il pagamento PayPal",
    cancelling: "Annullamento…",
    cancelled: "Annullato. Ora può pagare con carta o scegliere un altro piano.",
    paid: "PayPal indica che il pagamento è andato a buon fine. Stiamo registrando il suo piano.",
    failed: "PayPal non lo ha confermato. Riprovi tra un momento.",
    promptBody: "Ha iniziato a pagare questo sito web con PayPal senza completare il pagamento. Per pagare in un altro modo, annulli prima quel pagamento PayPal. Se non lo ha approvato, non le è stato addebitato nulla.",
    cancelAndContinue: "Annulli e continui",
  },
  de: {
    title: "Eine PayPal-Zahlung wurde begonnen, aber nicht abgeschlossen",
    body: "Solange sie nicht storniert ist, kann diese Website weder per Karte bezahlt noch auf einen anderen Tarif umgestellt werden. Wenn Sie sie in PayPal bestätigt haben, warten Sie eine Minute und laden Sie diese Seite neu.",
    cancel: "PayPal-Zahlung stornieren",
    cancelling: "Wird storniert…",
    cancelled: "Storniert. Sie können jetzt per Karte bezahlen oder einen anderen Tarif wählen.",
    paid: "Laut PayPal ist diese Zahlung eingegangen. Ihr Tarif wird gerade eingetragen.",
    failed: "PayPal hat es nicht bestätigt. Versuchen Sie es gleich noch einmal.",
    promptBody: "Sie haben begonnen, diese Website mit PayPal zu bezahlen, aber nicht abgeschlossen. Um anders zu bezahlen, stornieren Sie zuerst diese PayPal-Zahlung. Wenn Sie sie nicht bestätigt haben, wurde nichts abgebucht.",
    cancelAndContinue: "Stornieren und fortfahren",
  },
};
