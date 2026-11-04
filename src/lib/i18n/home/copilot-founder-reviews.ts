import type { Locale } from "@/lib/i18n/config";

/**
 * Words for three homepage sections of the client's approved design
 * (design.html, 2026-11-04): Growth AI Chat Copilot with its "Connect your
 * website and favorite accounts" strip, the founder, and the customer
 * reviews ("Customer stories").
 *
 * English is the design's text, word for word. The other languages use the
 * formal address (usted / vous / Lei / Sie). "Growth AI Chat Copilot" is a
 * product name and stays in English everywhere. The chat lines are an
 * illustration of the product, not an account or a result.
 *
 * The reviews themselves are not here: they are the published cards from
 * Admin -> Testimonials, in the customers' own words.
 */
export type CopilotFounderReviewsCopy = {
  copilot: {
    strip: string;
    /** aria-label of the row of platform tiles. */
    stripLabel: string;
    kicker: string;
    title: string;
    body: string;
    points: { lead: string; text: string }[];
    connect: string;
    watch: string;
    /** The example website in the drawing. */
    site: string;
    channelsConnected: string;
    /** aria-label of the drawn conversation. */
    previewLabel: string;
    userMessage: string;
    status: string;
    lines: [string, string, string];
    input: string;
  };
  founder: {
    eyebrow: string;
    role: string;
    /** `**words**` are bold. */
    body: string;
    body2: string;
    /** aria-label of the two profile buttons. */
    profilesLabel: string;
    /** "{name} LinkedIn profile"; {network} and {name} are filled in. */
    profile: string;
    portraitAlt: string;
    yearsValue: string;
    yearsLabel: string;
    ledValue: string;
    ledLabel: string;
  };
  reviews: {
    kicker: string;
    titleLead: string;
    titleAccent: string;
    lead: string;
    proofStrong: string;
    proofRest: string;
    viewOriginals: string;
    /** aria-label of the two drifting rows. */
    tickerLabel: string;
    pills: [string, string, string, string, string, string, string, string];
    /** aria-label of a card: "Review from {name}". */
    reviewFrom: string;
    readMore: string;
    readLess: string;
    originalReview: string;
    /** The small line above each quote, by reviewer (lowercase name); a reviewer not listed has none. */
    tags: Record<string, string>;
    showMore: string;
    showLess: string;
    allFeedback: string;
    videoTag: string;
    uiLines: [string, string, string];
    playLabel: string;
    videoOverline: string;
    frameTitle: string;
    videoCaption: string;
    videoTitle: string;
    videoNote: string;
    videoLink: string;
  };
};

