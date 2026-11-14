import type { Locale } from "@/lib/i18n/config";

/**
 * The right-hand panel of the sign-up page (client's design, 2026-11-15,
 * repget-signup-inline-owl.html: the gecko and the owl), in every language.
 * The site language the visitor was reading picks one, or else their
 * browser's (authLocale).
 */

export type SignupShowcaseCopy = {
  kicker: string;
  /** The title's first line, then its orange line. */
  titleLead: string;
  titleAccent: string;
  lead: string;
  /** The drawing's accessible name. It is an illustration, and says so. */
  sceneLabel: string;
  /** The three signals around the mascots: search, AI, social. */
  nodes: [string, string, string];
  /** The footer line: its start, then its orange end. */
  footLead: string;
  footAccent: string;
  footNote: string;
  tag: string;
};

const COPY: Record<Locale, SignupShowcaseCopy> = {
  en: {
    kicker: "One workspace. Everywhere they search.",
    titleLead: "Your next customer is looking.",
    titleAccent: "Get found.",
    lead: "Grow your presence across search, AI and social. RepGet brings content, backlinks and visibility into one place.",
    sceneLabel: "RepGet's gecko and owl mascots, surrounded by search, AI and social signals",
    nodes: ["Search visibility", "AI discovery", "Social reach"],
    footLead: "Make your brand",
    footAccent: "impossible to overlook.",
    footNote: "Create. Publish. Get discovered.",
    tag: "Made to grow",
  },
  es: {
    kicker: "Un solo espacio. Allí donde le buscan.",
    titleLead: "Su próximo cliente está buscando.",
    titleAccent: "Hágase encontrar.",
    lead: "Aumente su presencia en buscadores, IA y redes sociales. RepGet reúne contenido, backlinks y visibilidad en un solo lugar.",
    sceneLabel: "Las mascotas de RepGet, un geco y un búho, rodeadas de señales de búsqueda, IA y redes sociales",
    nodes: ["Visibilidad en buscadores", "Descubrimiento en IA", "Alcance en redes"],
    footLead: "Haga que su marca sea",
    footAccent: "imposible de pasar por alto.",
    footNote: "Cree. Publique. Hágase visible.",
    tag: "Hecho para crecer",
  },
  fr: {
    kicker: "Un seul espace. Partout où l’on vous cherche.",
    titleLead: "Votre prochain client vous cherche.",
    titleAccent: "Soyez trouvé.",
    lead: "Développez votre présence dans la recherche, l’IA et les réseaux sociaux. RepGet réunit contenu, backlinks et visibilité au même endroit.",
    sceneLabel: "Les mascottes de RepGet, un gecko et un hibou, entourées de signaux de recherche, d’IA et de réseaux sociaux",
    nodes: ["Visibilité dans la recherche", "Découverte par l’IA", "Portée sur les réseaux"],
    footLead: "Rendez votre marque",
    footAccent: "impossible à ignorer.",
    footNote: "Créez. Publiez. Soyez découvert.",
    tag: "Fait pour grandir",
  },
  it: {
    kicker: "Un solo spazio. Ovunque la cerchino.",
    titleLead: "Il suo prossimo cliente la sta cercando.",
    titleAccent: "Si faccia trovare.",
    lead: "Faccia crescere la sua presenza nella ricerca, nell’AI e sui social. RepGet riunisce contenuti, backlink e visibilità in un unico posto.",
    sceneLabel: "Le mascotte di RepGet, un geco e un gufo, circondate da segnali di ricerca, AI e social",
    nodes: ["Visibilità nella ricerca", "Scoperta tramite AI", "Portata sui social"],
    footLead: "Renda il suo marchio",
    footAccent: "impossibile da ignorare.",
    footNote: "Crei. Pubblichi. Si faccia scoprire.",
    tag: "Fatto per crescere",
  },
  de: {
    kicker: "Ein Arbeitsbereich. Überall, wo gesucht wird.",
    titleLead: "Ihr nächster Kunde sucht schon.",
    titleAccent: "Werden Sie gefunden.",
    lead: "Bauen Sie Ihre Präsenz in Suche, KI und sozialen Netzwerken aus. RepGet bündelt Inhalte, Backlinks und Sichtbarkeit an einem Ort.",
    sceneLabel: "Die RepGet-Maskottchen Gecko und Eule, umgeben von Signalen aus Suche, KI und sozialen Netzwerken",
    nodes: ["Sichtbarkeit in der Suche", "Entdeckt durch KI", "Reichweite in Social Media"],
    footLead: "Machen Sie Ihre Marke",
    footAccent: "unübersehbar.",
    footNote: "Erstellen. Veröffentlichen. Entdeckt werden.",
    tag: "Gemacht zum Wachsen",
  },
};

export function signupShowcaseCopy(locale: Locale): SignupShowcaseCopy {
  return COPY[locale] ?? COPY.en;
}
