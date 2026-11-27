import type { Locale } from "@/lib/i18n/config";

/**
 * The Opportunities page as Daniel's 24 Nov 2026 ticket has it: one row per
 * platform that opens to its opportunities, a button on each that opens the
 * real place, and suggestions without a connected account. The rest of the
 * page's words are in messages.ts (app.social) and social-connections.ts.
 * {placeholders} are filled with format(); "one|many" with plural().
 */
export type OpportunitiesCopy = {
  intro: string;
  /** {shown}, {total}, {platforms}. */
  showing: string;
  /** "one|many", {count}. */
  opportunities: string;
  newCount: string;
  totalCount: string;
  tagPost: string;
  tagConversation: string;
  /** The row buttons: {platform}. */
  openOn: string;
  createOn: string;
  /** Said before the click, by screen readers and on hover: {platform}, {price}. */
  oneClickHelp: string;
  oneClickHelpFree: string;
  /** After a scheduled post is posted by hand. */
  scheduledHelp: string;
  /** The one-click post opened its tab, and RepGet's record of it has not answered. */
  recordSlow: string;
  /** A conversation's source, as a link: {where}. */
  sourceLabel: string;
  /** An open platform with nothing in it. */
  platformEmpty: string;
  /** Nothing anywhere yet. */
  emptyTitle: string;
  emptyHelp: string;
  connectOptional: string;
  /** The website's analysis has not finished. */
  analysingTitle: string;
  analysingHelp: string;
  /** The review drawer, for a platform with no account: {platform}. */
  noAccountNote: string;
  /** Account settings, a paused account. */
  paused: string;
  turnOn: string;
  /** The review drawer, a reply: when RepGet lets a reply name the business (lib/social/mention.ts). */
  replyNatural: string;
  /** A reply's community (a subreddit): its rules, as a link; {community}. */
  communityRules: string;
  /** A community known to remove self-promotion: {community}; the row's short form. */
  communityStrict: string;
  communityStrictShort: string;
  /** LinkedIn's group and card: own posts only, no conversations through its API. */
  linkedinNote: string;
  linkedinCard: string;
};

