import type { Locale } from "@/lib/i18n/config";

/**
 * Words for three homepage sections of the client's approved design
 * (design.html, 2026-11-04): the dark "four growth engines" band, the
 * walkthrough video and the three steps to start.
 *
 * English is the design's text, word for word. The other languages use the
 * formal address (usted / vous / Lei / Sie). The drawings' words are
 * illustrations of the product, not results, so none carries a figure.
 */
export type StoryCopy = {
  engines: {
    eyebrow: string;
    titleStart: string;
    titleAccent: string;
    sub: string;
    /** The cards' list, for screen readers. */
    cardsLabel: string;
    link: string;
    search: {
      title: string;
      body: string;
      foot: string;
      label: string;
      value: string;
      rise: string;
      weeks: [string, string, string];
      chartLabel: string;
    };
    social: { title: string; body: string; foot: string; calendar: string; scheduled: string; queue: string; channels: string; ready: string };
    /** `answer` follows the brand name, which is drawn in bold before it. */
    ai: { title: string; body: string; foot: string; question: string; answer: string; found: string };
    links: { title: string; body: string; foot: string; label: string; network: string };
  };
  video: {
    eyebrow: string;
    title: string;
    sub: string;
    /** The play button's accessible name. */
    play: string;
    /** The player's title, read when focus enters it. */
    frameTitle: string;
    walkthrough: string;
    duration: string;
    watch: string;
    opensInNewTab: string;
  };
  steps: {
    kicker: string;
    title: string;
    titleAccent: string;
    sub: string;
    /** "Step", read with the number before each step's heading. */
    step: string;
    items: [Step, Step, Step];
    url: string;
    emailInstead: string;
    planLabel: string;
    /** The middle one is drawn as the chosen plan. */
    plans: [Plan, Plan, Plan];
    setupLabel: string;
    yourWebsite: string;
    connectReview: string;
    ready: string;
    connected: string;
    cta: string;
    footnote: string;
  };
};

type Step = { title: string; body: string };
type Plan = { name: string; tag: string };

const en: StoryCopy = {
  engines: {
    eyebrow: "One platform. Four growth engines.",
    titleStart: "Growth from",
    titleAccent: "every direction.",
    sub: "Search, social, AI and authority working together, not in separate tools.",
    cardsLabel: "Four interactive product illustrations",
    link: "See how the workflow connects",
    search: {
      title: "SEO that climbs.",
      body: "Be discovered when customers are searching.",
      foot: "Audits · Keywords · Rankings",
      label: "Organic visibility",
      value: "Going up",
      rise: "Growth trend",
      weeks: ["Week 1", "Week 4", "Week 8"],
      chartLabel: "Illustrative rising search visibility trend",
    },
    social: {
      title: "Social that travels.",
      body: "One idea, beautifully distributed everywhere.",
      foot: "Plan · Create · Distribute",
      calendar: "Publishing calendar",
      scheduled: "Scheduled",
      queue: "One content queue",
      channels: "Multiple channels",
      ready: "Ready to publish",
    },
    ai: {
      title: "AI that mentions you.",
      body: "Become part of the answers people trust.",
      foot: "Monitor · Understand · Improve",
      question: "What platform helps my business grow online?",
      answer: "brings search visibility, AI mentions and social content into one workflow.",
      found: "Brand discovered in AI answers",
    },
    links: {
      title: "Backlinks that build.",
      body: "Strengthen your brand with relevant links.",
      foot: "Backlinks · Indexing · Reports",
      label: "Relevant website mentions",
      network: "Authority network",
    },
  },
  video: {
    eyebrow: "The platform in action",
    title: "See RepGet in two minutes.",
    sub: "See how RepGet brings content, search visibility, backlinks and AI discovery into one connected workflow.",
    play: "Play the official RepGet demonstration video",
    frameTitle: "RepGet official two-minute product walkthrough",
    walkthrough: "Official RepGet walkthrough",
    duration: "About 2 minutes",
    watch: "Watch on YouTube",
    opensInNewTab: "(opens in a new tab)",
  },
  steps: {
    kicker: "From signup to setup",
    title: "Be ready before your next coffee.",
    titleAccent: "Get started in 3 simple steps.",
    sub: "Just a few details to set up your growth workspace. No technical experience needed.",
    step: "Step",
    items: [
      { title: "Enter your website or email", body: "Share your domain, or use your email if you don't have a website yet." },
      { title: "Choose your plan", body: "Pick the level of SEO, content, backlinks and social growth that fits your business." },
      { title: "Connect your website", body: "Link your site or publishing platform, then review your workspace. You can add a website later, too." },
    ],
    url: "yourwebsite.com",
    emailInstead: "Or start with your email instead",
    planLabel: "Your growth plan",
    plans: [
      { name: "Get discovered", tag: "Search" },
      { name: "Grow everywhere", tag: "Recommended" },
      { name: "Scale your reach", tag: "More" },
    ],
    setupLabel: "Website setup",
    yourWebsite: "Your website",
    connectReview: "Connect and review setup",
    ready: "Ready to configure your workspace",
    connected: "Connected",
    cta: "Start free trial",
    footnote: "Start with a website or just your email.",
  },
};

