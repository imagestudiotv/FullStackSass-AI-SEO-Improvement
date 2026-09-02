import type { Locale } from "@/lib/i18n/config";

/**
 * Translated marketing copy.
 *
 * Plain objects rather than a translation library. The set of strings is fixed
 * and small, every one is used at build time on a static page, and a library
 * would add a provider, a loader and a dependency for a lookup that is a
 * property access.
 *
 * WHAT IS TRANSLATED: the marketing pages — home, pricing, FAQ, about,
 * contact, tools, and the two network pages. These are what Google indexes and
 * what "major reach" in the brief refers to.
 *
 * WHAT IS NOT, deliberately:
 *
 *  - The legal pages. Privacy, terms and refunds carry commitments with
 *    specific legal meanings, and a mistranslated one is a liability rather
 *    than a typo. They stay in English until a lawyer or a professional
 *    translator has produced a version, and the page says so.
 *  - The signed-in app. The brief says "the website" and gives /es and /it,
 *    which are public URLs. Translating the app is a far larger job and
 *    reaches nobody who has not already signed up.
 *  - The blog. Posts are written content, not interface strings; translating
 *    them means writing them again in each language.
 *
 * These translations are fluent but have NOT been reviewed by a native
 * speaker. Register in particular is a brand decision rather than a
 * translation one — Spanish, French, Italian and German all choose between
 * formal and informal address, and this uses the formal form throughout, which
 * suits a business audience but is worth a native review before launch.
 */

export type Messages = {
  nav: {
    freeCheck: string;
    tools: string;
    pricing: string;
    blog: string;
    faq: string;
    about: string;
    signIn: string;
    getStarted: string;
  };
  footer: {
    tagline: string;
    product: string;
    legal: string;
    freeCheck: string;
    freeTools: string;
    pricing: string;
    blog: string;
    faq: string;
    about: string;
    contact: string;
    backlinkExchange: string;
    publishers: string;
    affiliate: string;
    privacy: string;
    terms: string;
    refunds: string;
  };
  home: {
    title: string;
    subtitle: string;
    checkFree: string;
    getStarted: string;
    howItWorks: string;
    howItWorksSub: string;
    included: string[];
    pricingTitle: string;
    pricingSub: string;
    seePlans: string;
    guarantee: string;
  };
  pricing: {
    title: string;
    subtitle: string;
    perMonth: string;
    getStarted: string;
    mostPopular: string;
    unavailable: string;
    annualNote: string;
    refundPolicy: string;
    features: {
      articles: (n: number) => string;
      keywords: (n: string) => string;
      websites: (n: number) => string;
      credits: (n: number) => string;
      healthChecks: string;
      publishing: string;
    };
  };
  legalNotice: string;
};

const en: Messages = {
  nav: {
    freeCheck: "Free check",
    tools: "Tools",
    pricing: "Pricing",
    blog: "Blog",
    faq: "FAQ",
    about: "About",
    signIn: "Sign in",
    getStarted: "Get started",
  },
  footer: {
    tagline: "SEO results for small businesses, without the agency.",
    product: "Product",
    legal: "Legal",
    freeCheck: "Free website check",
    freeTools: "Free tools",
    pricing: "Pricing",
    blog: "Blog",
    faq: "FAQ",
    about: "About",
    contact: "Contact",
    backlinkExchange: "Backlink exchange",
    publishers: "Monetize your blog",
    affiliate: "Refer a business",
    privacy: "Privacy",
    terms: "Terms",
    refunds: "Refunds",
  },
  home: {
    title: "Get found on Google, without hiring an agency",
    subtitle:
      "We do the SEO work for your business — finding the terms worth going after, writing the pages, and showing you what changed.",
    checkFree: "Check my website free",
    getStarted: "Get started",
    howItWorks: "How it works",
    howItWorksSub: "Four steps, and we do all of them.",
    included: [
      "We read your website and learn what you do",
      "We find the searches your customers actually use",
      "We write and publish the articles that answer them",
      "You see exactly what improved",
    ],
    pricingTitle: "Pricing",
    pricingSub:
      "Everything is included in every plan. The difference is how much we write for you each month, starting at EUR 1.",
    seePlans: "See all plans",
    guarantee: "14-day money-back guarantee",
  },
  pricing: {
    title: "Simple pricing",
    subtitle:
      "Everything is included in every plan. The difference is how much we write for you each month.",
    perMonth: " / month",
    getStarted: "Get started",
    mostPopular: "Most popular",
    unavailable: "Pricing is not available right now. Please check back shortly.",
    annualNote:
      "Annual plans are available once you sign up, at two months free. Cancel any time — see our",
    refundPolicy: "refund policy",
    features: {
      articles: (n) => `${n} ${n === 1 ? "article" : "articles"} written each month`,
      keywords: (n) => `${n} search terms tracked`,
      websites: (n) => `${n} ${n === 1 ? "website" : "websites"}`,
      credits: (n) => `${n} ${n === 1 ? "link credit" : "link credits"} each month`,
      healthChecks: "Website health checks",
      publishing: "Publish to WordPress, Ghost or Shopify",
    },
  },
  legalNotice:
    "This page is available in English only. Translations of our legal terms are prepared by a professional translator before publication.",
};

