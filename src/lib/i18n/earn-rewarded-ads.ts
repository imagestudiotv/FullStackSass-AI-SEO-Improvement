import type { Locale } from "@/lib/i18n/config";

/**
 * Earn Credits' "Watch an ad to earn credits" card (client ticket, 2026-11-13;
 * lib/earn/rewarded-ads.ts). {placeholders} are filled with format()
 * (lib/i18n/format.ts); the reward and the limit are always placeholders, read
 * from the deployment's settings.
 *
 * Google's rules for rewarded ads ask for a clear, accurate disclosure of what
 * must be done and what is given, BEFORE each ad, an explicit opt-in with a
 * real "no", and never a hint that Google verifies or endorses the reward:
 * the body, the ready step and the note say exactly that, and nothing more.
 */
export type EarnRewardedAdsCopy = {
  title: string;
  /** "Watch a short ad to the end and earn {credits} credits, up to {limit} ads a day." */
  body: string;
  /** "{count} of {limit} today" */
  today: string;
  /** "+{credits} per ad" */
  perAd: string;
  watch: string;
  loading: string;
  /** The opt-in, once the ad is ready: "Your ad is ready. Watch it to the end to earn {credits} credits." */
  ready: string;
  startAd: string;
  notNow: string;
  playing: string;
  claiming: string;
  /** "+{credits} credits added to your balance." */
  success: string;
  noFill: string;
  blocked: string;
  unsupported: string;
  closedEarly: string;
  /** "You have watched today's {limit} ads. Come back tomorrow." */
  limitReached: string;
  /** "Next ad in {time}" */
  cooldown: string;
  capReached: string;
  attempts: string;
  testMode: string;
  /** Non-transferable service credits; non-personalised ads without cookie consent. */
  note: string;
  errors: {
    too_early: string;
    expired: string;
    disabled: string;
    generic: string;
  };
};

const en: EarnRewardedAdsCopy = {
  title: "Watch an ad to earn credits",
  body: "Watch a short ad to the end and earn {credits} credits, up to {limit} ads a day.",
  today: "{count} of {limit} today",
  perAd: "+{credits} per ad",
  watch: "Watch an ad",
  loading: "Loading the ad…",
  ready: "Your ad is ready. Watch it to the end to earn {credits} credits. Closing it early gives no credits.",
  startAd: "Start the ad",
  notNow: "Not now",
  playing: "The ad is playing…",
  claiming: "Adding your credits…",
  success: "+{credits} credits added to your balance.",
  noFill: "No ad is available right now. Please try again later.",
  blocked: "The ad could not load. An ad blocker, a privacy setting or the connection may be stopping it.",
  unsupported: "Ads cannot be shown in this browser or on this screen.",
  closedEarly: "The ad was closed before the end, so no credits were added.",
  limitReached: "You have watched today's {limit} ads. Come back tomorrow.",
  cooldown: "Next ad in {time}",
  capReached: "No more ads can be watched today. Please come back tomorrow.",
  attempts: "Too many attempts today. Please come back tomorrow.",
  testMode: "Test ads",
  note: "Credits from ads are RepGet service credits: they cannot be transferred, withdrawn or exchanged for money. Unless you accepted cookies on our website, only non-personalised ads are shown.",
  errors: {
    too_early: "The ad was not watched long enough, so no credits were added.",
    expired: "This ad took too long. Please start again.",
    disabled: "Ads to earn credits are not available right now.",
    generic: "Something went wrong. Please try again.",
  },
};

