import type { Locale } from "@/lib/i18n/config";

/**
 * The onboarding plan step's own words (app/(site)/(onboarding)/onboarding/
 * plan/plan-step.tsx): the badges, the price line, the yearly switch, the
 * email code, the buttons and the free trial's terms. Five languages, formal
 * address (Lei, Sie, usted, vous).
 *
 * Translation only: every number is the caller's - prices from formatPrice
 * (always en-IE, "€59"), the trial's days from TRIAL_DAYS, the yearly saving
 * worked out by the step - so no language can state a different amount,
 * length or condition from the English. The prices are the charged ones; no
 * line quotes a percentage off them (conservative copy, 2026-11-18).
 */
export type PlanStepCopy = {
  /** Toast: Better Auth refused to send the code. */
  sendCodeFailed: string;
  /** Toast: the code was sent to this address. */
  codeSent: (email: string) => string;
  emailConfirmed: string;
  codeInvalid: string;
  /** Expired, or too many attempts. */
  codeExpired: string;
  codeCheckFailed: string;
  /** lib/plans/features.ts CONFIRM_EMAIL_FIRST, as checkout returns it, in the reader's language. */
  confirmEmailFirst: string;
  /** A plan's one line when the server passes none. */
  defaultDescription: string;
  /** The badge on Grow. */
  badgePopular: string;
  /** The badge on Scale. */
  badgeBestValue: string;
  /** "Step" in "Step 02 / 05". */
  step: string;
  /** The tier switcher's accessible name. */
  planLabel: string;
  /** The card's heading and accessible name: "Grow plan". */
  planName: (name: string) => string;
  /** Beside the large price. */
  perMonth: string;
  /** Beside "Pay yearly": the real saving, in percent. */
  save: (pct: number) => string;
  billedAnnually: string;
  billedMonthly: string;
  /** The email code box's heading. */
  confirmEmailTitle: (days: number) => string;
  codePlaceholder: string;
  codeLabel: string;
  confirm: string;
  sentTo: (email: string) => string;
  sendNewCode: string;
  emailMeCode: string;
  weSendItTo: (email: string) => string;
  startingCheckout: string;
  startTrial: string;
  continueToPayment: string;
  /** "€0 today · 3 days free." */
  trialToday: (zero: string, days: number) => string;
  thenYear: (price: string) => string;
  thenMonth: (price: string) => string;
  /** No trial left: charged at once. */
  chargedTodayMonth: (price: string) => string;
  chargedTodayYear: (price: string) => string;
  redirectingPayPal: string;
  payWithPayPal: string;
};

