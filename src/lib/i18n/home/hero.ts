import type { Locale } from "@/lib/i18n/config";

/**
 * The homepage hero and the platform ribbon under it (client's design,
 * 2026-11-03: `rgx-hero` and `rgx-channel-ribbon`), in every language.
 *
 * English is the design's own wording (the owner asked for the design's
 * texts on 2026-11-04); above the field it is the simpler hero of 2026-11-11
 * (repget_homepage_animated_social_proof.html). The ribbon's counter shows
 * the real number of things RepGet has made (lib/marketing/content-count.ts),
 * so only its caption is here.
 *
 * Marks: `**words**` bold (see _home/text.tsx).
 */
export type HeroCopy = {
  hero: {
    /** The pill above the title (client, 2026-11-11). */
    pill: string;
    /** The title's first word(s), before the mascots and "RepGet." - short: the title is one line on a phone. */
    meet: string;
    /** The promise under the name, in the same heading; the second line is the violet one. */
    subtitleLine1: string;
    subtitleLine2: string;
    /** What the gecko says, once, in three steps: a bold line and a small one each. */
    mascotNotes: [[string, string], [string, string], [string, string]];
    /** "Search" on the owl's banner (the other labels there are brand names). */
    mascotSearch: string;
    /** The description's first line (`**bold**` allowed) and its second. */
    descriptionLead: string;
    descriptionRest: string;
    websiteLabel: string;
    emailLabel: string;
    /** The examples the field's placeholder types out. */
    websitePlaceholder: string;
    emailPlaceholder: string;
    startTrial: string;
    useEmail: string;
    useWebsite: string;
    invalidWebsite: string;
    invalidEmail: string;
    /** Accessible name of the row under the field. */
    moreWays: string;
    noWebsite: string;
    buildOne: string;
    benefits: [string, string, string];
    joinGoogle: string;
    seeHow: string;
  };
  ribbon: {
    label: string;
    /** Under the real count, on one line. */
    counterLabel: string;
  };
};

const en: HeroCopy = {
  hero: {
    pill: "Meet your AI search and social growth team",
    meet: "Meet",
    subtitleLine1: "Get found on Google & AI.",
    subtitleLine2: "Grow across social.",
    mascotNotes: [
      ["I improve your", "ChatGPT mentions."],
      ["I help you show up", "in AI search."],
      ["I strengthen your", "Google visibility."],
    ],
    mascotSearch: "Search",
    descriptionLead: "Your AI growth team for **SEO, content, backlinks and social.**",
    descriptionRest: "Create once, get discovered, and reach customers everywhere.",
    websiteLabel: "Your website address",
    emailLabel: "Your email address",
    websitePlaceholder: "yourwebsite.com",
    emailPlaceholder: "demo@gmail.com",
    startTrial: "Start free trial",
    useEmail: "Use your email instead",
    useWebsite: "Use your website instead",
    invalidWebsite: "Please enter a website address, like yourwebsite.com.",
    invalidEmail: "Please enter a valid email address.",
    moreWays: "More ways to get started",
    noWebsite: "Don't have a website?",
    buildOne: "We'll build one for you",
    benefits: ["Private and secure", "24/7 real human support", "Results in seconds"],
    joinGoogle: "Join with Google",
    seeHow: "See how it works",
  },
  ribbon: {
    label: "Search, AI and social platforms",
    counterLabel: "Content created with RepGet",
  },
};

const es: HeroCopy = {
  hero: {
    pill: "Su equipo IA para búsqueda y redes",
    meet: "Conozca a",
    subtitleLine1: "Aparezca en Google y la IA.",
    subtitleLine2: "Crezca en las redes.",
    mascotNotes: [
      ["Mejoro sus", "menciones en ChatGPT."],
      ["Le ayudo a aparecer", "en la búsqueda con IA."],
      ["Refuerzo su", "visibilidad en Google."],
    ],
    mascotSearch: "Búsqueda",
    descriptionLead: "Su equipo de crecimiento con IA para **SEO, contenido, backlinks y redes sociales.**",
    descriptionRest: "Cree una vez, hágase visible y llegue a sus clientes en todas partes.",
    websiteLabel: "La dirección de su sitio web",
    emailLabel: "Su correo electrónico",
    websitePlaceholder: "susitioweb.com",
    emailPlaceholder: "demo@gmail.com",
    startTrial: "Empezar la prueba gratis",
    useEmail: "Usar su correo en su lugar",
    useWebsite: "Usar su sitio web en su lugar",
    invalidWebsite: "Escriba la dirección de un sitio web, como susitioweb.com.",
    invalidEmail: "Escriba un correo electrónico válido.",
    moreWays: "Otras formas de empezar",
    noWebsite: "¿No tiene sitio web?",
    buildOne: "Le creamos uno",
    benefits: ["Privado y seguro", "Soporte humano real 24/7", "Resultados en segundos"],
    joinGoogle: "Entrar con Google",
    seeHow: "Vea cómo funciona",
  },
  ribbon: {
    label: "Plataformas de búsqueda, IA y redes",
    counterLabel: "Contenido creado con RepGet",
  },
};

