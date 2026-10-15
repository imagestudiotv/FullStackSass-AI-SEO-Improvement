import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";

/**
 * The blog in more than one language (client, 2026-10-09: the same articles
 * in every language the site has, Italian first; translate and adapt, an AI
 * draft then a person's review).
 *
 * An English post lives at /blog/<slug>; a post in another language at
 * /<locale>/blog/<slug>. Translations of one article link to each other
 * (hreflang and a visible "Also in" line), so search engines treat them as
 * one article in several languages rather than as copies. Categories and the
 * team's author page exist in every language (client, 2026-10-15):
 * /it/blog/category/<slug> lists the Italian posts under the category's
 * Italian name, /it/blog/author/repget-team the team's Italian posts.
 *
 * The words around a post (dates, "min read", "In this article"...) are
 * here rather than in messages.ts: the admin editor's preview, a client
 * component, renders the same article, and messages.ts must never reach
 * the browser (lib/i18n/site-chrome.ts explains why).
 */

export const BLOG_LOCALES: readonly Locale[] = LOCALES;

/** Each language by its own name, as a reader looks for it. */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  de: "Deutsch",
};

/** The language's name in English, for the admin panel. */
export const LANGUAGE_NAMES_EN: Record<Locale, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  it: "Italian",
  de: "German",
};

export function isBlogLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** A stored locale, read defensively: anything unknown is English. */
export function blogLocale(value: string | null | undefined): Locale {
  return isBlogLocale(value) ? value : DEFAULT_LOCALE;
}

/** The blog's front page, or one post, in a language. */
export function blogPath(locale: Locale, slug?: string): string {
  const base = locale === DEFAULT_LOCALE ? "/blog" : `/${locale}/blog`;
  return slug ? `${base}/${slug}` : base;
}

/** A category's page in a language: the same address under the language's prefix. */
export function categoryPath(locale: Locale, slug: string): string {
  return `${blogPath(locale)}/category/${slug}`;
}

/**
 * hreflang for a category's first page: its page in every language that has
 * a published post in it (lib/blog/posts.ts publishedCategoryLocales), plus
 * x-default - the English page when English is among them, otherwise the
 * first. Nothing when fewer than two: the alternates only count when every
 * version lists every other, and a page with nothing in it in a language is
 * not one of the versions.
 */
export function categoryAlternates(slug: string, locales: readonly Locale[]): Record<string, string> | undefined {
  if (locales.length < 2) return undefined;
  const map: Record<string, string> = Object.fromEntries(locales.map((locale) => [locale, categoryPath(locale, slug)]));
  map["x-default"] = map[DEFAULT_LOCALE] ?? categoryPath(locales[0], slug);
  return map;
}

/** The site's home page in a language. */
export function homePath(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "/" : `/${locale}`;
}

export type BlogChrome = {
  /** "{n}" is the number of minutes. */
  minRead: string;
  /** "{date}" is the date. */
  updated: string;
  shortAnswer: string;
  inThisArticle: string;
  faq: string;
  sources: string;
  keepReading: string;
  home: string;
  blog: string;
  /** The front page's h1, with the accent word last. */
  titleLead: string;
  titleAccent: string;
  intro: string;
  metaTitle: string;
  metaDescription: string;
  latest: string;
  /** "{n} article|{n} articles". */
  articles: string;
  /** Other languages a post is available in. */
  alsoIn: string;
  /** Shown on a language's front page beside the English posts. */
  inEnglish: string;
  /** A language's front page with no post yet. */
  noneYet: string;
  /** A category's page in a language with no post in it yet; the English ones follow. */
  sectionEmpty: string;
  /** The RepGet team as an author: its byline, and its author page (/it/blog/author/repget-team). */
  teamName: string;
  /** Above the team's name on its author page. */
  authorEyebrow: string;
  /** The team's description on its author page, and in its structured data. */
  authorBio: string;
  /** The author page's meta description, without its full stop (" - Page N" goes before it). */
  authorMetaDescription: string;
  /** The author page's list of posts. */
  articlesHeading: string;
  /** The author page in a language with no post by the team yet; the English ones follow. */
  authorNoneYet: string;
  readInEnglish: string;
  /** A listing's page links (components/blog-pagination.tsx), for a screen reader. */
  pagination: string;
  /** "{page}" is the page number. */
  pageN: string;
  /** "{page}" and "{pages}": the phone's "Page 2 of 5". */
  pageOf: string;
  newer: string;
  older: string;
};