const es: StoryCopy = {
  engines: {
    eyebrow: "Una plataforma. Cuatro motores de crecimiento.",
    titleStart: "Crecimiento en",
    titleAccent: "todas direcciones.",
    sub: "Búsqueda, redes, IA y autoridad trabajando juntas, no en herramientas separadas.",
    cardsLabel: "Cuatro ilustraciones interactivas del producto",
    link: "Vea cómo se conecta todo",
    search: {
      title: "SEO que sube.",
      body: "Aparezca cuando sus clientes buscan.",
      foot: "Auditorías · Palabras clave · Posiciones",
      label: "Visibilidad orgánica",
      value: "En aumento",
      rise: "Tendencia",
      weeks: ["Semana 1", "Semana 4", "Semana 8"],
      chartLabel: "Ilustración de una visibilidad en búsqueda en aumento",
    },
    social: {
      title: "Redes que viajan.",
      body: "Una idea, bien distribuida en todas partes.",
      foot: "Planificar · Crear · Distribuir",
      calendar: "Calendario de publicación",
      scheduled: "Programado",
      queue: "Una sola cola de contenido",
      channels: "Varios canales",
      ready: "Listo para publicar",
    },
    ai: {
      title: "IA que le menciona.",
      body: "Forme parte de las respuestas en las que la gente confía.",
      foot: "Vigilar · Entender · Mejorar",
      question: "¿Qué plataforma ayuda a mi negocio a crecer en internet?",
      answer: "reúne la visibilidad en búsqueda, las menciones en IA y el contenido social en un solo flujo.",
      found: "Marca descubierta en respuestas de IA",
    },
    links: {
      title: "Backlinks que construyen.",
      body: "Refuerce su marca con enlaces relevantes.",
      foot: "Backlinks · Indexación · Informes",
      label: "Menciones en sitios relevantes",
      network: "Red de autoridad",
    },
  },
  video: {
    eyebrow: "La plataforma en acción",
    title: "Vea RepGet en dos minutos.",
    sub: "Vea cómo RepGet reúne contenido, visibilidad en búsqueda, backlinks y descubrimiento por IA en un solo flujo de trabajo conectado.",
    play: "Reproducir el vídeo oficial de presentación de RepGet",
    frameTitle: "Presentación oficial de RepGet en dos minutos",
    walkthrough: "Recorrido oficial de RepGet",
    duration: "Unos 2 minutos",
    watch: "Ver en YouTube",
    opensInNewTab: "(se abre en una pestaña nueva)",
  },
  steps: {
    kicker: "Del registro a la configuración",
    title: "Listo antes de su próximo café.",
    titleAccent: "Empiece en 3 pasos sencillos.",
    sub: "Solo unos datos para preparar su espacio de crecimiento. Sin conocimientos técnicos.",
    step: "Paso",
    items: [
      { title: "Escriba su sitio web o su correo", body: "Indique su dominio, o use su correo si todavía no tiene sitio web." },
      { title: "Elija su plan", body: "Elija el nivel de SEO, contenido, backlinks y redes que se ajusta a su negocio." },
      { title: "Conecte su sitio web", body: "Enlace su sitio o su plataforma de publicación y revise su espacio. También puede añadir el sitio más tarde." },
    ],
    url: "susitioweb.com",
    emailInstead: "O empiece con su correo",
    planLabel: "Su plan de crecimiento",
    plans: [
      { name: "Hacerse visible", tag: "Búsqueda" },
      { name: "Crecer en todas partes", tag: "Recomendado" },
      { name: "Ampliar su alcance", tag: "Más" },
    ],
    setupLabel: "Configuración del sitio",
    yourWebsite: "Su sitio web",
    connectReview: "Conectar y revisar",
    ready: "Listo para configurar su espacio",
    connected: "Conectado",
    cta: "Empezar la prueba gratis",
    footnote: "Empiece con un sitio web o solo con su correo.",
  },
};

