import type { Locale } from "@/lib/i18n/config";
import { format, formatNumber } from "@/lib/i18n/format";
import type { QuoteTopUpRefusal } from "@/lib/credits/quote-topup-shared";

/**
 * Credits for a quote (lib/credits/quote-topup.ts): the card at the top of
 * Billing that sells exactly what a website project's quote still needs, and
 * what the quote's page says when the customer comes back from paying.
 *
 * Formal address in every language (usted / vous / Lei / Sie). `{count}`
 * placeholders are filled with the reader's number format.
 */
export type QuoteCreditsCopy = {
  /** "{count} credit|{count} credits", the same words as the Credits screen. */
  credits: string;
  title: string;
  /** "{kind}" is the project's kind, already translated. */
  intro: string;
  required: string;
  balance: string;
  shortfall: string;
  price: string;
  /** "{rate}" per credit; "{pack}" the rate in full ("1,000 credits · €490"). */
  rateNote: string;
  terms: string;
  /** The card button: "{credits}" and "{price}". */
  payByCard: string;
  payWithPayPal: string;
  /** Under the buttons: buying credits never pays the quote. */
  notPaidYet: string;
  backToQuote: string;
  /** The Stripe line item's name: "{credits}". */
  lineItem: string;
  lineItemDescription: string;
  refusal: Record<QuoteTopUpRefusal | "changed" | "provider", string>;
  checkoutFailed: string;
  /** Back on the quote's page after paying. */
  returned: {
    paidTitle: string;
    paidBody: string;
    pendingTitle: string;
    pendingBody: string;
    failedTitle: string;
    failedBody: string;
  };
};

const en: QuoteCreditsCopy = {
  credits: "{count} credit|{count} credits",
  title: "Credits for your quote",
  intro: "Your {kind} quote is ready. Buy exactly the credits you are missing, then confirm the quote.",
  required: "Quote price",
  balance: "Your balance",
  shortfall: "You need",
  price: "Price",
  rateNote: "{rate} per credit ({pack}).",
  terms: "One-time payment. Credits never expire.",
  payByCard: "Buy {credits} for {price}",
  payWithPayPal: "Pay with PayPal",
  notPaidYet: "Buying credits does not pay the quote. Once the payment is confirmed, you go back to the quote and choose “Accept and pay”.",
  backToQuote: "Back to the quote",
  lineItem: "{credits} RepGet credits",
  lineItemDescription: "Credits for your website project quote. Credits never expire.",
  refusal: {
    unavailable: "This quote cannot be paid now. It may already be paid, declined or withdrawn.",
    stale: "This quote has changed since you opened it. Open it again to see the current price.",
    covered: "You already have enough credits for this quote. Go back to it and choose “Accept and pay”.",
    no_rate: "Credits cannot be bought right now. Please try again later.",
    out_of_bounds: "This amount cannot be paid in a single payment. Please contact us.",
    changed: "Your balance or the price has changed. The page has been updated: please check the new amount.",
    provider: "This payment method is not available right now. Please try again later or choose another one.",
  },
  checkoutFailed: "We could not start the payment. Please try again.",
  returned: {
    paidTitle: "{credits} added",
    paidBody: "Your quote is not paid yet: check it below and choose “Accept and pay”.",
    pendingTitle: "Confirming your payment",
    pendingBody: "Your credits appear here as soon as the payment is confirmed. With some payment methods this can take a few days; you do not need to pay again.",
    failedTitle: "The payment did not go through",
    failedBody: "No credits were added. You can try again from the quote.",
  },
};

const es: QuoteCreditsCopy = {
  credits: "{count} crédito|{count} créditos",
  title: "Créditos para su presupuesto",
  intro: "Su presupuesto de {kind} está listo. Compre exactamente los créditos que le faltan y después confirme el presupuesto.",
  required: "Precio del presupuesto",
  balance: "Su saldo",
  shortfall: "Le faltan",
  price: "Precio",
  rateNote: "{rate} por crédito ({pack}).",
  terms: "Pago único. Los créditos no caducan.",
  payByCard: "Comprar {credits} por {price}",
  payWithPayPal: "Pagar con PayPal",
  notPaidYet: "Comprar créditos no paga el presupuesto. Cuando se confirme el pago, vuelva al presupuesto y elija «Aceptar y pagar».",
  backToQuote: "Volver al presupuesto",
  lineItem: "{credits} créditos de RepGet",
  lineItemDescription: "Créditos para el presupuesto de su proyecto web. Los créditos no caducan.",
  refusal: {
    unavailable: "Este presupuesto no se puede pagar ahora. Puede que ya esté pagado, rechazado o retirado.",
    stale: "Este presupuesto ha cambiado desde que lo abrió. Ábralo de nuevo para ver el precio actual.",
    covered: "Ya tiene créditos suficientes para este presupuesto. Vuelva a él y elija «Aceptar y pagar».",
    no_rate: "Ahora mismo no se pueden comprar créditos. Inténtelo de nuevo más tarde.",
    out_of_bounds: "Este importe no se puede pagar en un solo pago. Póngase en contacto con nosotros.",
    changed: "Su saldo o el precio han cambiado. La página se ha actualizado: compruebe el nuevo importe.",
    provider: "Este método de pago no está disponible ahora. Inténtelo más tarde o elija otro.",
  },
  checkoutFailed: "No hemos podido iniciar el pago. Inténtelo de nuevo.",
  returned: {
    paidTitle: "{credits} añadidos",
    paidBody: "Su presupuesto todavía no está pagado: revíselo abajo y elija «Aceptar y pagar».",
    pendingTitle: "Confirmando su pago",
    pendingBody: "Sus créditos aparecerán aquí en cuanto se confirme el pago. Con algunos métodos de pago puede tardar unos días; no necesita pagar de nuevo.",
    failedTitle: "El pago no se ha completado",
    failedBody: "No se han añadido créditos. Puede intentarlo de nuevo desde el presupuesto.",
  },
};