const es: EarnRewardedAdsCopy = {
  title: "Vea un anuncio para ganar créditos",
  body: "Vea un anuncio breve hasta el final y gane {credits} créditos, hasta {limit} anuncios al día.",
  today: "{count} de {limit} hoy",
  perAd: "+{credits} por anuncio",
  watch: "Ver un anuncio",
  loading: "Cargando el anuncio…",
  ready: "Su anuncio está listo. Véalo hasta el final para ganar {credits} créditos. Si lo cierra antes, no recibirá créditos.",
  startAd: "Empezar el anuncio",
  notNow: "Ahora no",
  playing: "El anuncio se está reproduciendo…",
  claiming: "Añadiendo sus créditos…",
  success: "+{credits} créditos añadidos a su saldo.",
  noFill: "No hay ningún anuncio disponible en este momento. Inténtelo de nuevo más tarde.",
  blocked: "No se pudo cargar el anuncio. Puede que lo impida un bloqueador de anuncios, un ajuste de privacidad o la conexión.",
  unsupported: "No se pueden mostrar anuncios en este navegador o en esta pantalla.",
  closedEarly: "El anuncio se cerró antes del final, así que no se añadieron créditos.",
  limitReached: "Ya ha visto los {limit} anuncios de hoy. Vuelva mañana.",
  cooldown: "Próximo anuncio en {time}",
  capReached: "Hoy ya no se pueden ver más anuncios. Vuelva mañana.",
  attempts: "Demasiados intentos hoy. Vuelva mañana.",
  testMode: "Anuncios de prueba",
  note: "Los créditos de los anuncios son créditos de servicio de RepGet: no se pueden transferir, retirar ni cambiar por dinero. Si no aceptó las cookies en nuestro sitio web, solo se muestran anuncios no personalizados.",
  errors: {
    too_early: "El anuncio no se vio el tiempo suficiente, así que no se añadieron créditos.",
    expired: "Este anuncio tardó demasiado. Empiece de nuevo.",
    disabled: "Los anuncios para ganar créditos no están disponibles en este momento.",
    generic: "Algo salió mal. Inténtelo de nuevo.",
  },
};

const fr: EarnRewardedAdsCopy = {
  title: "Regardez une publicité pour gagner des crédits",
  body: "Regardez une courte publicité jusqu’au bout et gagnez {credits} crédits, jusqu’à {limit} publicités par jour.",
  today: "{count} sur {limit} aujourd’hui",
  perAd: "+{credits} par publicité",
  watch: "Regarder une publicité",
  loading: "Chargement de la publicité…",
  ready: "Votre publicité est prête. Regardez-la jusqu’au bout pour gagner {credits} crédits. Si vous la fermez avant, aucun crédit n’est ajouté.",
  startAd: "Lancer la publicité",
  notNow: "Pas maintenant",
  playing: "La publicité est en cours…",
  claiming: "Ajout de vos crédits…",
  success: "+{credits} crédits ajoutés à votre solde.",
  noFill: "Aucune publicité n’est disponible pour le moment. Veuillez réessayer plus tard.",
  blocked: "La publicité n’a pas pu se charger. Un bloqueur de publicités, un réglage de confidentialité ou la connexion l’en empêche peut-être.",
  unsupported: "Les publicités ne peuvent pas s’afficher dans ce navigateur ou sur cet écran.",
  closedEarly: "La publicité a été fermée avant la fin : aucun crédit n’a été ajouté.",
  limitReached: "Vous avez regardé les {limit} publicités du jour. Revenez demain.",
  cooldown: "Prochaine publicité dans {time}",
  capReached: "Plus aucune publicité ne peut être regardée aujourd’hui. Revenez demain.",
  attempts: "Trop de tentatives aujourd’hui. Revenez demain.",
  testMode: "Publicités de test",
  note: "Les crédits gagnés avec les publicités sont des crédits de service RepGet : ils ne peuvent être ni transférés, ni retirés, ni échangés contre de l’argent. Si vous n’avez pas accepté les cookies sur notre site, seules des publicités non personnalisées sont affichées.",
  errors: {
    too_early: "La publicité n’a pas été regardée assez longtemps : aucun crédit n’a été ajouté.",
    expired: "Cette publicité a pris trop de temps. Veuillez recommencer.",
    disabled: "Les publicités pour gagner des crédits ne sont pas disponibles pour le moment.",
    generic: "Une erreur s’est produite. Veuillez réessayer.",
  },
};