const fr: StoryCopy = {
  engines: {
    eyebrow: "Une plateforme. Quatre moteurs de croissance.",
    titleStart: "La croissance dans",
    titleAccent: "toutes les directions.",
    sub: "Recherche, réseaux, IA et autorité qui travaillent ensemble, pas dans des outils séparés.",
    cardsLabel: "Quatre illustrations interactives du produit",
    link: "Voir comment tout se connecte",
    search: {
      title: "Un SEO qui progresse.",
      body: "Soyez trouvé quand vos clients cherchent.",
      foot: "Audits · Mots-clés · Positions",
      label: "Visibilité organique",
      value: "En hausse",
      rise: "Tendance",
      weeks: ["Semaine 1", "Semaine 4", "Semaine 8"],
      chartLabel: "Illustration d’une visibilité dans la recherche en hausse",
    },
    social: {
      title: "Des réseaux qui portent.",
      body: "Une idée, bien diffusée partout.",
      foot: "Planifier · Créer · Diffuser",
      calendar: "Calendrier de publication",
      scheduled: "Programmé",
      queue: "Une seule file de contenu",
      channels: "Plusieurs canaux",
      ready: "Prêt à publier",
    },
    ai: {
      title: "Une IA qui vous cite.",
      body: "Faites partie des réponses auxquelles on se fie.",
      foot: "Suivre · Comprendre · Améliorer",
      question: "Quelle plateforme aide mon entreprise à grandir en ligne ?",
      answer: "réunit visibilité dans la recherche, mentions IA et contenu social dans un seul flux.",
      found: "Marque découverte dans les réponses IA",
    },
    links: {
      title: "Des backlinks qui construisent.",
      body: "Renforcez votre marque avec des liens pertinents.",
      foot: "Backlinks · Indexation · Rapports",
      label: "Mentions sur des sites pertinents",
      network: "Réseau d’autorité",
    },
  },
  video: {
    eyebrow: "La plateforme en action",
    title: "Découvrez RepGet en deux minutes.",
    sub: "Découvrez comment RepGet réunit contenu, visibilité dans la recherche, backlinks et découverte par l’IA dans un seul flux de travail connecté.",
    play: "Lire la vidéo de démonstration officielle de RepGet",
    frameTitle: "Présentation officielle de RepGet en deux minutes",
    walkthrough: "Présentation officielle de RepGet",
    duration: "Environ 2 minutes",
    watch: "Regarder sur YouTube",
    opensInNewTab: "(s’ouvre dans un nouvel onglet)",
  },
  steps: {
    kicker: "De l’inscription à la configuration",
    title: "Prêt avant votre prochain café.",
    titleAccent: "Démarrez en 3 étapes simples.",
    sub: "Juste quelques informations pour préparer votre espace de croissance. Aucune compétence technique nécessaire.",
    step: "Étape",
    items: [
      { title: "Saisissez votre site ou votre e-mail", body: "Indiquez votre domaine, ou votre e-mail si vous n’avez pas encore de site." },
      { title: "Choisissez votre formule", body: "Choisissez le niveau de SEO, de contenu, de backlinks et de réseaux qui convient à votre activité." },
      { title: "Connectez votre site", body: "Reliez votre site ou votre outil de publication, puis vérifiez votre espace. Vous pouvez aussi ajouter un site plus tard." },
    ],
    url: "votresite.com",
    emailInstead: "Ou commencez avec votre e-mail",
    planLabel: "Votre formule de croissance",
    plans: [
      { name: "Être trouvé", tag: "Recherche" },
      { name: "Grandir partout", tag: "Recommandé" },
      { name: "Élargir votre portée", tag: "Plus" },
    ],
    setupLabel: "Configuration du site",
    yourWebsite: "Votre site",
    connectReview: "Connecter et vérifier",
    ready: "Prêt à configurer votre espace",
    connected: "Connecté",
    cta: "Commencer l’essai gratuit",
    footnote: "Commencez avec un site ou simplement votre e-mail.",
  },
};

