import type { Locale } from "@/lib/i18n/config";

/**
 * The right-hand panel of the sign-up page (client's design, 2026-11-05,
 * RepGet-Signup-Official-Logo.html), in every language. The browser's language
 * picks one, as it does for the form beside it ((auth)/layout.tsx).
 */

export type SignupShowcaseCopy = {
  eyebrow: string;
  titleLead: string;
  titleAccent: string;
  lead: string;
  /** The drawing's accessible name. It is an illustration, and says so. */
  previewLabel: string;
  windowTitle: string;
  /** The three rows of the drawing: name, then the status beside it. */
  windowRows: [[string, string], [string, string], [string, string]];
  kicker: string;
  panelTitle: string;
  panelBody: string;
  features: [string, string, string];
  channelsCaption: string;
  channelsLabel: string;
};

const COPY: Record<Locale, SignupShowcaseCopy> = {
  en: {
    eyebrow: "One platform. Every growth channel.",
    titleLead: "Show up in more places.",
    titleAccent: "Grow on every channel.",
    lead: "From Google and AI search to the feeds your customers follow. One workspace to create, distribute and grow your online presence.",
    previewLabel: "Illustrative RepGet dashboard preview",
    windowTitle: "Growth workspace",
    windowRows: [
      ["SEO content", "Ready to publish"],
      ["Social calendar", "Connected"],
      ["AI visibility", "Monitoring"],
    ],
    kicker: "Your growth, connected",
    panelTitle: "Everything your online growth needs. One place.",
    panelBody:
      "Plan, create, publish and measure in one workspace. RepGet connects the work behind better search visibility with the content that reaches people on social.",
    features: ["SEO articles & relevant backlinks", "Social content & distribution", "Google & AI search insights"],
    channelsCaption: "Be discovered where your customers are",
    channelsLabel: "Discovery and social channels",
  },
  es: {
    eyebrow: "Una plataforma. Todos los canales de crecimiento.",
    titleLead: "Aparezca en más lugares.",
    titleAccent: "Crezca en todos los canales.",
    lead: "De Google y las búsquedas con IA a las redes que siguen sus clientes. Un solo espacio de trabajo para crear, distribuir y hacer crecer su presencia online.",
    previewLabel: "Vista previa ilustrativa del panel de RepGet",
    windowTitle: "Espacio de crecimiento",
    windowRows: [
      ["Contenido SEO", "Listo para publicar"],
      ["Calendario social", "Conectado"],
      ["Visibilidad en IA", "En seguimiento"],
    ],
    kicker: "Su crecimiento, conectado",
    panelTitle: "Todo lo que su crecimiento online necesita. En un solo lugar.",
    panelBody:
      "Planifique, cree, publique y mida en un solo espacio de trabajo. RepGet une el trabajo que mejora su visibilidad en las búsquedas con el contenido que llega a la gente en redes sociales.",
    features: ["Artículos SEO y backlinks relevantes", "Contenido social y distribución", "Datos de Google y de búsqueda con IA"],
    channelsCaption: "Déjese descubrir donde están sus clientes",
    channelsLabel: "Canales de búsqueda y redes sociales",
  },
  fr: {
    eyebrow: "Une plateforme. Tous les canaux de croissance.",
    titleLead: "Soyez présent à plus d’endroits.",
    titleAccent: "Développez-vous sur tous les canaux.",
    lead: "De Google et de la recherche par IA aux fils que suivent vos clients. Un seul espace de travail pour créer, diffuser et développer votre présence en ligne.",
    previewLabel: "Aperçu illustratif du tableau de bord RepGet",
    windowTitle: "Espace de croissance",
    windowRows: [
      ["Contenu SEO", "Prêt à publier"],
      ["Calendrier social", "Connecté"],
      ["Visibilité IA", "Sous surveillance"],
    ],
    kicker: "Votre croissance, connectée",
    panelTitle: "Tout ce qu’il faut à votre croissance en ligne. Au même endroit.",
    panelBody:
      "Planifiez, créez, publiez et mesurez dans un seul espace de travail. RepGet relie le travail qui améliore votre visibilité dans la recherche au contenu qui touche les gens sur les réseaux sociaux.",
    features: ["Articles SEO et backlinks pertinents", "Contenu social et diffusion", "Données Google et recherche par IA"],
    channelsCaption: "Soyez trouvé là où sont vos clients",
    channelsLabel: "Canaux de recherche et réseaux sociaux",
  },
  it: {
    eyebrow: "Una piattaforma. Ogni canale di crescita.",
    titleLead: "Sia presente in più luoghi.",
    titleAccent: "Cresca su ogni canale.",
    lead: "Da Google e dalla ricerca con l’AI ai feed che i suoi clienti seguono. Un unico spazio di lavoro per creare, distribuire e far crescere la sua presenza online.",
    previewLabel: "Anteprima illustrativa della dashboard di RepGet",
    windowTitle: "Spazio di crescita",
    windowRows: [
      ["Contenuti SEO", "Pronto da pubblicare"],
      ["Calendario social", "Collegato"],
      ["Visibilità AI", "Monitoraggio"],
    ],
    kicker: "La sua crescita, connessa",
    panelTitle: "Tutto ciò che serve alla sua crescita online. In un unico posto.",
    panelBody:
      "Pianifichi, crei, pubblichi e misuri in un unico spazio di lavoro. RepGet collega il lavoro che migliora la visibilità nella ricerca ai contenuti che raggiungono le persone sui social.",
    features: ["Articoli SEO e backlink pertinenti", "Contenuti social e distribuzione", "Dati di Google e della ricerca AI"],
    channelsCaption: "Si faccia trovare dove sono i suoi clienti",
    channelsLabel: "Canali di ricerca e social",
  },
  de: {
    eyebrow: "Eine Plattform. Jeder Wachstumskanal.",
    titleLead: "Seien Sie an mehr Orten sichtbar.",
    titleAccent: "Wachsen Sie auf jedem Kanal.",
    lead: "Von Google und KI-Suche bis zu den Feeds, denen Ihre Kunden folgen. Ein Arbeitsbereich, um Ihre Online-Präsenz zu gestalten, zu verbreiten und auszubauen.",
    previewLabel: "Beispielhafte Vorschau des RepGet-Dashboards",
    windowTitle: "Wachstumsbereich",
    windowRows: [
      ["SEO-Inhalte", "Bereit zur Veröffentlichung"],
      ["Social-Kalender", "Verbunden"],
      ["KI-Sichtbarkeit", "Wird beobachtet"],
    ],
    kicker: "Ihr Wachstum, vernetzt",
    panelTitle: "Alles für Ihr Online-Wachstum. An einem Ort.",
    panelBody:
      "Planen, erstellen, veröffentlichen und messen Sie in einem Arbeitsbereich. RepGet verbindet die Arbeit für bessere Sichtbarkeit in der Suche mit den Inhalten, die Menschen in sozialen Netzwerken erreichen.",
    features: ["SEO-Artikel und relevante Backlinks", "Social-Inhalte und Verbreitung", "Einblicke aus Google und KI-Suche"],
    channelsCaption: "Dort gefunden werden, wo Ihre Kunden sind",
    channelsLabel: "Such- und Social-Kanäle",
  },
};

export function signupShowcaseCopy(locale: Locale): SignupShowcaseCopy {
  return COPY[locale];
}
