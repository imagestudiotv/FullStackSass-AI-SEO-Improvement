import type { DraftRefusal } from "@/lib/articles/review";
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
  /** The team has a newer copy; the customer sees the last approved one. */
  withTeam: string;
  withTeamLive: string;
  lockedWithTeam: string;
  /** A change that was waiting at switch-on: nothing approved to send meanwhile. */
  withTeamChange: string;
  /** The Publishing page's note about a website's first article. */
  firstArticleTwoStep: string;
  errPluginUpdate: string;
  /** A post held as a WordPress draft, on a plugin too old to publish it from here: no Publish button. */
  pluginDraftNote: string;
  /** A post held as a WordPress draft: Publish makes that post live. */
  pluginDraftReady: string;
  /** What the plugin found instead of publishing that draft (DRAFT_REFUSALS in lib/articles/review.ts). */
  refusedChanged: string;
  refusedUnverified: string;
  refusedTrashed: string;
  refusedDeleted: string;
  /** Somebody published the post in WordPress: live, but not known to hold this version. */
  publishedInWordPress: string;
  /** The plan step's note, and the manual mode's label on the Publishing page. */
  onboardingNote: string;
  finishedManual: string;

  /** Beside Save, on an article the team approved. */
  saveNote: string;
  saveNoteLive: string;
  rewriteNote: string;

  /** Refusals from the server, in the reader's language. */
  errPreparing: string;
  errAlreadyOnSite: string;
  errAlreadyDelivering: string;

  /** The bell, written when the team approves. {title} is the article's. */
  notifyReady: string;
  notifyUpdate: string;
  notifyConnect: string;
  notifyDay: string;
  notifyNotPublished: string;

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