export const BLOG_CHROME: Record<Locale, BlogChrome> = {
  en: {
    minRead: "{n} min read",
    updated: "Updated {date}",
    shortAnswer: "Short answer",
    inThisArticle: "In this article",
    faq: "FAQ",
    sources: "Sources",
    keepReading: "Keep reading",
    home: "Home",
    blog: "Blog",
    titleLead: "The RepGet",
    titleAccent: "Blog",
    intro:
      "Guides, comparisons and playbooks for the new era of search. How to get found on Google, and how to get your business named by ChatGPT, Claude, Gemini and Perplexity.",
    metaTitle: "Blog",
    metaDescription:
      "Guides, comparisons and playbooks for getting found on Google and cited by AI assistants - written for people who run a business, not a marketing team.",
    latest: "Latest articles",
    articles: "{n} article|{n} articles",
    alsoIn: "Also in",
    inEnglish: "Articles in English",
    noneYet: "",
    sectionEmpty: "There is nothing in this section yet.",
    teamName: "RepGet team",
    authorEyebrow: "Author",
    authorBio: "The team behind RepGet. We write practical guides to keyword research, SEO content, publishing, backlinks, and getting your business found on Google and named by AI assistants.",
    authorMetaDescription: "Guides and playbooks from the RepGet team on getting found on Google and cited by AI assistants",
    articlesHeading: "Articles",
    authorNoneYet: "The team's first article is on its way.",
    readInEnglish: "See all articles in English",
    pagination: "Blog pages",
    pageN: "Page {page}",
    pageOf: "Page {page} of {pages}",
    newer: "Newer",
    older: "Older",
  },
  es: {
    minRead: "{n} min de lectura",
    updated: "Actualizado el {date}",
    shortAnswer: "Respuesta corta",
    inThisArticle: "En este artículo",
    faq: "Preguntas frecuentes",
    sources: "Fuentes",
    keepReading: "Siga leyendo",
    home: "Inicio",
    blog: "Blog",
    titleLead: "El blog de",
    titleAccent: "RepGet",
    intro:
      "Guías y estrategias para la nueva era de la búsqueda: cómo aparecer en Google y cómo conseguir que ChatGPT, Claude, Gemini y Perplexity mencionen su negocio.",
    metaTitle: "Blog",
    metaDescription:
      "Guías y estrategias para aparecer en Google y ser citado por los asistentes de IA, escritas para quienes dirigen un negocio.",
    latest: "Últimos artículos",
    articles: "{n} artículo|{n} artículos",
    alsoIn: "También en",
    inEnglish: "Artículos en inglés",
    noneYet: "Todavía no hay artículos en español. Estos son los últimos en inglés.",
    sectionEmpty: "Todavía no hay artículos en español en esta sección.",
    teamName: "El equipo de RepGet",
    authorEyebrow: "Autor",
    authorBio: "El equipo detrás de RepGet. Escribimos guías prácticas sobre investigación de palabras clave, contenido SEO, publicación y backlinks, y sobre cómo conseguir que su negocio aparezca en Google y que los asistentes de IA lo mencionen.",
    authorMetaDescription: "Guías y estrategias del equipo de RepGet para aparecer en Google y lograr que los asistentes de IA citen su negocio",
    articlesHeading: "Artículos",
    authorNoneYet: "Todavía no hay artículos del equipo en español.",
    readInEnglish: "Ver todos los artículos en inglés",
    pagination: "Páginas",
    pageN: "Página {page}",
    pageOf: "Página {page} de {pages}",
    newer: "Más recientes",
    older: "Anteriores",
  },
  fr: {
    minRead: "{n} min de lecture",
    updated: "Mis à jour le {date}",
    shortAnswer: "Réponse courte",
    inThisArticle: "Dans cet article",
    faq: "Questions fréquentes",
    sources: "Sources",
    keepReading: "À lire aussi",
    home: "Accueil",
    blog: "Blog",
    titleLead: "Le blog",
    titleAccent: "RepGet",
    intro:
      "Guides et méthodes pour la nouvelle ère de la recherche : être trouvé sur Google, et faire citer votre entreprise par ChatGPT, Claude, Gemini et Perplexity.",
    metaTitle: "Blog",
    metaDescription:
      "Guides et méthodes pour être trouvé sur Google et cité par les assistants IA, écrits pour celles et ceux qui dirigent une entreprise.",
    latest: "Derniers articles",
    articles: "{n} article|{n} articles",
    alsoIn: "Aussi en",
    inEnglish: "Articles en anglais",
    noneYet: "Pas encore d'articles en français. Voici les derniers en anglais.",
    sectionEmpty: "Pas encore d'articles en français dans cette rubrique.",
    teamName: "L’équipe RepGet",
    authorEyebrow: "Auteur",
    authorBio: "L’équipe derrière RepGet. Nous écrivons des guides pratiques sur la recherche de mots-clés, le contenu SEO, la publication et les backlinks, et sur la façon de rendre votre entreprise visible sur Google et citée par les assistants d’IA.",
    authorMetaDescription: "Guides et méthodes de l’équipe RepGet pour être trouvé sur Google et cité par les assistants d’IA",
    articlesHeading: "Articles",
    authorNoneYet: "Pas encore d’articles de l’équipe en français.",
    readInEnglish: "Voir tous les articles en anglais",
    pagination: "Pages",
    pageN: "Page {page}",
    pageOf: "Page {page} sur {pages}",
    newer: "Plus récents",
    older: "Plus anciens",
  },
  it: {
    minRead: "{n} min di lettura",
    updated: "Aggiornato il {date}",
    shortAnswer: "Risposta breve",
    inThisArticle: "In questo articolo",
    faq: "Domande frequenti",
    sources: "Fonti",
    keepReading: "Continui a leggere",
    home: "Home",
    blog: "Blog",
    titleLead: "Il blog di",
    titleAccent: "RepGet",
    intro:
      "Guide e strategie per la nuova era della ricerca: come farsi trovare su Google e come far citare la propria attività da ChatGPT, Claude, Gemini e Perplexity.",
    metaTitle: "Blog",
    metaDescription:
      "Guide e strategie per farsi trovare su Google ed essere citati dagli assistenti IA, scritte per chi gestisce un'attività.",
    latest: "Ultimi articoli",
    articles: "{n} articolo|{n} articoli",
    alsoIn: "Disponibile anche in",
    inEnglish: "Articoli in inglese",
    noneYet: "Non ci sono ancora articoli in italiano. Ecco gli ultimi in inglese.",
    sectionEmpty: "Non ci sono ancora articoli in italiano in questa sezione.",
    teamName: "Il team RepGet",
    authorEyebrow: "Autore",
    authorBio: "Il team dietro RepGet. Scriviamo guide pratiche su ricerca delle parole chiave, contenuti SEO, pubblicazione e backlink, e su come far trovare la sua attività su Google e farla citare dagli assistenti IA.",
    authorMetaDescription: "Guide e strategie del team RepGet per farsi trovare su Google ed essere citati dagli assistenti IA",
    articlesHeading: "Articoli",
    authorNoneYet: "Non ci sono ancora articoli del team in italiano.",
    readInEnglish: "Vedi tutti gli articoli in inglese",
    pagination: "Pagine",
    pageN: "Pagina {page}",
    pageOf: "Pagina {page} di {pages}",
    newer: "Più recenti",
    older: "Meno recenti",
  },
  de: {
    minRead: "{n} Min. Lesezeit",
    updated: "Aktualisiert am {date}",
    shortAnswer: "Kurze Antwort",
    inThisArticle: "In diesem Artikel",
    faq: "Häufige Fragen",
    sources: "Quellen",
    keepReading: "Weiterlesen",
    home: "Startseite",
    blog: "Blog",
    titleLead: "Der RepGet",
    titleAccent: "Blog",
    intro:
      "Leitfäden und Strategien für die neue Ära der Suche: wie Sie bei Google gefunden werden und wie ChatGPT, Claude, Gemini und Perplexity Ihr Unternehmen nennen.",
    metaTitle: "Blog",
    metaDescription:
      "Leitfäden und Strategien, um bei Google gefunden und von KI-Assistenten zitiert zu werden, geschrieben für alle, die ein Unternehmen führen.",
    latest: "Neueste Artikel",
    articles: "{n} Artikel|{n} Artikel",
    alsoIn: "Auch auf",
    inEnglish: "Artikel auf Englisch",
    noneYet: "Noch keine Artikel auf Deutsch. Hier sind die neuesten auf Englisch.",
    sectionEmpty: "In dieser Rubrik gibt es noch keine Artikel auf Deutsch.",
    teamName: "Das RepGet-Team",
    authorEyebrow: "Autor",
    authorBio: "Das Team hinter RepGet. Wir schreiben praktische Leitfäden zu Keyword-Recherche, SEO-Inhalten, Veröffentlichung und Backlinks – und dazu, wie Ihr Unternehmen bei Google gefunden und von KI-Assistenten genannt wird.",
    authorMetaDescription: "Leitfäden und Strategien des RepGet-Teams, um bei Google gefunden und von KI-Assistenten zitiert zu werden",
    articlesHeading: "Artikel",
    authorNoneYet: "Noch keine Artikel des Teams auf Deutsch.",
    readInEnglish: "Alle Artikel auf Englisch ansehen",
    pagination: "Seiten",
    pageN: "Seite {page}",
    pageOf: "Seite {page} von {pages}",
    newer: "Neuere",
    older: "Ältere",
  },
};

const DATE_LOCALES: Record<Locale, string> = { en: "en-GB", es: "es-ES", fr: "fr-FR", it: "it-IT", de: "de-DE" };

/** An ISO day (YYYY-MM-DD) as the blog shows it, in the post's language. */
export function blogDate(iso: string, locale: Locale): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(DATE_LOCALES[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "{n} min read" and friends: one form, or "one|many". */
export function fill(template: string, values: Record<string, string | number>): string {
  const n = typeof values.n === "number" ? values.n : null;
  const [one, many] = template.split("|");
  const chosen = many !== undefined && n !== null && n !== 1 ? many : one;
  return chosen.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
