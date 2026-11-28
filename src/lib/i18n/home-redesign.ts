import type { Locale } from "@/lib/i18n/config";

/**
 * The words of the header's two mega-menus, in every language. The rest of
 * the homepage's copy is in lib/i18n/home/, one file per area of the client's
 * design.
 *
 * Formal address throughout: usted, vous, Lei, Sie.
 */
export type HomeRedesignCopy = {
  /** The header's two mega-menus. */
  menu: {
    features: string;
    integrations: string;
    featuresOverline: string;
    featuresTitle: string;
    featuresTagline: string;
    next: string;
    open: string;
    bottom: string;
    tools: { title: string; sub: string; kicker: string; heading: string; body: string; steps: string[] }[];
    socialHead: string;
    socialSub: string;
    platforms: string;
    siteHead: string;
    siteSub: string;
    connections: string;
    footerTitle: string;
    footerBody: string;
    explore: string;
    /** The Features menu's link to /features (client, 2026-11-27). */
    allFeatures: string;
  };
};

const en: HomeRedesignCopy = {
  menu: {
    features: "Features",
    integrations: "Integrations",
    featuresOverline: "Explore the platform",
    featuresTitle: "Everything you need to grow.",
    featuresTagline: "Five tools. One Growth Copilot to run them.",
    next: "Next feature",
    open: "Learn more",
    bottom: "From first search to loyal customers. All connected in RepGet.",
    tools: [
      {
        title: "Articles",
        sub: "Plan & publish",
        kicker: "Content & publishing",
        heading: "Go from idea to published.",
        body: "Build a consistent content engine with topic planning, AI-assisted drafts, review and publishing to your website.",
        steps: ["Plan topics", "Review drafts", "Publish"],
      },
      {
        title: "Backlinks",
        sub: "Build authority",
        kicker: "Backlinks & authority",
        heading: "Build authority that lasts.",
        body: "Find relevant placement opportunities, manage quality reviews and strengthen your website with useful references.",
        steps: ["Discover", "Qualify", "Build"],
      },
      {
        title: "AI Visibility",
        sub: "Earn mentions",
        kicker: "AI search visibility",
        heading: "Be part of the answer.",
        body: "Every week RepGet asks {assistants}, with web search, the questions your customers ask: see whether your business is named, and find ways to become more discoverable.",
        steps: ["Monitor", "Understand", "Improve"],
      },
      {
        title: "Social",
        sub: "Create & distribute",
        kicker: "Social content",
        heading: "Create once. Show up everywhere.",
        body: "Turn your brand ideas into ready-to-post social content, tailor it for each platform and manage your publishing calendar.",
        steps: ["Create", "Adapt", "Schedule"],
      },
      {
        title: "Website Health",
        sub: "Audit & fix",
        kicker: "Website health",
        heading: "Get found by the right customers.",
        body: "Understand your website health, uncover search opportunities and see what to improve first.",
        steps: ["Audit", "Prioritize", "Improve"],
      },
    ],
    socialHead: "Social channels",
    socialSub: "Create once. Make it native to every channel.",
    platforms: "{n} platforms",
    siteHead: "Website & data",
    siteSub: "Publish to your site. Measure what matters.",
    connections: "{n} connections",
    footerTitle: "Beyond social. Your complete growth engine.",
    footerBody: "Create content, grow in search, build authority and get discovered by AI.",
    explore: "Explore RepGet",
    allFeatures: "See all features",
  },
};