/** What the plugin found instead of publishing a draft, in the reader's language. */
export function draftRefusalText(refusal: DraftRefusal, copy: ArticleDeliveryCopy): string {
  switch (refusal) {
    case "draft_changed":
      return copy.refusedChanged;
    case "draft_unverified":
      return copy.refusedUnverified;
    case "post_trashed":
      return copy.refusedTrashed;
    case "post_deleted":
      return copy.refusedDeleted;
  }
}

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
    withTeam: "The RepGet team is working on a change. You are seeing the last approved version, and Publish sends exactly this version. You will be told when the new one is ready.",
    withTeamLive: "The RepGet team is checking a change. The post on your website stays as it is, and you are seeing what is on it. You will be told when the change is ready.",
    lockedWithTeam: "This can be changed again once the RepGet team has finished.",
    saveNote: "Saving sends your change to the RepGet team to check. Until they finish you keep seeing, and can publish, the last approved version. You will be told when the new one is ready.",
    saveNoteLive: "Saving sends your change to the RepGet team to check. Until they finish, this page and your website keep the current version. You will be told when the new one is ready.",
    rewriteNote: "The new version goes to the RepGet team. Until they finish you keep seeing, and can publish, the last approved version.",
    errPreparing: "This article is being prepared by the RepGet team. You will be told when it is ready to publish.",
    errAlreadyOnSite: "This exact version is already on your website.",
    errAlreadyDelivering: "This article is already on its way to your website.",
    dashboardPreparingHelp: "The RepGet team is preparing it. You will be told when it is ready to publish; there is nothing for you to do.",
    dashboardReady: "Ready to publish",
    dashboardReadyHelp: "The RepGet team has finished it. Open it to publish.",
    notifyReady: "Your article is ready to publish",
    notifyUpdate: "Your article's update is ready to publish",
    notifyConnect: "{title}. Connect your website to publish it.",
    notifyDay: "{title}. It goes out by itself on its planned day, or you can publish it now.",
    withTeamChange: "The RepGet team is checking this change. The post on your website stays as it is. You will be told when the change is ready.",
    firstArticleTwoStep: "Your first article goes to the RepGet team first. Once they have finished, your choice here applies.",
    errPluginUpdate: "To send this update, first update the RepGet plugin on your website to version 1.10 or later.",
    pluginDraftNote: "This article is on your website as a draft. To publish it from here, update the RepGet plugin on your website to version 1.10 or later, or publish it from WordPress.",
    pluginDraftReady: "Ready to publish. This article is on your website as a draft, and Publish makes that same draft live.",
    refusedChanged: "This draft was changed in WordPress, so it was neither published nor overwritten. Please publish it from WordPress.",
    refusedUnverified: "This draft was saved by an earlier version of the plugin and RepGet cannot confirm it is unchanged, so it was neither published nor overwritten. Please publish it from WordPress.",
    refusedTrashed: "This draft is in the WordPress trash, so nothing was published. Restore it there, then press Publish again.",
    refusedDeleted: "This draft was deleted from WordPress, so nothing was published and no new post was made. Contact the RepGet team to have it sent again.",
    publishedInWordPress: "This post was published in WordPress, so what is live may differ from this version.",
    notifyNotPublished: "Your article was not published",
    onboardingNote: "We research your keywords, build a content calendar sized to your plan, and start writing. The RepGet team prepares your first article, and you will be told when it is ready to publish.",
    finishedManual: "Keep it in RepGet until I press Publish",
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
    withTeam: "El equipo de RepGet está trabajando en un cambio. Ve la última versión aprobada, y Publicar envía exactamente esta versión. Le avisaremos cuando la nueva esté lista.",
    withTeamLive: "El equipo de RepGet está revisando un cambio. La publicación de su sitio web no cambia, y lo que ve aquí es lo que está publicado. Le avisaremos cuando el cambio esté listo.",
    lockedWithTeam: "Podrá cambiarlo de nuevo cuando el equipo de RepGet haya terminado.",
    saveNote: "Al guardar, su cambio pasa al equipo de RepGet para que lo revise. Hasta que terminen, seguirá viendo y podrá publicar la última versión aprobada. Le avisaremos cuando la nueva esté lista.",
    saveNoteLive: "Al guardar, su cambio pasa al equipo de RepGet para que lo revise. Hasta que terminen, esta página y su sitio web mantienen la versión actual. Le avisaremos cuando la nueva esté lista.",
    rewriteNote: "La nueva versión pasa al equipo de RepGet. Hasta que terminen, seguirá viendo y podrá publicar la última versión aprobada.",
    errPreparing: "El equipo de RepGet está preparando este artículo. Le avisaremos cuando esté listo para publicar.",
    errAlreadyOnSite: "Esta misma versión ya está en su sitio web.",
    errAlreadyDelivering: "Este artículo ya va de camino a su sitio web.",
    dashboardPreparingHelp: "El equipo de RepGet lo está preparando. Le avisaremos cuando esté listo para publicar; usted no tiene que hacer nada.",
    dashboardReady: "Listo para publicar",
    dashboardReadyHelp: "El equipo de RepGet lo ha terminado. Ábralo para publicarlo.",
    notifyReady: "Su artículo está listo para publicar",
    notifyUpdate: "La actualización de su artículo está lista para publicar",
    notifyConnect: "{title}. Conecte su sitio web para publicarlo.",
    notifyDay: "{title}. Se publicará solo en la fecha prevista, o puede publicarlo ya.",
    withTeamChange: "El equipo de RepGet está revisando este cambio. La publicación de su sitio web no cambia. Le avisaremos cuando el cambio esté listo.",
    firstArticleTwoStep: "Su primer artículo pasa primero por el equipo de RepGet. Cuando terminen, se aplicará su elección.",
    errPluginUpdate: "Para enviar esta actualización, actualice primero el plugin de RepGet de su sitio web a la versión 1.10 o posterior.",
    pluginDraftNote: "Este artículo está en su sitio web como borrador. Para publicarlo desde aquí, actualice el plugin de RepGet de su sitio web a la versión 1.10 o posterior, o publíquelo desde WordPress.",
    pluginDraftReady: "Listo para publicar. Este artículo está en su sitio web como borrador, y Publicar hace público ese mismo borrador.",
    refusedChanged: "Este borrador se modificó en WordPress, por lo que no se ha publicado ni sobrescrito. Publíquelo desde WordPress.",
    refusedUnverified: "Este borrador lo guardó una versión anterior del plugin y RepGet no puede confirmar que no haya cambiado, por lo que no se ha publicado ni sobrescrito. Publíquelo desde WordPress.",
    refusedTrashed: "Este borrador está en la papelera de WordPress, por lo que no se ha publicado nada. Restáurelo allí y pulse Publicar de nuevo.",
    refusedDeleted: "Este borrador se eliminó de WordPress, por lo que no se ha publicado nada ni se ha creado una entrada nueva. Póngase en contacto con el equipo de RepGet para que se lo envíen de nuevo.",
    publishedInWordPress: "Esta entrada se publicó desde WordPress, por lo que lo que está en línea puede diferir de esta versión.",
    notifyNotPublished: "Su artículo no se ha publicado",
    onboardingNote: "Investigamos sus palabras clave, creamos un calendario de contenidos a la medida de su plan y empezamos a escribir. El equipo de RepGet prepara su primer artículo, y le avisaremos cuando esté listo para publicar.",
    finishedManual: "Guardarlo en RepGet hasta que pulse Publicar",
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
    withTeam: "L’équipe RepGet travaille sur une modification. Vous voyez la dernière version approuvée, et Publier envoie exactement cette version. Vous serez averti lorsque la nouvelle sera prête.",
    withTeamLive: "L’équipe RepGet vérifie une modification. L’article en ligne reste inchangé, et vous voyez ici ce qui est en ligne. Vous serez averti lorsque la modification sera prête.",
    lockedWithTeam: "Vous pourrez de nouveau modifier ceci lorsque l’équipe RepGet aura terminé.",
    saveNote: "En enregistrant, votre modification passe à l’équipe RepGet pour vérification. En attendant, vous voyez et pouvez publier la dernière version approuvée. Vous serez averti lorsque la nouvelle sera prête.",
    saveNoteLive: "En enregistrant, votre modification passe à l’équipe RepGet pour vérification. En attendant, cette page et votre site conservent la version actuelle. Vous serez averti lorsque la nouvelle sera prête.",
    rewriteNote: "La nouvelle version passe à l’équipe RepGet. En attendant, vous voyez et pouvez publier la dernière version approuvée.",
    errPreparing: "L’équipe RepGet prépare cet article. Vous serez averti lorsqu’il sera prêt à publier.",
    errAlreadyOnSite: "Cette version exacte est déjà sur votre site.",
    errAlreadyDelivering: "Cet article est déjà en route vers votre site.",
    dashboardPreparingHelp: "L’équipe RepGet le prépare. Vous serez averti lorsqu’il sera prêt à publier ; vous n’avez rien à faire.",
    dashboardReady: "Prêt à publier",
    dashboardReadyHelp: "L’équipe RepGet l’a terminé. Ouvrez-le pour le publier.",
    notifyReady: "Votre article est prêt à publier",
    notifyUpdate: "La mise à jour de votre article est prête à publier",
    notifyConnect: "{title}. Connectez votre site pour le publier.",
    notifyDay: "{title}. Il sera publié de lui-même à la date prévue, ou vous pouvez le publier dès maintenant.",
    withTeamChange: "L’équipe RepGet vérifie cette modification. L’article en ligne reste inchangé. Vous serez averti lorsque la modification sera prête.",
    firstArticleTwoStep: "Votre premier article passe d’abord par l’équipe RepGet. Ensuite, votre choix s’applique.",
    errPluginUpdate: "Pour envoyer cette mise à jour, mettez d’abord à jour l’extension RepGet de votre site vers la version 1.10 ou ultérieure.",
    pluginDraftNote: "Cet article est sur votre site en brouillon. Pour le publier d'ici, mettez à jour le plugin RepGet de votre site vers la version 1.10 ou ultérieure, ou publiez-le depuis WordPress.",
    pluginDraftReady: "Prêt à publier. Cet article est sur votre site en brouillon, et Publier met ce même brouillon en ligne.",
    refusedChanged: "Ce brouillon a été modifié dans WordPress : il n'a donc été ni publié ni écrasé. Publiez-le depuis WordPress.",
    refusedUnverified: "Ce brouillon a été enregistré par une version antérieure du plugin et RepGet ne peut pas confirmer qu'il est inchangé : il n'a donc été ni publié ni écrasé. Publiez-le depuis WordPress.",
    refusedTrashed: "Ce brouillon est dans la corbeille de WordPress : rien n'a donc été publié. Restaurez-le, puis appuyez de nouveau sur Publier.",
    refusedDeleted: "Ce brouillon a été supprimé de WordPress : rien n'a donc été publié et aucun nouvel article n'a été créé. Contactez l'équipe RepGet pour qu'il vous soit renvoyé.",
    publishedInWordPress: "Cet article a été publié depuis WordPress : ce qui est en ligne peut donc différer de cette version.",
    notifyNotPublished: "Votre article n'a pas été publié",
    onboardingNote: "Nous recherchons vos mots-clés, construisons un calendrier de contenu adapté à votre forfait et commençons à rédiger. L’équipe RepGet prépare votre premier article, et vous serez averti lorsqu’il sera prêt à publier.",
    finishedManual: "Le garder dans RepGet jusqu’à ce que je clique sur Publier",
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
    withTeam: "Il team di RepGet sta lavorando a una modifica. Vede l’ultima versione approvata, e Pubblica invia esattamente questa versione. La avviseremo quando la nuova sarà pronta.",
    withTeamLive: "Il team di RepGet sta controllando una modifica. L’articolo sul suo sito resta invariato, e qui vede ciò che è pubblicato. La avviseremo quando la modifica sarà pronta.",
    lockedWithTeam: "Potrà modificarlo di nuovo quando il team di RepGet avrà finito.",
    saveNote: "Salvando, la sua modifica passa al team di RepGet per un controllo. Fino ad allora vede e può pubblicare l’ultima versione approvata. La avviseremo quando la nuova sarà pronta.",
    saveNoteLive: "Salvando, la sua modifica passa al team di RepGet per un controllo. Fino ad allora questa pagina e il suo sito mantengono la versione attuale. La avviseremo quando la nuova sarà pronta.",
    rewriteNote: "La nuova versione passa al team di RepGet. Fino ad allora vede e può pubblicare l’ultima versione approvata.",
    errPreparing: "Il team di RepGet sta preparando questo articolo. La avviseremo quando sarà pronto per la pubblicazione.",
    errAlreadyOnSite: "Questa versione è già sul suo sito.",
    errAlreadyDelivering: "Questo articolo è già in viaggio verso il suo sito.",
    dashboardPreparingHelp: "Il team di RepGet lo sta preparando. La avviseremo quando sarà pronto per la pubblicazione; lei non deve fare nulla.",
    dashboardReady: "Pronto per la pubblicazione",
    dashboardReadyHelp: "Il team di RepGet lo ha completato. Lo apra per pubblicarlo.",
    notifyReady: "Il suo articolo è pronto per la pubblicazione",
    notifyUpdate: "L’aggiornamento del suo articolo è pronto per la pubblicazione",
    notifyConnect: "{title}. Colleghi il suo sito per pubblicarlo.",
    notifyDay: "{title}. Verrà pubblicato da solo nella data prevista, oppure può pubblicarlo subito.",
    withTeamChange: "Il team di RepGet sta controllando questa modifica. L’articolo sul suo sito resta invariato. La avviseremo quando la modifica sarà pronta.",
    firstArticleTwoStep: "Il suo primo articolo passa prima dal team di RepGet. Poi vale la sua scelta.",
    errPluginUpdate: "Per inviare questo aggiornamento, aggiorni prima il plugin RepGet del suo sito alla versione 1.10 o successiva.",
    pluginDraftNote: "Questo articolo è sul suo sito come bozza. Per pubblicarlo da qui, aggiorni il plugin RepGet del suo sito alla versione 1.10 o successiva, oppure lo pubblichi da WordPress.",
    pluginDraftReady: "Pronto per la pubblicazione. Questo articolo è sul suo sito come bozza, e Pubblica mette online quella stessa bozza.",
    refusedChanged: "Questa bozza è stata modificata in WordPress, quindi non è stata né pubblicata né sovrascritta. La pubblichi da WordPress.",
    refusedUnverified: "Questa bozza è stata salvata da una versione precedente del plugin e RepGet non può confermare che sia rimasta invariata, quindi non è stata né pubblicata né sovrascritta. La pubblichi da WordPress.",
    refusedTrashed: "Questa bozza è nel cestino di WordPress, quindi non è stato pubblicato nulla. La ripristini, poi prema di nuovo Pubblica.",
    refusedDeleted: "Questa bozza è stata eliminata da WordPress, quindi non è stato pubblicato nulla e non è stato creato un nuovo articolo. Contatti il team di RepGet per riceverla di nuovo.",
    publishedInWordPress: "Questo articolo è stato pubblicato da WordPress, quindi ciò che è online può differire da questa versione.",
    notifyNotPublished: "Il suo articolo non è stato pubblicato",
    onboardingNote: "Studiamo le sue parole chiave, costruiamo un calendario di contenuti su misura per il suo piano e iniziamo a scrivere. Il team di RepGet prepara il suo primo articolo, e la avviseremo quando sarà pronto per la pubblicazione.",
    finishedManual: "Tenerlo in RepGet finché non premo Pubblica",
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
    withTeam: "Das RepGet-Team arbeitet an einer Änderung. Sie sehen die zuletzt freigegebene Version, und Veröffentlichen sendet genau diese Version. Sie werden benachrichtigt, sobald die neue fertig ist.",
    withTeamLive: "Das RepGet-Team prüft eine Änderung. Der Beitrag auf Ihrer Website bleibt unverändert, und Sie sehen hier, was dort steht. Sie werden benachrichtigt, sobald die Änderung fertig ist.",
    lockedWithTeam: "Das können Sie wieder ändern, sobald das RepGet-Team fertig ist.",
    saveNote: "Beim Speichern geht Ihre Änderung zur Prüfung an das RepGet-Team. Bis dahin sehen Sie die zuletzt freigegebene Version und können sie veröffentlichen. Sie werden benachrichtigt, sobald die neue fertig ist.",
    saveNoteLive: "Beim Speichern geht Ihre Änderung zur Prüfung an das RepGet-Team. Bis dahin behalten diese Seite und Ihre Website die aktuelle Version. Sie werden benachrichtigt, sobald die neue fertig ist.",
    rewriteNote: "Die neue Version geht an das RepGet-Team. Bis dahin sehen Sie die zuletzt freigegebene Version und können sie veröffentlichen.",
    errPreparing: "Das RepGet-Team bereitet diesen Artikel vor. Sie werden benachrichtigt, sobald er zur Veröffentlichung bereit ist.",
    errAlreadyOnSite: "Genau diese Version ist bereits auf Ihrer Website.",
    errAlreadyDelivering: "Dieser Artikel ist bereits auf dem Weg zu Ihrer Website.",
    dashboardPreparingHelp: "Das RepGet-Team bereitet ihn vor. Sie werden benachrichtigt, sobald er zur Veröffentlichung bereit ist; Sie müssen nichts tun.",
    dashboardReady: "Bereit zur Veröffentlichung",
    dashboardReadyHelp: "Das RepGet-Team hat ihn fertiggestellt. Öffnen Sie ihn, um ihn zu veröffentlichen.",
    notifyReady: "Ihr Artikel ist zur Veröffentlichung bereit",
    notifyUpdate: "Die Aktualisierung Ihres Artikels ist zur Veröffentlichung bereit",
    notifyConnect: "{title}. Verbinden Sie Ihre Website, um ihn zu veröffentlichen.",
    notifyDay: "{title}. Er wird am geplanten Tag von selbst veröffentlicht, oder Sie veröffentlichen ihn jetzt.",
    withTeamChange: "Das RepGet-Team prüft diese Änderung. Der Beitrag auf Ihrer Website bleibt unverändert. Sie werden benachrichtigt, sobald die Änderung fertig ist.",
    firstArticleTwoStep: "Ihr erster Artikel geht zuerst an das RepGet-Team. Danach gilt Ihre Auswahl.",
    errPluginUpdate: "Um diese Aktualisierung zu senden, aktualisieren Sie zuerst das RepGet-Plugin auf Ihrer Website auf Version 1.10 oder neuer.",
    pluginDraftNote: "Dieser Artikel ist als Entwurf auf Ihrer Website. Um ihn von hier aus zu veröffentlichen, aktualisieren Sie das RepGet-Plugin Ihrer Website auf Version 1.10 oder neuer, oder veröffentlichen Sie ihn in WordPress.",
    pluginDraftReady: "Bereit zur Veröffentlichung. Dieser Artikel ist als Entwurf auf Ihrer Website, und Veröffentlichen schaltet genau diesen Entwurf live.",
    refusedChanged: "Dieser Entwurf wurde in WordPress geändert und wurde daher weder veröffentlicht noch überschrieben. Bitte veröffentlichen Sie ihn in WordPress.",
    refusedUnverified: "Dieser Entwurf wurde von einer älteren Plugin-Version gespeichert, und RepGet kann nicht bestätigen, dass er unverändert ist. Er wurde daher weder veröffentlicht noch überschrieben. Bitte veröffentlichen Sie ihn in WordPress.",
    refusedTrashed: "Dieser Entwurf liegt im WordPress-Papierkorb, daher wurde nichts veröffentlicht. Stellen Sie ihn dort wieder her und klicken Sie erneut auf Veröffentlichen.",
    refusedDeleted: "Dieser Entwurf wurde aus WordPress gelöscht, daher wurde nichts veröffentlicht und kein neuer Beitrag erstellt. Wenden Sie sich an das RepGet-Team, um ihn erneut zu erhalten.",
    publishedInWordPress: "Dieser Beitrag wurde in WordPress veröffentlicht. Was live ist, kann daher von dieser Version abweichen.",
    notifyNotPublished: "Ihr Artikel wurde nicht veröffentlicht",
    onboardingNote: "Wir recherchieren Ihre Suchbegriffe, bauen einen auf Ihren Tarif zugeschnittenen Contentplan und fangen an zu schreiben. Das RepGet-Team bereitet Ihren ersten Artikel vor, und Sie werden benachrichtigt, sobald er zur Veröffentlichung bereit ist.",
    finishedManual: "In RepGet behalten, bis ich auf Veröffentlichen klicke",
  },
};
