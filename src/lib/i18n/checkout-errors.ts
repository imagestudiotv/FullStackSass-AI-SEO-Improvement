import type { Locale } from "@/lib/i18n/config";

/**
 * Why a checkout could not start, in the payer's app language: what card
 * checkout (lib/stripe/actions.ts), PayPal checkout (lib/paypal/actions.ts)
 * and the decision between them (lib/billing/checkouts.ts beginCheckout)
 * return to the plan step and to Billing.
 *
 * Before 2026-11-18 the plan step was in the customer's language and its
 * refusals were English. Five languages, formal address (Lei, Sie, usted,
 * vous); a plan is "piano", "Tarif", "plan", "forfait", a checkout
 * "pagamento", "Bezahlvorgang", "pago", "paiement", as in the rest of the app.
 * The English is word for word what the actions returned before
 * (checkout-errors.test.ts).
 *
 * Translation only: plan names, offer codes and dates are the caller's, so no
 * language can name a different plan, discount or day. A provider's own words
 * are never here: Stripe's and PayPal's failures are logged, and the customer
 * reads `checkoutFailed` (or `stripeUnreachable`).
 *
 * lib/plans/features.ts CONFIRM_EMAIL_FIRST is deliberately not here: the
 * plan step and Billing recognise it by its English value (Billing sends the
 * customer to the email-code box), and the plan step words it itself
 * (plan-step.ts confirmEmailFirst).
 */
export type CheckoutErrorsCopy = {
  websiteNotFound: string;
  paymentsNotConfigured: string;
  planNotFound: string;
  noStripePrice: (plan: string) => string;
  /** lib/billing/repget-offer.ts OFFER_UNAVAILABLE; {code} is REPGET_CODE. */
  offerUnavailable: (code: string) => string;
  /** lib/billing/winback-offer.ts WINBACK_UNAVAILABLE. */
  winbackUnavailable: string;
  /** Our own bookkeeping failed before any provider was asked. */
  checkoutNotStarted: string;
  alreadyOnPlan: (plan: string) => string;
  /** lib/billing/repget-subscription.ts offerForPlanChange's refusal. */
  launchPriceDoesNotCover: (code: string) => string;
  nothingToChange: string;
  /** Stripe failed; what it said is logged, never shown. */
  checkoutFailed: string;
  stripeUnreachable: string;
  payPalUnavailable: string;
  payPalPaused: string;
  planNotOnPayPal: (plan: string) => string;
  winbackNotOnPayPal: (plan: string) => string;
  payPalChangeFailed: string;
  payPalStartFailed: string;
  /** {until} is the period's end, YYYY-MM-DD, or null when unknown. */
  payPalCancelledRuns: (until: string | null) => string;
  billedElsewhere: (provider: "paypal" | "stripe") => string;
  /** {status} is the subscription's status as stored ("past_due"). */
  subscriptionStatus: (status: string) => string;
  paymentBeingRecorded: string;
  checkoutBeingPrepared: string;
  payPalApprovalWaiting: string;
  earlierCheckoutUnconfirmed: string;
  earlierCheckoutStillOpen: string;
  /** {offer} is the offer's code, or null for the welcome-back discount. */
  offerUsed: (offer: string | null) => string;
  offerHeld: (offer: string | null) => string;
};

/** A stored status in words, falling back to the stored words themselves. */
function statusIn(words: Record<string, string>, status: string): string {
  return Object.hasOwn(words, status) ? words[status] : status.replace(/_/g, " ");
}

