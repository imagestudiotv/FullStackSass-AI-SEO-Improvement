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
  };
};

const en: HomeRedesignCopy = {
  menu: {
    features: "Features",
    integrations: "Integrations",
    featuresOverline: "Explore the platform",
    featuresTitle: "Everything you need to grow.",
    featuresTagline: "Six tools. One connected growth system.",
    next: "Next feature",
    open: "Learn more",
    bottom: "From first search to loyal customers. All connected in RepGet.",
    tools: [
      {
        title: "Content",
        sub: "Plan & publish",
        kicker: "Content & publishing",
        heading: "Go from idea to published.",
        body: "Build a consistent content engine with topic planning, AI-assisted drafts, review and publishing to your website.",
        steps: ["Plan topics", "Review drafts", "Publish"],
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
        title: "SEO",
        sub: "Get discovered",
        kicker: "Search visibility",
        heading: "Get found by the right customers.",
        body: "Understand your website health, uncover search opportunities and see what to improve first.",
        steps: ["Audit", "Prioritize", "Improve"],
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
        title: "AI Search",
        sub: "Earn mentions",
        kicker: "AI search visibility",
        heading: "Be part of the answer.",
        body: "Understand how AI-powered search platforms talk about your business and identify opportunities to become more discoverable.",
        steps: ["Monitor", "Understand", "Improve"],
      },
      {
        title: "Growth",
        sub: "See what works",
        kicker: "Reporting & growth",
        heading: "See what is moving the needle.",
        body: "Bring search, content and social activity into one clear picture so every next decision is easier.",
        steps: ["Connect", "Measure", "Grow"],
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
  },
};

const es: HomeRedesignCopy = {
  menu: {
    features: "Funciones",
    integrations: "Integraciones",
    featuresOverline: "Explore la plataforma",
    featuresTitle: "Todo lo que necesita para crecer.",
    featuresTagline: "Seis herramientas. Un sistema de crecimiento conectado.",
    next: "Siguiente función",
    open: "Más información",
    bottom: "De la primera búsqueda a clientes fieles. Todo conectado en RepGet.",
    tools: [
      { title: "Contenido", sub: "Planificar y publicar", kicker: "Contenido y publicación", heading: "De la idea a la publicación.", body: "Un motor de contenido constante: planificación de temas, borradores con IA, revisión y publicación en su sitio.", steps: ["Planificar", "Revisar", "Publicar"] },
      { title: "Redes", sub: "Crear y distribuir", kicker: "Contenido social", heading: "Cree una vez. Aparezca en todas partes.", body: "Convierta las ideas de su marca en contenido social listo para publicar, adáptelo a cada red y gestione su calendario de publicación.", steps: ["Crear", "Adaptar", "Programar"] },
      { title: "SEO", sub: "Hacerse visible", kicker: "Visibilidad en búsquedas", heading: "Que le encuentren los clientes adecuados.", body: "Conozca la salud de su sitio, descubra oportunidades de búsqueda y vea qué mejorar primero.", steps: ["Auditar", "Priorizar", "Mejorar"] },
      { title: "Backlinks", sub: "Ganar autoridad", kicker: "Backlinks y autoridad", heading: "Autoridad que perdura.", body: "Encuentre oportunidades de colocación relevantes, gestione revisiones de calidad y refuerce su sitio con referencias útiles.", steps: ["Descubrir", "Validar", "Construir"] },
      { title: "Búsqueda con IA", sub: "Ganar menciones", kicker: "Visibilidad en IA", heading: "Forme parte de la respuesta.", body: "Entienda cómo hablan de su negocio las plataformas de búsqueda con IA y descubra oportunidades para ser más visible.", steps: ["Vigilar", "Entender", "Mejorar"] },
      { title: "Crecimiento", sub: "Ver qué funciona", kicker: "Informes y crecimiento", heading: "Vea qué le hace avanzar.", body: "Búsqueda, contenido y redes en una sola imagen clara, para decidir mejor el siguiente paso.", steps: ["Conectar", "Medir", "Crecer"] },
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
  },
};

const fr: HomeRedesignCopy = {
  menu: {
    features: "Fonctionnalités",
    integrations: "Intégrations",
    featuresOverline: "Découvrir la plateforme",
    featuresTitle: "Tout ce qu’il faut pour grandir.",
    featuresTagline: "Six outils. Un système de croissance connecté.",
    next: "Fonctionnalité suivante",
    open: "En savoir plus",
    bottom: "De la première recherche aux clients fidèles. Tout est connecté dans RepGet.",
    tools: [
      { title: "Contenu", sub: "Planifier et publier", kicker: "Contenu et publication", heading: "De l’idée à la publication.", body: "Un moteur de contenu régulier : planification des sujets, brouillons assistés par l’IA, relecture et publication sur votre site.", steps: ["Planifier", "Relire", "Publier"] },
      { title: "Réseaux", sub: "Créer et diffuser", kicker: "Contenu social", heading: "Créez une fois. Soyez partout.", body: "Transformez les idées de votre marque en contenu social prêt à publier, adaptez-le à chaque réseau et gérez votre calendrier de publication.", steps: ["Créer", "Adapter", "Programmer"] },
      { title: "SEO", sub: "Être trouvé", kicker: "Visibilité dans la recherche", heading: "Soyez trouvé par les bons clients.", body: "Comprenez la santé de votre site, découvrez des opportunités et voyez quoi améliorer d’abord.", steps: ["Auditer", "Prioriser", "Améliorer"] },
      { title: "Backlinks", sub: "Gagner en autorité", kicker: "Backlinks et autorité", heading: "Une autorité qui dure.", body: "Trouvez des opportunités de placement pertinentes, gérez les contrôles qualité et renforcez votre site avec des références utiles.", steps: ["Découvrir", "Qualifier", "Construire"] },
      { title: "Recherche IA", sub: "Être cité", kicker: "Visibilité dans l’IA", heading: "Faites partie de la réponse.", body: "Comprenez comment les plateformes de recherche IA parlent de votre entreprise et repérez les occasions d’être plus visible.", steps: ["Suivre", "Comprendre", "Améliorer"] },
      { title: "Croissance", sub: "Voir ce qui marche", kicker: "Rapports et croissance", heading: "Voyez ce qui fait la différence.", body: "Recherche, contenu et réseaux dans une seule vue claire, pour mieux décider de la suite.", steps: ["Connecter", "Mesurer", "Grandir"] },
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
  },
};

const it: HomeRedesignCopy = {
  menu: {
    features: "Funzioni",
    integrations: "Integrazioni",
    featuresOverline: "Esplori la piattaforma",
    featuresTitle: "Tutto ciò che serve per crescere.",
    featuresTagline: "Sei strumenti. Un sistema di crescita collegato.",
    next: "Funzione successiva",
    open: "Scopra di più",
    bottom: "Dalla prima ricerca ai clienti fedeli. Tutto collegato in RepGet.",
    tools: [
      { title: "Contenuti", sub: "Pianificare e pubblicare", kicker: "Contenuti e pubblicazione", heading: "Dall’idea alla pubblicazione.", body: "Un motore di contenuti costante: pianificazione dei temi, bozze con l’IA, revisione e pubblicazione sul Suo sito.", steps: ["Pianificare", "Rivedere", "Pubblicare"] },
      { title: "Social", sub: "Creare e distribuire", kicker: "Contenuti social", heading: "Crei una volta. Sia ovunque.", body: "Trasformi le idee del Suo marchio in contenuti social pronti da pubblicare, li adatti a ogni piattaforma e gestisca il calendario di pubblicazione.", steps: ["Creare", "Adattare", "Programmare"] },
      { title: "SEO", sub: "Farsi trovare", kicker: "Visibilità nella ricerca", heading: "Si faccia trovare dai clienti giusti.", body: "Capisca la salute del Suo sito, scopra opportunità di ricerca e veda cosa migliorare prima.", steps: ["Analizzare", "Dare priorità", "Migliorare"] },
      { title: "Backlink", sub: "Costruire autorevolezza", kicker: "Backlink e autorevolezza", heading: "Un’autorevolezza che dura.", body: "Trovi opportunità di inserimento pertinenti, gestisca le verifiche di qualità e rafforzi il sito con riferimenti utili.", steps: ["Scoprire", "Valutare", "Costruire"] },
      { title: "Ricerca IA", sub: "Ottenere menzioni", kicker: "Visibilità nell’IA", heading: "Entri nella risposta.", body: "Capisca come le piattaforme di ricerca con IA parlano della Sua attività e individui le occasioni per farsi trovare di più.", steps: ["Monitorare", "Capire", "Migliorare"] },
      { title: "Crescita", sub: "Vedere cosa funziona", kicker: "Report e crescita", heading: "Veda cosa fa la differenza.", body: "Ricerca, contenuti e social in un’unica vista chiara, per decidere meglio il passo successivo.", steps: ["Collegare", "Misurare", "Crescere"] },
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
  },
};

const de: HomeRedesignCopy = {
  menu: {
    features: "Funktionen",
    integrations: "Integrationen",
    featuresOverline: "Die Plattform entdecken",
    featuresTitle: "Alles, was Sie zum Wachsen brauchen.",
    featuresTagline: "Sechs Werkzeuge. Ein vernetztes Wachstumssystem.",
    next: "Nächste Funktion",
    open: "Mehr erfahren",
    bottom: "Von der ersten Suche bis zum treuen Kunden. Alles vernetzt in RepGet.",
    tools: [
      { title: "Inhalte", sub: "Planen und veröffentlichen", kicker: "Inhalte und Veröffentlichung", heading: "Von der Idee zur Veröffentlichung.", body: "Ein verlässlicher Inhaltsmotor: Themenplanung, KI-gestützte Entwürfe, Prüfung und Veröffentlichung auf Ihrer Website.", steps: ["Planen", "Prüfen", "Veröffentlichen"] },
      { title: "Social Media", sub: "Erstellen und verteilen", kicker: "Social-Media-Inhalte", heading: "Einmal erstellen. Überall präsent sein.", body: "Machen Sie aus den Ideen Ihrer Marke fertige Social-Media-Inhalte, passen Sie sie an jede Plattform an und verwalten Sie Ihren Veröffentlichungsplan.", steps: ["Erstellen", "Anpassen", "Planen"] },
      { title: "SEO", sub: "Gefunden werden", kicker: "Sichtbarkeit in der Suche", heading: "Von den richtigen Kunden gefunden werden.", body: "Verstehen Sie den Zustand Ihrer Website, entdecken Sie Suchchancen und sehen Sie, was Sie zuerst verbessern sollten.", steps: ["Prüfen", "Priorisieren", "Verbessern"] },
      { title: "Backlinks", sub: "Autorität aufbauen", kicker: "Backlinks und Autorität", heading: "Autorität, die bleibt.", body: "Finden Sie relevante Platzierungsmöglichkeiten, steuern Sie Qualitätsprüfungen und stärken Sie Ihre Website mit nützlichen Verweisen.", steps: ["Entdecken", "Bewerten", "Aufbauen"] },
      { title: "KI-Suche", sub: "Erwähnt werden", kicker: "Sichtbarkeit in der KI", heading: "Teil der Antwort werden.", body: "Verstehen Sie, wie KI-gestützte Suchplattformen über Ihr Unternehmen sprechen, und erkennen Sie Chancen, leichter gefunden zu werden.", steps: ["Beobachten", "Verstehen", "Verbessern"] },
      { title: "Wachstum", sub: "Sehen, was wirkt", kicker: "Berichte und Wachstum", heading: "Sehen, was wirklich wirkt.", body: "Suche, Inhalte und Social Media in einem klaren Bild, damit jede nächste Entscheidung leichter fällt.", steps: ["Verbinden", "Messen", "Wachsen"] },
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
  },
};

const COPY: Record<Locale, HomeRedesignCopy> = { en, es, fr, it, de };

/** Every language's header menu words, for the client-side header (see site-chrome.ts). */
export function homeMenuCopy(locale: Locale): HomeRedesignCopy["menu"] {
  return COPY[locale].menu;
}
