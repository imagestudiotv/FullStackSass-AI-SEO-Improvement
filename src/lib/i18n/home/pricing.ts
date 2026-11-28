import type { Locale } from "@/lib/i18n/config";

/**
 * The homepage's pricing section (client's design, 2026-11-03: "One
 * platform. Everything to grow."), in every language.
 *
 * The words for each package are the design's. The figures are not written
 * here: prices, articles and social posts come from the plans table, the same
 * rows checkout charges (scripts/plan-catalog.mjs).
 *
 * Plan names stay in English everywhere: they are product names. So does
 * "Growth AI Chat Copilot".
 */

/** The tiers the design has words for. */
export type HomePackageId = "launch" | "grow" | "scale";

export type PricingCopy = {
  eyebrow: string;
  titleLead: string;
  titleAccent: string;
  sub: string;
  /** aria-label of the row of the five tools (lib/marketing/product-tools.ts). */
  includedLabel: string;
  /** aria-label of the three cards. */
  gridLabel: string;
  allInOne: string;
  popular: string;
  perMonth: string;
  articles: string;
  posts: string;
  getStarted: string;
  packages: Record<HomePackageId, { label: string; intro: string; bullets: string[] }>;
  moreTitle: string;
  moreBody: string;
  talk: string;
};

const COPILOT = "Growth AI Chat Copilot";

const en: PricingCopy = {
  eyebrow: "Simple, transparent growth",
  titleLead: "One platform.",
  titleAccent: "Everything to grow.",
  sub: "SEO articles, backlinks, AI search visibility, and social content creation and distribution. Start free, then get the complete growth workflow, with more capacity as you scale.",
  includedLabel: "The five RepGet tools",
  gridLabel: "Complete RepGet packages",
  allInOne: "All-in-one",
  popular: "Most popular",
  perMonth: "/ month",
  articles: "SEO articles / month",
  posts: "social posts / month",
  getStarted: "Get Started",
  packages: {
    launch: {
      label: "Launch plan",
      intro: "All the essentials for a solo founder or local business.",
      bullets: [
        "Website SEO and AI-readiness audit",
        "Keyword research, article drafting and publishing",
        "Social content adapted for connected channels",
        "Backlink research and placement opportunities",
        "AI mentions checks and simple growth reporting",
        COPILOT,
        "One website and connected social profiles",
      ],
    },
    grow: {
      label: "Grow plan, most popular",
      intro: "A complete, consistent search and social presence.",
      bullets: [
        "Everything in Free, plus backlinks and higher capacity",
        "SEO content planning and CMS publishing",
        "Social posts, repurposing and scheduling",
        "Backlink credits and partner-network opportunities",
        "Weekly AI answer checks on your questions",
        COPILOT,
        "Campaign calendar and growth reporting",
      ],
    },
    scale: {
      label: "Scale plan",
      intro: "More reach, more content, and more growth opportunities.",
      bullets: [
        "Everything in Grow, with higher capacity",
        "Expanded keyword and topical authority planning",
        "Cross-channel social content and distribution",
        "Expanded backlink outreach opportunities",
        "AI answer checks on up to 50 questions",
        COPILOT,
        "The most search terms researched and clustered",
      ],
    },
  },
  moreTitle: "Need more capacity or a website built for you?",
  moreBody: "Add more social posts, backlink credits, website design credits or additional brand workspaces as your business grows.",
  talk: "Talk to our team",
};

const es: PricingCopy = {
  eyebrow: "Crecimiento sencillo y transparente",
  titleLead: "Una plataforma.",
  titleAccent: "Todo para crecer.",
  sub: "Artículos SEO, backlinks, visibilidad en búsquedas con IA y creación y distribución de contenido para redes sociales. Empiece gratis y obtenga después el flujo de crecimiento completo, con más capacidad a medida que crece.",
  includedLabel: "Las cinco herramientas de RepGet",
  gridLabel: "Planes completos de RepGet",
  allInOne: "Todo en uno",
  popular: "Más popular",
  perMonth: "/ mes",
  articles: "artículos SEO / mes",
  posts: "publicaciones en redes / mes",
  getStarted: "Empezar",
  packages: {
    launch: {
      label: "Plan Launch",
      intro: "Todo lo esencial para un emprendedor individual o un negocio local.",
      bullets: [
        "Auditoría SEO y de preparación para la IA de su sitio web",
        "Investigación de palabras clave, redacción y publicación de artículos",
        "Contenido social adaptado a los canales conectados",
        "Búsqueda de backlinks y oportunidades de colocación",
        "Control de menciones en IA e informes de crecimiento sencillos",
        COPILOT,
        "Un sitio web y perfiles sociales conectados",
      ],
    },
    grow: {
      label: "Plan Grow, el más popular",
      intro: "Una presencia completa y constante en búsquedas y redes.",
      bullets: [
        "Todo lo de Free, más backlinks y más capacidad",
        "Planificación de contenido SEO y publicación en su CMS",
        "Publicaciones sociales, reutilización de contenido y programación",
        "Créditos de backlinks y oportunidades en la red de socios",
        "Comprobación semanal de respuestas de IA a sus preguntas",
        COPILOT,
        "Calendario de campañas e informes de crecimiento",
      ],
    },
    scale: {
      label: "Plan Scale",
      intro: "Más alcance, más contenido y más oportunidades de crecimiento.",
      bullets: [
        "Todo lo de Grow, con más capacidad",
        "Planificación ampliada de palabras clave y autoridad temática",
        "Contenido social y distribución en varios canales",
        "Más oportunidades de outreach para backlinks",
        "Comprobación de respuestas de IA en hasta 50 preguntas",
        COPILOT,
        "El mayor volumen de términos de búsqueda investigados y agrupados",
      ],
    },
  },
  moreTitle: "¿Necesita más capacidad o un sitio web hecho para usted?",
  moreBody: "Añada más publicaciones en redes, créditos de backlinks, créditos de diseño web o espacios de marca adicionales a medida que crece su negocio.",
  talk: "Hable con nuestro equipo",
};

