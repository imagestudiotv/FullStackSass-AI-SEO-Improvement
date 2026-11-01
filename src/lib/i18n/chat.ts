import type { ChatActionKind } from "@/lib/chat/action-kinds";
import type { ChatPage } from "@/lib/chat/config";
import type { Locale } from "@/lib/i18n/config";

/**
 * The Home page chat's words (lib/chat; client, 2026-10-31). Five languages,
 * formal address, like the rest of the app. {placeholders} are filled with
 * format() (lib/i18n/format.ts); "one|other" pairs with plural().
 */
export type ChatCopy = {
  title: string;
  intro: string;
  placeholder: string;
  send: string;
  thinking: string;
  newChat: string;
  history: string;
  noHistory: string;
  deleteChat: string;
  /** "{count} free message left today|{count} free messages left today" */
  freeLeft: string;
  /** After the free ones: "Each message now costs {price}." */
  freeUsed: string;
  /** "{free} free messages a day, then {price} each." */
  allowance: string;
  keepNote: string;
  disclaimer: string;
  starters: string[];
  open: string;
  pages: Record<ChatPage, string>;
  actions: Record<ChatActionKind, string>;
  confirm: string;
  cancel: string;
  done: string;
  cancelled: string;
  /** "Could not be done: {error}" */
  failed: string;
  priceFree: string;
  priceArticle: string;
  /** "{count} topic added|{count} topics added" */
  topicsAdded: string;
  errors: {
    view_only: string;
    no_plan: string;
    not_configured: string;
    empty: string;
    too_long: string;
    not_found: string;
    /** "{price} needed, {available} available." */
    not_enough_credits: string;
    ai_failed: string;
    already_handled: string;
    generic: string;
  };
};

const en: ChatCopy = {
  title: "Ask RepGet",
  intro: "Ask anything about your website: traffic, articles, website health, AI visibility, backlinks, social media and videos. RepGet answers from your data and can do things for you once you confirm.",
  placeholder: "Ask about your website...",
  send: "Send",
  thinking: "Looking at your data...",
  newChat: "New chat",
  history: "Earlier chats",
  noHistory: "No earlier chats yet.",
  deleteChat: "Delete this chat",
  freeLeft: "{count} free message left today|{count} free messages left today",
  freeUsed: "Today's free messages are used. Each message now costs {price}.",
  allowance: "{free} free messages a day, then {price} each.",
  keepNote: "Chats are kept for 30 days.",
  disclaimer: "The assistant can make mistakes. Check important figures on their page.",
  starters: ["How is my website doing?", "Why did my traffic drop?", "What should I fix first?", "Which article is doing best?"],
  open: "Open",
  pages: {
    dashboard: "Dashboard",
    planned_articles: "Planned articles",
    website_health: "Website health",
    google: "Google",
    losing_traffic: "Losing traffic",
    ai_visibility: "AI visibility",
    backlinks: "Backlinks",
    social: "Social media",
    videos: "Videos",
    profile: "Business profile",
    integrations: "Integrations",
    publishing: "Publishing",
    credits: "Credits",
    billing: "Billing",
  },
  actions: {
    add_topics: "Add topics to your planned articles",
    write_article: "Write this article now",
    rerun_website_check: "Run the website check again",
    find_social_posts: "Find new social media suggestions",
    make_video: "Make this video",
    new_video_ideas: "Write today's video ideas",
    snooze_task: "Hide this task for 7 days",
    add_backlink_page: "Get backlinks to this page",
  },
  confirm: "Confirm",
  cancel: "Cancel",
  done: "Done",
  cancelled: "Cancelled",
  failed: "Could not be done: {error}",
  priceFree: "Free",
  priceArticle: "Part of your plan's monthly articles",
  topicsAdded: "{count} topic added|{count} topics added",
  errors: {
    view_only: "You have view-only access to this website, so you cannot use the assistant.",
    no_plan: "Choose a plan for this website to use the assistant.",
    not_configured: "The assistant is not available right now.",
    empty: "Please write a message.",
    too_long: "That message is too long. Please shorten it.",
    not_found: "This chat no longer exists.",
    not_enough_credits: "Not enough credits: {price} needed, {available} available.",
    ai_failed: "No answer came this time. Your message was not counted, please try again.",
    already_handled: "This was already confirmed or cancelled.",
    generic: "Something went wrong. Please try again.",
  },
};

