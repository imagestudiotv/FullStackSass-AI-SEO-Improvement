import type { Locale } from "@/lib/i18n/config";

/**
 * What the customer reads about an article under the two-step flow
 * (docs/two-step-articles.md): while the RepGet team prepares it, when it is
 * ready, and when a later change goes back to the team. Five languages, formal
 * address, like the rest of the app. {placeholders} are filled with format()
 * (lib/i18n/format.ts).
 */
export type ArticleDeliveryCopy = {
  /** The title of a held article no plan entry names. See PREPARING_TITLE. */
  preparingTitle: string;
  /** While the article is first being written. */
  writingTitle: string;
  writingBody: string;
  /** While the RepGet team has it. */
  teamTitle: string;
  teamBody: string;
  stepsLabel: string;
  stepTeam: string;
  stepPublish: string;
  currentStep: string;
  /** Not connected yet: nothing is live, and this is what to do about it. */
  connectNote: string;
  connectAction: string;
  /** The customer's own automatic publishing still runs, after the approval. */
  autoNoteLive: string;
  autoNoteDraft: string;

  /** Ready: the publishing panel's first line. */
  ready: string;
  /** "… on {date} …" */
  readyAutoLive: string;
  readyAutoDraft: string;
  readyConnect: string;
  /** A change to a post already on the site, while the team checks it. */
  liveChangeWithTeam: string;

  /** Beside Save, on an article the team approved. */
  saveNote: string;
  saveNoteLive: string;
  rewriteNote: string;

  /** Refusals from the server, in the reader's language. */
  errPreparing: string;
  errAlreadyOnSite: string;
  errAlreadyDelivering: string;

  /** The dashboard's card. */
  dashboardPreparingHelp: string;
  dashboardReady: string;
  dashboardReadyHelp: string;
};

/**
 * What a read returns as the title of a held article no plan entry names.
 * The reads do not know the reader's language, so this marker travels to the
 * page, which says it with articleTitleText. U+001F never appears in a real
 * title (lib/articles/review.ts).
 */
export const PREPARING_TITLE = "\u001fpreparing";

/** An article title from a customer's read, ready to show. */
export function articleTitleText(title: string, locale: Locale): string {
  return title === PREPARING_TITLE ? ARTICLE_DELIVERY[locale].preparingTitle : title;
}