const fr: PricingCopy = {
  eyebrow: "Une croissance simple et transparente",
  titleLead: "Une seule plateforme.",
  titleAccent: "Tout pour grandir.",
  sub: "Articles SEO, backlinks, visibilité dans la recherche IA, création et diffusion de contenus sociaux. Commencez gratuitement, puis profitez du parcours de croissance complet, avec plus de capacité à mesure que vous grandissez.",
  includedLabel: "Les cinq outils de RepGet",
  gridLabel: "Offres RepGet complètes",
  allInOne: "Tout-en-un",
  popular: "Le plus choisi",
  perMonth: "/ mois",
  articles: "articles SEO / mois",
  posts: "publications sociales / mois",
  getStarted: "Commencer",
  packages: {
    launch: {
      label: "Offre Launch",
      intro: "L’essentiel pour un entrepreneur indépendant ou un commerce local.",
      bullets: [
        "Audit SEO et de préparation à l’IA de votre site",
        "Recherche de mots-clés, rédaction et publication d’articles",
        "Contenus sociaux adaptés à vos canaux connectés",
        "Recherche de backlinks et opportunités de placement",
        "Suivi des mentions IA et rapports de croissance simples",
        COPILOT,
        "Un site web et des profils sociaux connectés",
      ],
    },
    grow: {
      label: "Offre Grow, la plus choisie",
      intro: "Une présence complète et régulière dans la recherche et sur les réseaux.",
      bullets: [
        "Tout Free, plus les backlinks et plus de capacité",
        "Planification de contenus SEO et publication sur votre CMS",
        "Publications sociales, recyclage de contenus et programmation",
        "Crédits backlinks et opportunités du réseau de partenaires",
        "Vérification hebdomadaire des réponses de l’IA à vos questions",
        COPILOT,
        "Calendrier de campagnes et rapports de croissance",
      ],
    },
    scale: {
      label: "Offre Scale",
      intro: "Plus de portée, plus de contenus et plus d’opportunités de croissance.",
      bullets: [
        "Tout Grow, avec plus de capacité",
        "Planification étendue des mots-clés et de l’autorité thématique",
        "Contenus sociaux et diffusion multicanal",
        "Plus d’opportunités de prospection de backlinks",
        "Vérification des réponses de l’IA sur 50 questions maximum",
        COPILOT,
        "Le plus grand volume de termes de recherche analysés et regroupés",
      ],
    },
  },
  moreTitle: "Besoin de plus de capacité ou d’un site web conçu pour vous ?",
  moreBody: "Ajoutez des publications sociales, des crédits backlinks, des crédits de création de site ou des espaces de marque supplémentaires à mesure que votre activité grandit.",
  talk: "Parler à notre équipe",
};