const it: StoryCopy = {
  engines: {
    eyebrow: "Una piattaforma. Quattro motori di crescita.",
    titleStart: "Crescita in",
    titleAccent: "ogni direzione.",
    sub: "Ricerca, social, IA e autorevolezza che lavorano insieme, non in strumenti separati.",
    cardsLabel: "Quattro illustrazioni interattive del prodotto",
    link: "Veda come si collega tutto",
    search: {
      title: "Una SEO che sale.",
      body: "Si faccia trovare quando i clienti cercano.",
      foot: "Audit · Parole chiave · Posizioni",
      label: "Visibilità organica",
      value: "In crescita",
      rise: "Tendenza",
      weeks: ["Settimana 1", "Settimana 4", "Settimana 8"],
      chartLabel: "Illustrazione di una visibilità nella ricerca in crescita",
    },
    social: {
      title: "Social che arrivano lontano.",
      body: "Un’idea, distribuita bene ovunque.",
      foot: "Pianificare · Creare · Distribuire",
      calendar: "Calendario di pubblicazione",
      scheduled: "Programmato",
      queue: "Un’unica coda di contenuti",
      channels: "Più canali",
      ready: "Pronto da pubblicare",
    },
    ai: {
      title: "Un’IA che La cita.",
      body: "Entri nelle risposte di cui le persone si fidano.",
      foot: "Monitorare · Capire · Migliorare",
      question: "Quale piattaforma aiuta la mia attività a crescere online?",
      answer: "riunisce visibilità nella ricerca, menzioni IA e contenuti social in un unico flusso.",
      found: "Marchio scoperto nelle risposte IA",
    },
    links: {
      title: "Backlink che costruiscono.",
      body: "Rafforzi il Suo marchio con link pertinenti.",
      foot: "Backlink · Indicizzazione · Report",
      label: "Menzioni su siti pertinenti",
      network: "Rete di autorevolezza",
    },
  },
  video: {
    eyebrow: "La piattaforma in azione",
    title: "RepGet in due minuti.",
    sub: "Scopra come RepGet riunisce contenuti, visibilità nella ricerca, backlink e scoperta tramite IA in un unico flusso di lavoro collegato.",
    play: "Riproduca il video dimostrativo ufficiale di RepGet",
    frameTitle: "Presentazione ufficiale di RepGet in due minuti",
    walkthrough: "Presentazione ufficiale di RepGet",
    duration: "Circa 2 minuti",
    watch: "Guarda su YouTube",
    opensInNewTab: "(si apre in una nuova scheda)",
  },
  steps: {
    kicker: "Dalla registrazione alla configurazione",
    title: "Pronto prima del prossimo caffè.",
    titleAccent: "Inizi in 3 semplici passi.",
    sub: "Bastano pochi dati per preparare il Suo spazio di crescita. Nessuna competenza tecnica richiesta.",
    step: "Passo",
    items: [
      { title: "Inserisca il sito o l’email", body: "Indichi il Suo dominio, o usi l’email se non ha ancora un sito." },
      { title: "Scelga il piano", body: "Scelga il livello di SEO, contenuti, backlink e social adatto alla Sua attività." },
      { title: "Colleghi il Suo sito", body: "Colleghi il sito o la piattaforma di pubblicazione, poi controlli il Suo spazio. Può anche aggiungere il sito più tardi." },
    ],
    url: "ilsuosito.com",
    emailInstead: "Oppure inizi con l’email",
    planLabel: "Il Suo piano di crescita",
    plans: [
      { name: "Farsi trovare", tag: "Ricerca" },
      { name: "Crescere ovunque", tag: "Consigliato" },
      { name: "Ampliare la portata", tag: "Di più" },
    ],
    setupLabel: "Configurazione del sito",
    yourWebsite: "Il Suo sito",
    connectReview: "Colleghi e controlli",
    ready: "Pronto a configurare il Suo spazio",
    connected: "Collegato",
    cta: "Inizi la prova gratuita",
    footnote: "Inizi con un sito o solo con l’email.",
  },
};