const es: ChatCopy = {
  title: "Pregunte a RepGet",
  intro: "Pregunte lo que quiera sobre su sitio web: tráfico, artículos, salud del sitio, visibilidad en IA, backlinks, redes sociales y vídeos. RepGet responde con sus datos y puede hacer cosas por usted cuando usted lo confirme.",
  placeholder: "Pregunte sobre su sitio web...",
  send: "Enviar",
  thinking: "Revisando sus datos...",
  newChat: "Nueva conversación",
  history: "Conversaciones anteriores",
  noHistory: "Todavía no hay conversaciones anteriores.",
  deleteChat: "Eliminar esta conversación",
  freeLeft: "Le queda {count} mensaje gratis hoy|Le quedan {count} mensajes gratis hoy",
  freeUsed: "Ha usado los mensajes gratis de hoy. Cada mensaje cuesta ahora {price}.",
  allowance: "{free} mensajes gratis al día, después {price} cada uno.",
  keepNote: "Las conversaciones se guardan 30 días.",
  disclaimer: "El asistente puede equivocarse. Compruebe las cifras importantes en su página.",
  starters: ["¿Cómo va mi sitio web?", "¿Por qué ha bajado mi tráfico?", "¿Qué debería arreglar primero?", "¿Qué artículo funciona mejor?"],
  open: "Abrir",
  pages: {
    dashboard: "Panel",
    planned_articles: "Artículos planificados",
    website_health: "Salud del sitio",
    google: "Google",
    losing_traffic: "Pérdida de tráfico",
    ai_visibility: "Visibilidad en IA",
    backlinks: "Backlinks",
    social: "Redes sociales",
    videos: "Vídeos",
    profile: "Perfil del negocio",
    integrations: "Integraciones",
    publishing: "Publicación",
    credits: "Créditos",
    billing: "Facturación",
  },
  actions: {
    add_topics: "Añadir temas a sus artículos planificados",
    write_article: "Escribir este artículo ahora",
    rerun_website_check: "Volver a revisar el sitio web",
    find_social_posts: "Buscar nuevas sugerencias para redes sociales",
    make_video: "Crear este vídeo",
    new_video_ideas: "Escribir las ideas de vídeo de hoy",
    snooze_task: "Ocultar esta tarea durante 7 días",
    add_backlink_page: "Conseguir backlinks para esta página",
  },
  confirm: "Confirmar",
  cancel: "Cancelar",
  done: "Hecho",
  cancelled: "Cancelado",
  failed: "No se pudo hacer: {error}",
  priceFree: "Gratis",
  priceArticle: "Forma parte de los artículos mensuales de su plan",
  topicsAdded: "{count} tema añadido|{count} temas añadidos",
  errors: {
    view_only: "Solo tiene acceso de lectura a este sitio web, por lo que no puede usar el asistente.",
    no_plan: "Elija un plan para este sitio web para usar el asistente.",
    not_configured: "El asistente no está disponible en este momento.",
    empty: "Escriba un mensaje.",
    too_long: "El mensaje es demasiado largo. Acórtelo, por favor.",
    not_found: "Esta conversación ya no existe.",
    not_enough_credits: "No hay créditos suficientes: se necesitan {price}, hay {available}.",
    ai_failed: "Esta vez no llegó ninguna respuesta. Su mensaje no se ha contado, inténtelo de nuevo.",
    already_handled: "Esto ya se confirmó o se canceló.",
    generic: "Algo salió mal. Inténtelo de nuevo.",
  },
};