const en: CopilotFounderReviewsCopy = {
  copilot: {
    strip: "Connect your website and favorite accounts",
    stripLabel: "Supported connections",
    kicker: "Website + Social + AI Copilot",
    title: "Meet your Growth AI Chat Copilot.",
    body: "Connect your website, your social channels and your data, then manage everything from one simple conversation.",
    points: [
      { lead: "Connect.", text: "Add your domain, search data and social profiles." },
      { lead: "Ask.", text: "Get audits, content plans, post ideas and growth actions." },
      { lead: "Publish.", text: "Approve once and let RepGet handle the execution." },
    ],
    connect: "Connect your setup",
    watch: "Watch the demo",
    site: "yourwebsite.com",
    channelsConnected: "4 channels connected",
    previewLabel: "Growth AI Chat Copilot preview",
    userMessage: "Connect my website, Instagram and TikTok, then build me a growth plan for this month.",
    status: "Growth AI Copilot is connecting your website and channels",
    lines: ["Website audit ready", "Social accounts connected", "Drafting SEO, AI and social actions"],
    input: "Ask anything about your growth...",
  },
  founder: {
    eyebrow: "Built by",
    role: "Founder of RepGet",
    body: "After years creating for businesses and building digital projects, I wanted a simpler way to grow online. **RepGet brings SEO, AI visibility, content, backlinks and social distribution together** in one practical platform.",
    body2: "The idea is simple. Less time juggling tools, more time creating, connecting and growing.",
    profilesLabel: "Founder social profiles",
    profile: "{name} {network} profile",
    portraitAlt: "Dumitru Culiuc, founder of RepGet, portrait on a neutral studio background",
    yearsValue: "14+ years",
    yearsLabel: "creative production",
    ledValue: "Founder-led",
    ledLabel: "human-first growth",
  },
  reviews: {
    kicker: "Customer stories",
    titleLead: "Loved by people who",
    titleAccent: "build and grow.",
    lead: "From creative studios to founders and agencies, here is what customers have shared about using RepGet.",
    proofStrong: "Customer feedback",
    proofRest: "published on RepGet",
    viewOriginals: "View the originals",
    tickerLabel: "Reported customer experiences",
    pills: [
      "Better search visibility",
      "More consistent publishing",
      "Higher-quality enquiries",
      "Stronger AI discovery",
      "Clearer content planning",
      "Less manual SEO work",
      "Content and backlinks together",
      "A more reliable lead flow",
    ],
    reviewFrom: "Review from {name}",
    readMore: "Read more",
    readLess: "Read less",
    originalReview: "Original review",
    tags: {
      "image studio": "SEARCH VISIBILITY",
      "stefan coetzer": "CONTENT & AUTHORITY",
      "culiucs": "PUBLISHING EXPERIENCE",
      "tristan b.": "SIMPLE GROWTH",
      "oxford magic tours": "QUALIFIED ENQUIRIES",
      "gasper b.": "LOCAL DISCOVERY",
      "peter chrzaniecki": "DAILY EXECUTION",
      "muhammad imran": "AGENCY WORKFLOW",
      "patryk": "TRAFFIC & CONVERSIONS",
      "sofia rinaldi": "PUBLISHING SPEED",
      "groweco": "ORGANISED SEO",
      "lauren t.": "STEADY MOMENTUM",
    },
    showMore: "Show more reviews",
    showLess: "Show fewer reviews",
    allFeedback: "All customer feedback",
    videoTag: "Platform video",
    uiLines: ["More discoverable", "Better content planning", "Every channel connected"],
    playLabel: "Play the official RepGet product walkthrough",
    videoOverline: "See the platform in action",
    frameTitle: "Official RepGet platform walkthrough",
    videoCaption: "Real product walkthrough",
    videoTitle: "See what one connected growth platform looks like.",
    videoNote: "This video demonstrates RepGet itself. It is a product walkthrough, not a customer endorsement.",
    videoLink: "Watch the full demo",
  },
};

const es: CopilotFounderReviewsCopy = {
  copilot: {
    strip: "Conecte su sitio web y sus cuentas favoritas",
    stripLabel: "Conexiones disponibles",
    kicker: "Sitio web + Redes + Copiloto de IA",
    title: "Conozca su Growth AI Chat Copilot.",
    body: "Conecte su sitio web, sus redes sociales y sus datos, y gestione todo desde una conversación sencilla.",
    points: [
      { lead: "Conecte.", text: "Añada su dominio, sus datos de búsqueda y sus perfiles sociales." },
      { lead: "Pregunte.", text: "Obtenga auditorías, planes de contenido, ideas de publicaciones y acciones de crecimiento." },
      { lead: "Publique.", text: "Apruebe una vez y deje que RepGet se encargue de la ejecución." },
    ],
    connect: "Conectar su configuración",
    watch: "Ver la demostración",
    site: "susitioweb.com",
    channelsConnected: "4 canales conectados",
    previewLabel: "Vista previa de Growth AI Chat Copilot",
    userMessage: "Conecta mi sitio web, Instagram y TikTok, y prepárame un plan de crecimiento para este mes.",
    status: "Growth AI Copilot está conectando su sitio web y sus canales",
    lines: ["Auditoría del sitio lista", "Cuentas sociales conectadas", "Preparando acciones de SEO, IA y redes"],
    input: "Pregunte lo que quiera sobre su crecimiento...",
  },
  founder: {
    eyebrow: "Creado por",
    role: "Fundador de RepGet",
    body: "Después de años creando para empresas y desarrollando proyectos digitales, quería una forma más sencilla de crecer en internet. **RepGet reúne SEO, visibilidad en IA, contenido, backlinks y distribución en redes** en una plataforma práctica.",
    body2: "La idea es sencilla: menos tiempo con herramientas, más tiempo para crear, conectar y crecer.",
    profilesLabel: "Perfiles sociales del fundador",
    profile: "Perfil de {network} de {name}",
    portraitAlt: "Dumitru Culiuc, fundador de RepGet, retrato sobre un fondo de estudio neutro",
    yearsValue: "Más de 14 años",
    yearsLabel: "de producción creativa",
    ledValue: "Dirigido por su fundador",
    ledLabel: "crecimiento con trato humano",
  },
  reviews: {
    kicker: "Historias de clientes",
    titleLead: "Elegido por quienes",
    titleAccent: "crean y crecen.",
    lead: "De estudios creativos a fundadores y agencias: esto es lo que los clientes han contado sobre su experiencia con RepGet.",
    proofStrong: "Opiniones de clientes",
    proofRest: "publicadas en RepGet",
    viewOriginals: "Ver los originales",
    tickerLabel: "Experiencias contadas por clientes",
    pills: [
      "Más visibilidad en búsquedas",
      "Publicación más constante",
      "Consultas de más calidad",
      "Más presencia en la IA",
      "Planificación de contenido más clara",
      "Menos trabajo manual de SEO",
      "Contenido y backlinks juntos",
      "Un flujo de clientes más fiable",
    ],
    reviewFrom: "Opinión de {name}",
    readMore: "Leer más",
    readLess: "Leer menos",
    originalReview: "Opinión original",
    tags: {
      "image studio": "VISIBILIDAD EN BÚSQUEDAS",
      "stefan coetzer": "CONTENIDO Y AUTORIDAD",
      "culiucs": "EXPERIENCIA DE PUBLICACIÓN",
      "tristan b.": "CRECIMIENTO SENCILLO",
      "oxford magic tours": "CONSULTAS CUALIFICADAS",
      "gasper b.": "DESCUBRIMIENTO LOCAL",
      "peter chrzaniecki": "EJECUCIÓN DIARIA",
      "muhammad imran": "FLUJO DE AGENCIA",
      "patryk": "TRÁFICO Y CONVERSIONES",
      "sofia rinaldi": "VELOCIDAD DE PUBLICACIÓN",
      "groweco": "SEO ORGANIZADO",
      "lauren t.": "IMPULSO CONSTANTE",
    },
    showMore: "Ver más opiniones",
    showLess: "Ver menos opiniones",
    allFeedback: "Todas las opiniones de clientes",
    videoTag: "Vídeo de la plataforma",
    uiLines: ["Más visible", "Mejor planificación", "Todos los canales conectados"],
    playLabel: "Reproducir el recorrido oficial por RepGet",
    videoOverline: "Vea la plataforma en acción",
    frameTitle: "Recorrido oficial por la plataforma RepGet",
    videoCaption: "Recorrido real del producto",
    videoTitle: "Así es una plataforma de crecimiento conectada.",
    videoNote: "Este vídeo muestra RepGet. Es un recorrido del producto, no una recomendación de un cliente.",
    videoLink: "Ver la demostración completa",
  },
};