export const PLAN_STEP_COPY: Record<Locale, PlanStepCopy> = {
  en: {
    sendCodeFailed: "We could not send the code. Please try again in a minute.",
    codeSent: (email) => `We sent a 6-digit code to ${email}.`,
    emailConfirmed: "Email confirmed.",
    codeInvalid: "That code is not right. Check the email and try again.",
    codeExpired: "That code no longer works. Send a new one.",
    codeCheckFailed: "We could not check the code. Please try again.",
    confirmEmailFirst: "Confirm your email address first - your free trial is given to it.",
    defaultDescription: "Everything you need to grow organic traffic from Google and AI search, on autopilot.",
    badgePopular: "Most popular plan",
    badgeBestValue: "Best value",
    step: "Step",
    planLabel: "Plan",
    planName: (name) => `${name} plan`,
    perMonth: "/month",
    save: (pct) => `save ${pct}%`,
    billedAnnually: "Billed annually",
    billedMonthly: "Billed monthly",
    confirmEmailTitle: (days) => `Confirm your email to start your ${days}-day free trial`,
    codePlaceholder: "6-digit code",
    codeLabel: "Confirmation code",
    confirm: "Confirm",
    sentTo: (email) => `Sent to ${email}.`,
    sendNewCode: "Send a new code",
    emailMeCode: "Email me a code",
    weSendItTo: (email) => `We send it to ${email}.`,
    startingCheckout: "Starting checkout…",
    startTrial: "Start free trial",
    continueToPayment: "Continue to payment",
    trialToday: (zero, days) => `${zero} today · ${days} days free.`,
    thenYear: (price) => `Then ${price}/year, unless you cancel before the trial ends.`,
    thenMonth: (price) => `Then ${price}/month, unless you cancel before the trial ends.`,
    chargedTodayMonth: (price) => `${price} a month, charged today. This workspace has already had its free trial.`,
    chargedTodayYear: (price) => `${price} a year, charged today. This workspace has already had its free trial.`,
    redirectingPayPal: "Redirecting to PayPal…",
    payWithPayPal: "Pay with PayPal",
  },
  es: {
    sendCodeFailed: "No hemos podido enviar el código. Inténtelo de nuevo dentro de un minuto.",
    codeSent: (email) => `Hemos enviado un código de 6 dígitos a ${email}.`,
    emailConfirmed: "Correo confirmado.",
    codeInvalid: "Ese código no es correcto. Revise el correo e inténtelo de nuevo.",
    codeExpired: "Ese código ya no es válido. Solicite uno nuevo.",
    codeCheckFailed: "No hemos podido comprobar el código. Inténtelo de nuevo.",
    confirmEmailFirst: "Confirme primero su dirección de correo: su prueba gratuita se asocia a ella.",
    defaultDescription:
      "Todo lo que necesita para aumentar el tráfico orgánico desde Google y la búsqueda con IA, en piloto automático.",
    badgePopular: "El plan más popular",
    badgeBestValue: "La mejor relación calidad-precio",
    step: "Paso",
    planLabel: "Plan",
    planName: (name) => `Plan ${name}`,
    perMonth: "/mes",
    save: (pct) => `ahorre un ${pct} %`,
    billedAnnually: "Facturación anual",
    billedMonthly: "Facturación mensual",
    confirmEmailTitle: (days) => `Confirme su correo para empezar su prueba gratuita de ${days} días`,
    codePlaceholder: "Código de 6 dígitos",
    codeLabel: "Código de confirmación",
    confirm: "Confirmar",
    sentTo: (email) => `Enviado a ${email}.`,
    sendNewCode: "Enviar un código nuevo",
    emailMeCode: "Envíenme un código por correo",
    weSendItTo: (email) => `Se lo enviamos a ${email}.`,
    startingCheckout: "Iniciando el pago…",
    startTrial: "Empezar la prueba gratuita",
    continueToPayment: "Continuar al pago",
    trialToday: (zero, days) => `${zero} hoy · ${days} días gratis.`,
    thenYear: (price) => `Después, ${price}/año, salvo que cancele antes de que termine la prueba.`,
    thenMonth: (price) => `Después, ${price}/mes, salvo que cancele antes de que termine la prueba.`,
    chargedTodayMonth: (price) =>
      `${price} al mes, cobrados hoy. Este espacio de trabajo ya ha tenido su prueba gratuita.`,
    chargedTodayYear: (price) =>
      `${price} al año, cobrados hoy. Este espacio de trabajo ya ha tenido su prueba gratuita.`,
    redirectingPayPal: "Redirigiendo a PayPal…",
    payWithPayPal: "Pagar con PayPal",
  },
  fr: {
    sendCodeFailed: "Nous n’avons pas pu envoyer le code. Réessayez dans une minute.",
    codeSent: (email) => `Nous avons envoyé un code à 6 chiffres à ${email}.`,
    emailConfirmed: "Adresse e-mail confirmée.",
    codeInvalid: "Ce code est incorrect. Vérifiez l’e-mail et réessayez.",
    codeExpired: "Ce code n’est plus valable. Demandez-en un nouveau.",
    codeCheckFailed: "Nous n’avons pas pu vérifier le code. Réessayez.",
    confirmEmailFirst: "Confirmez d’abord votre adresse e-mail : votre essai gratuit lui est attribué.",
    defaultDescription:
      "Tout ce qu’il vous faut pour développer votre trafic organique depuis Google et la recherche IA, en pilote automatique.",
    badgePopular: "Le forfait le plus choisi",
    badgeBestValue: "Le meilleur rapport qualité-prix",
    step: "Étape",
    planLabel: "Forfait",
    planName: (name) => `Forfait ${name}`,
    perMonth: "/mois",
    save: (pct) => `économisez ${pct} %`,
    billedAnnually: "Facturé chaque année",
    billedMonthly: "Facturé chaque mois",
    confirmEmailTitle: (days) => `Confirmez votre adresse e-mail pour commencer votre essai gratuit de ${days} jours`,
    codePlaceholder: "Code à 6 chiffres",
    codeLabel: "Code de confirmation",
    confirm: "Confirmer",
    sentTo: (email) => `Envoyé à ${email}.`,
    sendNewCode: "Envoyer un nouveau code",
    emailMeCode: "Envoyez-moi un code par e-mail",
    weSendItTo: (email) => `Nous l’envoyons à ${email}.`,
    startingCheckout: "Lancement du paiement…",
    startTrial: "Commencer l’essai gratuit",
    continueToPayment: "Continuer vers le paiement",
    trialToday: (zero, days) => `${zero} aujourd’hui · ${days} jours gratuits.`,
    thenYear: (price) => `Ensuite ${price}/an, sauf si vous résiliez avant la fin de l’essai.`,
    thenMonth: (price) => `Ensuite ${price}/mois, sauf si vous résiliez avant la fin de l’essai.`,
    chargedTodayMonth: (price) =>
      `${price} par mois, facturés aujourd’hui. Cet espace de travail a déjà bénéficié de son essai gratuit.`,
    chargedTodayYear: (price) =>
      `${price} par an, facturés aujourd’hui. Cet espace de travail a déjà bénéficié de son essai gratuit.`,
    redirectingPayPal: "Redirection vers PayPal…",
    payWithPayPal: "Payer avec PayPal",
  },
  it: {
    sendCodeFailed: "Non siamo riusciti a inviare il codice. Riprovi tra un minuto.",
    codeSent: (email) => `Abbiamo inviato un codice di 6 cifre a ${email}.`,
    emailConfirmed: "E-mail confermata.",
    codeInvalid: "Il codice non è corretto. Controlli l’e-mail e riprovi.",
    codeExpired: "Il codice non è più valido. Ne richieda uno nuovo.",
    codeCheckFailed: "Non siamo riusciti a verificare il codice. Riprovi.",
    confirmEmailFirst: "Confermi prima il suo indirizzo e-mail: la prova gratuita viene assegnata a quell’indirizzo.",
    defaultDescription:
      "Tutto ciò che le serve per far crescere il traffico organico da Google e dalla ricerca con IA, in automatico.",
    badgePopular: "Il piano più scelto",
    badgeBestValue: "Il miglior rapporto qualità-prezzo",
    step: "Passo",
    planLabel: "Piano",
    planName: (name) => `Piano ${name}`,
    perMonth: "/mese",
    save: (pct) => `risparmi il ${pct}%`,
    billedAnnually: "Fatturazione annuale",
    billedMonthly: "Fatturazione mensile",
    confirmEmailTitle: (days) => `Confermi la sua e-mail per iniziare la prova gratuita di ${days} giorni`,
    codePlaceholder: "Codice di 6 cifre",
    codeLabel: "Codice di conferma",
    confirm: "Conferma",
    sentTo: (email) => `Inviato a ${email}.`,
    sendNewCode: "Invia un nuovo codice",
    emailMeCode: "Inviatemi un codice via e-mail",
    weSendItTo: (email) => `Lo inviamo a ${email}.`,
    startingCheckout: "Avvio del pagamento…",
    startTrial: "Inizi la prova gratuita",
    continueToPayment: "Continua al pagamento",
    trialToday: (zero, days) => `${zero} oggi · ${days} giorni gratis.`,
    thenYear: (price) => `Poi ${price}/anno, a meno che non disdica prima della fine della prova.`,
    thenMonth: (price) => `Poi ${price}/mese, a meno che non disdica prima della fine della prova.`,
    chargedTodayMonth: (price) =>
      `${price} al mese, addebitati oggi. Questo spazio di lavoro ha già usufruito della prova gratuita.`,
    chargedTodayYear: (price) =>
      `${price} all’anno, addebitati oggi. Questo spazio di lavoro ha già usufruito della prova gratuita.`,
    redirectingPayPal: "Reindirizzamento a PayPal…",
    payWithPayPal: "Paga con PayPal",
  },
  de: {
    sendCodeFailed: "Der Code konnte nicht gesendet werden. Bitte versuchen Sie es in einer Minute erneut.",
    codeSent: (email) => `Wir haben einen 6-stelligen Code an ${email} gesendet.`,
    emailConfirmed: "E-Mail-Adresse bestätigt.",
    codeInvalid: "Der Code ist nicht richtig. Prüfen Sie die E-Mail und versuchen Sie es erneut.",
    codeExpired: "Der Code ist nicht mehr gültig. Fordern Sie einen neuen an.",
    codeCheckFailed: "Der Code konnte nicht geprüft werden. Bitte versuchen Sie es erneut.",
    confirmEmailFirst:
      "Bestätigen Sie zuerst Ihre E-Mail-Adresse – Ihre kostenlose Testphase wird an diese Adresse vergeben.",
    defaultDescription:
      "Alles, was Sie brauchen, um organischen Traffic aus Google und der KI-Suche zu steigern – automatisch.",
    badgePopular: "Beliebtester Tarif",
    badgeBestValue: "Bestes Preis-Leistungs-Verhältnis",
    step: "Schritt",
    planLabel: "Tarif",
    planName: (name) => `Tarif ${name}`,
    perMonth: "/Monat",
    save: (pct) => `${pct} % sparen`,
    billedAnnually: "Jährliche Abrechnung",
    billedMonthly: "Monatliche Abrechnung",
    confirmEmailTitle: (days) =>
      `Bestätigen Sie Ihre E-Mail-Adresse, um Ihre ${days}-tägige kostenlose Testphase zu starten`,
    codePlaceholder: "6-stelliger Code",
    codeLabel: "Bestätigungscode",
    confirm: "Bestätigen",
    sentTo: (email) => `Gesendet an ${email}.`,
    sendNewCode: "Neuen Code senden",
    emailMeCode: "Code per E-Mail senden",
    weSendItTo: (email) => `Wir senden ihn an ${email}.`,
    startingCheckout: "Bezahlvorgang wird gestartet…",
    startTrial: "Kostenlose Testphase starten",
    continueToPayment: "Weiter zur Zahlung",
    trialToday: (zero, days) => `${zero} heute · ${days} Tage kostenlos.`,
    thenYear: (price) => `Danach ${price}/Jahr, sofern Sie nicht vor dem Ende der Testphase kündigen.`,
    thenMonth: (price) => `Danach ${price}/Monat, sofern Sie nicht vor dem Ende der Testphase kündigen.`,
    chargedTodayMonth: (price) =>
      `${price} pro Monat, heute berechnet. Dieser Arbeitsbereich hatte seine kostenlose Testphase bereits.`,
    chargedTodayYear: (price) =>
      `${price} pro Jahr, heute berechnet. Dieser Arbeitsbereich hatte seine kostenlose Testphase bereits.`,
    redirectingPayPal: "Weiterleitung zu PayPal…",
    payWithPayPal: "Mit PayPal bezahlen",
  },
};

/** The plan step's words for a locale, English for anything unknown. */
export function planStepCopy(locale: Locale): PlanStepCopy {
  return PLAN_STEP_COPY[locale] ?? PLAN_STEP_COPY.en;
}