const fr: QuoteCreditsCopy = {
  credits: "{count} crédit|{count} crédits",
  title: "Crédits pour votre devis",
  intro: "Votre devis « {kind} » est prêt. Achetez exactement les crédits qui vous manquent, puis confirmez le devis.",
  required: "Prix du devis",
  balance: "Votre solde",
  shortfall: "Il vous manque",
  price: "Prix",
  rateNote: "{rate} par crédit ({pack}).",
  terms: "Paiement unique. Les crédits n’expirent jamais.",
  payByCard: "Acheter {credits} pour {price}",
  payWithPayPal: "Payer avec PayPal",
  notPaidYet: "Acheter des crédits ne règle pas le devis. Une fois le paiement confirmé, revenez au devis et choisissez « Accepter et payer ».",
  backToQuote: "Retour au devis",
  lineItem: "{credits} crédits RepGet",
  lineItemDescription: "Crédits pour le devis de votre projet de site web. Les crédits n’expirent jamais.",
  refusal: {
    unavailable: "Ce devis ne peut pas être réglé maintenant. Il a peut-être déjà été payé, refusé ou retiré.",
    stale: "Ce devis a changé depuis que vous l’avez ouvert. Ouvrez-le à nouveau pour voir le prix actuel.",
    covered: "Vous avez déjà assez de crédits pour ce devis. Revenez-y et choisissez « Accepter et payer ».",
    no_rate: "Les crédits ne peuvent pas être achetés pour le moment. Veuillez réessayer plus tard.",
    out_of_bounds: "Ce montant ne peut pas être réglé en un seul paiement. Veuillez nous contacter.",
    changed: "Votre solde ou le prix a changé. La page a été mise à jour : veuillez vérifier le nouveau montant.",
    provider: "Ce moyen de paiement n’est pas disponible pour le moment. Veuillez réessayer plus tard ou en choisir un autre.",
  },
  checkoutFailed: "Nous n’avons pas pu lancer le paiement. Veuillez réessayer.",
  returned: {
    paidTitle: "{credits} ajoutés",
    paidBody: "Votre devis n’est pas encore réglé : vérifiez-le ci-dessous et choisissez « Accepter et payer ».",
    pendingTitle: "Confirmation de votre paiement",
    pendingBody: "Vos crédits apparaîtront ici dès que le paiement sera confirmé. Avec certains moyens de paiement, cela peut prendre quelques jours ; inutile de payer à nouveau.",
    failedTitle: "Le paiement n’a pas abouti",
    failedBody: "Aucun crédit n’a été ajouté. Vous pouvez réessayer depuis le devis.",
  },
};