const fr: CopilotFounderReviewsCopy = {
  copilot: {
    strip: "Connectez votre site et vos comptes préférés",
    stripLabel: "Connexions disponibles",
    kicker: "Site + Réseaux + Copilote IA",
    title: "Découvrez votre Growth AI Chat Copilot.",
    body: "Connectez votre site, vos réseaux sociaux et vos données, puis pilotez tout depuis une simple conversation.",
    points: [
      { lead: "Connectez.", text: "Ajoutez votre domaine, vos données de recherche et vos profils sociaux." },
      { lead: "Demandez.", text: "Obtenez des audits, des plans de contenu, des idées de publications et des actions de croissance." },
      { lead: "Publiez.", text: "Validez une fois et laissez RepGet s’occuper de l’exécution." },
    ],
    connect: "Connecter votre configuration",
    watch: "Voir la démo",
    site: "votresite.com",
    channelsConnected: "4 canaux connectés",
    previewLabel: "Aperçu de Growth AI Chat Copilot",
    userMessage: "Connecte mon site, Instagram et TikTok, puis prépare-moi un plan de croissance pour ce mois-ci.",
    status: "Growth AI Copilot connecte votre site et vos canaux",
    lines: ["Audit du site prêt", "Comptes sociaux connectés", "Préparation des actions SEO, IA et réseaux"],
    input: "Posez une question sur votre croissance...",
  },
  founder: {
    eyebrow: "Créé par",
    role: "Fondateur de RepGet",
    body: "Après des années à créer pour des entreprises et à mener des projets numériques, je voulais une façon plus simple de grandir en ligne. **RepGet réunit le SEO, la visibilité IA, le contenu, les backlinks et la diffusion sur les réseaux** dans une plateforme pratique.",
    body2: "L’idée est simple : moins de temps à jongler entre les outils, plus de temps pour créer, échanger et grandir.",
    profilesLabel: "Profils sociaux du fondateur",
    profile: "Profil {network} de {name}",
    portraitAlt: "Dumitru Culiuc, fondateur de RepGet, portrait sur un fond de studio neutre",
    yearsValue: "Plus de 14 ans",
    yearsLabel: "de production créative",
    ledValue: "Dirigé par son fondateur",
    ledLabel: "une croissance à visage humain",
  },
  reviews: {
    kicker: "Témoignages clients",
    titleLead: "Apprécié par ceux qui",
    titleAccent: "créent et grandissent.",
    lead: "Studios créatifs, fondateurs, agences : voici ce que des clients ont partagé sur leur utilisation de RepGet.",
    proofStrong: "Avis clients",
    proofRest: "publiés sur RepGet",
    viewOriginals: "Voir les originaux",
    tickerLabel: "Expériences rapportées par des clients",
    pills: [
      "Plus de visibilité dans la recherche",
      "Une publication plus régulière",
      "Des demandes de meilleure qualité",
      "Plus de présence dans l’IA",
      "Un planning de contenu plus clair",
      "Moins de SEO manuel",
      "Contenu et backlinks ensemble",
      "Un flux de prospects plus fiable",
    ],
    reviewFrom: "Avis de {name}",
    readMore: "Lire la suite",
    readLess: "Réduire",
    originalReview: "Avis original",
    tags: {
      "image studio": "VISIBILITÉ DANS LA RECHERCHE",
      "stefan coetzer": "CONTENU ET AUTORITÉ",
      "culiucs": "EXPÉRIENCE DE PUBLICATION",
      "tristan b.": "CROISSANCE SIMPLE",
      "oxford magic tours": "DEMANDES QUALIFIÉES",
      "gasper b.": "DÉCOUVERTE LOCALE",
      "peter chrzaniecki": "EXÉCUTION QUOTIDIENNE",
      "muhammad imran": "FLUX D'AGENCE",
      "patryk": "TRAFIC ET CONVERSIONS",
      "sofia rinaldi": "VITESSE DE PUBLICATION",
      "groweco": "SEO ORGANISÉ",
      "lauren t.": "ÉLAN CONSTANT",
    },
    showMore: "Voir plus d’avis",
    showLess: "Voir moins d’avis",
    allFeedback: "Tous les avis clients",
    videoTag: "Vidéo de la plateforme",
    uiLines: ["Plus visible", "Meilleur planning", "Tous les canaux connectés"],
    playLabel: "Lire la présentation officielle de RepGet",
    videoOverline: "Voir la plateforme en action",
    frameTitle: "Présentation officielle de la plateforme RepGet",
    videoCaption: "Vraie présentation du produit",
    videoTitle: "À quoi ressemble une plateforme de croissance connectée.",
    videoNote: "Cette vidéo présente RepGet. C’est une démonstration du produit, pas une recommandation de client.",
    videoLink: "Voir la démo complète",
  },
};