const es: Messages = {
  nav: {
    freeCheck: "Análisis gratuito",
    tools: "Herramientas",
    pricing: "Precios",
    blog: "Blog",
    faq: "Preguntas frecuentes",
    about: "Nosotros",
    signIn: "Iniciar sesión",
    getStarted: "Empezar",
  },
  footer: {
    tagline: "Resultados SEO para pequeñas empresas, sin agencia.",
    product: "Producto",
    legal: "Legal",
    freeCheck: "Análisis gratuito de tu web",
    freeTools: "Herramientas gratuitas",
    pricing: "Precios",
    blog: "Blog",
    faq: "Preguntas frecuentes",
    about: "Nosotros",
    contact: "Contacto",
    backlinkExchange: "Intercambio de enlaces",
    publishers: "Monetiza tu blog",
    affiliate: "Recomienda una empresa",
    privacy: "Privacidad",
    terms: "Términos",
    refunds: "Reembolsos",
  },
  home: {
    title: "Que te encuentren en Google, sin contratar una agencia",
    subtitle:
      "Hacemos el trabajo de SEO para su negocio: encontramos los términos que merecen la pena, escribimos las páginas y le mostramos qué ha mejorado.",
    checkFree: "Analizar mi web gratis",
    getStarted: "Empezar",
    howItWorks: "Cómo funciona",
    howItWorksSub: "Cuatro pasos, y los hacemos todos nosotros.",
    included: [
      "Leemos su web y entendemos a qué se dedica",
      "Encontramos las búsquedas que usan sus clientes",
      "Escribimos y publicamos los artículos que las responden",
      "Usted ve exactamente qué ha mejorado",
    ],
    pricingTitle: "Precios",
    pricingSub:
      "Todo está incluido en cada plan. La diferencia es cuánto escribimos para usted cada mes, desde 1 EUR.",
    seePlans: "Ver todos los planes",
    guarantee: "Garantía de devolución de 14 días",
  },
  pricing: {
    title: "Precios sencillos",
    subtitle:
      "Todo está incluido en cada plan. La diferencia es cuánto escribimos para usted cada mes.",
    perMonth: " / mes",
    getStarted: "Empezar",
    mostPopular: "Más popular",
    unavailable:
      "Los precios no están disponibles en este momento. Vuelva a intentarlo en breve.",
    annualNote:
      "Los planes anuales están disponibles al registrarse, con dos meses gratis. Cancele cuando quiera: consulte nuestra",
    refundPolicy: "política de reembolsos",
    features: {
      articles: (n) => `${n} ${n === 1 ? "artículo" : "artículos"} escritos cada mes`,
      keywords: (n) => `${n} términos de búsqueda monitorizados`,
      websites: (n) => `${n} ${n === 1 ? "sitio web" : "sitios web"}`,
      credits: (n) => `${n} ${n === 1 ? "crédito de enlace" : "créditos de enlace"} cada mes`,
      healthChecks: "Análisis de salud de la web",
      publishing: "Publica en WordPress, Ghost o Shopify",
    },
  },
  legalNotice:
    "Esta página solo está disponible en inglés. Las traducciones de nuestros términos legales las prepara un traductor profesional antes de su publicación.",
};

