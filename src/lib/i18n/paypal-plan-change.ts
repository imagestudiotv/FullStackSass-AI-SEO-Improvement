import type { Locale } from "@/lib/i18n/config";

/**
 * A plan change on a PayPal subscription (review P1, lib/paypal/plan-changes.ts):
 * what Billing says while it is under way, and on coming back from PayPal.
 * Kept beside the other payment wording. Native read pending, as for the rest
 * of the payment copy.
 */
export type PayPalPlanChangeCopy = {
  payTitle: (plan: string) => string;
  payBody: (amount: string) => string;
  payButton: string;
  approveTitle: (plan: string) => string;
  approveBody: string;
  approveBodyPaid: string;
  approveButton: string;
  scheduled: (plan: string, date: string) => string;
  refunding: (amount: string) => string;
  result: Record<"completed" | "pending" | "cancelled" | "refunded" | "failed", string>;
};

export const PAYPAL_PLAN_CHANGE_COPY: Record<Locale, PayPalPlanChangeCopy> = {
  en: {
    payTitle: (plan) => `Your change to ${plan} is waiting for payment`,
    payBody: (amount) =>
      `Upgrading through PayPal is paid in two steps: first the difference for the rest of this billing period (${amount}), then you approve the new price on PayPal. Nothing changes until both are done.`,
    payButton: "Pay the difference on PayPal",
    approveTitle: (plan) => `Approve your change to ${plan} on PayPal`,
    approveBody: "PayPal needs your approval for the new price. Your plan changes once you have approved it.",
    approveBodyPaid:
      "The difference is paid. PayPal now needs your approval for the new price, which applies from your next billing date. If it is not approved within 72 hours, the difference is refunded.",
    approveButton: "Approve on PayPal",
    scheduled: (plan, date) => `This website moves to ${plan} on ${date}. Until then it keeps the plan already paid for.`,
    refunding: (amount) => `The plan change was not completed, so the difference (${amount}) is being refunded to your PayPal account.`,
    result: {
      completed: "Your plan has changed.",
      pending: "PayPal is still confirming your plan change. This page updates once it has.",
      cancelled: "The plan change was cancelled. Nothing was charged and your plan is unchanged.",
      refunded: "The plan change was not completed. The difference you paid is refunded to your PayPal account.",
      failed: "PayPal did not complete the plan change. Our team has been told and will contact you.",
    },
  },
  es: {
    payTitle: (plan) => `Su cambio a ${plan} está pendiente de pago`,
    payBody: (amount) =>
      `El cambio a un plan superior con PayPal se paga en dos pasos: primero la diferencia por el resto de este periodo de facturación (${amount}) y después aprueba el nuevo precio en PayPal. No cambia nada hasta completar ambos.`,
    payButton: "Pagar la diferencia en PayPal",
    approveTitle: (plan) => `Apruebe su cambio a ${plan} en PayPal`,
    approveBody: "PayPal necesita su aprobación para el nuevo precio. Su plan cambia en cuanto lo apruebe.",
    approveBodyPaid:
      "La diferencia está pagada. Ahora PayPal necesita su aprobación para el nuevo precio, que se aplica desde su próxima fecha de facturación. Si no se aprueba en 72 horas, se le reembolsa la diferencia.",
    approveButton: "Aprobar en PayPal",
    scheduled: (plan, date) => `Este sitio web pasa a ${plan} el ${date}. Hasta entonces mantiene el plan ya pagado.`,
    refunding: (amount) => `El cambio de plan no se completó, así que se está reembolsando la diferencia (${amount}) a su cuenta de PayPal.`,
    result: {
      completed: "Su plan ha cambiado.",
      pending: "PayPal todavía está confirmando su cambio de plan. Esta página se actualizará en cuanto lo haga.",
      cancelled: "El cambio de plan se canceló. No se ha cobrado nada y su plan no ha cambiado.",
      refunded: "El cambio de plan no se completó. La diferencia que pagó se reembolsa a su cuenta de PayPal.",
      failed: "PayPal no completó el cambio de plan. Nuestro equipo ha sido avisado y se pondrá en contacto con usted.",
    },
  },
  fr: {
    payTitle: (plan) => `Votre passage à ${plan} attend le paiement`,
    payBody: (amount) =>
      `Passer à une formule supérieure avec PayPal se règle en deux étapes : d’abord la différence pour le reste de cette période de facturation (${amount}), puis vous approuvez le nouveau prix sur PayPal. Rien ne change avant la fin des deux étapes.`,
    payButton: "Payer la différence sur PayPal",
    approveTitle: (plan) => `Approuvez votre passage à ${plan} sur PayPal`,
    approveBody: "PayPal a besoin de votre accord pour le nouveau prix. Votre formule change dès que vous l’avez approuvé.",
    approveBodyPaid:
      "La différence est payée. PayPal a maintenant besoin de votre accord pour le nouveau prix, appliqué à partir de votre prochaine date de facturation. Sans approbation sous 72 heures, la différence vous est remboursée.",
    approveButton: "Approuver sur PayPal",
    scheduled: (plan, date) => `Ce site passe à ${plan} le ${date}. D’ici là, il conserve la formule déjà payée.`,
    refunding: (amount) => `Le changement de formule n’a pas abouti : la différence (${amount}) est en cours de remboursement sur votre compte PayPal.`,
    result: {
      completed: "Votre formule a changé.",
      pending: "PayPal confirme encore votre changement de formule. Cette page se mettra à jour dès que ce sera fait.",
      cancelled: "Le changement de formule a été annulé. Rien n’a été débité et votre formule reste la même.",
      refunded: "Le changement de formule n’a pas abouti. La différence payée est remboursée sur votre compte PayPal.",
      failed: "PayPal n’a pas finalisé le changement de formule. Notre équipe a été prévenue et vous contactera.",
    },
  },
  it: {
    payTitle: (plan) => `Il passaggio a ${plan} è in attesa di pagamento`,
    payBody: (amount) =>
      `Il passaggio a un piano superiore con PayPal si paga in due passaggi: prima la differenza per il resto di questo periodo di fatturazione (${amount}), poi approva il nuovo prezzo su PayPal. Non cambia nulla finché entrambi non sono completati.`,
    payButton: "Paga la differenza su PayPal",
    approveTitle: (plan) => `Approvi il passaggio a ${plan} su PayPal`,
    approveBody: "PayPal ha bisogno della sua approvazione per il nuovo prezzo. Il piano cambia appena lo approva.",
    approveBodyPaid:
      "La differenza è pagata. Ora PayPal ha bisogno della sua approvazione per il nuovo prezzo, che si applica dalla prossima data di fatturazione. Se non viene approvato entro 72 ore, la differenza le viene rimborsata.",
    approveButton: "Approva su PayPal",
    scheduled: (plan, date) => `Questo sito passa a ${plan} il ${date}. Fino ad allora mantiene il piano già pagato.`,
    refunding: (amount) => `Il cambio di piano non è stato completato, quindi la differenza (${amount}) viene rimborsata sul suo conto PayPal.`,
    result: {
      completed: "Il suo piano è cambiato.",
      pending: "PayPal sta ancora confermando il cambio di piano. Questa pagina si aggiorna appena è confermato.",
      cancelled: "Il cambio di piano è stato annullato. Non è stato addebitato nulla e il piano resta invariato.",
      refunded: "Il cambio di piano non è stato completato. La differenza pagata viene rimborsata sul suo conto PayPal.",
      failed: "PayPal non ha completato il cambio di piano. Il nostro team è stato avvisato e la contatterà.",
    },
  },
  de: {
    payTitle: (plan) => `Ihr Wechsel zu ${plan} wartet auf die Zahlung`,
    payBody: (amount) =>
      `Ein Upgrade über PayPal wird in zwei Schritten bezahlt: zuerst die Differenz für den Rest dieses Abrechnungszeitraums (${amount}), dann bestätigen Sie den neuen Preis bei PayPal. Bis beides erledigt ist, ändert sich nichts.`,
    payButton: "Differenz mit PayPal bezahlen",
    approveTitle: (plan) => `Bestätigen Sie Ihren Wechsel zu ${plan} bei PayPal`,
    approveBody: "PayPal braucht Ihre Bestätigung für den neuen Preis. Ihr Tarif ändert sich, sobald Sie bestätigt haben.",
    approveBodyPaid:
      "Die Differenz ist bezahlt. Jetzt braucht PayPal Ihre Bestätigung für den neuen Preis, der ab Ihrem nächsten Abrechnungsdatum gilt. Wird er nicht innerhalb von 72 Stunden bestätigt, erstatten wir die Differenz.",
    approveButton: "Bei PayPal bestätigen",
    scheduled: (plan, date) => `Diese Website wechselt am ${date} zu ${plan}. Bis dahin behält sie den bereits bezahlten Tarif.`,
    refunding: (amount) => `Der Tarifwechsel wurde nicht abgeschlossen, daher wird die Differenz (${amount}) auf Ihr PayPal-Konto erstattet.`,
    result: {
      completed: "Ihr Tarif wurde geändert.",
      pending: "PayPal bestätigt Ihren Tarifwechsel noch. Diese Seite aktualisiert sich, sobald das geschehen ist.",
      cancelled: "Der Tarifwechsel wurde abgebrochen. Es wurde nichts abgebucht und Ihr Tarif bleibt unverändert.",
      refunded: "Der Tarifwechsel wurde nicht abgeschlossen. Die bezahlte Differenz wird auf Ihr PayPal-Konto erstattet.",
      failed: "PayPal hat den Tarifwechsel nicht abgeschlossen. Unser Team wurde informiert und meldet sich bei Ihnen.",
    },
  },
};