const it: CopilotFounderReviewsCopy = {
  copilot: {
    strip: "Colleghi il Suo sito e i Suoi account preferiti",
    stripLabel: "Collegamenti disponibili",
    kicker: "Sito + Social + Copilota IA",
    title: "Scopra il Suo Growth AI Chat Copilot.",
    body: "Colleghi il Suo sito, i Suoi canali social e i Suoi dati, poi gestisca tutto da una semplice conversazione.",
    points: [
      { lead: "Colleghi.", text: "Aggiunga dominio, dati di ricerca e profili social." },
      { lead: "Chieda.", text: "Ottenga audit, piani di contenuti, idee per i post e azioni di crescita." },
      { lead: "Pubblichi.", text: "Approvi una volta e lasci che RepGet si occupi dell’esecuzione." },
    ],
    connect: "Colleghi la Sua configurazione",
    watch: "Guardi la demo",
    site: "ilsuosito.com",
    channelsConnected: "4 canali collegati",
    previewLabel: "Anteprima di Growth AI Chat Copilot",
    userMessage: "Collega il mio sito, Instagram e TikTok, poi preparami un piano di crescita per questo mese.",
    status: "Growth AI Copilot sta collegando il Suo sito e i Suoi canali",
    lines: ["Audit del sito pronto", "Account social collegati", "Preparazione di azioni SEO, IA e social"],
    input: "Chieda qualsiasi cosa sulla Sua crescita...",
  },
  founder: {
    eyebrow: "Creato da",
    role: "Fondatore di RepGet",
    body: "Dopo anni passati a creare per le aziende e a sviluppare progetti digitali, volevo un modo più semplice per crescere online. **RepGet riunisce SEO, visibilità nell’IA, contenuti, backlink e distribuzione sui social** in un’unica piattaforma pratica.",
    body2: "L’idea è semplice: meno tempo a destreggiarsi tra strumenti, più tempo per creare, connettersi e crescere.",
    profilesLabel: "Profili social del fondatore",
    profile: "Profilo {network} di {name}",
    portraitAlt: "Dumitru Culiuc, fondatore di RepGet, ritratto su uno sfondo neutro da studio",
    yearsValue: "Oltre 14 anni",
    yearsLabel: "di produzione creativa",
    ledValue: "Guidato dal fondatore",
    ledLabel: "crescita a misura d’uomo",
  },
  reviews: {
    kicker: "Storie dei clienti",
    titleLead: "Scelto da chi",
    titleAccent: "crea e cresce.",
    lead: "Da studi creativi a fondatori e agenzie: ecco cosa hanno raccontato i clienti sul loro uso di RepGet.",
    proofStrong: "Opinioni dei clienti",
    proofRest: "pubblicate su RepGet",
    viewOriginals: "Veda gli originali",
    tickerLabel: "Esperienze raccontate dai clienti",
    pills: [
      "Più visibilità nella ricerca",
      "Pubblicazione più costante",
      "Richieste di qualità migliore",
      "Più presenza nell’IA",
      "Pianificazione dei contenuti più chiara",
      "Meno lavoro SEO manuale",
      "Contenuti e backlink insieme",
      "Un flusso di contatti più affidabile",
    ],
    reviewFrom: "Recensione di {name}",
    readMore: "Leggi tutto",
    readLess: "Riduci",
    originalReview: "Recensione originale",
    tags: {
      "image studio": "VISIBILITÀ NELLA RICERCA",
      "stefan coetzer": "CONTENUTI E AUTOREVOLEZZA",
      "culiucs": "ESPERIENZA DI PUBBLICAZIONE",
      "tristan b.": "CRESCITA SEMPLICE",
      "oxford magic tours": "RICHIESTE QUALIFICATE",
      "gasper b.": "VISIBILITÀ LOCALE",
      "peter chrzaniecki": "ESECUZIONE QUOTIDIANA",
      "muhammad imran": "FLUSSO DI AGENZIA",
      "patryk": "TRAFFICO E CONVERSIONI",
      "sofia rinaldi": "VELOCITÀ DI PUBBLICAZIONE",
      "groweco": "SEO ORGANIZZATA",
      "lauren t.": "SLANCIO COSTANTE",
    },
    showMore: "Mostra altre recensioni",
    showLess: "Mostra meno recensioni",
    allFeedback: "Tutte le opinioni dei clienti",
    videoTag: "Video della piattaforma",
    uiLines: ["Più visibile", "Pianificazione migliore", "Tutti i canali collegati"],
    playLabel: "Riproduca la presentazione ufficiale di RepGet",
    videoOverline: "Veda la piattaforma in azione",
    frameTitle: "Presentazione ufficiale della piattaforma RepGet",
    videoCaption: "Presentazione reale del prodotto",
    videoTitle: "Ecco com’è una piattaforma di crescita collegata.",
    videoNote: "Questo video mostra RepGet. È una presentazione del prodotto, non la raccomandazione di un cliente.",
    videoLink: "Guardi la demo completa",
  },
};