const es: HomeRedesignCopy = {
  menu: {
    features: "Funciones",
    integrations: "Integraciones",
    featuresOverline: "Explore la plataforma",
    featuresTitle: "Todo lo que necesita para crecer.",
    featuresTagline: "Cinco herramientas. Un Growth Copilot que las dirige.",
    next: "Siguiente función",
    open: "Más información",
    bottom: "De la primera búsqueda a clientes fieles. Todo conectado en RepGet.",
    tools: [
      { title: "Artículos", sub: "Planificar y publicar", kicker: "Contenido y publicación", heading: "De la idea a la publicación.", body: "Un motor de contenido constante: planificación de temas, borradores con IA, revisión y publicación en su sitio.", steps: ["Planificar", "Revisar", "Publicar"] },
      { title: "Backlinks", sub: "Ganar autoridad", kicker: "Backlinks y autoridad", heading: "Autoridad que perdura.", body: "Encuentre oportunidades de colocación relevantes, gestione revisiones de calidad y refuerce su sitio con referencias útiles.", steps: ["Descubrir", "Validar", "Construir"] },
      { title: "Visibilidad en IA", sub: "Ganar menciones", kicker: "Visibilidad en IA", heading: "Forme parte de la respuesta.", body: "Cada semana RepGet hace a {assistants}, con búsqueda web, las preguntas de sus clientes: vea si se nombra su negocio y descubra cómo ser más visible.", steps: ["Vigilar", "Entender", "Mejorar"] },
      { title: "Redes", sub: "Crear y distribuir", kicker: "Contenido social", heading: "Cree una vez. Aparezca en todas partes.", body: "Convierta las ideas de su marca en contenido social listo para publicar, adáptelo a cada red y gestione su calendario de publicación.", steps: ["Crear", "Adaptar", "Programar"] },
      { title: "Salud del sitio", sub: "Auditar y corregir", kicker: "Salud del sitio", heading: "Que le encuentren los clientes adecuados.", body: "Conozca la salud de su sitio, descubra oportunidades de búsqueda y vea qué mejorar primero.", steps: ["Auditar", "Priorizar", "Mejorar"] },
    ],
    socialHead: "Redes sociales",
    socialSub: "Cree una vez. Adaptado a cada red.",
    platforms: "{n} plataformas",
    siteHead: "Sitio web y datos",
    siteSub: "Publique en su sitio. Mida lo que importa.",
    connections: "{n} conexiones",
    footerTitle: "Más allá de las redes. Su motor de crecimiento completo.",
    footerBody: "Cree contenido, crezca en búsquedas, gane autoridad y aparezca en la IA.",
    explore: "Descubra RepGet",
    allFeatures: "Ver todas las funciones",
  },
};

const fr: HomeRedesignCopy = {
  menu: {
    features: "Fonctionnalités",
    integrations: "Intégrations",
    featuresOverline: "Découvrir la plateforme",
    featuresTitle: "Tout ce qu’il faut pour grandir.",
    featuresTagline: "Cinq outils. Un Growth Copilot pour les piloter.",
    next: "Fonctionnalité suivante",
    open: "En savoir plus",
    bottom: "De la première recherche aux clients fidèles. Tout est connecté dans RepGet.",
    tools: [
      { title: "Articles", sub: "Planifier et publier", kicker: "Contenu et publication", heading: "De l’idée à la publication.", body: "Un moteur de contenu régulier : planification des sujets, brouillons assistés par l’IA, relecture et publication sur votre site.", steps: ["Planifier", "Relire", "Publier"] },
      { title: "Backlinks", sub: "Gagner en autorité", kicker: "Backlinks et autorité", heading: "Une autorité qui dure.", body: "Trouvez des opportunités de placement pertinentes, gérez les contrôles qualité et renforcez votre site avec des références utiles.", steps: ["Découvrir", "Qualifier", "Construire"] },
      { title: "Visibilité IA", sub: "Être cité", kicker: "Visibilité dans l’IA", heading: "Faites partie de la réponse.", body: "Chaque semaine, RepGet pose à {assistants}, avec la recherche web, les questions de vos clients : voyez si votre entreprise est citée, et repérez les occasions d’être plus visible.", steps: ["Suivre", "Comprendre", "Améliorer"] },
      { title: "Réseaux", sub: "Créer et diffuser", kicker: "Contenu social", heading: "Créez une fois. Soyez partout.", body: "Transformez les idées de votre marque en contenu social prêt à publier, adaptez-le à chaque réseau et gérez votre calendrier de publication.", steps: ["Créer", "Adapter", "Programmer"] },
      { title: "Santé du site", sub: "Auditer et corriger", kicker: "Santé du site", heading: "Soyez trouvé par les bons clients.", body: "Comprenez la santé de votre site, découvrez des opportunités et voyez quoi améliorer d’abord.", steps: ["Auditer", "Prioriser", "Améliorer"] },
    ],
    socialHead: "Réseaux sociaux",
    socialSub: "Créez une fois. Natif sur chaque réseau.",
    platforms: "{n} plateformes",
    siteHead: "Site et données",
    siteSub: "Publiez sur votre site. Mesurez l’essentiel.",
    connections: "{n} connexions",
    footerTitle: "Au-delà des réseaux. Votre moteur de croissance complet.",
    footerBody: "Créez du contenu, progressez dans la recherche, gagnez en autorité et soyez cité par l’IA.",
    explore: "Découvrir RepGet",
    allFeatures: "Voir toutes les fonctionnalités",
  },
};