const it: PricingCopy = {
  eyebrow: "Crescita semplice e trasparente",
  titleLead: "Un’unica piattaforma.",
  titleAccent: "Tutto per crescere.",
  sub: "Articoli SEO, backlink, visibilità nella ricerca IA e creazione e distribuzione di contenuti social. Inizi gratis, poi ottenga l’intero percorso di crescita, con più capacità man mano che cresce.",
  includedLabel: "I cinque strumenti di RepGet",
  gridLabel: "Piani RepGet completi",
  allInOne: "Tutto in uno",
  popular: "Il più scelto",
  perMonth: "/ mese",
  articles: "articoli SEO / mese",
  posts: "post social / mese",
  getStarted: "Inizia",
  packages: {
    launch: {
      label: "Piano Launch",
      intro: "Tutto l’essenziale per un professionista o un’attività locale.",
      bullets: [
        "Audit SEO e di preparazione all’IA del sito",
        "Ricerca di parole chiave, stesura e pubblicazione degli articoli",
        "Contenuti social adattati ai canali collegati",
        "Ricerca di backlink e opportunità di inserimento",
        "Controllo delle menzioni nell’IA e report di crescita semplici",
        COPILOT,
        "Un sito web e profili social collegati",
      ],
    },
    grow: {
      label: "Piano Grow, il più scelto",
      intro: "Una presenza completa e costante nella ricerca e sui social.",
      bullets: [
        "Tutto ciò che include Free, più backlink e più capacità",
        "Pianificazione dei contenuti SEO e pubblicazione sul CMS",
        "Post social, riutilizzo dei contenuti e programmazione",
        "Crediti backlink e opportunità nella rete di partner",
        "Controllo settimanale delle risposte dell’IA alle Sue domande",
        COPILOT,
        "Calendario delle campagne e report di crescita",
      ],
    },
    scale: {
      label: "Piano Scale",
      intro: "Più copertura, più contenuti e più opportunità di crescita.",
      bullets: [
        "Tutto ciò che include Grow, con più capacità",
        "Pianificazione estesa di parole chiave e autorità tematica",
        "Contenuti social e distribuzione su più canali",
        "Più opportunità di outreach per i backlink",
        "Controllo delle risposte dell’IA fino a 50 domande",
        COPILOT,
        "Il maggior numero di termini di ricerca analizzati e raggruppati",
      ],
    },
  },
  moreTitle: "Le serve più capacità o un sito web realizzato per Lei?",
  moreBody: "Aggiunga altri post social, crediti backlink, crediti per il design del sito o spazi di brand aggiuntivi man mano che la Sua attività cresce.",
  talk: "Parli con il nostro team",
};

const de: PricingCopy = {
  eyebrow: "Einfaches, transparentes Wachstum",
  titleLead: "Eine Plattform.",
  titleAccent: "Alles für Ihr Wachstum.",
  sub: "SEO-Artikel, Backlinks, Sichtbarkeit in der KI-Suche sowie Erstellung und Verbreitung von Social-Media-Inhalten. Starten Sie kostenlos und erhalten Sie dann den kompletten Wachstums-Workflow, mit mehr Kapazität, während Sie wachsen.",
  includedLabel: "Die fünf RepGet-Werkzeuge",
  gridLabel: "Komplette RepGet-Pakete",
  allInOne: "All-in-one",
  popular: "Am beliebtesten",
  perMonth: "/ Monat",
  articles: "SEO-Artikel / Monat",
  posts: "Social-Posts / Monat",
  getStarted: "Loslegen",
  packages: {
    launch: {
      label: "Tarif Launch",
      intro: "Alles Wesentliche für Selbstständige und lokale Unternehmen.",
      bullets: [
        "SEO- und KI-Readiness-Audit Ihrer Website",
        "Keyword-Recherche, Artikelerstellung und Veröffentlichung",
        "Social-Media-Inhalte, angepasst an Ihre verbundenen Kanäle",
        "Backlink-Recherche und Platzierungsmöglichkeiten",
        "Prüfung von KI-Erwähnungen und einfache Wachstumsberichte",
        COPILOT,
        "Eine Website und verbundene Social-Media-Profile",
      ],
    },
    grow: {
      label: "Tarif Grow, am beliebtesten",
      intro: "Eine vollständige, konsistente Präsenz in Suche und Social Media.",
      bullets: [
        "Alles aus Free, plus Backlinks und mehr Kapazität",
        "SEO-Content-Planung und Veröffentlichung im CMS",
        "Social-Posts, Wiederverwendung von Inhalten und Planung",
        "Backlink-Credits und Möglichkeiten im Partnernetzwerk",
        "Wöchentliche Prüfung der KI-Antworten auf Ihre Fragen",
        COPILOT,
        "Kampagnenkalender und Wachstumsberichte",
      ],
    },
    scale: {
      label: "Tarif Scale",
      intro: "Mehr Reichweite, mehr Inhalte und mehr Wachstumschancen.",
      bullets: [
        "Alles aus Grow, mit mehr Kapazität",
        "Erweiterte Keyword- und Themenautoritätsplanung",
        "Kanalübergreifende Social-Media-Inhalte und Verbreitung",
        "Erweiterte Backlink-Outreach-Möglichkeiten",
        "Prüfung der KI-Antworten für bis zu 50 Fragen",
        COPILOT,
        "Die meisten recherchierten und gruppierten Suchbegriffe",
      ],
    },
  },
  moreTitle: "Mehr Kapazität oder eine Website, die für Sie erstellt wird?",
  moreBody: "Fügen Sie weitere Social-Posts, Backlink-Credits, Webdesign-Credits oder zusätzliche Marken-Workspaces hinzu, während Ihr Unternehmen wächst.",
  talk: "Mit unserem Team sprechen",
};

const COPY: Record<Locale, PricingCopy> = { en, es, fr, it, de };

export function pricingCopy(locale: Locale): PricingCopy {
  return COPY[locale] ?? en;
}