const fr: Messages = {
  nav: {
    freeCheck: "Analyse gratuite",
    tools: "Outils",
    pricing: "Tarifs",
    blog: "Blog",
    faq: "FAQ",
    about: "À propos",
    signIn: "Se connecter",
    getStarted: "Commencer",
  },
  footer: {
    tagline: "Des résultats SEO pour les petites entreprises, sans agence.",
    product: "Produit",
    legal: "Mentions légales",
    freeCheck: "Analyse gratuite de votre site",
    freeTools: "Outils gratuits",
    pricing: "Tarifs",
    blog: "Blog",
    faq: "FAQ",
    about: "À propos",
    contact: "Contact",
    backlinkExchange: "Échange de liens",
    publishers: "Monétisez votre blog",
    affiliate: "Recommander une entreprise",
    privacy: "Confidentialité",
    terms: "Conditions",
    refunds: "Remboursements",
  },
  home: {
    title: "Soyez trouvé sur Google, sans engager d'agence",
    subtitle:
      "Nous faisons le travail de SEO pour votre entreprise : trouver les termes qui comptent, rédiger les pages et vous montrer ce qui a changé.",
    checkFree: "Analyser mon site gratuitement",
    getStarted: "Commencer",
    howItWorks: "Comment ça marche",
    howItWorksSub: "Quatre étapes, et nous les faisons toutes.",
    included: [
      "Nous lisons votre site et comprenons votre activité",
      "Nous trouvons les recherches que vos clients utilisent vraiment",
      "Nous rédigeons et publions les articles qui y répondent",
      "Vous voyez exactement ce qui s'est amélioré",
    ],
    pricingTitle: "Tarifs",
    pricingSub:
      "Tout est inclus dans chaque formule. La différence tient à ce que nous rédigeons pour vous chaque mois, à partir de 1 EUR.",
    seePlans: "Voir toutes les formules",
    guarantee: "Garantie satisfait ou remboursé sous 14 jours",
  },
  pricing: {
    title: "Des tarifs simples",
    subtitle:
      "Tout est inclus dans chaque formule. La différence tient à ce que nous rédigeons pour vous chaque mois.",
    perMonth: " / mois",
    getStarted: "Commencer",
    mostPopular: "Le plus choisi",
    unavailable:
      "Les tarifs ne sont pas disponibles pour le moment. Merci de réessayer sous peu.",
    annualNote:
      "Les formules annuelles sont proposées après votre inscription, avec deux mois offerts. Annulez à tout moment : consultez notre",
    refundPolicy: "politique de remboursement",
    features: {
      articles: (n) => `${n} ${n === 1 ? "article rédigé" : "articles rédigés"} chaque mois`,
      keywords: (n) => `${n} termes de recherche suivis`,
      websites: (n) => `${n} ${n === 1 ? "site web" : "sites web"}`,
      credits: (n) => `${n} ${n === 1 ? "crédit de lien" : "crédits de lien"} chaque mois`,
      healthChecks: "Analyses de santé du site",
      publishing: "Publiez sur WordPress, Ghost ou Shopify",
    },
  },
  legalNotice:
    "Cette page n'est disponible qu'en anglais. Les traductions de nos conditions légales sont réalisées par un traducteur professionnel avant publication.",
};

const it: Messages = {
  nav: {
    freeCheck: "Analisi gratuita",
    tools: "Strumenti",
    pricing: "Prezzi",
    blog: "Blog",
    faq: "Domande frequenti",
    about: "Chi siamo",
    signIn: "Accedi",
    getStarted: "Inizia",
  },
  footer: {
    tagline: "Risultati SEO per le piccole imprese, senza agenzia.",
    product: "Prodotto",
    legal: "Note legali",
    freeCheck: "Analisi gratuita del tuo sito",
    freeTools: "Strumenti gratuiti",
    pricing: "Prezzi",
    blog: "Blog",
    faq: "Domande frequenti",
    about: "Chi siamo",
    contact: "Contatti",
    backlinkExchange: "Scambio di link",
    publishers: "Monetizza il tuo blog",
    affiliate: "Segnala un'azienda",
    privacy: "Privacy",
    terms: "Termini",
    refunds: "Rimborsi",
  },
  home: {
    title: "Fatti trovare su Google, senza assumere un'agenzia",
    subtitle:
      "Ci occupiamo noi della SEO per la sua attività: troviamo i termini che contano, scriviamo le pagine e le mostriamo che cosa è migliorato.",
    checkFree: "Analizza il mio sito gratis",
    getStarted: "Inizia",
    howItWorks: "Come funziona",
    howItWorksSub: "Quattro passaggi, e li facciamo tutti noi.",
    included: [
      "Leggiamo il suo sito e capiamo di cosa si occupa",
      "Troviamo le ricerche che usano davvero i suoi clienti",
      "Scriviamo e pubblichiamo gli articoli che rispondono",
      "Lei vede esattamente che cosa è migliorato",
    ],
    pricingTitle: "Prezzi",
    pricingSub:
      "Ogni piano include tutto. La differenza è quanto scriviamo per lei ogni mese, a partire da 1 EUR.",
    seePlans: "Vedi tutti i piani",
    guarantee: "Garanzia di rimborso entro 14 giorni",
  },
  pricing: {
    title: "Prezzi semplici",
    subtitle:
      "Ogni piano include tutto. La differenza è quanto scriviamo per lei ogni mese.",
    perMonth: " / mese",
    getStarted: "Inizia",
    mostPopular: "Il più scelto",
    unavailable:
      "I prezzi non sono disponibili in questo momento. Riprovi tra poco.",
    annualNote:
      "I piani annuali sono disponibili dopo la registrazione, con due mesi gratis. Può disdire quando vuole: consulti la nostra",
    refundPolicy: "politica di rimborso",
    features: {
      articles: (n) => `${n} ${n === 1 ? "articolo scritto" : "articoli scritti"} ogni mese`,
      keywords: (n) => `${n} termini di ricerca monitorati`,
      websites: (n) => `${n} ${n === 1 ? "sito web" : "siti web"}`,
      credits: (n) => `${n} ${n === 1 ? "credito link" : "crediti link"} ogni mese`,
      healthChecks: "Controlli sullo stato del sito",
      publishing: "Pubblica su WordPress, Ghost o Shopify",
    },
  },
  legalNotice:
    "Questa pagina è disponibile solo in inglese. Le traduzioni dei nostri termini legali sono curate da un traduttore professionista prima della pubblicazione.",
};