const it: HomeRedesignCopy = {
  menu: {
    features: "Funzioni",
    integrations: "Integrazioni",
    featuresOverline: "Esplori la piattaforma",
    featuresTitle: "Tutto ciò che serve per crescere.",
    featuresTagline: "Cinque strumenti. Un Growth Copilot che li guida.",
    next: "Funzione successiva",
    open: "Scopra di più",
    bottom: "Dalla prima ricerca ai clienti fedeli. Tutto collegato in RepGet.",
    tools: [
      { title: "Articoli", sub: "Pianificare e pubblicare", kicker: "Contenuti e pubblicazione", heading: "Dall’idea alla pubblicazione.", body: "Un motore di contenuti costante: pianificazione dei temi, bozze con l’IA, revisione e pubblicazione sul Suo sito.", steps: ["Pianificare", "Rivedere", "Pubblicare"] },
      { title: "Backlink", sub: "Costruire autorevolezza", kicker: "Backlink e autorevolezza", heading: "Un’autorevolezza che dura.", body: "Trovi opportunità di inserimento pertinenti, gestisca le verifiche di qualità e rafforzi il sito con riferimenti utili.", steps: ["Scoprire", "Valutare", "Costruire"] },
      { title: "Visibilità IA", sub: "Ottenere menzioni", kicker: "Visibilità nell’IA", heading: "Entri nella risposta.", body: "Ogni settimana RepGet pone a {assistants}, con la ricerca web, le domande dei Suoi clienti: veda se la Sua attività viene nominata e individui le occasioni per farsi trovare di più.", steps: ["Monitorare", "Capire", "Migliorare"] },
      { title: "Social", sub: "Creare e distribuire", kicker: "Contenuti social", heading: "Crei una volta. Sia ovunque.", body: "Trasformi le idee del Suo marchio in contenuti social pronti da pubblicare, li adatti a ogni piattaforma e gestisca il calendario di pubblicazione.", steps: ["Creare", "Adattare", "Programmare"] },
      { title: "Salute del sito", sub: "Analizzare e correggere", kicker: "Salute del sito", heading: "Si faccia trovare dai clienti giusti.", body: "Capisca la salute del Suo sito, scopra opportunità di ricerca e veda cosa migliorare prima.", steps: ["Analizzare", "Dare priorità", "Migliorare"] },
    ],
    socialHead: "Canali social",
    socialSub: "Crei una volta. Nativo su ogni canale.",
    platforms: "{n} piattaforme",
    siteHead: "Sito e dati",
    siteSub: "Pubblichi sul sito. Misuri ciò che conta.",
    connections: "{n} collegamenti",
    footerTitle: "Oltre i social. Il Suo motore di crescita completo.",
    footerBody: "Crei contenuti, cresca nella ricerca, costruisca autorevolezza e si faccia trovare dall’IA.",
    explore: "Scopra RepGet",
    allFeatures: "Vedi tutte le funzioni",
  },
};

