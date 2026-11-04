import type { Locale } from "@/lib/i18n/config";

/**
 * The homepage hero and the platform ribbon under it (client's design,
 * 2026-11-03: `rgx-hero` and `rgx-channel-ribbon`), in every language.
 *
 * English is the design's own wording, figures included (the owner asked for
 * the design's texts on 2026-11-04). The one exception is the ribbon's
 * counter: it shows the real number of things RepGet has made
 * (lib/marketing/content-count.ts), so only its caption is here.
 *
 * Marks: `*word*` is the orange accent, `**words**` bold (see _home/text.tsx).
 */
export type HeroCopy = {
  hero: {
    eyebrow: string;
    /** The review pill: "4.9/5" (the stars are drawn, the same everywhere). */
    ratingScore: string;
    ratingCopy: string;
    /** The pill's accessible name. */
    ratingLabel: string;
    /** Two lines; `*word*` is the orange one. */
    titleLine1: string;
    titleLine2: string;
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
    /** Accessible name of the six floating cards. */
    cardsLabel: string;
    /** The six floating cards, in order: social, SEO, AI, backlinks, content, insights. */
    cards: { title: string; detail: string }[];
  };
  ribbon: {
    label: string;
    /** Under the real count, on one line. */
    counterLabel: string;
  };
};

const en: HeroCopy = {
  hero: {
    eyebrow: "One growth platform for search, AI & social",
    ratingScore: "4.9/5",
    ratingCopy: "Customer reviews",
    ratingLabel: "Customer reviews: 4.9 out of 5. Read what customers say.",
    titleLine1: "Get *found* on Google & AI.",
    titleLine2: "Grow across *social.*",
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
    cardsLabel: "RepGet growth features",
    cards: [
      { title: "Social", detail: "90+ posts a month" },
      { title: "SEO", detail: "+200% organic clicks" },
      { title: "AI Mentions", detail: "ChatGPT, Gemini + more" },
      { title: "Backlinks", detail: "20+ links this month" },
      { title: "Content", detail: "30+ articles a month" },
      { title: "Insights", detail: "24/7 growth insights" },
    ],
  },
  ribbon: {
    label: "Search, AI and social platforms",
    counterLabel: "Content created with RepGet",
  },
};

const es: HeroCopy = {
  hero: {
    eyebrow: "Una plataforma de crecimiento para búsqueda, IA y redes",
    ratingScore: "4.9/5",
    ratingCopy: "Opiniones de clientes",
    ratingLabel: "Opiniones de clientes: 4,9 de 5. Lea lo que dicen los clientes.",
    titleLine1: "Aparezca en *Google* y la IA.",
    titleLine2: "Crezca en las *redes.*",
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
    cardsLabel: "Funciones de crecimiento de RepGet",
    cards: [
      { title: "Redes", detail: "Más de 90 publicaciones al mes" },
      { title: "SEO", detail: "+200 % de clics orgánicos" },
      { title: "Menciones en IA", detail: "ChatGPT, Gemini y más" },
      { title: "Backlinks", detail: "Más de 20 enlaces este mes" },
      { title: "Contenido", detail: "Más de 30 artículos al mes" },
      { title: "Análisis", detail: "Ideas de crecimiento 24/7" },
    ],
  },
  ribbon: {
    label: "Plataformas de búsqueda, IA y redes",
    counterLabel: "Contenido creado con RepGet",
  },
};

const fr: HeroCopy = {
  hero: {
    eyebrow: "Une plateforme de croissance pour la recherche, l’IA et les réseaux",
    ratingScore: "4.9/5",
    ratingCopy: "Avis clients",
    ratingLabel: "Avis clients : 4,9 sur 5. Lire les avis des clients.",
    titleLine1: "*Visible* sur Google et l’IA.",
    titleLine2: "Grandissez sur les *réseaux.*",
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
    cardsLabel: "Les fonctions de croissance de RepGet",
    cards: [
      { title: "Réseaux", detail: "Plus de 90 publications par mois" },
      { title: "SEO", detail: "+200 % de clics organiques" },
      { title: "Mentions IA", detail: "ChatGPT, Gemini et plus" },
      { title: "Backlinks", detail: "Plus de 20 liens ce mois-ci" },
      { title: "Contenu", detail: "Plus de 30 articles par mois" },
      { title: "Analyses", detail: "Pistes de croissance 24h/24" },
    ],
  },
  ribbon: {
    label: "Plateformes de recherche, d’IA et de réseaux",
    counterLabel: "Contenus créés avec RepGet",
  },
};

const it: HeroCopy = {
  hero: {
    eyebrow: "Un’unica piattaforma di crescita per ricerca, IA e social",
    ratingScore: "4.9/5",
    ratingCopy: "Recensioni dei clienti",
    ratingLabel: "Recensioni dei clienti: 4,9 su 5. Legga cosa dicono i clienti.",
    titleLine1: "*Visibile* su Google e sull’IA.",
    titleLine2: "Cresca sui *social.*",
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
    cardsLabel: "Le funzioni di crescita di RepGet",
    cards: [
      { title: "Social", detail: "Oltre 90 post al mese" },
      { title: "SEO", detail: "+200% di clic organici" },
      { title: "Menzioni IA", detail: "ChatGPT, Gemini e altri" },
      { title: "Backlink", detail: "Oltre 20 link questo mese" },
      { title: "Contenuti", detail: "Oltre 30 articoli al mese" },
      { title: "Insight", detail: "Spunti di crescita 24/7" },
    ],
  },
  ribbon: {
    label: "Piattaforme di ricerca, IA e social",
    counterLabel: "Contenuti creati con RepGet",
  },
};

const de: HeroCopy = {
  hero: {
    eyebrow: "Eine Wachstumsplattform für Suche, KI und Social Media",
    ratingScore: "4.9/5",
    ratingCopy: "Kundenbewertungen",
    ratingLabel: "Kundenbewertungen: 4,9 von 5. Lesen Sie, was Kunden sagen.",
    titleLine1: "Bei Google & KI *gefunden.*",
    titleLine2: "Auf *Social Media* wachsen.",
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
    cardsLabel: "Die Wachstumsfunktionen von RepGet",
    cards: [
      { title: "Social", detail: "Über 90 Beiträge pro Monat" },
      { title: "SEO", detail: "+200 % organische Klicks" },
      { title: "KI-Erwähnungen", detail: "ChatGPT, Gemini und mehr" },
      { title: "Backlinks", detail: "Über 20 Links diesen Monat" },
      { title: "Inhalte", detail: "Über 30 Artikel pro Monat" },
      { title: "Insights", detail: "Wachstumsimpulse rund um die Uhr" },
    ],
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