const fr: ChatCopy = {
  title: "Demandez à RepGet",
  intro: "Posez toutes vos questions sur votre site : trafic, articles, santé du site, visibilité IA, backlinks, réseaux sociaux et vidéos. RepGet répond à partir de vos données et peut agir pour vous une fois que vous avez confirmé.",
  placeholder: "Posez une question sur votre site...",
  send: "Envoyer",
  thinking: "Analyse de vos données...",
  newChat: "Nouvelle conversation",
  history: "Conversations précédentes",
  noHistory: "Pas encore de conversations précédentes.",
  deleteChat: "Supprimer cette conversation",
  freeLeft: "Il vous reste {count} message gratuit aujourd'hui|Il vous reste {count} messages gratuits aujourd'hui",
  freeUsed: "Les messages gratuits du jour sont utilisés. Chaque message coûte désormais {price}.",
  allowance: "{free} messages gratuits par jour, puis {price} chacun.",
  keepNote: "Les conversations sont conservées 30 jours.",
  disclaimer: "L'assistant peut se tromper. Vérifiez les chiffres importants sur leur page.",
  starters: ["Comment se porte mon site ?", "Pourquoi mon trafic a-t-il baissé ?", "Que dois-je corriger en premier ?", "Quel article fonctionne le mieux ?"],
  open: "Ouvrir",
  pages: {
    dashboard: "Tableau de bord",
    planned_articles: "Articles planifiés",
    website_health: "Santé du site",
    google: "Google",
    losing_traffic: "Trafic en baisse",
    ai_visibility: "Visibilité IA",
    backlinks: "Backlinks",
    social: "Réseaux sociaux",
    videos: "Vidéos",
    profile: "Profil de l'entreprise",
    integrations: "Intégrations",
    publishing: "Publication",
    credits: "Crédits",
    billing: "Facturation",
  },
  actions: {
    add_topics: "Ajouter des sujets à vos articles planifiés",
    write_article: "Écrire cet article maintenant",
    rerun_website_check: "Relancer l'analyse du site",
    find_social_posts: "Trouver de nouvelles suggestions pour les réseaux sociaux",
    make_video: "Créer cette vidéo",
    new_video_ideas: "Écrire les idées de vidéos du jour",
    snooze_task: "Masquer cette tâche pendant 7 jours",
    add_backlink_page: "Obtenir des backlinks vers cette page",
  },
  confirm: "Confirmer",
  cancel: "Annuler",
  done: "Fait",
  cancelled: "Annulé",
  failed: "Impossible : {error}",
  priceFree: "Gratuit",
  priceArticle: "Compris dans les articles mensuels de votre formule",
  topicsAdded: "{count} sujet ajouté|{count} sujets ajoutés",
  errors: {
    view_only: "Vous avez un accès en lecture seule à ce site, vous ne pouvez donc pas utiliser l'assistant.",
    no_plan: "Choisissez une formule pour ce site afin d'utiliser l'assistant.",
    not_configured: "L'assistant n'est pas disponible pour le moment.",
    empty: "Veuillez écrire un message.",
    too_long: "Ce message est trop long. Veuillez le raccourcir.",
    not_found: "Cette conversation n'existe plus.",
    not_enough_credits: "Crédits insuffisants : {price} nécessaires, {available} disponibles.",
    ai_failed: "Aucune réponse cette fois. Votre message n'a pas été compté, veuillez réessayer.",
    already_handled: "Cela a déjà été confirmé ou annulé.",
    generic: "Une erreur s'est produite. Veuillez réessayer.",
  },
};

const it: ChatCopy = {
  title: "Chieda a RepGet",
  intro: "Chieda qualsiasi cosa sul suo sito: traffico, articoli, salute del sito, visibilità nelle IA, backlink, social media e video. RepGet risponde con i suoi dati e può fare cose per lei, dopo la sua conferma.",
  placeholder: "Chieda qualcosa sul suo sito...",
  send: "Invia",
  thinking: "Sto guardando i suoi dati...",
  newChat: "Nuova conversazione",
  history: "Conversazioni precedenti",
  noHistory: "Ancora nessuna conversazione precedente.",
  deleteChat: "Elimina questa conversazione",
  freeLeft: "Le resta {count} messaggio gratuito oggi|Le restano {count} messaggi gratuiti oggi",
  freeUsed: "I messaggi gratuiti di oggi sono finiti. Ogni messaggio ora costa {price}.",
  allowance: "{free} messaggi gratuiti al giorno, poi {price} ciascuno.",
  keepNote: "Le conversazioni vengono conservate per 30 giorni.",
  disclaimer: "L'assistente può sbagliare. Verifichi i dati importanti nella loro pagina.",
  starters: ["Come sta andando il mio sito?", "Perché il mio traffico è calato?", "Cosa dovrei sistemare per primo?", "Quale articolo funziona meglio?"],
  open: "Apri",
  pages: {
    dashboard: "Dashboard",
    planned_articles: "Articoli pianificati",
    website_health: "Salute del sito",
    google: "Google",
    losing_traffic: "Traffico in calo",
    ai_visibility: "Visibilità nelle IA",
    backlinks: "Backlink",
    social: "Social media",
    videos: "Video",
    profile: "Profilo aziendale",
    integrations: "Integrazioni",
    publishing: "Pubblicazione",
    credits: "Crediti",
    billing: "Fatturazione",
  },
  actions: {
    add_topics: "Aggiungere argomenti agli articoli pianificati",
    write_article: "Scrivere ora questo articolo",
    rerun_website_check: "Controllare di nuovo il sito",
    find_social_posts: "Trovare nuovi suggerimenti per i social",
    make_video: "Creare questo video",
    new_video_ideas: "Scrivere le idee video di oggi",
    snooze_task: "Nascondere questa attività per 7 giorni",
    add_backlink_page: "Ottenere backlink verso questa pagina",
  },
  confirm: "Conferma",
  cancel: "Annulla",
  done: "Fatto",
  cancelled: "Annullato",
  failed: "Non è stato possibile: {error}",
  priceFree: "Gratis",
  priceArticle: "Fa parte degli articoli mensili del suo piano",
  topicsAdded: "{count} argomento aggiunto|{count} argomenti aggiunti",
  errors: {
    view_only: "Ha accesso in sola lettura a questo sito, quindi non può usare l'assistente.",
    no_plan: "Scelga un piano per questo sito per usare l'assistente.",
    not_configured: "L'assistente al momento non è disponibile.",
    empty: "Scriva un messaggio.",
    too_long: "Il messaggio è troppo lungo. Lo accorci, per favore.",
    not_found: "Questa conversazione non esiste più.",
    not_enough_credits: "Crediti insufficienti: ne servono {price}, disponibili {available}.",
    ai_failed: "Questa volta non è arrivata una risposta. Il suo messaggio non è stato conteggiato, riprovi.",
    already_handled: "Questa azione è già stata confermata o annullata.",
    generic: "Qualcosa è andato storto. Riprovi.",
  },
};