const de: HomeRedesignCopy = {
  menu: {
    features: "Funktionen",
    integrations: "Integrationen",
    featuresOverline: "Die Plattform entdecken",
    featuresTitle: "Alles, was Sie zum Wachsen brauchen.",
    featuresTagline: "Fünf Werkzeuge. Ein Growth Copilot, der sie steuert.",
    next: "Nächste Funktion",
    open: "Mehr erfahren",
    bottom: "Von der ersten Suche bis zum treuen Kunden. Alles vernetzt in RepGet.",
    tools: [
      { title: "Artikel", sub: "Planen und veröffentlichen", kicker: "Inhalte und Veröffentlichung", heading: "Von der Idee zur Veröffentlichung.", body: "Ein verlässlicher Inhaltsmotor: Themenplanung, KI-gestützte Entwürfe, Prüfung und Veröffentlichung auf Ihrer Website.", steps: ["Planen", "Prüfen", "Veröffentlichen"] },
      { title: "Backlinks", sub: "Autorität aufbauen", kicker: "Backlinks und Autorität", heading: "Autorität, die bleibt.", body: "Finden Sie relevante Platzierungsmöglichkeiten, steuern Sie Qualitätsprüfungen und stärken Sie Ihre Website mit nützlichen Verweisen.", steps: ["Entdecken", "Bewerten", "Aufbauen"] },
      { title: "KI-Sichtbarkeit", sub: "Erwähnt werden", kicker: "Sichtbarkeit in der KI", heading: "Teil der Antwort werden.", body: "Jede Woche stellt RepGet {assistants} mit Websuche die Fragen Ihrer Kunden: Sehen Sie, ob Ihr Unternehmen genannt wird, und erkennen Sie Chancen, leichter gefunden zu werden.", steps: ["Beobachten", "Verstehen", "Verbessern"] },
      { title: "Social Media", sub: "Erstellen und verteilen", kicker: "Social-Media-Inhalte", heading: "Einmal erstellen. Überall präsent sein.", body: "Machen Sie aus den Ideen Ihrer Marke fertige Social-Media-Inhalte, passen Sie sie an jede Plattform an und verwalten Sie Ihren Veröffentlichungsplan.", steps: ["Erstellen", "Anpassen", "Planen"] },
      { title: "Website-Zustand", sub: "Prüfen und beheben", kicker: "Website-Zustand", heading: "Von den richtigen Kunden gefunden werden.", body: "Verstehen Sie den Zustand Ihrer Website, entdecken Sie Suchchancen und sehen Sie, was Sie zuerst verbessern sollten.", steps: ["Prüfen", "Priorisieren", "Verbessern"] },
    ],
    socialHead: "Social-Media-Kanäle",
    socialSub: "Einmal erstellen. Passend für jeden Kanal.",
    platforms: "{n} Plattformen",
    siteHead: "Website und Daten",
    siteSub: "Auf Ihrer Website veröffentlichen. Messen, was zählt.",
    connections: "{n} Verbindungen",
    footerTitle: "Mehr als Social Media. Ihr kompletter Wachstumsmotor.",
    footerBody: "Inhalte erstellen, in der Suche wachsen, Autorität aufbauen und von der KI gefunden werden.",
    explore: "RepGet entdecken",
    allFeatures: "Alle Funktionen ansehen",
  },
};

const COPY: Record<Locale, HomeRedesignCopy> = { en, es, fr, it, de };

/** Every language's header menu words, for the client-side header (see site-chrome.ts). */
export function homeMenuCopy(locale: Locale): HomeRedesignCopy["menu"] {
  return COPY[locale].menu;
}