const de: CopilotFounderReviewsCopy = {
  copilot: {
    strip: "Verbinden Sie Ihre Website und Ihre Lieblingskonten",
    stripLabel: "Verfügbare Verbindungen",
    kicker: "Website + Social Media + KI-Copilot",
    title: "Lernen Sie Ihren Growth AI Chat Copilot kennen.",
    body: "Verbinden Sie Ihre Website, Ihre Social-Media-Kanäle und Ihre Daten und steuern Sie alles in einem einfachen Gespräch.",
    points: [
      { lead: "Verbinden.", text: "Fügen Sie Domain, Suchdaten und Social-Media-Profile hinzu." },
      { lead: "Fragen.", text: "Erhalten Sie Audits, Inhaltspläne, Post-Ideen und Wachstumsaktionen." },
      { lead: "Veröffentlichen.", text: "Einmal freigeben, RepGet übernimmt die Umsetzung." },
    ],
    connect: "Einrichtung verbinden",
    watch: "Demo ansehen",
    site: "ihrewebsite.de",
    channelsConnected: "4 Kanäle verbunden",
    previewLabel: "Vorschau von Growth AI Chat Copilot",
    userMessage: "Verbinde meine Website, Instagram und TikTok und erstelle mir einen Wachstumsplan für diesen Monat.",
    status: "Growth AI Copilot verbindet Ihre Website und Ihre Kanäle",
    lines: ["Website-Audit fertig", "Social-Media-Konten verbunden", "SEO-, KI- und Social-Aktionen in Arbeit"],
    input: "Fragen Sie alles zu Ihrem Wachstum...",
  },
  founder: {
    eyebrow: "Entwickelt von",
    role: "Gründer von RepGet",
    body: "Nach Jahren, in denen ich für Unternehmen gestaltet und digitale Projekte aufgebaut habe, wollte ich einen einfacheren Weg, online zu wachsen. **RepGet vereint SEO, KI-Sichtbarkeit, Inhalte, Backlinks und Social-Media-Verbreitung** in einer praktischen Plattform.",
    body2: "Die Idee ist einfach: weniger Zeit mit Tools jonglieren, mehr Zeit zum Gestalten, Vernetzen und Wachsen.",
    profilesLabel: "Social-Media-Profile des Gründers",
    profile: "{network}-Profil von {name}",
    portraitAlt: "Dumitru Culiuc, Gründer von RepGet, Porträt vor neutralem Studiohintergrund",
    yearsValue: "Über 14 Jahre",
    yearsLabel: "kreative Produktion",
    ledValue: "Vom Gründer geführt",
    ledLabel: "Wachstum mit persönlichem Kontakt",
  },
  reviews: {
    kicker: "Kundenstimmen",
    titleLead: "Geschätzt von Menschen, die",
    titleAccent: "aufbauen und wachsen.",
    lead: "Von Kreativstudios bis zu Gründern und Agenturen: Das erzählen Kunden über ihre Arbeit mit RepGet.",
    proofStrong: "Kundenfeedback",
    proofRest: "veröffentlicht auf RepGet",
    viewOriginals: "Originale ansehen",
    tickerLabel: "Von Kunden berichtete Erfahrungen",
    pills: [
      "Mehr Sichtbarkeit in der Suche",
      "Regelmäßigeres Veröffentlichen",
      "Hochwertigere Anfragen",
      "Mehr Präsenz in der KI",
      "Klarere Inhaltsplanung",
      "Weniger manuelle SEO-Arbeit",
      "Inhalte und Backlinks zusammen",
      "Ein verlässlicherer Strom an Anfragen",
    ],
    reviewFrom: "Bewertung von {name}",
    readMore: "Weiterlesen",
    readLess: "Weniger anzeigen",
    originalReview: "Originalbewertung",
    tags: {
      "image studio": "SICHTBARKEIT IN DER SUCHE",
      "stefan coetzer": "INHALTE & AUTORITÄT",
      "culiucs": "VERÖFFENTLICHUNGSERLEBNIS",
      "tristan b.": "EINFACHES WACHSTUM",
      "oxford magic tours": "QUALIFIZIERTE ANFRAGEN",
      "gasper b.": "LOKALE AUFFINDBARKEIT",
      "peter chrzaniecki": "TÄGLICHE UMSETZUNG",
      "muhammad imran": "AGENTUR-WORKFLOW",
      "patryk": "TRAFFIC & CONVERSIONS",
      "sofia rinaldi": "VERÖFFENTLICHUNGSTEMPO",
      "groweco": "STRUKTURIERTES SEO",
      "lauren t.": "STETIGER SCHWUNG",
    },
    showMore: "Mehr Bewertungen anzeigen",
    showLess: "Weniger Bewertungen anzeigen",
    allFeedback: "Alle Kundenstimmen",
    videoTag: "Plattform-Video",
    uiLines: ["Besser auffindbar", "Bessere Planung", "Alle Kanäle verbunden"],
    playLabel: "Offiziellen RepGet-Produktrundgang abspielen",
    videoOverline: "Die Plattform in Aktion",
    frameTitle: "Offizieller Rundgang durch die RepGet-Plattform",
    videoCaption: "Echter Produktrundgang",
    videoTitle: "So sieht eine vernetzte Wachstumsplattform aus.",
    videoNote: "Dieses Video zeigt RepGet selbst. Es ist ein Produktrundgang, keine Kundenempfehlung.",
    videoLink: "Ganze Demo ansehen",
  },
};

const COPY: Record<Locale, CopilotFounderReviewsCopy> = { en, es, fr, it, de };

export function copilotFounderReviewsCopy(locale: Locale): CopilotFounderReviewsCopy {
  return COPY[locale] ?? en;
}