export const OPPORTUNITIES_COPY: Record<Locale, OpportunitiesCopy> = {
  en: {
    intro:
      "Posts and conversations found for your website. Review the text, make it yours and post it with one click. Connect an account and RepGet can also publish your own posts for you.",
    showing: "Showing {shown} of {total} opportunities across {platforms} platforms",
    opportunities: "{count} opportunity|{count} opportunities",
    newCount: "{count} new",
    totalCount: "{count} total",
    tagPost: "Suggested post",
    tagConversation: "Conversation",
    openOn: "Open on {platform}",
    createOn: "Create on {platform}",
    oneClickHelp: "Copies the text, opens {platform} and counts as posted. Costs {price}.",
    oneClickHelpFree: "Copies the text, opens {platform} and counts as posted.",
    scheduledHelp: "RepGet will then not publish it.",
    recordSlow: "RepGet has not confirmed this post yet. Reload the page before trying again: a post is never charged twice.",
    sourceLabel: "Open the discussion in {where}",
    platformEmpty: "Nothing here yet. New suggestions arrive in the morning.",
    emptyTitle: "RepGet writes your first suggestions from your website's information.",
    emptyHelp: "No account is needed: copy the text, open the platform and post it yourself. New suggestions arrive in the morning, or ask for them now.",
    connectOptional: "Connect accounts (optional)",
    analysingTitle: "Suggestions start when your website's analysis is finished.",
    analysingHelp: "You can connect your accounts meanwhile.",
    noAccountNote: "{platform} is not connected, so you post this yourself. RepGet does not know the account: it keeps links and product names out, as for a new one.",
    paused: "Automatic posting is paused. Your posts are ready to post by hand.",
    turnOn: "Turn on again",
    replyNatural: "RepGet keeps replies helpful and free of promotion: your business is named only where a discussion asks for recommendations, the community allows it, and in about 1 reply in 10. Platforms can ban accounts that promote themselves, and that falls on your account.",
    communityRules: "Read the rules of {community}",
    communityStrict: "{community} usually removes self-promotion. Post this only as a helpful answer, without your business's name, and read its rules first.",
    communityStrictShort: "No self-promotion",
    linkedinNote: "LinkedIn: RepGet writes your own posts and, once the account is connected, publishes them on the profile or company page you chose. LinkedIn does not let apps find or answer other people's posts, so there are no conversations here.",
    linkedinCard: "Own posts only",
  },
  es: {
    intro:
      "Publicaciones y conversaciones encontradas para su sitio web. Revise el texto, hágalo suyo y publíquelo con un clic. Si conecta una cuenta, RepGet también puede publicar sus propias publicaciones.",
    showing: "{shown} de {total} oportunidades en {platforms} plataformas",
    opportunities: "{count} oportunidad|{count} oportunidades",
    newCount: "{count} nuevas",
    totalCount: "{count} en total",
    tagPost: "Publicación sugerida",
    tagConversation: "Conversación",
    openOn: "Abrir en {platform}",
    createOn: "Crear en {platform}",
    oneClickHelp: "Copia el texto, abre {platform} y cuenta como publicado. Cuesta {price}.",
    oneClickHelpFree: "Copia el texto, abre {platform} y cuenta como publicado.",
    scheduledHelp: "RepGet ya no lo publicará.",
    recordSlow: "RepGet aún no ha confirmado esta publicación. Recargue la página antes de volver a intentarlo: una publicación nunca se cobra dos veces.",
    sourceLabel: "Abrir la conversación en {where}",
    platformEmpty: "Todavía no hay nada. Las nuevas sugerencias llegan por la mañana.",
    emptyTitle: "RepGet escribe sus primeras sugerencias con la información de su sitio web.",
    emptyHelp: "No necesita ninguna cuenta conectada: copie el texto, abra la plataforma y publíquelo usted. Las nuevas sugerencias llegan por la mañana, o pídalas ahora.",
    connectOptional: "Conectar cuentas (opcional)",
    analysingTitle: "Las sugerencias empiezan cuando termina el análisis de su sitio web.",
    analysingHelp: "Mientras tanto puede conectar sus cuentas.",
    noAccountNote: "{platform} no está conectado, así que lo publica usted. RepGet no conoce la cuenta: evita enlaces y nombres de producto, como con una cuenta nueva.",
    paused: "La publicación automática está en pausa. Sus publicaciones están listas para publicarlas a mano.",
    turnOn: "Volver a activar",
    replyNatural: "RepGet mantiene las respuestas útiles y sin promoción: su negocio solo se menciona cuando una conversación pide recomendaciones, la comunidad lo permite y, como mucho, en 1 de cada 10 respuestas. Las plataformas pueden bloquear las cuentas que se promocionan, y eso recae en su cuenta.",
    communityRules: "Lea las normas de {community}",
    communityStrict: "{community} suele eliminar la autopromoción. Publique esto solo como una respuesta útil, sin el nombre de su negocio, y lea antes sus normas.",
    communityStrictShort: "Sin autopromoción",
    linkedinNote: "LinkedIn: RepGet escribe sus propias publicaciones y, una vez conectada la cuenta, las publica en el perfil o la página de empresa que haya elegido. LinkedIn no permite a las aplicaciones encontrar ni responder publicaciones de otras personas, así que aquí no hay conversaciones.",
    linkedinCard: "Solo publicaciones propias",
  },
  fr: {
    intro:
      "Publications et conversations trouvées pour votre site. Relisez le texte, adaptez-le et publiez-le en un clic. Si vous connectez un compte, RepGet peut aussi publier vos propres publications.",
    showing: "{shown} opportunités sur {total}, sur {platforms} plateformes",
    opportunities: "{count} opportunité|{count} opportunités",
    newCount: "{count} nouv.",
    totalCount: "{count} au total",
    tagPost: "Publication suggérée",
    tagConversation: "Conversation",
    openOn: "Ouvrir sur {platform}",
    createOn: "Créer sur {platform}",
    oneClickHelp: "Copie le texte, ouvre {platform} et compte comme publié. Coûte {price}.",
    oneClickHelpFree: "Copie le texte, ouvre {platform} et compte comme publié.",
    scheduledHelp: "RepGet ne la publiera alors plus.",
    recordSlow: "RepGet n'a pas encore confirmé cette publication. Rechargez la page avant de réessayer : une publication n'est jamais facturée deux fois.",
    sourceLabel: "Ouvrir la discussion dans {where}",
    platformEmpty: "Rien pour l'instant. Les nouvelles suggestions arrivent le matin.",
    emptyTitle: "RepGet rédige vos premières suggestions à partir des informations de votre site.",
    emptyHelp: "Aucun compte n'est nécessaire : copiez le texte, ouvrez la plateforme et publiez-le vous-même. Les nouvelles suggestions arrivent le matin, ou demandez-les maintenant.",
    connectOptional: "Connecter des comptes (facultatif)",
    analysingTitle: "Les suggestions commencent dès que l'analyse de votre site est terminée.",
    analysingHelp: "Vous pouvez déjà connecter vos comptes.",
    noAccountNote: "{platform} n'est pas connecté, vous publiez donc vous-même. RepGet ne connaît pas le compte : il évite les liens et les noms de produits, comme pour un nouveau compte.",
    paused: "La publication automatique est en pause. Vos publications sont prêtes à être publiées à la main.",
    turnOn: "Réactiver",
    replyNatural: "RepGet garde les réponses utiles et sans promotion : votre entreprise n’est citée que lorsqu’une discussion demande des recommandations, que la communauté l’autorise, et au plus dans 1 réponse sur 10. Les plateformes peuvent bannir les comptes qui font leur propre promotion, et c’est votre compte qui en subit les conséquences.",
    communityRules: "Lire les règles de {community}",
    communityStrict: "{community} supprime généralement l’autopromotion. Publiez ceci uniquement comme une réponse utile, sans le nom de votre entreprise, et lisez d’abord ses règles.",
    communityStrictShort: "Pas d’autopromotion",
    linkedinNote: "LinkedIn : RepGet rédige vos propres publications et, une fois le compte connecté, les publie sur le profil ou la page entreprise choisis. LinkedIn ne permet pas aux applications de trouver les publications d’autres personnes ni d’y répondre : il n’y a donc pas de conversations ici.",
    linkedinCard: "Vos publications uniquement",
  },
  it: {
    intro:
      "Post e conversazioni trovati per il suo sito. Controlli il testo, lo personalizzi e lo pubblichi con un clic. Se collega un account, RepGet può anche pubblicare i suoi post.",
    showing: "{shown} opportunità su {total} in {platforms} piattaforme",
    opportunities: "{count} opportunità|{count} opportunità",
    newCount: "{count} nuove",
    totalCount: "{count} in totale",
    tagPost: "Post suggerito",
    tagConversation: "Conversazione",
    openOn: "Apri su {platform}",
    createOn: "Crea su {platform}",
    oneClickHelp: "Copia il testo, apre {platform} e conta come pubblicato. Costa {price}.",
    oneClickHelpFree: "Copia il testo, apre {platform} e conta come pubblicato.",
    scheduledHelp: "RepGet non lo pubblicherà più.",
    recordSlow: "RepGet non ha ancora confermato questa pubblicazione. Ricarichi la pagina prima di riprovare: una pubblicazione non viene mai addebitata due volte.",
    sourceLabel: "Apri la discussione in {where}",
    platformEmpty: "Ancora niente. I nuovi suggerimenti arrivano al mattino.",
    emptyTitle: "RepGet scrive i suoi primi suggerimenti dalle informazioni del suo sito.",
    emptyHelp: "Non serve alcun account: copi il testo, apra la piattaforma e lo pubblichi lei. I nuovi suggerimenti arrivano al mattino, oppure li chieda ora.",
    connectOptional: "Collega account (facoltativo)",
    analysingTitle: "I suggerimenti iniziano al termine dell'analisi del suo sito.",
    analysingHelp: "Nel frattempo può collegare i suoi account.",
    noAccountNote: "{platform} non è collegato, quindi pubblica lei. RepGet non conosce l'account: evita link e nomi di prodotti, come per un account nuovo.",
    paused: "La pubblicazione automatica è in pausa. I suoi post sono pronti da pubblicare a mano.",
    turnOn: "Riattiva",
    replyNatural: "RepGet mantiene le risposte utili e senza promozione: la Sua attività viene nominata solo quando una discussione chiede consigli, la community lo consente e al massimo in 1 risposta su 10. Le piattaforme possono bannare gli account che si promuovono, e le conseguenze ricadono sul Suo account.",
    communityRules: "Legga le regole di {community}",
    communityStrict: "{community} di solito rimuove l’autopromozione. La pubblichi solo come risposta utile, senza il nome della Sua attività, e legga prima le regole.",
    communityStrictShort: "Niente autopromozione",
    linkedinNote: "LinkedIn: RepGet scrive i Suoi post e, una volta collegato l’account, li pubblica sul profilo o sulla pagina aziendale scelti. LinkedIn non consente alle app di trovare i post di altre persone né di rispondervi, quindi qui non ci sono conversazioni.",
    linkedinCard: "Solo post propri",
  },
  de: {
    intro:
      "Beiträge und Gespräche, die zu Ihrer Website passen. Prüfen Sie den Text, passen Sie ihn an und veröffentlichen Sie ihn mit einem Klick. Wenn Sie ein Konto verbinden, kann RepGet Ihre eigenen Beiträge auch für Sie veröffentlichen.",
    showing: "{shown} von {total} Chancen auf {platforms} Plattformen",
    opportunities: "{count} Chance|{count} Chancen",
    newCount: "{count} neu",
    totalCount: "{count} gesamt",
    tagPost: "Vorgeschlagener Beitrag",
    tagConversation: "Gespräch",
    openOn: "Auf {platform} öffnen",
    createOn: "Auf {platform} erstellen",
    oneClickHelp: "Kopiert den Text, öffnet {platform} und zählt als veröffentlicht. Kostet {price}.",
    oneClickHelpFree: "Kopiert den Text, öffnet {platform} und zählt als veröffentlicht.",
    scheduledHelp: "RepGet veröffentlicht ihn dann nicht mehr.",
    recordSlow: "RepGet hat diesen Beitrag noch nicht bestätigt. Laden Sie die Seite neu, bevor Sie es erneut versuchen: Ein Beitrag wird nie doppelt berechnet.",
    sourceLabel: "Diskussion in {where} öffnen",
    platformEmpty: "Noch nichts vorhanden. Neue Vorschläge kommen am Morgen.",
    emptyTitle: "RepGet schreibt Ihre ersten Vorschläge aus den Informationen Ihrer Website.",
    emptyHelp: "Sie brauchen kein verbundenes Konto: Text kopieren, Plattform öffnen und selbst veröffentlichen. Neue Vorschläge kommen am Morgen, oder Sie fordern sie jetzt an.",
    connectOptional: "Konten verbinden (optional)",
    analysingTitle: "Vorschläge gibt es, sobald die Analyse Ihrer Website abgeschlossen ist.",
    analysingHelp: "Ihre Konten können Sie inzwischen verbinden.",
    noAccountNote: "{platform} ist nicht verbunden, Sie veröffentlichen also selbst. RepGet kennt das Konto nicht und verzichtet wie bei einem neuen Konto auf Links und Produktnamen.",
    paused: "Die automatische Veröffentlichung ist pausiert. Ihre Beiträge können Sie von Hand veröffentlichen.",
    turnOn: "Wieder einschalten",
    replyNatural: "RepGet hält Antworten hilfreich und frei von Werbung: Ihr Unternehmen wird nur genannt, wenn eine Diskussion nach Empfehlungen fragt, die Community das erlaubt, und höchstens in etwa 1 von 10 Antworten. Plattformen können Konten sperren, die für sich werben, und das trifft Ihr Konto.",
    communityRules: "Regeln von {community} lesen",
    communityStrict: "{community} entfernt Eigenwerbung in der Regel. Posten Sie dies nur als hilfreiche Antwort, ohne den Namen Ihres Unternehmens, und lesen Sie vorher die Regeln.",
    communityStrictShort: "Keine Eigenwerbung",
    linkedinNote: "LinkedIn: RepGet schreibt Ihre eigenen Beiträge und veröffentlicht sie nach dem Verbinden auf dem gewählten Profil oder der Unternehmensseite. LinkedIn erlaubt Apps nicht, Beiträge anderer zu finden oder zu beantworten, daher gibt es hier keine Unterhaltungen.",
    linkedinCard: "Nur eigene Beiträge",
  },
};