const it: QuoteCreditsCopy = {
  credits: "{count} credito|{count} crediti",
  title: "Crediti per il Suo preventivo",
  intro: "Il Suo preventivo per «{kind}» è pronto. Acquisti esattamente i crediti che Le mancano, poi confermi il preventivo.",
  required: "Prezzo del preventivo",
  balance: "Il Suo saldo",
  shortfall: "Le mancano",
  price: "Prezzo",
  rateNote: "{rate} per credito ({pack}).",
  terms: "Pagamento unico. I crediti non scadono.",
  payByCard: "Acquista {credits} a {price}",
  payWithPayPal: "Paga con PayPal",
  notPaidYet: "Acquistare crediti non paga il preventivo. Una volta confermato il pagamento, torni al preventivo e scelga «Accetta e paga».",
  backToQuote: "Torna al preventivo",
  lineItem: "{credits} crediti RepGet",
  lineItemDescription: "Crediti per il preventivo del Suo progetto web. I crediti non scadono.",
  refusal: {
    unavailable: "Questo preventivo non può essere pagato ora. Potrebbe essere già pagato, rifiutato o ritirato.",
    stale: "Questo preventivo è cambiato da quando lo ha aperto. Lo apra di nuovo per vedere il prezzo attuale.",
    covered: "Ha già crediti sufficienti per questo preventivo. Torni al preventivo e scelga «Accetta e paga».",
    no_rate: "Al momento non è possibile acquistare crediti. Riprovi più tardi.",
    out_of_bounds: "Questo importo non può essere pagato con un unico pagamento. La preghiamo di contattarci.",
    changed: "Il Suo saldo o il prezzo sono cambiati. La pagina è stata aggiornata: controlli il nuovo importo.",
    provider: "Questo metodo di pagamento non è disponibile al momento. Riprovi più tardi o ne scelga un altro.",
  },
  checkoutFailed: "Non è stato possibile avviare il pagamento. Riprovi.",
  returned: {
    paidTitle: "{credits} aggiunti",
    paidBody: "Il Suo preventivo non è ancora pagato: lo controlli qui sotto e scelga «Accetta e paga».",
    pendingTitle: "Conferma del pagamento in corso",
    pendingBody: "I Suoi crediti compariranno qui non appena il pagamento sarà confermato. Con alcuni metodi di pagamento possono servire alcuni giorni; non deve pagare di nuovo.",
    failedTitle: "Il pagamento non è andato a buon fine",
    failedBody: "Non sono stati aggiunti crediti. Può riprovare dal preventivo.",
  },
};

const de: QuoteCreditsCopy = {
  credits: "{count} Credit|{count} Credits",
  title: "Credits für Ihr Angebot",
  intro: "Ihr Angebot für „{kind}“ ist fertig. Kaufen Sie genau die Credits, die Ihnen fehlen, und bestätigen Sie dann das Angebot.",
  required: "Angebotspreis",
  balance: "Ihr Guthaben",
  shortfall: "Es fehlen",
  price: "Preis",
  rateNote: "{rate} pro Credit ({pack}).",
  terms: "Einmalige Zahlung. Credits verfallen nicht.",
  payByCard: "{credits} für {price} kaufen",
  payWithPayPal: "Mit PayPal bezahlen",
  notPaidYet: "Der Kauf von Credits bezahlt das Angebot nicht. Sobald die Zahlung bestätigt ist, kehren Sie zum Angebot zurück und wählen „Annehmen und bezahlen“.",
  backToQuote: "Zurück zum Angebot",
  lineItem: "{credits} RepGet-Credits",
  lineItemDescription: "Credits für das Angebot Ihres Website-Projekts. Credits verfallen nicht.",
  refusal: {
    unavailable: "Dieses Angebot kann jetzt nicht bezahlt werden. Es wurde möglicherweise bereits bezahlt, abgelehnt oder zurückgezogen.",
    stale: "Dieses Angebot hat sich geändert, seit Sie es geöffnet haben. Öffnen Sie es erneut, um den aktuellen Preis zu sehen.",
    covered: "Sie haben bereits genug Credits für dieses Angebot. Kehren Sie zum Angebot zurück und wählen Sie „Annehmen und bezahlen“.",
    no_rate: "Credits können gerade nicht gekauft werden. Bitte versuchen Sie es später erneut.",
    out_of_bounds: "Dieser Betrag kann nicht in einer einzigen Zahlung bezahlt werden. Bitte kontaktieren Sie uns.",
    changed: "Ihr Guthaben oder der Preis hat sich geändert. Die Seite wurde aktualisiert: Bitte prüfen Sie den neuen Betrag.",
    provider: "Diese Zahlungsart ist gerade nicht verfügbar. Bitte versuchen Sie es später erneut oder wählen Sie eine andere.",
  },
  checkoutFailed: "Die Zahlung konnte nicht gestartet werden. Bitte versuchen Sie es erneut.",
  returned: {
    paidTitle: "{credits} gutgeschrieben",
    paidBody: "Ihr Angebot ist noch nicht bezahlt: Prüfen Sie es unten und wählen Sie „Annehmen und bezahlen“.",
    pendingTitle: "Ihre Zahlung wird bestätigt",
    pendingBody: "Ihre Credits erscheinen hier, sobald die Zahlung bestätigt ist. Bei manchen Zahlungsarten kann das einige Tage dauern; Sie müssen nicht erneut bezahlen.",
    failedTitle: "Die Zahlung ist nicht durchgegangen",
    failedBody: "Es wurden keine Credits gutgeschrieben. Sie können es über das Angebot erneut versuchen.",
  },
};

export const QUOTE_CREDITS_COPY: Record<Locale, QuoteCreditsCopy> = { en, es, fr, it, de };

/** "1,000 credits" in the reader's number format and plural. */
export function creditsIn(copy: Pick<QuoteCreditsCopy, "credits">, count: number, locale: Locale): string {
  const [one = "", many = ""] = copy.credits.split("|");
  return format(count === 1 ? one : many, { count: formatNumber(count, locale) });
}