const de: StoryCopy = {
  engines: {
    eyebrow: "Eine Plattform. Vier Wachstumsmotoren.",
    titleStart: "Wachstum aus",
    titleAccent: "allen Richtungen.",
    sub: "Suche, Social Media, KI und Autorität arbeiten zusammen statt in getrennten Tools.",
    cardsLabel: "Vier interaktive Produktillustrationen",
    link: "So greift alles ineinander",
    search: {
      title: "SEO, das steigt.",
      body: "Gefunden werden, wenn Kunden suchen.",
      foot: "Audits · Keywords · Rankings",
      label: "Organische Sichtbarkeit",
      value: "Steigend",
      rise: "Trend",
      weeks: ["Woche 1", "Woche 4", "Woche 8"],
      chartLabel: "Illustration einer steigenden Sichtbarkeit in der Suche",
    },
    social: {
      title: "Social Media, das ankommt.",
      body: "Eine Idee, überall gut verteilt.",
      foot: "Planen · Erstellen · Verteilen",
      calendar: "Veröffentlichungsplan",
      scheduled: "Geplant",
      queue: "Eine Warteschlange für Inhalte",
      channels: "Mehrere Kanäle",
      ready: "Bereit zur Veröffentlichung",
    },
    ai: {
      title: "KI, die Sie nennt.",
      body: "Teil der Antworten werden, denen Menschen vertrauen.",
      foot: "Beobachten · Verstehen · Verbessern",
      question: "Welche Plattform hilft meinem Unternehmen, online zu wachsen?",
      answer: "vereint Sichtbarkeit in der Suche, KI-Erwähnungen und Social-Media-Inhalte in einem Ablauf.",
      found: "Marke in KI-Antworten entdeckt",
    },
    links: {
      title: "Backlinks, die aufbauen.",
      body: "Stärken Sie Ihre Marke mit relevanten Links.",
      foot: "Backlinks · Indexierung · Berichte",
      label: "Erwähnungen auf relevanten Websites",
      network: "Autoritätsnetzwerk",
    },
  },
  video: {
    eyebrow: "Die Plattform in Aktion",
    title: "RepGet in zwei Minuten.",
    sub: "Sehen Sie, wie RepGet Inhalte, Sichtbarkeit in der Suche, Backlinks und KI-Auffindbarkeit in einem verbundenen Ablauf vereint.",
    play: "Offizielles RepGet-Demovideo abspielen",
    frameTitle: "Offizieller zweiminütiger RepGet-Produktrundgang",
    walkthrough: "Offizieller RepGet-Rundgang",
    duration: "Etwa 2 Minuten",
    watch: "Auf YouTube ansehen",
    opensInNewTab: "(öffnet in einem neuen Tab)",
  },
  steps: {
    kicker: "Von der Anmeldung zur Einrichtung",
    title: "Startklar vor dem nächsten Kaffee.",
    titleAccent: "In 3 einfachen Schritten loslegen.",
    sub: "Nur ein paar Angaben, um Ihren Wachstumsbereich einzurichten. Keine technischen Kenntnisse nötig.",
    step: "Schritt",
    items: [
      { title: "Website oder E-Mail eingeben", body: "Geben Sie Ihre Domain an, oder Ihre E-Mail, wenn Sie noch keine Website haben." },
      { title: "Tarif wählen", body: "Wählen Sie den Umfang an SEO, Inhalten, Backlinks und Social Media, der zu Ihrem Unternehmen passt." },
      { title: "Website verbinden", body: "Verbinden Sie Ihre Website oder Ihr Publishing-Tool und prüfen Sie Ihren Bereich. Eine Website können Sie auch später hinzufügen." },
    ],
    url: "ihre-website.com",
    emailInstead: "Oder mit Ihrer E-Mail starten",
    planLabel: "Ihr Wachstumstarif",
    plans: [
      { name: "Gefunden werden", tag: "Suche" },
      { name: "Überall wachsen", tag: "Empfohlen" },
      { name: "Reichweite ausbauen", tag: "Mehr" },
    ],
    setupLabel: "Website-Einrichtung",
    yourWebsite: "Ihre Website",
    connectReview: "Verbinden und prüfen",
    ready: "Bereit zur Einrichtung Ihres Bereichs",
    connected: "Verbunden",
    cta: "Kostenlos testen",
    footnote: "Starten Sie mit einer Website oder nur mit Ihrer E-Mail.",
  },
};

const COPY: Record<Locale, StoryCopy> = { en, es, fr, it, de };

/** The three sections' words in the visitor's language. */
export function storyCopy(locale: Locale): StoryCopy {
  return COPY[locale] ?? en;
}