const de: ChatCopy = {
  title: "Fragen Sie RepGet",
  intro: "Fragen Sie alles zu Ihrer Website: Traffic, Artikel, Website-Zustand, KI-Sichtbarkeit, Backlinks, Social Media und Videos. RepGet antwortet mit Ihren Daten und kann Dinge für Sie erledigen, sobald Sie bestätigen.",
  placeholder: "Fragen Sie etwas zu Ihrer Website...",
  send: "Senden",
  thinking: "Ihre Daten werden angesehen...",
  newChat: "Neuer Chat",
  history: "Frühere Chats",
  noHistory: "Noch keine früheren Chats.",
  deleteChat: "Diesen Chat löschen",
  freeLeft: "Heute noch {count} kostenlose Nachricht|Heute noch {count} kostenlose Nachrichten",
  freeUsed: "Die kostenlosen Nachrichten für heute sind aufgebraucht. Jede Nachricht kostet jetzt {price}.",
  allowance: "{free} kostenlose Nachrichten pro Tag, danach je {price}.",
  keepNote: "Chats werden 30 Tage aufbewahrt.",
  disclaimer: "Der Assistent kann Fehler machen. Prüfen Sie wichtige Zahlen auf der jeweiligen Seite.",
  starters: ["Wie steht meine Website da?", "Warum ist mein Traffic gesunken?", "Was sollte ich zuerst beheben?", "Welcher Artikel läuft am besten?"],
  open: "Öffnen",
  pages: {
    dashboard: "Dashboard",
    planned_articles: "Geplante Artikel",
    website_health: "Website-Zustand",
    google: "Google",
    losing_traffic: "Traffic-Verluste",
    ai_visibility: "KI-Sichtbarkeit",
    backlinks: "Backlinks",
    social: "Social Media",
    videos: "Videos",
    profile: "Unternehmensprofil",
    integrations: "Integrationen",
    publishing: "Veröffentlichung",
    credits: "Credits",
    billing: "Abrechnung",
  },
  actions: {
    add_topics: "Themen zu Ihren geplanten Artikeln hinzufügen",
    write_article: "Diesen Artikel jetzt schreiben",
    rerun_website_check: "Website erneut prüfen",
    find_social_posts: "Neue Social-Media-Vorschläge finden",
    make_video: "Dieses Video erstellen",
    new_video_ideas: "Die Videoideen für heute schreiben",
    snooze_task: "Diese Aufgabe 7 Tage ausblenden",
    add_backlink_page: "Backlinks für diese Seite bekommen",
  },
  confirm: "Bestätigen",
  cancel: "Abbrechen",
  done: "Erledigt",
  cancelled: "Abgebrochen",
  failed: "Nicht möglich: {error}",
  priceFree: "Kostenlos",
  priceArticle: "Teil der monatlichen Artikel Ihres Tarifs",
  topicsAdded: "{count} Thema hinzugefügt|{count} Themen hinzugefügt",
  errors: {
    view_only: "Sie haben nur Lesezugriff auf diese Website und können den Assistenten daher nicht nutzen.",
    no_plan: "Wählen Sie einen Tarif für diese Website, um den Assistenten zu nutzen.",
    not_configured: "Der Assistent ist gerade nicht verfügbar.",
    empty: "Bitte schreiben Sie eine Nachricht.",
    too_long: "Diese Nachricht ist zu lang. Bitte kürzen Sie sie.",
    not_found: "Diesen Chat gibt es nicht mehr.",
    not_enough_credits: "Nicht genug Credits: {price} benötigt, {available} verfügbar.",
    ai_failed: "Diesmal kam keine Antwort. Ihre Nachricht wurde nicht gezählt, bitte versuchen Sie es erneut.",
    already_handled: "Das wurde bereits bestätigt oder abgebrochen.",
    generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
  },
};

export const CHAT_COPY: Record<Locale, ChatCopy> = { en, es, fr, it, de };