const it: EarnRewardedAdsCopy = {
  title: "Guardi un annuncio per guadagnare crediti",
  body: "Guardi un breve annuncio fino alla fine e guadagni {credits} crediti, fino a {limit} annunci al giorno.",
  today: "{count} di {limit} oggi",
  perAd: "+{credits} per annuncio",
  watch: "Guarda un annuncio",
  loading: "Caricamento dell’annuncio…",
  ready: "Il Suo annuncio è pronto. Lo guardi fino alla fine per guadagnare {credits} crediti. Se lo chiude prima, non riceve crediti.",
  startAd: "Avvia l’annuncio",
  notNow: "Non ora",
  playing: "L’annuncio è in riproduzione…",
  claiming: "Aggiunta dei Suoi crediti…",
  success: "+{credits} crediti aggiunti al Suo saldo.",
  noFill: "Al momento non ci sono annunci disponibili. Riprovi più tardi.",
  blocked: "Non è stato possibile caricare l’annuncio. Potrebbe impedirlo un blocco degli annunci, un’impostazione della privacy o la connessione.",
  unsupported: "Non è possibile mostrare annunci in questo browser o su questo schermo.",
  closedEarly: "L’annuncio è stato chiuso prima della fine, quindi non sono stati aggiunti crediti.",
  limitReached: "Ha già guardato i {limit} annunci di oggi. Torni domani.",
  cooldown: "Prossimo annuncio tra {time}",
  capReached: "Oggi non è più possibile guardare annunci. Torni domani.",
  attempts: "Troppi tentativi oggi. Torni domani.",
  testMode: "Annunci di prova",
  note: "I crediti ottenuti con gli annunci sono crediti di servizio RepGet: non possono essere trasferiti, prelevati né convertiti in denaro. Se non ha accettato i cookie sul nostro sito, vengono mostrati solo annunci non personalizzati.",
  errors: {
    too_early: "L’annuncio non è stato guardato abbastanza a lungo, quindi non sono stati aggiunti crediti.",
    expired: "Questo annuncio ha richiesto troppo tempo. Ricominci.",
    disabled: "Gli annunci per guadagnare crediti non sono disponibili al momento.",
    generic: "Qualcosa è andato storto. Riprovi.",
  },
};

const de: EarnRewardedAdsCopy = {
  title: "Werbung ansehen und Credits verdienen",
  body: "Sehen Sie eine kurze Werbung bis zum Ende an und verdienen Sie {credits} Credits, bis zu {limit} Werbungen pro Tag.",
  today: "{count} von {limit} heute",
  perAd: "+{credits} pro Werbung",
  watch: "Werbung ansehen",
  loading: "Werbung wird geladen…",
  ready: "Ihre Werbung ist bereit. Sehen Sie sie bis zum Ende an, um {credits} Credits zu verdienen. Wenn Sie sie vorher schließen, gibt es keine Credits.",
  startAd: "Werbung starten",
  notNow: "Jetzt nicht",
  playing: "Die Werbung läuft…",
  claiming: "Ihre Credits werden gutgeschrieben…",
  success: "+{credits} Credits wurden Ihrem Guthaben gutgeschrieben.",
  noFill: "Im Moment ist keine Werbung verfügbar. Bitte versuchen Sie es später erneut.",
  blocked: "Die Werbung konnte nicht geladen werden. Möglicherweise verhindert das ein Werbeblocker, eine Datenschutzeinstellung oder die Verbindung.",
  unsupported: "In diesem Browser oder auf diesem Bildschirm kann keine Werbung angezeigt werden.",
  closedEarly: "Die Werbung wurde vor dem Ende geschlossen, daher wurden keine Credits gutgeschrieben.",
  limitReached: "Sie haben die {limit} Werbungen für heute angesehen. Kommen Sie morgen wieder.",
  cooldown: "Nächste Werbung in {time}",
  capReached: "Heute kann keine Werbung mehr angesehen werden. Kommen Sie morgen wieder.",
  attempts: "Zu viele Versuche heute. Kommen Sie morgen wieder.",
  testMode: "Testwerbung",
  note: "Credits aus Werbung sind RepGet-Service-Credits: sie können nicht übertragen, ausgezahlt oder in Geld umgetauscht werden. Wenn Sie auf unserer Website keine Cookies akzeptiert haben, wird nur nicht personalisierte Werbung angezeigt.",
  errors: {
    too_early: "Die Werbung wurde nicht lange genug angesehen, daher wurden keine Credits gutgeschrieben.",
    expired: "Diese Werbung hat zu lange gedauert. Bitte starten Sie erneut.",
    disabled: "Werbung zum Verdienen von Credits ist im Moment nicht verfügbar.",
    generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
  },
};

export const EARN_REWARDED_ADS_COPY: Record<Locale, EarnRewardedAdsCopy> = { en, es, fr, it, de };