export const CHECKOUT_ERRORS: Record<Locale, CheckoutErrorsCopy> = {
  en: {
    websiteNotFound: "Website not found",
    paymentsNotConfigured: "Payments are not configured yet.",
    planNotFound: "Plan not found",
    noStripePrice: (plan) => `Plan "${plan}" has no Stripe price configured`,
    offerUnavailable: (code) =>
      `We could not apply the ${code} discount just now, so nothing was started and you have not been charged. Our team has been told. Please try again later.`,
    winbackUnavailable:
      "We could not apply your welcome-back discount just now, so nothing was started and you have not been charged. Our team has been told. Please try again later.",
    checkoutNotStarted: "We could not start the checkout. Please try again.",
    alreadyOnPlan: (plan) => `This website is already on ${plan}.`,
    launchPriceDoesNotCover: (code) =>
      `Your ${code} launch price does not cover this plan, and moving to it would end your discount. Please contact us if you want to change to it.`,
    nothingToChange: "This subscription has nothing to change.",
    checkoutFailed: "Something went wrong starting checkout. Please try again.",
    stripeUnreachable: "Could not reach Stripe. Check your connection and try again.",
    payPalUnavailable: "PayPal is not available yet. Please pay by card.",
    payPalPaused: "Paying with PayPal is paused for now. Please pay by card, or try again later.",
    planNotOnPayPal: (plan) => `"${plan}" is not available through PayPal yet. Please pay by card.`,
    winbackNotOnPayPal: (plan) =>
      `The welcome-back discount is not available with PayPal for "${plan}" yet. Please pay by card to get it.`,
    payPalChangeFailed: "PayPal could not change the plan.",
    payPalStartFailed: "PayPal could not start the subscription.",
    payPalCancelledRuns: (until) =>
      `This website's PayPal subscription is cancelled and its plan runs${until ? ` until ${until}` : ""}. You can choose a plan again, by card or PayPal, once it has ended.`,
    billedElsewhere: (provider) =>
      `This website is already billed by ${provider === "paypal" ? "PayPal" : "card (Stripe)"}. Change its plan there, or cancel that subscription first.`,
    subscriptionStatus: (status) =>
      `This website's subscription is ${statusIn({}, status)}. Settle or cancel it before starting another.`,
    paymentBeingRecorded: "A payment for this website has just gone through and is still being recorded. Refresh in a minute.",
    checkoutBeingPrepared: "A checkout for this website is already being prepared. Try again in a moment.",
    payPalApprovalWaiting:
      "A PayPal approval for this website is still waiting. Finish it in PayPal, or wait until PayPal reports it expired, before choosing another plan or payment method.",
    earlierCheckoutUnconfirmed:
      "We could not confirm whether an earlier checkout for this website can still be paid. Contact support before starting another.",
    earlierCheckoutStillOpen:
      "An earlier checkout for this website is still open and could not be closed. Try again in a few minutes.",
    offerUsed: (offer) => `Your account has already used the ${offer ?? "welcome-back"} discount.`,
    offerHeld: (offer) =>
      `The ${offer ?? "welcome-back"} discount is on another checkout of your account. Finish that one, or try again once it has expired.`,
  },
  es: {
    websiteNotFound: "Sitio web no encontrado",
    paymentsNotConfigured: "Los pagos aún no están configurados.",
    planNotFound: "Plan no encontrado",
    noStripePrice: (plan) => `El plan "${plan}" no tiene un precio de Stripe configurado`,
    offerUnavailable: (code) =>
      `No hemos podido aplicar el descuento ${code} en este momento, así que no se ha iniciado nada y no se le ha cobrado. Nuestro equipo ya está avisado. Inténtelo de nuevo más tarde.`,
    winbackUnavailable:
      "No hemos podido aplicar su descuento «Bienvenido de nuevo» en este momento, así que no se ha iniciado nada y no se le ha cobrado. Nuestro equipo ya está avisado. Inténtelo de nuevo más tarde.",
    checkoutNotStarted: "No se pudo iniciar el pago. Inténtelo de nuevo.",
    alreadyOnPlan: (plan) => `Este sitio web ya tiene el plan ${plan}.`,
    launchPriceDoesNotCover: (code) =>
      `Su precio de lanzamiento ${code} no cubre este plan, y cambiar a él pondría fin a su descuento. Póngase en contacto con nosotros si desea cambiar.`,
    nothingToChange: "No hay nada que cambiar en esta suscripción.",
    checkoutFailed: "Algo ha fallado al iniciar el pago. Inténtelo de nuevo.",
    stripeUnreachable: "No se pudo contactar con Stripe. Compruebe su conexión e inténtelo de nuevo.",
    payPalUnavailable: "PayPal aún no está disponible. Pague con tarjeta.",
    payPalPaused: "El pago con PayPal está en pausa por ahora. Pague con tarjeta o inténtelo de nuevo más tarde.",
    planNotOnPayPal: (plan) => `"${plan}" aún no está disponible con PayPal. Pague con tarjeta.`,
    winbackNotOnPayPal: (plan) =>
      `El descuento «Bienvenido de nuevo» aún no está disponible con PayPal para "${plan}". Pague con tarjeta para obtenerlo.`,
    payPalChangeFailed: "PayPal no pudo cambiar el plan.",
    payPalStartFailed: "PayPal no pudo iniciar la suscripción.",
    payPalCancelledRuns: (until) =>
      `La suscripción de PayPal de este sitio web está cancelada y su plan sigue vigente${until ? ` hasta el ${until}` : ""}. Podrá elegir un plan de nuevo, con tarjeta o PayPal, cuando haya terminado.`,
    billedElsewhere: (provider) =>
      `Este sitio web ya se factura con ${provider === "paypal" ? "PayPal" : "tarjeta (Stripe)"}. Cambie el plan allí o cancele antes esa suscripción.`,
    subscriptionStatus: (status) =>
      `La suscripción de este sitio web está ${statusIn({ past_due: "con el pago vencido", incomplete: "incompleta", unpaid: "impagada", paused: "en pausa", suspended: "suspendida", approval_pending: "pendiente de aprobación" }, status)}. Regularícela o cancélela antes de iniciar otra.`,
    paymentBeingRecorded:
      "Un pago de este sitio web acaba de completarse y todavía se está registrando. Actualice la página dentro de un minuto.",
    checkoutBeingPrepared: "Ya se está preparando un pago para este sitio web. Inténtelo de nuevo en un momento.",
    payPalApprovalWaiting:
      "Una aprobación de PayPal para este sitio web sigue pendiente. Complétela en PayPal o espere a que PayPal indique que ha caducado antes de elegir otro plan u otro método de pago.",
    earlierCheckoutUnconfirmed:
      "No hemos podido confirmar si un pago anterior de este sitio web aún puede completarse. Póngase en contacto con soporte antes de iniciar otro.",
    earlierCheckoutStillOpen:
      "Un pago anterior de este sitio web sigue abierto y no se ha podido cerrar. Inténtelo de nuevo dentro de unos minutos.",
    offerUsed: (offer) => `Su cuenta ya ha usado el descuento ${offer ?? "«Bienvenido de nuevo»"}.`,
    offerHeld: (offer) =>
      `El descuento ${offer ?? "«Bienvenido de nuevo»"} está en otro pago de su cuenta. Termine ese o inténtelo de nuevo cuando haya caducado.`,
  },
  fr: {
    websiteNotFound: "Site web introuvable",
    paymentsNotConfigured: "Les paiements ne sont pas encore configurés.",
    planNotFound: "Forfait introuvable",
    noStripePrice: (plan) => `Le forfait "${plan}" n’a pas de prix Stripe configuré`,
    offerUnavailable: (code) =>
      `Nous n’avons pas pu appliquer la réduction ${code} pour le moment : rien n’a été lancé et vous n’avez pas été débité. Notre équipe a été prévenue. Veuillez réessayer plus tard.`,
    winbackUnavailable:
      "Nous n’avons pas pu appliquer votre réduction « Bon retour » pour le moment : rien n’a été lancé et vous n’avez pas été débité. Notre équipe a été prévenue. Veuillez réessayer plus tard.",
    checkoutNotStarted: "Impossible de lancer le paiement. Veuillez réessayer.",
    alreadyOnPlan: (plan) => `Ce site web est déjà sur le forfait ${plan}.`,
    launchPriceDoesNotCover: (code) =>
      `Votre prix de lancement ${code} ne couvre pas ce forfait, et y passer mettrait fin à votre réduction. Contactez-nous si vous souhaitez changer.`,
    nothingToChange: "Il n’y a rien à modifier dans cet abonnement.",
    checkoutFailed: "Un problème est survenu au lancement du paiement. Veuillez réessayer.",
    stripeUnreachable: "Impossible de joindre Stripe. Vérifiez votre connexion et réessayez.",
    payPalUnavailable: "PayPal n’est pas encore disponible. Veuillez payer par carte.",
    payPalPaused: "Le paiement par PayPal est suspendu pour le moment. Veuillez payer par carte, ou réessayer plus tard.",
    planNotOnPayPal: (plan) => `"${plan}" n’est pas encore disponible via PayPal. Veuillez payer par carte.`,
    winbackNotOnPayPal: (plan) =>
      `La réduction « Bon retour » n’est pas encore disponible avec PayPal pour "${plan}". Veuillez payer par carte pour en bénéficier.`,
    payPalChangeFailed: "PayPal n’a pas pu changer le forfait.",
    payPalStartFailed: "PayPal n’a pas pu lancer l’abonnement.",
    payPalCancelledRuns: (until) =>
      `L’abonnement PayPal de ce site web est résilié et son forfait reste actif${until ? ` jusqu’au ${until}` : ""}. Vous pourrez choisir à nouveau un forfait, par carte ou PayPal, une fois qu’il aura pris fin.`,
    billedElsewhere: (provider) =>
      `Ce site web est déjà facturé par ${provider === "paypal" ? "PayPal" : "carte (Stripe)"}. Changez son forfait là-bas, ou résiliez d’abord cet abonnement.`,
    subscriptionStatus: (status) =>
      `L’abonnement de ce site web est ${statusIn({ past_due: "en retard de paiement", incomplete: "incomplet", unpaid: "impayé", paused: "en pause", suspended: "suspendu", approval_pending: "en attente d’approbation" }, status)}. Régularisez-le ou résiliez-le avant d’en lancer un autre.`,
    paymentBeingRecorded:
      "Un paiement pour ce site web vient d’aboutir et est encore en cours d’enregistrement. Actualisez la page dans une minute.",
    checkoutBeingPrepared: "Un paiement pour ce site web est déjà en préparation. Réessayez dans un instant.",
    payPalApprovalWaiting:
      "Une approbation PayPal pour ce site web est toujours en attente. Terminez-la dans PayPal, ou attendez que PayPal la signale comme expirée, avant de choisir un autre forfait ou moyen de paiement.",
    earlierCheckoutUnconfirmed:
      "Nous n’avons pas pu confirmer si un paiement précédent pour ce site web peut encore être réglé. Contactez le support avant d’en lancer un autre.",
    earlierCheckoutStillOpen:
      "Un paiement précédent pour ce site web est toujours ouvert et n’a pas pu être fermé. Réessayez dans quelques minutes.",
    offerUsed: (offer) => `Votre compte a déjà utilisé la réduction ${offer ?? "« Bon retour »"}.`,
    offerHeld: (offer) =>
      `La réduction ${offer ?? "« Bon retour »"} est sur un autre paiement de votre compte. Terminez celui-ci, ou réessayez une fois qu’il aura expiré.`,
  },
  it: {
    websiteNotFound: "Sito web non trovato",
    paymentsNotConfigured: "I pagamenti non sono ancora configurati.",
    planNotFound: "Piano non trovato",
    noStripePrice: (plan) => `Il piano "${plan}" non ha un prezzo Stripe configurato`,
    offerUnavailable: (code) =>
      `Non è stato possibile applicare lo sconto ${code} in questo momento, quindi non è stato avviato nulla e non le è stato addebitato nulla. Il nostro team è stato avvisato. Riprovi più tardi.`,
    winbackUnavailable:
      "Non è stato possibile applicare il suo sconto di bentornato in questo momento, quindi non è stato avviato nulla e non le è stato addebitato nulla. Il nostro team è stato avvisato. Riprovi più tardi.",
    checkoutNotStarted: "Non è stato possibile avviare il pagamento. Riprovi.",
    alreadyOnPlan: (plan) => `Questo sito web ha già il piano ${plan}.`,
    launchPriceDoesNotCover: (code) =>
      `Il suo prezzo di lancio ${code} non copre questo piano e passarvi farebbe terminare lo sconto. Ci contatti se desidera cambiare piano.`,
    nothingToChange: "Questo abbonamento non ha nulla da modificare.",
    checkoutFailed: "Qualcosa è andato storto durante l’avvio del pagamento. Riprovi.",
    stripeUnreachable: "Non è stato possibile raggiungere Stripe. Controlli la connessione e riprovi.",
    payPalUnavailable: "PayPal non è ancora disponibile. Paghi con carta.",
    payPalPaused: "Il pagamento con PayPal è sospeso per ora. Paghi con carta o riprovi più tardi.",
    planNotOnPayPal: (plan) => `"${plan}" non è ancora disponibile tramite PayPal. Paghi con carta.`,
    winbackNotOnPayPal: (plan) =>
      `Lo sconto di bentornato non è ancora disponibile con PayPal per "${plan}". Paghi con carta per ottenerlo.`,
    payPalChangeFailed: "PayPal non è riuscito a cambiare il piano.",
    payPalStartFailed: "PayPal non è riuscito ad avviare l’abbonamento.",
    payPalCancelledRuns: (until) =>
      `L’abbonamento PayPal di questo sito web è annullato e il suo piano resta attivo${until ? ` fino al ${until}` : ""}. Potrà scegliere di nuovo un piano, con carta o PayPal, quando sarà terminato.`,
    billedElsewhere: (provider) =>
      `Questo sito web è già fatturato tramite ${provider === "paypal" ? "PayPal" : "carta (Stripe)"}. Cambi il piano da lì, oppure annulli prima quell’abbonamento.`,
    subscriptionStatus: (status) =>
      `L’abbonamento di questo sito web è ${statusIn({ past_due: "in ritardo di pagamento", incomplete: "incompleto", unpaid: "non pagato", paused: "in pausa", suspended: "sospeso", approval_pending: "in attesa di approvazione" }, status)}. Lo regolarizzi o lo annulli prima di avviarne un altro.`,
    paymentBeingRecorded:
      "Un pagamento per questo sito web è appena andato a buon fine ed è ancora in fase di registrazione. Aggiorni la pagina tra un minuto.",
    checkoutBeingPrepared: "È già in preparazione un pagamento per questo sito web. Riprovi tra un momento.",
    payPalApprovalWaiting:
      "Un’approvazione PayPal per questo sito web è ancora in attesa. La completi su PayPal, oppure attenda che PayPal la segnali come scaduta, prima di scegliere un altro piano o metodo di pagamento.",
    earlierCheckoutUnconfirmed:
      "Non siamo riusciti a verificare se un pagamento precedente per questo sito web può ancora essere completato. Contatti l’assistenza prima di avviarne un altro.",
    earlierCheckoutStillOpen:
      "Un pagamento precedente per questo sito web è ancora aperto e non è stato possibile chiuderlo. Riprovi tra qualche minuto.",
    offerUsed: (offer) => `Il suo account ha già usato lo sconto ${offer ?? "di bentornato"}.`,
    offerHeld: (offer) =>
      `Lo sconto ${offer ?? "di bentornato"} è su un altro pagamento del suo account. Completi quello, oppure riprovi quando sarà scaduto.`,
  },
  de: {
    websiteNotFound: "Website nicht gefunden",
    paymentsNotConfigured: "Zahlungen sind noch nicht eingerichtet.",
    planNotFound: "Tarif nicht gefunden",
    noStripePrice: (plan) => `Für den Tarif "${plan}" ist kein Stripe-Preis eingerichtet`,
    offerUnavailable: (code) =>
      `Der ${code}-Rabatt konnte gerade nicht angewendet werden. Deshalb wurde nichts gestartet und Ihnen wurde nichts berechnet. Unser Team wurde informiert. Bitte versuchen Sie es später erneut.`,
    winbackUnavailable:
      "Ihr Willkommen-zurück-Rabatt konnte gerade nicht angewendet werden. Deshalb wurde nichts gestartet und Ihnen wurde nichts berechnet. Unser Team wurde informiert. Bitte versuchen Sie es später erneut.",
    checkoutNotStarted: "Der Bezahlvorgang konnte nicht gestartet werden. Bitte versuchen Sie es erneut.",
    alreadyOnPlan: (plan) => `Diese Website hat bereits den Tarif ${plan}.`,
    launchPriceDoesNotCover: (code) =>
      `Ihr ${code}-Einführungspreis gilt nicht für diesen Tarif, und ein Wechsel würde Ihren Rabatt beenden. Bitte kontaktieren Sie uns, wenn Sie wechseln möchten.`,
    nothingToChange: "An diesem Abonnement gibt es nichts zu ändern.",
    checkoutFailed: "Beim Starten des Bezahlvorgangs ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.",
    stripeUnreachable: "Stripe war nicht erreichbar. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
    payPalUnavailable: "PayPal ist noch nicht verfügbar. Bitte zahlen Sie mit Karte.",
    payPalPaused: "Die Zahlung mit PayPal ist vorerst pausiert. Bitte zahlen Sie mit Karte oder versuchen Sie es später erneut.",
    planNotOnPayPal: (plan) => `"${plan}" ist über PayPal noch nicht verfügbar. Bitte zahlen Sie mit Karte.`,
    winbackNotOnPayPal: (plan) =>
      `Der Willkommen-zurück-Rabatt ist mit PayPal für "${plan}" noch nicht verfügbar. Bitte zahlen Sie mit Karte, um ihn zu erhalten.`,
    payPalChangeFailed: "PayPal konnte den Tarif nicht ändern.",
    payPalStartFailed: "PayPal konnte das Abonnement nicht starten.",
    payPalCancelledRuns: (until) =>
      `Das PayPal-Abonnement dieser Website ist gekündigt, und ihr Tarif läuft ${until ? `bis ${until}` : "noch"}. Sie können wieder einen Tarif wählen, per Karte oder PayPal, sobald er abgelaufen ist.`,
    billedElsewhere: (provider) =>
      `Diese Website wird bereits über ${provider === "paypal" ? "PayPal" : "Karte (Stripe)"} abgerechnet. Ändern Sie den Tarif dort, oder kündigen Sie zuerst dieses Abonnement.`,
    subscriptionStatus: (status) =>
      `Das Abonnement dieser Website ist ${statusIn({ past_due: "im Zahlungsverzug", incomplete: "unvollständig", unpaid: "unbezahlt", paused: "pausiert", suspended: "ausgesetzt", approval_pending: "noch nicht freigegeben" }, status)}. Klären oder kündigen Sie es, bevor Sie ein neues starten.`,
    paymentBeingRecorded:
      "Eine Zahlung für diese Website ist gerade eingegangen und wird noch erfasst. Aktualisieren Sie die Seite in einer Minute.",
    checkoutBeingPrepared: "Ein Bezahlvorgang für diese Website wird bereits vorbereitet. Versuchen Sie es gleich noch einmal.",
    payPalApprovalWaiting:
      "Eine PayPal-Freigabe für diese Website steht noch aus. Schließen Sie sie bei PayPal ab, oder warten Sie, bis PayPal sie als abgelaufen meldet, bevor Sie einen anderen Tarif oder eine andere Zahlungsart wählen.",
    earlierCheckoutUnconfirmed:
      "Wir konnten nicht bestätigen, ob ein früherer Bezahlvorgang für diese Website noch bezahlt werden kann. Wenden Sie sich an den Support, bevor Sie einen neuen starten.",
    earlierCheckoutStillOpen:
      "Ein früherer Bezahlvorgang für diese Website ist noch offen und konnte nicht geschlossen werden. Versuchen Sie es in ein paar Minuten erneut.",
    offerUsed: (offer) => `Ihr Konto hat den ${offer ? `${offer}-Rabatt` : "Willkommen-zurück-Rabatt"} bereits genutzt.`,
    offerHeld: (offer) =>
      `Der ${offer ? `${offer}-Rabatt` : "Willkommen-zurück-Rabatt"} ist bereits in einem anderen Bezahlvorgang Ihres Kontos. Schließen Sie diesen ab, oder versuchen Sie es erneut, sobald er abgelaufen ist.`,
  },
};

/** The words for a locale; English for none (lib/billing/provider-locale.ts payerLocale's null). */
export function checkoutErrors(locale: Locale | null | undefined): CheckoutErrorsCopy {
  return (locale && CHECKOUT_ERRORS[locale]) || CHECKOUT_ERRORS.en;
}