export const ARTICLE_DELIVERY: Record<Locale, ArticleDeliveryCopy> = {
  en: {
    preparingTitle: "Article in preparation",
    writingTitle: "We are writing this article",
    writingBody: "When it is written, it goes to the RepGet team to be edited and checked. There is nothing for you to do.",
    teamTitle: "The RepGet team is preparing this article",
    teamBody: "They edit it, check its sources and add relevant links. You will get a notification when it is ready. There is nothing for you to do.",
    stepsLabel: "How this article reaches your website",
    stepTeam: "The RepGet team prepares it",
    stepPublish: "You publish it to your website",
    currentStep: "Current step",
    connectNote: "Your website is not connected yet. Connect it now, so you can publish as soon as the article is ready.",
    connectAction: "Connect your website",
    autoNoteLive: "You have automatic publishing on: once the team has approved it, it goes live by itself on its planned day.",
    autoNoteDraft: "You have automatic publishing on, as drafts: once the team has approved it, it goes to your website as a draft on its planned day.",
    ready: "Ready to publish. The RepGet team has finished this article.",
    readyAutoLive: "Ready. Automatic publishing is on, so it goes live by itself on {date}. You can publish it sooner.",
    readyAutoDraft: "Ready. Automatic publishing is on, as drafts, so it goes to your website as a draft on {date}. You can publish it live now.",
    readyConnect: "This article is ready, but it is not on your website yet. Connect your website to publish it.",
    liveChangeWithTeam: "The RepGet team is checking your change. The post on your website stays as it is until they finish and you press Update.",
    saveNote: "Saving sends this article back to the RepGet team for a final check. It is hidden here until they finish, and you will be told when it is ready again.",
    saveNoteLive: "Saving sends your change to the RepGet team for a check. The post on your website stays as it is until they finish and you press Update.",
    rewriteNote: "The new version goes to the RepGet team. It is hidden here until they finish, and you will be told when it is ready.",
    errPreparing: "This article is being prepared by the RepGet team. You will be told when it is ready to publish.",
    errAlreadyOnSite: "This exact version is already on your website.",
    errAlreadyDelivering: "This article is already on its way to your website.",
    dashboardPreparingHelp: "The RepGet team is preparing it. You will be told when it is ready to publish; there is nothing for you to do.",
    dashboardReady: "Ready to publish",
    dashboardReadyHelp: "The RepGet team has finished it. Open it to publish.",
  },
  es: {
    preparingTitle: "Artículo en preparación",
    writingTitle: "Estamos escribiendo este artículo",
    writingBody: "Cuando esté escrito, pasará al equipo de RepGet para que lo edite y lo revise. Usted no tiene que hacer nada.",
    teamTitle: "El equipo de RepGet está preparando este artículo",
    teamBody: "Lo editan, revisan sus fuentes y añaden enlaces relevantes. Recibirá una notificación cuando esté listo. Usted no tiene que hacer nada.",
    stepsLabel: "Cómo llega este artículo a su sitio web",
    stepTeam: "El equipo de RepGet lo prepara",
    stepPublish: "Usted lo publica en su sitio web",
    currentStep: "Paso actual",
    connectNote: "Su sitio web aún no está conectado. Conéctelo ahora para poder publicar en cuanto el artículo esté listo.",
    connectAction: "Conectar su sitio web",
    autoNoteLive: "Tiene activada la publicación automática: una vez aprobado por el equipo, se publicará solo en la fecha prevista.",
    autoNoteDraft: "Tiene activada la publicación automática como borradores: una vez aprobado por el equipo, llegará a su sitio web como borrador en la fecha prevista.",
    ready: "Listo para publicar. El equipo de RepGet ha terminado este artículo.",
    readyAutoLive: "Listo. La publicación automática está activada, así que se publicará solo el {date}. Puede publicarlo antes.",
    readyAutoDraft: "Listo. La publicación automática está activada como borradores, así que llegará a su sitio web como borrador el {date}. Puede publicarlo ya.",
    readyConnect: "Este artículo está listo, pero aún no está en su sitio web. Conecte su sitio web para publicarlo.",
    liveChangeWithTeam: "El equipo de RepGet está revisando su cambio. La publicación de su sitio web no cambia hasta que terminen y usted pulse Actualizar.",
    saveNote: "Al guardar, este artículo vuelve al equipo de RepGet para una última revisión. Quedará oculto aquí hasta que terminen, y le avisaremos cuando vuelva a estar listo.",
    saveNoteLive: "Al guardar, su cambio pasa al equipo de RepGet para que lo revise. La publicación de su sitio web no cambia hasta que terminen y usted pulse Actualizar.",
    rewriteNote: "La nueva versión pasa al equipo de RepGet. Quedará oculta aquí hasta que terminen, y le avisaremos cuando esté lista.",
    errPreparing: "El equipo de RepGet está preparando este artículo. Le avisaremos cuando esté listo para publicar.",
    errAlreadyOnSite: "Esta misma versión ya está en su sitio web.",
    errAlreadyDelivering: "Este artículo ya va de camino a su sitio web.",
    dashboardPreparingHelp: "El equipo de RepGet lo está preparando. Le avisaremos cuando esté listo para publicar; usted no tiene que hacer nada.",
    dashboardReady: "Listo para publicar",
    dashboardReadyHelp: "El equipo de RepGet lo ha terminado. Ábralo para publicarlo.",
  },
  fr: {
    preparingTitle: "Article en préparation",
    writingTitle: "Nous rédigeons cet article",
    writingBody: "Une fois rédigé, il passe à l’équipe RepGet, qui le relit et le vérifie. Vous n’avez rien à faire.",
    teamTitle: "L’équipe RepGet prépare cet article",
    teamBody: "Elle le relit, vérifie ses sources et ajoute des liens pertinents. Vous recevrez une notification lorsqu’il sera prêt. Vous n’avez rien à faire.",
    stepsLabel: "Comment cet article arrive sur votre site",
    stepTeam: "L’équipe RepGet le prépare",
    stepPublish: "Vous le publiez sur votre site",
    currentStep: "Étape en cours",
    connectNote: "Votre site n’est pas encore connecté. Connectez-le dès maintenant pour pouvoir publier dès que l’article sera prêt.",
    connectAction: "Connecter votre site",
    autoNoteLive: "La publication automatique est activée : une fois approuvé par l’équipe, il sera publié de lui-même à la date prévue.",
    autoNoteDraft: "La publication automatique est activée en brouillon : une fois approuvé par l’équipe, il arrivera sur votre site en brouillon à la date prévue.",
    ready: "Prêt à publier. L’équipe RepGet a terminé cet article.",
    readyAutoLive: "Prêt. La publication automatique est activée : il sera publié de lui-même le {date}. Vous pouvez le publier plus tôt.",
    readyAutoDraft: "Prêt. La publication automatique est activée en brouillon : il arrivera sur votre site en brouillon le {date}. Vous pouvez le publier dès maintenant.",
    readyConnect: "Cet article est prêt, mais il n’est pas encore sur votre site. Connectez votre site pour le publier.",
    liveChangeWithTeam: "L’équipe RepGet vérifie votre modification. L’article en ligne reste inchangé jusqu’à ce qu’elle ait terminé et que vous cliquiez sur Mettre à jour.",
    saveNote: "En enregistrant, cet article retourne à l’équipe RepGet pour une dernière vérification. Il reste masqué ici jusqu’à ce qu’elle ait terminé, et vous serez averti lorsqu’il sera de nouveau prêt.",
    saveNoteLive: "En enregistrant, votre modification passe à l’équipe RepGet pour vérification. L’article en ligne reste inchangé jusqu’à ce qu’elle ait terminé et que vous cliquiez sur Mettre à jour.",
    rewriteNote: "La nouvelle version passe à l’équipe RepGet. Elle reste masquée ici jusqu’à ce que l’équipe ait terminé, et vous serez averti lorsqu’elle sera prête.",
    errPreparing: "L’équipe RepGet prépare cet article. Vous serez averti lorsqu’il sera prêt à publier.",
    errAlreadyOnSite: "Cette version exacte est déjà sur votre site.",
    errAlreadyDelivering: "Cet article est déjà en route vers votre site.",
    dashboardPreparingHelp: "L’équipe RepGet le prépare. Vous serez averti lorsqu’il sera prêt à publier ; vous n’avez rien à faire.",
    dashboardReady: "Prêt à publier",
    dashboardReadyHelp: "L’équipe RepGet l’a terminé. Ouvrez-le pour le publier.",
  },
  it: {
    preparingTitle: "Articolo in preparazione",
    writingTitle: "Stiamo scrivendo questo articolo",
    writingBody: "Una volta scritto, passa al team di RepGet per la revisione e i controlli. Lei non deve fare nulla.",
    teamTitle: "Il team di RepGet sta preparando questo articolo",
    teamBody: "Lo revisionano, ne controllano le fonti e aggiungono link pertinenti. Riceverà una notifica quando sarà pronto. Lei non deve fare nulla.",
    stepsLabel: "Come questo articolo arriva al suo sito",
    stepTeam: "Il team di RepGet lo prepara",
    stepPublish: "Lei lo pubblica sul suo sito",
    currentStep: "Passaggio attuale",
    connectNote: "Il suo sito non è ancora collegato. Lo colleghi ora, così potrà pubblicare non appena l’articolo sarà pronto.",
    connectAction: "Colleghi il suo sito",
    autoNoteLive: "La pubblicazione automatica è attiva: una volta approvato dal team, verrà pubblicato da solo nella data prevista.",
    autoNoteDraft: "La pubblicazione automatica è attiva come bozze: una volta approvato dal team, arriverà sul suo sito come bozza nella data prevista.",
    ready: "Pronto per la pubblicazione. Il team di RepGet ha completato questo articolo.",
    readyAutoLive: "Pronto. La pubblicazione automatica è attiva, quindi verrà pubblicato da solo il {date}. Può pubblicarlo prima.",
    readyAutoDraft: "Pronto. La pubblicazione automatica è attiva come bozze, quindi arriverà sul suo sito come bozza il {date}. Può pubblicarlo subito.",
    readyConnect: "Questo articolo è pronto, ma non è ancora sul suo sito. Colleghi il suo sito per pubblicarlo.",
    liveChangeWithTeam: "Il team di RepGet sta controllando la sua modifica. L’articolo sul suo sito resta invariato finché non hanno finito e lei non preme Aggiorna.",
    saveNote: "Salvando, questo articolo torna al team di RepGet per un ultimo controllo. Resta nascosto qui finché non hanno finito, e la avviseremo quando sarà di nuovo pronto.",
    saveNoteLive: "Salvando, la sua modifica passa al team di RepGet per un controllo. L’articolo sul suo sito resta invariato finché non hanno finito e lei non preme Aggiorna.",
    rewriteNote: "La nuova versione passa al team di RepGet. Resta nascosta qui finché non hanno finito, e la avviseremo quando sarà pronta.",
    errPreparing: "Il team di RepGet sta preparando questo articolo. La avviseremo quando sarà pronto per la pubblicazione.",
    errAlreadyOnSite: "Questa versione è già sul suo sito.",
    errAlreadyDelivering: "Questo articolo è già in viaggio verso il suo sito.",
    dashboardPreparingHelp: "Il team di RepGet lo sta preparando. La avviseremo quando sarà pronto per la pubblicazione; lei non deve fare nulla.",
    dashboardReady: "Pronto per la pubblicazione",
    dashboardReadyHelp: "Il team di RepGet lo ha completato. Lo apra per pubblicarlo.",
  },
  de: {
    preparingTitle: "Artikel in Vorbereitung",
    writingTitle: "Wir schreiben diesen Artikel",
    writingBody: "Sobald er geschrieben ist, geht er zur Bearbeitung und Prüfung an das RepGet-Team. Sie müssen nichts tun.",
    teamTitle: "Das RepGet-Team bereitet diesen Artikel vor",
    teamBody: "Es bearbeitet ihn, prüft seine Quellen und ergänzt passende Links. Sie erhalten eine Benachrichtigung, sobald er fertig ist. Sie müssen nichts tun.",
    stepsLabel: "So kommt dieser Artikel auf Ihre Website",
    stepTeam: "Das RepGet-Team bereitet ihn vor",
    stepPublish: "Sie veröffentlichen ihn auf Ihrer Website",
    currentStep: "Aktueller Schritt",
    connectNote: "Ihre Website ist noch nicht verbunden. Verbinden Sie sie jetzt, damit Sie veröffentlichen können, sobald der Artikel fertig ist.",
    connectAction: "Website verbinden",
    autoNoteLive: "Die automatische Veröffentlichung ist aktiv: Nach der Freigabe durch das Team wird er am geplanten Tag von selbst veröffentlicht.",
    autoNoteDraft: "Die automatische Veröffentlichung ist als Entwurf aktiv: Nach der Freigabe durch das Team kommt er am geplanten Tag als Entwurf auf Ihre Website.",
    ready: "Bereit zur Veröffentlichung. Das RepGet-Team hat diesen Artikel fertiggestellt.",
    readyAutoLive: "Fertig. Die automatische Veröffentlichung ist aktiv, daher wird er am {date} von selbst veröffentlicht. Sie können ihn auch früher veröffentlichen.",
    readyAutoDraft: "Fertig. Die automatische Veröffentlichung ist als Entwurf aktiv, daher kommt er am {date} als Entwurf auf Ihre Website. Sie können ihn jetzt veröffentlichen.",
    readyConnect: "Dieser Artikel ist fertig, aber noch nicht auf Ihrer Website. Verbinden Sie Ihre Website, um ihn zu veröffentlichen.",
    liveChangeWithTeam: "Das RepGet-Team prüft Ihre Änderung. Der Beitrag auf Ihrer Website bleibt unverändert, bis die Prüfung abgeschlossen ist und Sie auf Aktualisieren klicken.",
    saveNote: "Beim Speichern geht dieser Artikel zur letzten Prüfung zurück an das RepGet-Team. Er ist hier ausgeblendet, bis die Prüfung abgeschlossen ist, und Sie werden benachrichtigt, sobald er wieder fertig ist.",
    saveNoteLive: "Beim Speichern geht Ihre Änderung zur Prüfung an das RepGet-Team. Der Beitrag auf Ihrer Website bleibt unverändert, bis die Prüfung abgeschlossen ist und Sie auf Aktualisieren klicken.",
    rewriteNote: "Die neue Version geht an das RepGet-Team. Sie ist hier ausgeblendet, bis die Prüfung abgeschlossen ist, und Sie werden benachrichtigt, sobald sie fertig ist.",
    errPreparing: "Das RepGet-Team bereitet diesen Artikel vor. Sie werden benachrichtigt, sobald er zur Veröffentlichung bereit ist.",
    errAlreadyOnSite: "Genau diese Version ist bereits auf Ihrer Website.",
    errAlreadyDelivering: "Dieser Artikel ist bereits auf dem Weg zu Ihrer Website.",
    dashboardPreparingHelp: "Das RepGet-Team bereitet ihn vor. Sie werden benachrichtigt, sobald er zur Veröffentlichung bereit ist; Sie müssen nichts tun.",
    dashboardReady: "Bereit zur Veröffentlichung",
    dashboardReadyHelp: "Das RepGet-Team hat ihn fertiggestellt. Öffnen Sie ihn, um ihn zu veröffentlichen.",
  },
};