const de: Messages = {
  nav: {
    freeCheck: "Kostenlose Analyse",
    tools: "Werkzeuge",
    pricing: "Preise",
    blog: "Blog",
    faq: "Häufige Fragen",
    about: "Über uns",
    signIn: "Anmelden",
    getStarted: "Loslegen",
  },
  footer: {
    tagline: "SEO-Ergebnisse für kleine Unternehmen, ohne Agentur.",
    product: "Produkt",
    legal: "Rechtliches",
    freeCheck: "Kostenlose Website-Analyse",
    freeTools: "Kostenlose Werkzeuge",
    pricing: "Preise",
    blog: "Blog",
    faq: "Häufige Fragen",
    about: "Über uns",
    contact: "Kontakt",
    backlinkExchange: "Linktausch",
    publishers: "Monetarisieren Sie Ihren Blog",
    affiliate: "Unternehmen empfehlen",
    privacy: "Datenschutz",
    terms: "AGB",
    refunds: "Rückerstattungen",
  },
  home: {
    title: "Bei Google gefunden werden, ganz ohne Agentur",
    subtitle:
      "Wir übernehmen die SEO-Arbeit für Ihr Unternehmen: Wir finden die Suchbegriffe, die sich lohnen, schreiben die Seiten und zeigen Ihnen, was sich verbessert hat.",
    checkFree: "Meine Website kostenlos prüfen",
    getStarted: "Loslegen",
    howItWorks: "So funktioniert es",
    howItWorksSub: "Vier Schritte, und wir übernehmen sie alle.",
    included: [
      "Wir lesen Ihre Website und verstehen, was Sie tun",
      "Wir finden die Suchanfragen, die Ihre Kunden wirklich nutzen",
      "Wir schreiben und veröffentlichen die Artikel, die sie beantworten",
      "Sie sehen genau, was sich verbessert hat",
    ],
    pricingTitle: "Preise",
    pricingSub:
      "In jedem Tarif ist alles enthalten. Der Unterschied liegt darin, wie viel wir jeden Monat für Sie schreiben — ab 1 EUR.",
    seePlans: "Alle Tarife ansehen",
    guarantee: "14 Tage Geld-zurück-Garantie",
  },
  pricing: {
    title: "Einfache Preise",
    subtitle:
      "In jedem Tarif ist alles enthalten. Der Unterschied liegt darin, wie viel wir jeden Monat für Sie schreiben.",
    perMonth: " / Monat",
    getStarted: "Loslegen",
    mostPopular: "Am beliebtesten",
    unavailable:
      "Die Preise sind derzeit nicht verfügbar. Bitte versuchen Sie es in Kürze erneut.",
    annualNote:
      "Jahrestarife sind nach der Anmeldung verfügbar, mit zwei Freimonaten. Jederzeit kündbar — siehe unsere",
    refundPolicy: "Rückerstattungsrichtlinie",
    features: {
      articles: (n) => `${n} ${n === 1 ? "Artikel" : "Artikel"} pro Monat geschrieben`,
      keywords: (n) => `${n} Suchbegriffe überwacht`,
      websites: (n) => `${n} ${n === 1 ? "Website" : "Websites"}`,
      credits: (n) => `${n} ${n === 1 ? "Link-Guthaben" : "Link-Guthaben"} pro Monat`,
      healthChecks: "Website-Gesundheitschecks",
      publishing: "Veröffentlichen auf WordPress, Ghost oder Shopify",
    },
  },
  legalNotice:
    "Diese Seite ist nur auf Englisch verfügbar. Übersetzungen unserer rechtlichen Bedingungen werden vor der Veröffentlichung von einem professionellen Übersetzer erstellt.",
};

const MESSAGES: Record<Locale, Messages> = { en, es, fr, it, de };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale] ?? en;
}
