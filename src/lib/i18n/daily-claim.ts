import type { Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/i18n/format";

/**
 * The daily check-in's words (client design and ticket, 2026-11-05). Five
 * languages, formal address, like the rest of the app. {placeholders} are
 * filled with format(); {credits} is always `credits` below with the real
 * amount, never a figure written into a sentence.
 */
export type DailyClaimCopy = {
  /** "{count} credit|{count} credits" */
  credits: string;
  eyebrow: string;

  /** The launchers. */
  launchClaim: string;
  launchView: string;
  /** The banner's button once the server has confirmed today's claim. */
  claimedToday: string;
  bannerTitle: string;
  bannerBody: string;

  /** The modal before today's check-in, on a paid plan and on a trial. */
  title: string;
  titleEm: string;
  sub: string;
  trialTitle: string;
  trialEm: string;
  trialSub: string;
  /** After it. {count} is the next check-in's amount, {when} when it opens. */
  doneTitle: string;
  doneEm: string;
  doneSub: string;
  trialDoneEm: string;
  /** A trial's last day: nothing more is coming until a plan starts. */
  trialLastEm: string;
  trialLastSub: string;
  trialLastSubPaid: string;

  journey: string;
  trialJourney: string;
  /** "{count}-day streak|{count}-day streak" */
  streak: string;
  noStreak: string;
  day: string;
  stateClaimed: string;
  stateToday: string;
  stateMissed: string;
  stateUpcoming: string;

  momentum: string;
  everyDay: string;
  trialDays: string;
  collect: string;
  collecting: string;
  collected: string;
  fine: string;
  fineTrial: string;
  more: string;
  moreLink: string;
  moreEnd: string;

  /** What came back from the server. */
  success: string;
  already: string;
  notEligible: string;
  failed: string;

  /** The Earn Credits card. */
  next: string;
  notCollected: string;
  noneHelp: string;
  seePlans: string;
  close: string;
};

const en: DailyClaimCopy = {
  credits: "{count} credit|{count} credits",
  eyebrow: "RepGet daily rewards",

  launchClaim: "Claim {credits}",
  launchView: "View daily rewards",
  claimedToday: "Claimed today",
  bannerTitle: "Show up daily. Grow for free.",
  bannerBody: "Check in today and get {credits} to use in your workspace.",

  title: "Your daily check-in.",
  titleEm: "{credits} free, every day.",
  sub: "A little consistency goes a long way. Collect today's reward.",
  trialTitle: "Your trial check-in.",
  trialEm: "{credits} free today.",
  trialSub: "Day {day} of {days} of your trial credits. Collect today's reward.",
  doneTitle: "You're all checked in.",
  doneEm: "Come back tomorrow for +{count}.",
  doneSub: "Today's credits are in your balance. Next check-in: {when}.",
  trialDoneEm: "Come back for +{count} more.",
  trialLastEm: "That was your last trial day.",
  trialLastSub: "Your trial's credits are in your balance and never expire.",
  trialLastSubPaid: "Your trial's credits are in your balance and never expire. With a paid plan you can collect {credits} every day you check in.",

  journey: "Your {days}-day journey",
  trialJourney: "Your {days} trial days",
  streak: "{count}-day streak|{count}-day streak",
  noStreak: "Start your streak",
  day: "Day {day}",
  stateClaimed: "Claimed",
  stateToday: "Today",
  stateMissed: "Missed",
  stateUpcoming: "Upcoming",

  momentum: "Small rewards. Big momentum.",
  everyDay: "+{credits} every day you check in",
  trialDays: "+{credits} on each of your first {days} days, until {date}",
  collect: "Check in & collect {credits}",
  collecting: "Collecting…",
  collected: "You've collected today's {credits}",
  fine: "One check-in per day. Each check-in earns {credits}. A missed day cannot be claimed later. The {days} days start again after day {days}; your balance does not.",
  fineTrial: "One check-in per trial day. A missed day cannot be claimed later. Credits you collect never expire.",
  more: "Want more than {credits}?",
  moreLink: "Earn Credits",
  moreEnd: "for free.",

  success: "{credits} added to your balance.",
  already: "Today's credits were already collected.",
  notEligible: "Your account cannot collect daily credits right now.",
  failed: "Your check-in could not be confirmed. Please try again: you cannot be credited twice.",

  next: "Next check-in: {when}",
  notCollected: "Not collected yet",
  noneHelp: "With a paid plan you can collect {credits} every day you check in.",
  seePlans: "See plans",
  close: "Close",
};

const es: DailyClaimCopy = {
  credits: "{count} crédito|{count} créditos",
  eyebrow: "Recompensas diarias de RepGet",

  launchClaim: "Reclamar {credits}",
  launchView: "Ver recompensas diarias",
  claimedToday: "Recogido hoy",
  bannerTitle: "Vuelva cada día. Crezca gratis.",
  bannerBody: "Registre su visita de hoy y reciba {credits} para usar en su espacio de trabajo.",

  title: "Su visita diaria.",
  titleEm: "{credits} gratis, cada día.",
  sub: "Un poco de constancia llega lejos. Recoja la recompensa de hoy.",
  trialTitle: "Su visita de prueba.",
  trialEm: "{credits} gratis hoy.",
  trialSub: "Día {day} de {days} de sus créditos de prueba. Recoja la recompensa de hoy.",
  doneTitle: "Visita registrada.",
  doneEm: "Vuelva mañana a por +{count}.",
  doneSub: "Los créditos de hoy ya están en su saldo. Próxima visita: {when}.",
  trialDoneEm: "Vuelva a por +{count} más.",
  trialLastEm: "Ese ha sido su último día de prueba.",
  trialLastSub: "Los créditos de su prueba están en su saldo y no caducan nunca.",
  trialLastSubPaid: "Los créditos de su prueba están en su saldo y no caducan nunca. Con un plan de pago puede recoger {credits} cada día que registra su visita.",

  journey: "Su recorrido de {days} días",
  trialJourney: "Sus {days} días de prueba",
  streak: "Racha de {count} día|Racha de {count} días",
  noStreak: "Empiece su racha",
  day: "Día {day}",
  stateClaimed: "Recogido",
  stateToday: "Hoy",
  stateMissed: "Perdido",
  stateUpcoming: "Próximo",

  momentum: "Pequeñas recompensas. Gran impulso.",
  everyDay: "+{credits} cada día que registra su visita",
  trialDays: "+{credits} en cada uno de sus primeros {days} días, hasta el {date}",
  collect: "Registrar y recoger {credits}",
  collecting: "Recogiendo…",
  collected: "Ya ha recogido {credits} de hoy",
  fine: "Una visita al día. Cada visita da {credits}. Un día perdido no se puede reclamar después. Los {days} días vuelven a empezar tras el día {days}; su saldo no.",
  fineTrial: "Una visita por día de prueba. Un día perdido no se puede reclamar después. Los créditos recogidos no caducan nunca.",
  more: "¿Quiere más de {credits}?",
  moreLink: "Gane créditos",
  moreEnd: "gratis.",

  success: "{credits} añadidos a su saldo.",
  already: "Los créditos de hoy ya se habían recogido.",
  notEligible: "Su cuenta no puede recoger créditos diarios en este momento.",
  failed: "No se ha podido confirmar su visita. Inténtelo de nuevo: no se le pueden abonar dos veces.",

  next: "Próxima visita: {when}",
  notCollected: "Aún sin recoger",
  noneHelp: "Con un plan de pago puede recoger {credits} cada día que registra su visita.",
  seePlans: "Ver planes",
  close: "Cerrar",
};

const fr: DailyClaimCopy = {
  credits: "{count} crédit|{count} crédits",
  eyebrow: "Récompenses quotidiennes RepGet",

  launchClaim: "Récupérer {credits}",
  launchView: "Voir les récompenses",
  claimedToday: "Récupéré aujourd’hui",
  bannerTitle: "Revenez chaque jour. Progressez gratuitement.",
  bannerBody: "Faites votre check-in aujourd’hui et recevez {credits} à utiliser dans votre espace de travail.",

  title: "Votre check-in quotidien.",
  titleEm: "{credits} offerts, chaque jour.",
  sub: "Un peu de régularité mène loin. Récupérez la récompense du jour.",
  trialTitle: "Votre check-in d’essai.",
  trialEm: "{credits} offerts aujourd’hui.",
  trialSub: "Jour {day} sur {days} de vos crédits d’essai. Récupérez la récompense du jour.",
  doneTitle: "Check-in effectué.",
  doneEm: "Revenez demain pour +{count}.",
  doneSub: "Les crédits du jour sont sur votre solde. Prochain check-in : {when}.",
  trialDoneEm: "Revenez pour +{count} de plus.",
  trialLastEm: "C’était votre dernier jour d’essai.",
  trialLastSub: "Les crédits de votre essai sont sur votre solde et n’expirent jamais.",
  trialLastSubPaid: "Les crédits de votre essai sont sur votre solde et n’expirent jamais. Avec un forfait payant, vous pouvez récupérer {credits} chaque jour où vous faites votre check-in.",

  journey: "Votre parcours de {days} jours",
  trialJourney: "Vos {days} jours d’essai",
  streak: "Série de {count} jour|Série de {count} jours",
  noStreak: "Commencez votre série",
  day: "Jour {day}",
  stateClaimed: "Récupéré",
  stateToday: "Aujourd’hui",
  stateMissed: "Manqué",
  stateUpcoming: "À venir",

  momentum: "Petites récompenses. Grand élan.",
  everyDay: "+{credits} chaque jour où vous faites votre check-in",
  trialDays: "+{credits} chacun de vos {days} premiers jours, jusqu’au {date}",
  collect: "Check-in et récupérer {credits}",
  collecting: "Récupération…",
  collected: "Vous avez récupéré {credits} aujourd’hui",
  fine: "Un check-in par jour. Chaque check-in rapporte {credits}. Un jour manqué ne peut pas être réclamé plus tard. Les {days} jours recommencent après le jour {days} ; votre solde, non.",
  fineTrial: "Un check-in par jour d’essai. Un jour manqué ne peut pas être réclamé plus tard. Les crédits récupérés n’expirent jamais.",
  more: "Envie de plus de {credits} ?",
  moreLink: "Gagnez des crédits",
  moreEnd: "gratuitement.",

  success: "{credits} ajoutés à votre solde.",
  already: "Les crédits du jour ont déjà été récupérés.",
  notEligible: "Votre compte ne peut pas récupérer de crédits quotidiens pour le moment.",
  failed: "Votre check-in n’a pas pu être confirmé. Réessayez : vous ne pouvez pas être crédité deux fois.",

  next: "Prochain check-in : {when}",
  notCollected: "Pas encore récupérés",
  noneHelp: "Avec un forfait payant, vous pouvez récupérer {credits} chaque jour où vous faites votre check-in.",
  seePlans: "Voir les forfaits",
  close: "Fermer",
};

const it: DailyClaimCopy = {
  credits: "{count} credito|{count} crediti",
  eyebrow: "Premi giornalieri RepGet",

  launchClaim: "Richieda {credits}",
  launchView: "Vedi premi giornalieri",
  claimedToday: "Ricevuto oggi",
  bannerTitle: "Torni ogni giorno. Cresca gratis.",
  bannerBody: "Faccia il check-in di oggi e riceva {credits} da usare nel Suo spazio di lavoro.",

  title: "Il Suo check-in giornaliero.",
  titleEm: "{credits} gratis, ogni giorno.",
  sub: "Un po’ di costanza porta lontano. Riceva il premio di oggi.",
  trialTitle: "Il Suo check-in di prova.",
  trialEm: "{credits} gratis oggi.",
  trialSub: "Giorno {day} di {days} dei Suoi crediti di prova. Riceva il premio di oggi.",
  doneTitle: "Check-in fatto.",
  doneEm: "Torni domani per +{count}.",
  doneSub: "I crediti di oggi sono nel Suo saldo. Prossimo check-in: {when}.",
  trialDoneEm: "Torni per altri +{count}.",
  trialLastEm: "Questo era il Suo ultimo giorno di prova.",
  trialLastSub: "I crediti della prova sono nel Suo saldo e non scadono mai.",
  trialLastSubPaid: "I crediti della prova sono nel Suo saldo e non scadono mai. Con un piano a pagamento può ricevere {credits} ogni giorno in cui fa il check-in.",

  journey: "Il Suo percorso di {days} giorni",
  trialJourney: "I Suoi {days} giorni di prova",
  streak: "Serie di {count} giorno|Serie di {count} giorni",
  noStreak: "Inizi la Sua serie",
  day: "Giorno {day}",
  stateClaimed: "Ricevuto",
  stateToday: "Oggi",
  stateMissed: "Perso",
  stateUpcoming: "In arrivo",

  momentum: "Piccoli premi. Grande slancio.",
  everyDay: "+{credits} ogni giorno in cui fa il check-in",
  trialDays: "+{credits} in ciascuno dei primi {days} giorni, fino al {date}",
  collect: "Check-in e ricevi {credits}",
  collecting: "Attendere…",
  collected: "Ha ricevuto {credits} di oggi",
  fine: "Un check-in al giorno. Ogni check-in vale {credits}. Un giorno perso non si può richiedere in seguito. I {days} giorni ricominciano dopo il giorno {days}; il Suo saldo no.",
  fineTrial: "Un check-in per giorno di prova. Un giorno perso non si può richiedere in seguito. I crediti ricevuti non scadono mai.",
  more: "Vuole più di {credits}?",
  moreLink: "Guadagni crediti",
  moreEnd: "gratis.",

  success: "{credits} aggiunti al Suo saldo.",
  already: "I crediti di oggi erano già stati ricevuti.",
  notEligible: "Il Suo account al momento non può ricevere crediti giornalieri.",
  failed: "Non è stato possibile confermare il check-in. Riprovi: non possono esserLe accreditati due volte.",

  next: "Prossimo check-in: {when}",
  notCollected: "Non ancora ricevuti",
  noneHelp: "Con un piano a pagamento può ricevere {credits} ogni giorno in cui fa il check-in.",
  seePlans: "Vedi i piani",
  close: "Chiudi",
};

const de: DailyClaimCopy = {
  credits: "{count} Credit|{count} Credits",
  eyebrow: "Tägliche RepGet-Prämien",

  launchClaim: "{credits} abholen",
  launchView: "Tägliche Prämien ansehen",
  claimedToday: "Heute abgeholt",
  bannerTitle: "Täglich dabei. Kostenlos wachsen.",
  bannerBody: "Checken Sie heute ein und erhalten Sie {credits} für Ihren Arbeitsbereich.",

  title: "Ihr täglicher Check-in.",
  titleEm: "{credits} gratis, jeden Tag.",
  sub: "Ein wenig Beständigkeit bringt viel. Holen Sie die heutige Prämie ab.",
  trialTitle: "Ihr Check-in in der Testphase.",
  trialEm: "{credits} gratis heute.",
  trialSub: "Tag {day} von {days} Ihrer Test-Credits. Holen Sie die heutige Prämie ab.",
  doneTitle: "Sie sind eingecheckt.",
  doneEm: "Morgen wieder +{count}.",
  doneSub: "Die heutigen Credits sind in Ihrem Guthaben. Nächster Check-in: {when}.",
  trialDoneEm: "Kommen Sie für weitere +{count} wieder.",
  trialLastEm: "Das war Ihr letzter Testtag.",
  trialLastSub: "Die Credits Ihrer Testphase sind in Ihrem Guthaben und verfallen nie.",
  trialLastSubPaid: "Die Credits Ihrer Testphase sind in Ihrem Guthaben und verfallen nie. Mit einem kostenpflichtigen Tarif können Sie an jedem Tag, an dem Sie einchecken, {credits} abholen.",

  journey: "Ihre {days}-Tage-Reise",
  trialJourney: "Ihre {days} Testtage",
  streak: "{count} Tag in Folge|{count} Tage in Folge",
  noStreak: "Starten Sie Ihre Serie",
  day: "Tag {day}",
  stateClaimed: "Abgeholt",
  stateToday: "Heute",
  stateMissed: "Verpasst",
  stateUpcoming: "Demnächst",

  momentum: "Kleine Prämien. Großer Schwung.",
  everyDay: "+{credits} an jedem Tag, an dem Sie einchecken",
  trialDays: "+{credits} an jedem Ihrer ersten {days} Tage, bis zum {date}",
  collect: "Einchecken & {credits} abholen",
  collecting: "Wird abgeholt…",
  collected: "Sie haben heute {credits} abgeholt",
  fine: "Ein Check-in pro Tag. Jeder Check-in bringt {credits}. Ein verpasster Tag kann später nicht nachgeholt werden. Die {days} Tage beginnen nach Tag {days} von vorn, Ihr Guthaben nicht.",
  fineTrial: "Ein Check-in pro Testtag. Ein verpasster Tag kann später nicht nachgeholt werden. Abgeholte Credits verfallen nie.",
  more: "Mehr als {credits}?",
  moreLink: "Credits verdienen",
  moreEnd: "kostenlos.",

  success: "{credits} Ihrem Guthaben hinzugefügt.",
  already: "Die heutigen Credits wurden bereits abgeholt.",
  notEligible: "Ihr Konto kann derzeit keine täglichen Credits abholen.",
  failed: "Ihr Check-in konnte nicht bestätigt werden. Bitte versuchen Sie es erneut: Es kann nicht doppelt gutgeschrieben werden.",

  next: "Nächster Check-in: {when}",
  notCollected: "Noch nicht abgeholt",
  noneHelp: "Mit einem kostenpflichtigen Tarif können Sie an jedem Tag, an dem Sie einchecken, {credits} abholen.",
  seePlans: "Tarife ansehen",
  close: "Schließen",
};

export const DAILY_CLAIM_COPY: Record<Locale, DailyClaimCopy> = { en, es, fr, it, de };

/** When the next check-in opens: in UTC, the clock the days run on, so the server and browser agree. */
export function dailyWhen(at: Date, locale: Locale): string {
  return formatDate(at, locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}