const fr: HeroCopy = {
  hero: {
    pill: "Votre équipe IA : recherche et réseaux",
    meet: "Découvrez",
    subtitleLine1: "Visible sur Google et l’IA.",
    subtitleLine2: "Grandissez sur les réseaux.",
    mascotNotes: [
      ["J’améliore vos", "mentions dans ChatGPT."],
      ["Je vous aide à apparaître", "dans la recherche IA."],
      ["Je renforce votre", "visibilité sur Google."],
    ],
    mascotSearch: "Recherche",
    descriptionLead: "Votre équipe de croissance IA pour **le SEO, le contenu, les backlinks et les réseaux sociaux.**",
    descriptionRest: "Créez une fois, gagnez en visibilité et touchez vos clients partout.",
    websiteLabel: "L’adresse de votre site",
    emailLabel: "Votre adresse e-mail",
    websitePlaceholder: "votresite.com",
    emailPlaceholder: "demo@gmail.com",
    startTrial: "Commencer l’essai gratuit",
    useEmail: "Utiliser votre e-mail à la place",
    useWebsite: "Utiliser votre site à la place",
    invalidWebsite: "Saisissez l’adresse d’un site, par exemple votresite.com.",
    invalidEmail: "Saisissez une adresse e-mail valide.",
    moreWays: "Autres façons de commencer",
    noWebsite: "Pas encore de site ?",
    buildOne: "Nous vous en créons un",
    benefits: ["Privé et sécurisé", "Une vraie assistance humaine 24h/24", "Résultats en quelques secondes"],
    joinGoogle: "Continuer avec Google",
    seeHow: "Voir comment ça marche",
  },
  ribbon: {
    label: "Plateformes de recherche, d’IA et de réseaux",
    counterLabel: "Contenus créés avec RepGet",
  },
};

const it: HeroCopy = {
  hero: {
    pill: "Il Suo team IA per ricerca e social",
    meet: "Scopra",
    subtitleLine1: "Visibile su Google e sull’IA.",
    subtitleLine2: "Cresca sui social.",
    mascotNotes: [
      ["Miglioro le Sue", "menzioni su ChatGPT."],
      ["La aiuto a comparire", "nella ricerca IA."],
      ["Rafforzo la Sua", "visibilità su Google."],
    ],
    mascotSearch: "Ricerca",
    descriptionLead: "Il Suo team di crescita con IA per **SEO, contenuti, backlink e social.**",
    descriptionRest: "Crei una volta, si faccia trovare e raggiunga i clienti ovunque.",
    websiteLabel: "L’indirizzo del Suo sito",
    emailLabel: "Il Suo indirizzo email",
    websitePlaceholder: "ilsuosito.com",
    emailPlaceholder: "demo@gmail.com",
    startTrial: "Inizi la prova gratuita",
    useEmail: "Usi l’email al suo posto",
    useWebsite: "Usi il sito al suo posto",
    invalidWebsite: "Inserisca l’indirizzo di un sito, ad esempio ilsuosito.com.",
    invalidEmail: "Inserisca un indirizzo email valido.",
    moreWays: "Altri modi per iniziare",
    noWebsite: "Non ha un sito web?",
    buildOne: "Glielo creiamo noi",
    benefits: ["Privato e sicuro", "Assistenza umana reale 24/7", "Risultati in pochi secondi"],
    joinGoogle: "Entri con Google",
    seeHow: "Scopra come funziona",
  },
  ribbon: {
    label: "Piattaforme di ricerca, IA e social",
    counterLabel: "Contenuti creati con RepGet",
  },
};

const de: HeroCopy = {
  hero: {
    pill: "Ihr KI-Team für Suche und Social Media",
    meet: "Das ist",
    subtitleLine1: "Bei Google & KI gefunden.",
    subtitleLine2: "Auf Social Media wachsen.",
    mascotNotes: [
      ["Ich verbessere Ihre", "ChatGPT-Erwähnungen."],
      ["Ich helfe Ihnen,", "in der KI-Suche aufzutauchen."],
      ["Ich stärke Ihre", "Sichtbarkeit bei Google."],
    ],
    mascotSearch: "Suche",
    descriptionLead: "Ihr KI-Wachstumsteam für **SEO, Inhalte, Backlinks und Social Media.**",
    descriptionRest: "Einmal erstellen, gefunden werden und Kunden überall erreichen.",
    websiteLabel: "Ihre Website-Adresse",
    emailLabel: "Ihre E-Mail-Adresse",
    websitePlaceholder: "ihrewebsite.de",
    emailPlaceholder: "demo@gmail.com",
    startTrial: "Kostenlos testen",
    useEmail: "Stattdessen E-Mail verwenden",
    useWebsite: "Stattdessen Website verwenden",
    invalidWebsite: "Bitte geben Sie eine Website-Adresse ein, z. B. ihrewebsite.de.",
    invalidEmail: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    moreWays: "Weitere Möglichkeiten zum Start",
    noWebsite: "Keine Website?",
    buildOne: "Wir erstellen Ihnen eine",
    benefits: ["Privat und sicher", "Echter persönlicher Support rund um die Uhr", "Ergebnisse in Sekunden"],
    joinGoogle: "Mit Google anmelden",
    seeHow: "So funktioniert es",
  },
  ribbon: {
    label: "Such-, KI- und Social-Media-Plattformen",
    counterLabel: "Mit RepGet erstellte Inhalte",
  },
};

const COPY: Record<Locale, HeroCopy> = { en, es, fr, it, de };

export function heroCopy(locale: Locale): HeroCopy {
  return COPY[locale] ?? en;
}
