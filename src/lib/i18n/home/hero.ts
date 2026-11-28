import type { Locale } from "@/lib/i18n/config";

/**
 * The homepage hero and the platform ribbon under it (client's design,
 * 2026-11-03: `rgx-hero` and `rgx-channel-ribbon`), in every language.
 *
 * English is the design's own wording (the owner asked for the design's
 * texts on 2026-11-04); above the field it is the headline of 2026-11-24
 * (repget_homepage_animated_signals.html), with "Meet RepGet." now after the
 * ribbon. The ribbon's counter shows the real number of things RepGet has
 * made (lib/marketing/content-count.ts), so only its caption is here.
 *
 * Marks: `**words**` bold, `*words*` the accent colour (see _home/text.tsx).
 */
export type HeroCopy = {
  hero: {
    /** The title's quiet first line (client, 2026-11-24). */
    opening: string;
    /** The title's promise, its last word in the accent colour (`*word*`) - short: one line on a desktop. */
    promise: string;
    /** The description's two lines (`**bold**` allowed). */
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
    /**
     * Promises the product keeps. The third was "Results in seconds" while an
     * article can wait for the RepGet team's check (outside review,
     * 2026-11-27); what does take minutes is the site analysis after sign-up.
     */
    benefits: [string, string, string];
    joinGoogle: string;
    seeHow: string;
  };
  /** After the ribbon: "Meet [the gecko and the owl] RepGet." (client, 2026-11-24). */
  meet: {
    eyebrow: string;
    /** The title's first word(s), before the mascots and "RepGet." - short: the title is one line on a phone. */
    meet: string;
  };
  ribbon: {
    label: string;
    /** Under the real count, on one line. */
    counterLabel: string;
  };
};

const en: HeroCopy = {
  hero: {
    opening: "They search. They scroll. They ask AI.",
    promise: "Be the brand they *find.*",
    descriptionLead: "Your **AI growth platform** for **SEO, content, backlinks and social.**",
    descriptionRest: "One place to grow your visibility and reach more customers.",
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
    benefits: ["Private and secure", "Real human support", "Site analysis in minutes"],
    joinGoogle: "Join with Google",
    seeHow: "See how it works",
  },
  meet: {
    eyebrow: "Your AI growth team, in one place",
    meet: "Meet",
  },
  ribbon: {
    label: "Search, AI and social platforms",
    counterLabel: "Content created with RepGet",
  },
};

const es: HeroCopy = {
  hero: {
    opening: "Buscan. Navegan. Preguntan a la IA.",
    promise: "Sea la marca que *encuentran.*",
    descriptionLead: "Su **plataforma de crecimiento con IA** para **SEO, contenido, backlinks y redes sociales.**",
    descriptionRest: "Un solo lugar para ganar visibilidad y llegar a más clientes.",
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
    benefits: ["Privado y seguro", "Soporte humano real", "Análisis del sitio en minutos"],
    joinGoogle: "Entrar con Google",
    seeHow: "Vea cómo funciona",
  },
  meet: {
    eyebrow: "Su equipo de crecimiento con IA, en un solo lugar",
    meet: "Conozca a",
  },
  ribbon: {
    label: "Plataformas de búsqueda, IA y redes",
    counterLabel: "Contenido creado con RepGet",
  },
};

const fr: HeroCopy = {
  hero: {
    opening: "Ils cherchent. Ils scrollent. Ils interrogent l’IA.",
    promise: "Soyez la marque qu’ils *trouvent.*",
    descriptionLead: "Votre **plateforme de croissance IA** pour **le SEO, le contenu, les backlinks et les réseaux sociaux.**",
    descriptionRest: "Un seul endroit pour gagner en visibilité et toucher plus de clients.",
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
    benefits: ["Privé et sécurisé", "Une vraie assistance humaine", "Analyse du site en quelques minutes"],
    joinGoogle: "Continuer avec Google",
    seeHow: "Voir comment ça marche",
  },
  meet: {
    eyebrow: "Votre équipe de croissance IA, en un seul endroit",
    meet: "Découvrez",
  },
  ribbon: {
    label: "Plateformes de recherche, d’IA et de réseaux",
    counterLabel: "Contenus créés avec RepGet",
  },
};

const it: HeroCopy = {
  hero: {
    opening: "Cercano. Scorrono. Chiedono all’IA.",
    promise: "Sia il brand che *trovano.*",
    descriptionLead: "La Sua **piattaforma di crescita con IA** per **SEO, contenuti, backlink e social.**",
    descriptionRest: "Un unico posto per aumentare la visibilità e raggiungere più clienti.",
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
    benefits: ["Privato e sicuro", "Assistenza umana reale", "Analisi del sito in pochi minuti"],
    joinGoogle: "Entri con Google",
    seeHow: "Scopra come funziona",
  },
  meet: {
    eyebrow: "Il Suo team di crescita con IA, in un unico posto",
    meet: "Scopra",
  },
  ribbon: {
    label: "Piattaforme di ricerca, IA e social",
    counterLabel: "Contenuti creati con RepGet",
  },
};

const de: HeroCopy = {
  hero: {
    opening: "Kunden suchen. Scrollen. Fragen die KI.",
    promise: "Und finden Ihre *Marke.*",
    descriptionLead: "Ihre **KI-Wachstumsplattform** für **SEO, Inhalte, Backlinks und Social Media.**",
    descriptionRest: "Ein Ort, um sichtbarer zu werden und mehr Kunden zu erreichen.",
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
    benefits: ["Privat und sicher", "Echter persönlicher Support", "Website-Analyse in wenigen Minuten"],
    joinGoogle: "Mit Google anmelden",
    seeHow: "So funktioniert es",
  },
  meet: {
    eyebrow: "Ihr KI-Wachstumsteam an einem Ort",
    meet: "Das ist",
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
