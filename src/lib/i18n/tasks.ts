import type { Locale } from "@/lib/i18n/config";
import type { SetupTask, WorkTaskId } from "@/lib/tasks/tasks";

/**
 * The Tasks page (Home > Tasks; lib/tasks/tasks.ts), in every language.
 *
 * "one|many" strings go through plural(); {n} and {total} through format().
 * The set-up rows repeat the launch checklist's meaning in each language -
 * lib/onboarding/launch.ts holds them in English only, for /setup.
 */
type Row = { title: string; help: string };

export type TasksCopy = {
  title: string;
  help: string;
  overview: string;
  ringLabel: string;
  progress: string;
  allDone: string;
  today: string;
  todayHelp: string;
  setup: string;
  setupHelp: string;
  accounts: string;
  accountsHelp: string;
  waiting: string;
  nothingWaiting: string;
  done: string;
  toDo: string;
  optional: string;
  connectedOf: string;
  unavailable: string;
  work: Record<WorkTaskId, Row>;
  steps: Record<SetupTask["id"], Row>;
  account: Record<"social" | "video", Row>;
};

export const TASKS_COPY: Record<Locale, TasksCopy> = {
  en: {
    title: "Tasks",
    help: "Everything waiting for you on {domain}, in one list.",
    overview: "Open the overview",
    ringLabel: "done",
    progress: "{n} of {total} set-up tasks done",
    allDone: "Everything is set up",
    today: "Today's work",
    todayHelp: "New work arrives every day. A row clears once it has been handled.",
    setup: "Set up your website",
    setupHelp: "One-off steps. Each one ticks itself as soon as it is done.",
    accounts: "Connect your accounts",
    accountsHelp: "Connect the channels you use, so posts and videos can go out from RepGet.",
    waiting: "1 waiting|{count} waiting",
    nothingWaiting: "Nothing waiting",
    done: "Done",
    toDo: "To do",
    optional: "Optional",
    connectedOf: "{n} of {total} connected",
    unavailable: "Your tasks could not be loaded. Refresh the page to try again.",
    work: {
      failed: { title: "Articles that need attention", help: "Writing stopped on these. Open each one to see what went wrong and try again." },
      drafts: { title: "Drafts to review", help: "Your website uses manual publishing, so drafts wait for your approval." },
      social: { title: "Social posts and replies to review", help: "Suggestions for your channels from the last 7 days." },
      videos: { title: "Today's video ideas", help: "Choose the ideas you like and create the videos." },
    },
    steps: {
      profile: { title: "Check your business profile", help: "Your market, language, description and competitors. Every article is written from these." },
      site: { title: "Connect your website", help: "So finished articles can publish themselves to your blog." },
      "search-console": { title: "Connect Google Search Console", help: "Your real rankings and clicks, measured rather than estimated." },
      audit: { title: "Audit your website", help: "We read every page and list what is holding it back on Google and with AI assistants." },
      articles: { title: "Generate & launch your content plan", help: "Search terms, topic clusters and a publishing calendar." },
      preferences: { title: "Configure your article preferences", help: "Tone, words to avoid, and the rules every article should follow." },
      backlinks: { title: "Activate the backlink exchange", help: "Host articles for related businesses and earn links back to you." },
      prompts: { title: "Generate prompts & start AI tracking", help: "The questions customers ask AI assistants, and whether you are named in the answer." },
    },
    account: {
      social: { title: "Connect your social media channels", help: "We suggest posts and replies for every channel you connect." },
      video: { title: "Connect your video channels", help: "Instagram, TikTok, YouTube and Facebook, so finished videos can be posted." },
    },
  },
  es: {
    title: "Tareas",
    help: "Todo lo que le espera en {domain}, en una sola lista.",
    overview: "Abrir el resumen",
    ringLabel: "hecho",
    progress: "{n} de {total} tareas de configuración hechas",
    allDone: "Todo está configurado",
    today: "Trabajo de hoy",
    todayHelp: "Cada día llega trabajo nuevo. Una fila desaparece en cuanto se ha atendido.",
    setup: "Configure su sitio web",
    setupHelp: "Pasos únicos. Cada uno se marca solo en cuanto está hecho.",
    accounts: "Conecte sus cuentas",
    accountsHelp: "Conecte los canales que utiliza para que las publicaciones y los vídeos salgan desde RepGet.",
    waiting: "1 pendiente|{count} pendientes",
    nothingWaiting: "Nada pendiente",
    done: "Hecho",
    toDo: "Pendiente",
    optional: "Opcional",
    connectedOf: "{n} de {total} conectados",
    unavailable: "No se pudieron cargar sus tareas. Actualice la página para reintentar.",
    work: {
      failed: { title: "Artículos que requieren atención", help: "La redacción se detuvo en estos. Abra cada uno para ver qué ocurrió y vuelva a intentarlo." },
      drafts: { title: "Borradores por revisar", help: "Su sitio utiliza la publicación manual, así que los borradores esperan su aprobación." },
      social: { title: "Publicaciones y respuestas por revisar", help: "Sugerencias para sus canales de los últimos 7 días." },
      videos: { title: "Ideas de vídeo de hoy", help: "Elija las ideas que le gusten y cree los vídeos." },
    },
    steps: {
      profile: { title: "Revise el perfil de su negocio", help: "Su mercado, idioma, descripción y competidores. Cada artículo se escribe a partir de estos datos." },
      site: { title: "Conecte su sitio web", help: "Para que los artículos terminados se publiquen solos en su blog." },
      "search-console": { title: "Conecte Google Search Console", help: "Sus posiciones y clics reales, medidos en lugar de estimados." },
      audit: { title: "Audite su sitio web", help: "Leemos cada página y le mostramos qué la frena en Google y en los asistentes de IA." },
      articles: { title: "Genere y lance su plan de contenido", help: "Términos de búsqueda, grupos de temas y un calendario de publicación." },
      preferences: { title: "Configure sus preferencias de artículos", help: "Tono, palabras a evitar y las reglas que debe seguir cada artículo." },
      backlinks: { title: "Active el intercambio de backlinks", help: "Aloje artículos de negocios afines y consiga enlaces hacia su sitio." },
      prompts: { title: "Genere preguntas y active el seguimiento de IA", help: "Las preguntas que los clientes hacen a los asistentes de IA, y si usted aparece en la respuesta." },
    },
    account: {
      social: { title: "Conecte sus redes sociales", help: "Le sugerimos publicaciones y respuestas para cada canal que conecte." },
      video: { title: "Conecte sus canales de vídeo", help: "Instagram, TikTok, YouTube y Facebook, para poder publicar los vídeos terminados." },
    },
  },
  fr: {
    title: "Tâches",
    help: "Tout ce qui vous attend sur {domain}, dans une seule liste.",
    overview: "Ouvrir la vue d’ensemble",
    ringLabel: "fait",
    progress: "{n} tâches de configuration sur {total} terminées",
    allDone: "Tout est configuré",
    today: "Le travail du jour",
    todayHelp: "Du nouveau travail arrive chaque jour. Une ligne disparaît dès qu’elle a été traitée.",
    setup: "Configurez votre site",
    setupHelp: "Des étapes uniques. Chacune se coche d’elle-même dès qu’elle est faite.",
    accounts: "Connectez vos comptes",
    accountsHelp: "Connectez les canaux que vous utilisez pour que les publications et les vidéos partent depuis RepGet.",
    waiting: "1 en attente|{count} en attente",
    nothingWaiting: "Rien en attente",
    done: "Fait",
    toDo: "À faire",
    optional: "Facultatif",
    connectedOf: "{n} sur {total} connectés",
    unavailable: "Impossible de charger vos tâches. Actualisez la page pour réessayer.",
    work: {
      failed: { title: "Articles à traiter", help: "La rédaction s’est arrêtée sur ces articles. Ouvrez chacun pour voir le problème et réessayez." },
      drafts: { title: "Brouillons à relire", help: "Votre site utilise la publication manuelle : les brouillons attendent votre validation." },
      social: { title: "Publications et réponses à relire", help: "Les suggestions pour vos canaux des 7 derniers jours." },
      videos: { title: "Les idées de vidéo du jour", help: "Choisissez les idées qui vous plaisent et créez les vidéos." },
    },
    steps: {
      profile: { title: "Vérifiez le profil de votre entreprise", help: "Votre marché, votre langue, votre description et vos concurrents. Chaque article est rédigé à partir de ces informations." },
      site: { title: "Connectez votre site", help: "Pour que les articles terminés se publient d’eux-mêmes sur votre blog." },
      "search-console": { title: "Connectez Google Search Console", help: "Vos positions et clics réels, mesurés plutôt qu’estimés." },
      audit: { title: "Auditez votre site", help: "Nous lisons chaque page et listons ce qui la freine sur Google et auprès des assistants IA." },
      articles: { title: "Générez et lancez votre plan de contenu", help: "Des termes de recherche, des groupes de sujets et un calendrier de publication." },
      preferences: { title: "Configurez vos préférences d’articles", help: "Le ton, les mots à éviter et les règles que chaque article doit suivre." },
      backlinks: { title: "Activez l’échange de backlinks", help: "Hébergez des articles d’entreprises proches et obtenez des liens vers votre site." },
      prompts: { title: "Générez des questions et lancez le suivi IA", help: "Les questions que les clients posent aux assistants IA, et si vous êtes cité dans la réponse." },
    },
    account: {
      social: { title: "Connectez vos réseaux sociaux", help: "Nous suggérons des publications et des réponses pour chaque canal connecté." },
      video: { title: "Connectez vos canaux vidéo", help: "Instagram, TikTok, YouTube et Facebook, pour publier les vidéos terminées." },
    },
  },
  it: {
    title: "Attività",
    help: "Tutto ciò che la aspetta su {domain}, in un’unica lista.",
    overview: "Apri la panoramica",
    ringLabel: "fatto",
    progress: "{n} di {total} attività di configurazione completate",
    allDone: "È tutto configurato",
    today: "Il lavoro di oggi",
    todayHelp: "Ogni giorno arriva nuovo lavoro. Una riga sparisce appena è stata gestita.",
    setup: "Configuri il suo sito",
    setupHelp: "Passaggi da fare una volta. Ognuno si spunta da solo appena è completato.",
    accounts: "Colleghi i suoi account",
    accountsHelp: "Colleghi i canali che usa, così post e video possono partire da RepGet.",
    waiting: "1 in attesa|{count} in attesa",
    nothingWaiting: "Niente in attesa",
    done: "Fatto",
    toDo: "Da fare",
    optional: "Facoltativo",
    connectedOf: "{n} di {total} collegati",
    unavailable: "Impossibile caricare le attività. Aggiorni la pagina per riprovare.",
    work: {
      failed: { title: "Articoli che richiedono attenzione", help: "La scrittura si è fermata su questi articoli. Apra ciascuno per vedere il problema e riprovare." },
      drafts: { title: "Bozze da rivedere", help: "Il suo sito usa la pubblicazione manuale, quindi le bozze aspettano la sua approvazione." },
      social: { title: "Post e risposte da rivedere", help: "I suggerimenti per i suoi canali degli ultimi 7 giorni." },
      videos: { title: "Le idee video di oggi", help: "Scelga le idee che preferisce e crei i video." },
    },
    steps: {
      profile: { title: "Controlli il profilo della sua attività", help: "Mercato, lingua, descrizione e concorrenti. Ogni articolo viene scritto a partire da questi dati." },
      site: { title: "Colleghi il suo sito", help: "Così gli articoli finiti si pubblicano da soli sul suo blog." },
      "search-console": { title: "Colleghi Google Search Console", help: "Posizioni e clic reali, misurati invece che stimati." },
      audit: { title: "Analizzi il suo sito", help: "Leggiamo ogni pagina ed elenchiamo cosa la frena su Google e con gli assistenti IA." },
      articles: { title: "Generi e avvii il suo piano dei contenuti", help: "Termini di ricerca, gruppi di argomenti e un calendario di pubblicazione." },
      preferences: { title: "Configuri le preferenze degli articoli", help: "Tono, parole da evitare e le regole che ogni articolo deve seguire." },
      backlinks: { title: "Attivi lo scambio di backlink", help: "Ospiti articoli di attività affini e ottenga link verso il suo sito." },
      prompts: { title: "Generi domande e avvii il monitoraggio IA", help: "Le domande che i clienti fanno agli assistenti IA, e se lei viene citato nella risposta." },
    },
    account: {
      social: { title: "Colleghi i suoi social", help: "Suggeriamo post e risposte per ogni canale che collega." },
      video: { title: "Colleghi i suoi canali video", help: "Instagram, TikTok, YouTube e Facebook, per pubblicare i video finiti." },
    },
  },
  de: {
    title: "Aufgaben",
    help: "Alles, was auf {domain} auf Sie wartet, in einer Liste.",
    overview: "Übersicht öffnen",
    ringLabel: "erledigt",
    progress: "{n} von {total} Einrichtungsaufgaben erledigt",
    allDone: "Alles ist eingerichtet",
    today: "Die Arbeit von heute",
    todayHelp: "Jeden Tag kommt neue Arbeit hinzu. Eine Zeile verschwindet, sobald sie erledigt ist.",
    setup: "Richten Sie Ihre Website ein",
    setupHelp: "Einmalige Schritte. Jeder hakt sich selbst ab, sobald er erledigt ist.",
    accounts: "Verbinden Sie Ihre Konten",
    accountsHelp: "Verbinden Sie die Kanäle, die Sie nutzen, damit Beiträge und Videos über RepGet veröffentlicht werden können.",
    waiting: "1 offen|{count} offen",
    nothingWaiting: "Nichts offen",
    done: "Erledigt",
    toDo: "Offen",
    optional: "Optional",
    connectedOf: "{n} von {total} verbunden",
    unavailable: "Ihre Aufgaben konnten nicht geladen werden. Laden Sie die Seite erneut.",
    work: {
      failed: { title: "Artikel mit Handlungsbedarf", help: "Bei diesen Artikeln wurde das Schreiben unterbrochen. Öffnen Sie jeden, um das Problem zu sehen, und versuchen Sie es erneut." },
      drafts: { title: "Entwürfe zur Prüfung", help: "Ihre Website nutzt die manuelle Veröffentlichung, daher warten Entwürfe auf Ihre Freigabe." },
      social: { title: "Beiträge und Antworten zur Prüfung", help: "Vorschläge für Ihre Kanäle aus den letzten 7 Tagen." },
      videos: { title: "Die Videoideen von heute", help: "Wählen Sie die Ideen, die Ihnen gefallen, und erstellen Sie die Videos." },
    },
    steps: {
      profile: { title: "Prüfen Sie Ihr Unternehmensprofil", help: "Ihr Markt, Ihre Sprache, Beschreibung und Wettbewerber. Jeder Artikel wird auf dieser Grundlage geschrieben." },
      site: { title: "Verbinden Sie Ihre Website", help: "Damit fertige Artikel sich selbst in Ihrem Blog veröffentlichen." },
      "search-console": { title: "Verbinden Sie die Google Search Console", help: "Ihre echten Positionen und Klicks, gemessen statt geschätzt." },
      audit: { title: "Prüfen Sie Ihre Website", help: "Wir lesen jede Seite und zeigen, was sie bei Google und KI-Assistenten bremst." },
      articles: { title: "Erstellen und starten Sie Ihren Inhaltsplan", help: "Suchbegriffe, Themengruppen und ein Veröffentlichungskalender." },
      preferences: { title: "Legen Sie Ihre Artikeleinstellungen fest", help: "Tonfall, zu vermeidende Wörter und die Regeln, denen jeder Artikel folgt." },
      backlinks: { title: "Aktivieren Sie den Backlink-Austausch", help: "Veröffentlichen Sie Artikel verwandter Unternehmen und erhalten Sie Links zu Ihrer Website." },
      prompts: { title: "Erstellen Sie Fragen und starten Sie das KI-Tracking", help: "Die Fragen, die Kunden KI-Assistenten stellen, und ob Sie in der Antwort genannt werden." },
    },
    account: {
      social: { title: "Verbinden Sie Ihre sozialen Netzwerke", help: "Wir schlagen Beiträge und Antworten für jeden verbundenen Kanal vor." },
      video: { title: "Verbinden Sie Ihre Videokanäle", help: "Instagram, TikTok, YouTube und Facebook, damit fertige Videos veröffentlicht werden können." },
    },
  },
};
