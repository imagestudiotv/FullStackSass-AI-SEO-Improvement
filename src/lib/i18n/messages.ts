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
    howItWorks: string;
    freeCheck: string;
    tools: string;
    pricing: string;
    blog: string;
    faq: string;
    about: string;
    contact: string;
    signIn: string;
    getStarted: string;
    startFree: string;
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
    eyebrow: string;
    title: string;
    subtitle: string;
    checkFree: string;
    getStarted: string;
    noCard: string;
    /** "Free with your audit" band. */
    auditBand: string;
    auditItems: { title: string; body: string }[];
    checkMyWebsite: string;
    howItWorks: string;
    steps: { title: string; body: string }[];
    /** Problem / solution. */
    problemsEyebrow: string;
    yourProblem: string;
    ourSolution: string;
    problems: string[];
    solutionTitle: string;
    solution: string[];
    /** One subscription. */
    stackEyebrow: string;
    stackTitle: string;
    stackTitleAccent: string;
    stackSub: string;
    seePricing: string;
    replaces: string[];
    /** Publishing. */
    publishesTitle: string;
    publishesAccent: string;
    publishesTitleEnd: string;
    publishesSub: string;
    publishesPlugin: string;
    platformOther: string;
    /** What you see. */
    trackedTitle: string;
    trackedSub: string;
    tracked: { label: string; detail: string }[];
    /** Backlink network. */
    networkEyebrow: string;
    networkTitle: string;
    networkTitleRest: string;
    networkHeading: string;
    networkPoints: string[];
    networkHowLink: string;
    networkWhyTitle: string;
    networkWhyBody: string;
    /** Pricing preview. */
    pricingEyebrow: string;
    pricingTitle: string;
    pricingTitleAccent: string;
    pricingSub: string;
    seeAllPlans: string;
    mostPopular: string;
    getStartedPlan: string;
    perMonth: string;
    unavailable: string;
    planArticles: (n: number) => string;
    planWebsites: (n: number) => string;
    planCredits: (n: number) => string;
    /** Closing. */
    closingTitle: string;
    closingSub: string;
    cancelAnytime: string;
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
    howItWorks: "How it works",
    freeCheck: "Free check",
    tools: "Tools",
    pricing: "Pricing",
    blog: "Blog",
    faq: "FAQ",
    about: "About",
    signIn: "Sign in",
    getStarted: "Get started",
    contact: "Contact",
    startFree: "Start for free",
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
    eyebrow: "Get ranked. Get cited. Get recommended.",
    title: "Get found everywhere your customers search",
    subtitle:
      "Rank on Google. Get recommended by AI assistants. Build authority with content and backlinks, automatically.",
    checkFree: "Check my website free",
    getStarted: "Start for free",
    noCard: "No card required to run your first check.",
    auditBand: "Free with your audit",
    auditItems: [
      {
        title: "SEO & AI audit",
        body: "See your site's health, what is missing, and whether AI assistants mention you.",
      },
      {
        title: "A plan to act on",
        body: "The specific changes worth making, in the order worth making them.",
      },
      {
        title: "Your first backlink",
        body: "One link from a real business in a related field, earned rather than bought.",
      },
    ],
    checkMyWebsite: "Check my website",
    howItWorks: "How it works",
    steps: [
      {
        title: "Audit",
        body: "We read your website, find what is holding it back, and check whether AI assistants mention you.",
      },
      {
        title: "Connect",
        body: "Link your site — WordPress, Ghost, Shopify or a webhook — so we can publish for you.",
      },
      {
        title: "Grow",
        body: "We research, write and publish, then show you what actually changed.",
      },
    ],
    problemsEyebrow: "Problems & solution",
    yourProblem: "Your problem",
    ourSolution: "Our solution",
    problems: [
      "Paid ads drain your budget every month — and stop the moment you do.",
      "Hours lost juggling audits, keywords, content and a stack of separate tools.",
      "AI assistants recommend your competitors, and you never find out.",
    ],
    solutionTitle: "Everything you need, in one place",
    solution: [
      "Full SEO and AI-readiness audit",
      "AI visibility tracking across assistants",
      "Keyword and market research",
      "Articles written for you, published automatically",
      "Backlinks earned from real businesses",
    ],
    stackEyebrow: "Us vs. a stack of tools",
    stackTitle: "One subscription replaces",
    stackTitleAccent: "your whole SEO stack",
    stackSub:
      "Audit, AI visibility, research, content, publishing, backlinks and reporting — in one place, for less than the tools cost separately.",
    seePricing: "See pricing",
    replaces: [
      "SEO audit and site crawl",
      "AI visibility tracking",
      "Keyword and market research",
      "Written, optimised articles",
      "Publishing to your CMS",
      "Backlink building",
      "Search Console and Analytics reporting",
    ],
    publishesTitle: "Publishes",
    publishesAccent: "directly",
    publishesTitleEnd: "to your site",
    publishesSub:
      "Connect once. No manual uploads, no copy-paste — articles appear on your site automatically, with their images.",
    publishesPlugin:
      "Our WordPress plugin connects with one key, and works even if your host blocks the WordPress API.",
    platformOther: "Any site via webhook",
    trackedTitle: "You see exactly what changed",
    trackedSub:
      "Not a monthly PDF. A dashboard reading your own Search Console and Analytics data.",
    tracked: [
      { label: "Rankings and clicks", detail: "From Search Console" },
      { label: "AI visibility", detail: "Whether assistants name you" },
      { label: "Backlinks earned", detail: "Checked every day" },
      { label: "Articles published", detail: "And what they did" },
    ],
    networkEyebrow: "A vetted backlink network",
    networkTitle: "A backlink network",
    networkTitleRest: "that gets stronger with every new customer.",
    networkHeading: "Automated link exchange",
    networkPoints: [
      "Every customer both gives and receives links",
      "Links come from businesses in a related field, never unrelated ones",
      "Placed inside real articles, not a page of links",
      "Checked daily — if a link is removed, your credit comes back",
    ],
    networkHowLink: "How the exchange works",
    networkWhyTitle: "Why exchange rather than buy",
    networkWhyBody:
      "Buying links is against Google's guidelines and can be penalised. Every link here sits in a real article on a real business's site, published because that business wanted the article — which is why the network works by exchange.",
    pricingEyebrow: "Pricing",
    pricingTitle: "Start small.",
    pricingTitleAccent: "Grow when you are ready.",
    pricingSub:
      "A free check to start, no contract, and cancel whenever you like.",
    seeAllPlans: "See everything included in each plan",
    mostPopular: "Most popular",
    getStartedPlan: "Get started",
    perMonth: " / month",
    unavailable:
      "Pricing is not available right now. Please check back shortly.",
    planArticles: (n) => `${n} ${n === 1 ? "article" : "articles"} each month`,
    planWebsites: (n) => `${n} ${n === 1 ? "website" : "websites"}`,
    planCredits: (n) => `${n} ${n === 1 ? "link credit" : "link credits"}`,
    closingTitle: "Start growing on autopilot today",
    closingSub:
      "Run a free check on your website and see what is holding it back. No account needed.",
    cancelAnytime: "Cancel any time",
    guarantee: "14-day money-back guarantee",
  },
  pricing: {
    title: "Simple pricing",
    subtitle:
      "Everything is included in every plan. The difference is how much we write for you each month.",
    perMonth: " / month",
    getStarted: "Get started",
    mostPopular: "Most popular",
    unavailable:
      "Pricing is not available right now. Please check back shortly.",
    annualNote:
      "Annual plans are available once you sign up, at two months free. Cancel any time — see our",
    refundPolicy: "refund policy",
    features: {
      articles: (n) =>
        `${n} ${n === 1 ? "article" : "articles"} written each month`,
      keywords: (n) => `${n} search terms tracked`,
      websites: (n) => `${n} ${n === 1 ? "website" : "websites"}`,
      credits: (n) =>
        `${n} ${n === 1 ? "link credit" : "link credits"} each month`,
      healthChecks: "Website health checks",
      publishing: "Publish to WordPress, Ghost or Shopify",
    },
  },
  legalNotice:
    "This page is available in English only. Translations of our legal terms are prepared by a professional translator before publication.",
};

const es: Messages = {
  nav: {
    howItWorks: "Cómo funciona",
    freeCheck: "Análisis gratuito",
    tools: "Herramientas",
    pricing: "Precios",
    blog: "Blog",
    faq: "Preguntas frecuentes",
    about: "Nosotros",
    signIn: "Iniciar sesión",
    getStarted: "Empezar",
    contact: "Contacto",
    startFree: "Empezar gratis",
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
    eyebrow: "Posiciónate. Que te citen. Que te recomienden.",
    title: "Que te encuentren allí donde buscan tus clientes",
    subtitle:
      "Posiciónate en Google. Que los asistentes de IA te recomienden. Gana autoridad con contenido y enlaces, automáticamente.",
    checkFree: "Analizar mi web gratis",
    getStarted: "Empezar gratis",
    noCard: "No hace falta tarjeta para el primer análisis.",
    auditBand: "Gratis con tu análisis",
    auditItems: [
      {
        title: "Auditoría SEO e IA",
        body: "Vea el estado de su web, qué falta y si los asistentes de IA le mencionan.",
      },
      {
        title: "Un plan para actuar",
        body: "Los cambios concretos que merece la pena hacer, en el orden en que conviene hacerlos.",
      },
      {
        title: "Su primer enlace",
        body: "Un enlace de una empresa real de un sector afín, ganado y no comprado.",
      },
    ],
    checkMyWebsite: "Analizar mi web",
    howItWorks: "Cómo funciona",
    steps: [
      {
        title: "Análisis",
        body: "Leemos su web, encontramos qué la frena y comprobamos si los asistentes de IA la mencionan.",
      },
      {
        title: "Conexión",
        body: "Conecte su web — WordPress, Ghost, Shopify o un webhook — para que publiquemos por usted.",
      },
      {
        title: "Crecimiento",
        body: "Investigamos, escribimos y publicamos, y le mostramos qué ha cambiado de verdad.",
      },
    ],
    problemsEyebrow: "Problemas y solución",
    yourProblem: "Su problema",
    ourSolution: "Nuestra solución",
    problems: [
      "La publicidad de pago agota su presupuesto cada mes, y se detiene en cuanto usted lo hace.",
      "Horas perdidas entre auditorías, palabras clave, contenido y un montón de herramientas distintas.",
      "Los asistentes de IA recomiendan a su competencia, y usted nunca se entera.",
    ],
    solutionTitle: "Todo lo que necesita, en un solo sitio",
    solution: [
      "Auditoría SEO y de preparación para IA",
      "Seguimiento de visibilidad en asistentes de IA",
      "Investigación de palabras clave y mercado",
      "Artículos escritos y publicados automáticamente",
      "Enlaces ganados de empresas reales",
    ],
    stackEyebrow: "Nosotros frente a un montón de herramientas",
    stackTitle: "Una suscripción sustituye",
    stackTitleAccent: "todo su conjunto de herramientas SEO",
    stackSub:
      "Auditoría, visibilidad en IA, investigación, contenido, publicación, enlaces e informes: todo en un sitio y por menos de lo que cuestan las herramientas por separado.",
    seePricing: "Ver precios",
    replaces: [
      "Auditoría SEO y rastreo del sitio",
      "Seguimiento de visibilidad en IA",
      "Investigación de palabras clave y mercado",
      "Artículos escritos y optimizados",
      "Publicación en su CMS",
      "Creación de enlaces",
      "Informes de Search Console y Analytics",
    ],
    publishesTitle: "Publica",
    publishesAccent: "directamente",
    publishesTitleEnd: "en su web",
    publishesSub:
      "Conecte una vez. Sin subidas manuales ni copiar y pegar: los artículos aparecen solos en su web, con sus imágenes.",
    publishesPlugin:
      "Nuestro plugin de WordPress se conecta con una sola clave y funciona incluso si su alojamiento bloquea la API de WordPress.",
    platformOther: "Cualquier web mediante webhook",
    trackedTitle: "Ve exactamente qué ha cambiado",
    trackedSub:
      "No es un PDF mensual. Es un panel que lee sus propios datos de Search Console y Analytics.",
    tracked: [
      { label: "Posiciones y clics", detail: "Desde Search Console" },
      { label: "Visibilidad en IA", detail: "Si los asistentes le nombran" },
      { label: "Enlaces conseguidos", detail: "Comprobados a diario" },
      { label: "Artículos publicados", detail: "Y qué resultado dieron" },
    ],
    networkEyebrow: "Una red de enlaces verificada",
    networkTitle: "Una red de enlaces",
    networkTitleRest: "que se refuerza con cada nuevo cliente.",
    networkHeading: "Intercambio automático de enlaces",
    networkPoints: [
      "Cada cliente da y recibe enlaces",
      "Los enlaces vienen de empresas de sectores afines, nunca ajenos",
      "Colocados dentro de artículos reales, no en una página de enlaces",
      "Comprobados a diario: si se retira un enlace, recupera su crédito",
    ],
    networkHowLink: "Cómo funciona el intercambio",
    networkWhyTitle: "Por qué intercambiar en lugar de comprar",
    networkWhyBody:
      "Comprar enlaces va contra las directrices de Google y puede penalizarse. Aquí cada enlace está dentro de un artículo real, en la web de una empresa real que quería ese artículo. Por eso la red funciona por intercambio.",
    pricingEyebrow: "Precios",
    pricingTitle: "Empiece pequeño.",
    pricingTitleAccent: "Crezca cuando esté listo.",
    pricingSub:
      "Un análisis gratuito para empezar, sin contrato y cancele cuando quiera.",
    seeAllPlans: "Ver todo lo que incluye cada plan",
    mostPopular: "Más popular",
    getStartedPlan: "Empezar",
    perMonth: " / mes",
    unavailable:
      "Los precios no están disponibles ahora mismo. Vuelva a intentarlo en breve.",
    planArticles: (n) => `${n} ${n === 1 ? "artículo" : "artículos"} al mes`,
    planWebsites: (n) => `${n} ${n === 1 ? "sitio web" : "sitios web"}`,
    planCredits: (n) =>
      `${n} ${n === 1 ? "crédito de enlace" : "créditos de enlace"}`,
    closingTitle: "Empiece a crecer en piloto automático hoy",
    closingSub:
      "Analice su web gratis y vea qué la está frenando. Sin crear cuenta.",
    cancelAnytime: "Cancele cuando quiera",
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
      articles: (n) =>
        `${n} ${n === 1 ? "artículo" : "artículos"} escritos cada mes`,
      keywords: (n) => `${n} términos de búsqueda monitorizados`,
      websites: (n) => `${n} ${n === 1 ? "sitio web" : "sitios web"}`,
      credits: (n) =>
        `${n} ${n === 1 ? "crédito de enlace" : "créditos de enlace"} cada mes`,
      healthChecks: "Análisis de salud de la web",
      publishing: "Publica en WordPress, Ghost o Shopify",
    },
  },
  legalNotice:
    "Esta página solo está disponible en inglés. Las traducciones de nuestros términos legales las prepara un traductor profesional antes de su publicación.",
};

const fr: Messages = {
  nav: {
    howItWorks: "Comment ça marche",
    freeCheck: "Analyse gratuite",
    tools: "Outils",
    pricing: "Tarifs",
    blog: "Blog",
    faq: "FAQ",
    about: "À propos",
    signIn: "Se connecter",
    getStarted: "Commencer",
    contact: "Contact",
    startFree: "Commencer gratuitement",
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
    eyebrow: "Soyez classé. Soyez cité. Soyez recommandé.",
    title: "Soyez trouvé partout où vos clients cherchent",
    subtitle:
      "Classez-vous sur Google. Faites-vous recommander par les assistants IA. Bâtissez votre autorité avec du contenu et des liens, automatiquement.",
    checkFree: "Analyser mon site gratuitement",
    getStarted: "Commencer gratuitement",
    noCard: "Aucune carte requise pour la première analyse.",
    auditBand: "Offert avec votre analyse",
    auditItems: [
      {
        title: "Audit SEO et IA",
        body: "Voyez l'état de votre site, ce qui manque, et si les assistants IA vous mentionnent.",
      },
      {
        title: "Un plan concret",
        body: "Les changements qui comptent vraiment, dans l'ordre où il faut les faire.",
      },
      {
        title: "Votre premier lien",
        body: "Un lien d'une entreprise réelle d'un secteur proche, gagné et non acheté.",
      },
    ],
    checkMyWebsite: "Analyser mon site",
    howItWorks: "Comment ça marche",
    steps: [
      {
        title: "Analyse",
        body: "Nous lisons votre site, trouvons ce qui le freine et vérifions si les assistants IA le mentionnent.",
      },
      {
        title: "Connexion",
        body: "Reliez votre site — WordPress, Ghost, Shopify ou un webhook — pour que nous publiions à votre place.",
      },
      {
        title: "Croissance",
        body: "Nous cherchons, rédigeons et publions, puis vous montrons ce qui a réellement changé.",
      },
    ],
    problemsEyebrow: "Problèmes et solution",
    yourProblem: "Votre problème",
    ourSolution: "Notre solution",
    problems: [
      "La publicité payante épuise votre budget chaque mois, et s'arrête dès que vous arrêtez.",
      "Des heures perdues entre audits, mots-clés, contenu et une pile d'outils séparés.",
      "Les assistants IA recommandent vos concurrents, et vous ne le savez jamais.",
    ],
    solutionTitle: "Tout ce qu'il vous faut, au même endroit",
    solution: [
      "Audit SEO et préparation à l'IA",
      "Suivi de visibilité dans les assistants IA",
      "Recherche de mots-clés et de marché",
      "Articles rédigés pour vous et publiés automatiquement",
      "Liens gagnés auprès d'entreprises réelles",
    ],
    stackEyebrow: "Nous face à une pile d'outils",
    stackTitle: "Un abonnement remplace",
    stackTitleAccent: "toute votre panoplie SEO",
    stackSub:
      "Audit, visibilité IA, recherche, contenu, publication, liens et rapports : le tout au même endroit, pour moins cher que les outils séparément.",
    seePricing: "Voir les tarifs",
    replaces: [
      "Audit SEO et exploration du site",
      "Suivi de visibilité dans l'IA",
      "Recherche de mots-clés et de marché",
      "Articles rédigés et optimisés",
      "Publication sur votre CMS",
      "Création de liens",
      "Rapports Search Console et Analytics",
    ],
    publishesTitle: "Publie",
    publishesAccent: "directement",
    publishesTitleEnd: "sur votre site",
    publishesSub:
      "Connectez une fois. Aucun téléversement manuel, aucun copier-coller : les articles paraissent seuls sur votre site, avec leurs images.",
    publishesPlugin:
      "Notre extension WordPress se connecte avec une seule clé, et fonctionne même si votre hébergeur bloque l'API WordPress.",
    platformOther: "N'importe quel site via webhook",
    trackedTitle: "Vous voyez exactement ce qui a changé",
    trackedSub:
      "Pas un PDF mensuel. Un tableau de bord qui lit vos propres données Search Console et Analytics.",
    tracked: [
      { label: "Positions et clics", detail: "Depuis Search Console" },
      { label: "Visibilité IA", detail: "Si les assistants vous citent" },
      { label: "Liens obtenus", detail: "Vérifiés chaque jour" },
      { label: "Articles publiés", detail: "Et ce qu'ils ont donné" },
    ],
    networkEyebrow: "Un réseau de liens vérifié",
    networkTitle: "Un réseau de liens",
    networkTitleRest: "qui se renforce à chaque nouveau client.",
    networkHeading: "Échange de liens automatisé",
    networkPoints: [
      "Chaque client donne et reçoit des liens",
      "Les liens viennent d'entreprises d'un secteur proche, jamais sans rapport",
      "Placés dans de vrais articles, pas sur une page de liens",
      "Vérifiés chaque jour : si un lien disparaît, votre crédit revient",
    ],
    networkHowLink: "Comment fonctionne l'échange",
    networkWhyTitle: "Pourquoi échanger plutôt qu'acheter",
    networkWhyBody:
      "Acheter des liens va à l'encontre des consignes de Google et peut être pénalisé. Ici chaque lien se trouve dans un vrai article, sur le site d'une entreprise réelle qui voulait cet article. C'est pourquoi le réseau fonctionne par échange.",
    pricingEyebrow: "Tarifs",
    pricingTitle: "Commencez petit.",
    pricingTitleAccent: "Grandissez quand vous êtes prêt.",
    pricingSub:
      "Une analyse gratuite pour commencer, sans engagement, et annulez quand vous voulez.",
    seeAllPlans: "Voir tout ce que comprend chaque formule",
    mostPopular: "Le plus choisi",
    getStartedPlan: "Commencer",
    perMonth: " / mois",
    unavailable:
      "Les tarifs ne sont pas disponibles pour le moment. Merci de réessayer sous peu.",
    planArticles: (n) => `${n} ${n === 1 ? "article" : "articles"} par mois`,
    planWebsites: (n) => `${n} ${n === 1 ? "site web" : "sites web"}`,
    planCredits: (n) =>
      `${n} ${n === 1 ? "crédit de lien" : "crédits de lien"}`,
    closingTitle: "Commencez à croître en pilote automatique dès aujourd'hui",
    closingSub:
      "Lancez une analyse gratuite de votre site et voyez ce qui le freine. Sans créer de compte.",
    cancelAnytime: "Annulez à tout moment",
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
      articles: (n) =>
        `${n} ${n === 1 ? "article rédigé" : "articles rédigés"} chaque mois`,
      keywords: (n) => `${n} termes de recherche suivis`,
      websites: (n) => `${n} ${n === 1 ? "site web" : "sites web"}`,
      credits: (n) =>
        `${n} ${n === 1 ? "crédit de lien" : "crédits de lien"} chaque mois`,
      healthChecks: "Analyses de santé du site",
      publishing: "Publiez sur WordPress, Ghost ou Shopify",
    },
  },
  legalNotice:
    "Cette page n'est disponible qu'en anglais. Les traductions de nos conditions légales sont réalisées par un traducteur professionnel avant publication.",
};

const it: Messages = {
  nav: {
    howItWorks: "Come funziona",
    freeCheck: "Analisi gratuita",
    tools: "Strumenti",
    pricing: "Prezzi",
    blog: "Blog",
    faq: "Domande frequenti",
    about: "Chi siamo",
    signIn: "Accedi",
    getStarted: "Inizia",
    contact: "Contatti",
    startFree: "Inizia gratis",
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
    eyebrow: "Posizionati. Fatti citare. Fatti consigliare.",
    title: "Fatti trovare ovunque cerchino i tuoi clienti",
    subtitle:
      "Posizionati su Google. Fatti consigliare dagli assistenti IA. Costruisci autorevolezza con contenuti e link, in automatico.",
    checkFree: "Analizza il mio sito gratis",
    getStarted: "Inizia gratis",
    noCard: "Nessuna carta richiesta per la prima analisi.",
    auditBand: "Incluso con la tua analisi",
    auditItems: [
      {
        title: "Analisi SEO e IA",
        body: "Veda lo stato del suo sito, che cosa manca e se gli assistenti IA la citano.",
      },
      {
        title: "Un piano su cui agire",
        body: "Le modifiche che contano davvero, nell'ordine in cui conviene farle.",
      },
      {
        title: "Il suo primo link",
        body: "Un link da un'azienda reale di un settore affine, guadagnato e non comprato.",
      },
    ],
    checkMyWebsite: "Analizza il mio sito",
    howItWorks: "Come funziona",
    steps: [
      {
        title: "Analisi",
        body: "Leggiamo il suo sito, troviamo che cosa lo frena e verifichiamo se gli assistenti IA lo citano.",
      },
      {
        title: "Collegamento",
        body: "Colleghi il suo sito — WordPress, Ghost, Shopify o un webhook — così pubblichiamo noi per lei.",
      },
      {
        title: "Crescita",
        body: "Facciamo ricerca, scriviamo e pubblichiamo, poi le mostriamo che cosa è cambiato davvero.",
      },
    ],
    problemsEyebrow: "Problemi e soluzione",
    yourProblem: "Il suo problema",
    ourSolution: "La nostra soluzione",
    problems: [
      "Le campagne a pagamento consumano il budget ogni mese e si fermano appena si ferma lei.",
      "Ore perse tra analisi, parole chiave, contenuti e una serie di strumenti separati.",
      "Gli assistenti IA consigliano i suoi concorrenti, e lei non lo scopre mai.",
    ],
    solutionTitle: "Tutto quello che serve, in un unico posto",
    solution: [
      "Analisi SEO e di preparazione all'IA",
      "Monitoraggio della visibilità negli assistenti IA",
      "Ricerca di parole chiave e di mercato",
      "Articoli scritti per lei e pubblicati automaticamente",
      "Link guadagnati da aziende reali",
    ],
    stackEyebrow: "Noi contro una serie di strumenti",
    stackTitle: "Un abbonamento sostituisce",
    stackTitleAccent: "tutti i suoi strumenti SEO",
    stackSub:
      "Analisi, visibilità IA, ricerca, contenuti, pubblicazione, link e report: tutto in un posto e a meno di quanto costino gli strumenti separati.",
    seePricing: "Vedi i prezzi",
    replaces: [
      "Analisi SEO e scansione del sito",
      "Monitoraggio della visibilità IA",
      "Ricerca di parole chiave e di mercato",
      "Articoli scritti e ottimizzati",
      "Pubblicazione sul suo CMS",
      "Costruzione di link",
      "Report da Search Console e Analytics",
    ],
    publishesTitle: "Pubblica",
    publishesAccent: "direttamente",
    publishesTitleEnd: "sul suo sito",
    publishesSub:
      "Colleghi una volta sola. Nessun caricamento manuale, nessun copia e incolla: gli articoli compaiono da soli sul suo sito, con le immagini.",
    publishesPlugin:
      "Il nostro plugin per WordPress si collega con una sola chiave e funziona anche se il suo hosting blocca le API di WordPress.",
    platformOther: "Qualsiasi sito tramite webhook",
    trackedTitle: "Vede esattamente che cosa è cambiato",
    trackedSub:
      "Non un PDF mensile. Una dashboard che legge i suoi dati di Search Console e Analytics.",
    tracked: [
      { label: "Posizioni e clic", detail: "Da Search Console" },
      { label: "Visibilità IA", detail: "Se gli assistenti la nominano" },
      { label: "Link ottenuti", detail: "Verificati ogni giorno" },
      { label: "Articoli pubblicati", detail: "E che risultati hanno dato" },
    ],
    networkEyebrow: "Una rete di link verificata",
    networkTitle: "Una rete di link",
    networkTitleRest: "che si rafforza con ogni nuovo cliente.",
    networkHeading: "Scambio di link automatico",
    networkPoints: [
      "Ogni cliente dà e riceve link",
      "I link arrivano da aziende di settori affini, mai estranei",
      "Inseriti dentro articoli veri, non in una pagina di link",
      "Verificati ogni giorno: se un link sparisce, il credito torna indietro",
    ],
    networkHowLink: "Come funziona lo scambio",
    networkWhyTitle: "Perché scambiare invece di comprare",
    networkWhyBody:
      "Comprare link va contro le linee guida di Google e può essere penalizzato. Qui ogni link sta dentro un articolo vero, sul sito di un'azienda vera che voleva quell'articolo. È per questo che la rete funziona per scambio.",
    pricingEyebrow: "Prezzi",
    pricingTitle: "Inizi in piccolo.",
    pricingTitleAccent: "Cresca quando è pronto.",
    pricingSub:
      "Un'analisi gratuita per iniziare, senza vincoli, e disdica quando vuole.",
    seeAllPlans: "Vedi tutto ciò che include ogni piano",
    mostPopular: "Il più scelto",
    getStartedPlan: "Inizia",
    perMonth: " / mese",
    unavailable:
      "I prezzi non sono disponibili in questo momento. Riprovi tra poco.",
    planArticles: (n) => `${n} ${n === 1 ? "articolo" : "articoli"} al mese`,
    planWebsites: (n) => `${n} ${n === 1 ? "sito web" : "siti web"}`,
    planCredits: (n) => `${n} ${n === 1 ? "credito link" : "crediti link"}`,
    closingTitle: "Inizi oggi a crescere in automatico",
    closingSub:
      "Faccia un'analisi gratuita del suo sito e veda che cosa lo frena. Senza registrarsi.",
    cancelAnytime: "Disdica quando vuole",
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
      articles: (n) =>
        `${n} ${n === 1 ? "articolo scritto" : "articoli scritti"} ogni mese`,
      keywords: (n) => `${n} termini di ricerca monitorati`,
      websites: (n) => `${n} ${n === 1 ? "sito web" : "siti web"}`,
      credits: (n) =>
        `${n} ${n === 1 ? "credito link" : "crediti link"} ogni mese`,
      healthChecks: "Controlli sullo stato del sito",
      publishing: "Pubblica su WordPress, Ghost o Shopify",
    },
  },
  legalNotice:
    "Questa pagina è disponibile solo in inglese. Le traduzioni dei nostri termini legali sono curate da un traduttore professionista prima della pubblicazione.",
};

const de: Messages = {
  nav: {
    howItWorks: "So funktioniert es",
    freeCheck: "Kostenlose Analyse",
    tools: "Werkzeuge",
    pricing: "Preise",
    blog: "Blog",
    faq: "Häufige Fragen",
    about: "Über uns",
    signIn: "Anmelden",
    getStarted: "Loslegen",
    contact: "Kontakt",
    startFree: "Kostenlos starten",
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
    eyebrow: "Ranken. Zitiert werden. Empfohlen werden.",
    title: "Werden Sie überall gefunden, wo Ihre Kunden suchen",
    subtitle:
      "Ranken Sie bei Google. Lassen Sie sich von KI-Assistenten empfehlen. Bauen Sie Autorität auf — mit Inhalten und Backlinks, ganz automatisch.",
    checkFree: "Website kostenlos prüfen",
    getStarted: "Kostenlos starten",
    noCard: "Für die erste Prüfung ist keine Karte nötig.",
    auditBand: "Kostenlos zu Ihrer Analyse",
    auditItems: [
      {
        title: "SEO- und KI-Analyse",
        body: "Sehen Sie den Zustand Ihrer Website, was fehlt und ob KI-Assistenten Sie nennen.",
      },
      {
        title: "Ein Plan zum Handeln",
        body: "Die konkreten Änderungen, die sich lohnen — in der Reihenfolge, in der sie sinnvoll sind.",
      },
      {
        title: "Ihr erster Backlink",
        body: "Ein Link von einem echten Unternehmen aus einer verwandten Branche, verdient statt gekauft.",
      },
    ],
    checkMyWebsite: "Website prüfen",
    howItWorks: "So funktioniert es",
    steps: [
      {
        title: "Analyse",
        body: "Wir lesen Ihre Website, finden heraus, was sie bremst, und prüfen, ob KI-Assistenten sie nennen.",
      },
      {
        title: "Verbinden",
        body: "Verbinden Sie Ihre Website — WordPress, Ghost, Shopify oder einen Webhook — damit wir für Sie veröffentlichen.",
      },
      {
        title: "Wachsen",
        body: "Wir recherchieren, schreiben und veröffentlichen und zeigen Ihnen, was sich wirklich verändert hat.",
      },
    ],
    problemsEyebrow: "Probleme und Lösung",
    yourProblem: "Ihr Problem",
    ourSolution: "Unsere Lösung",
    problems: [
      "Bezahlte Anzeigen verbrauchen jeden Monat Ihr Budget — und hören auf, sobald Sie aufhören.",
      "Stunden, die zwischen Analysen, Keywords, Inhalten und einem Stapel einzelner Tools verloren gehen.",
      "KI-Assistenten empfehlen Ihre Wettbewerber, und Sie erfahren es nie.",
    ],
    solutionTitle: "Alles, was Sie brauchen, an einem Ort",
    solution: [
      "Vollständige SEO- und KI-Analyse",
      "Sichtbarkeitsverfolgung in KI-Assistenten",
      "Keyword- und Marktrecherche",
      "Artikel, die für Sie geschrieben und automatisch veröffentlicht werden",
      "Backlinks von echten Unternehmen",
    ],
    stackEyebrow: "Wir gegen einen Stapel von Tools",
    stackTitle: "Ein Abo ersetzt",
    stackTitleAccent: "Ihr gesamtes SEO-Werkzeug",
    stackSub:
      "Analyse, KI-Sichtbarkeit, Recherche, Inhalte, Veröffentlichung, Backlinks und Berichte — an einem Ort und günstiger als die Tools einzeln.",
    seePricing: "Preise ansehen",
    replaces: [
      "SEO-Analyse und Website-Crawl",
      "KI-Sichtbarkeitsverfolgung",
      "Keyword- und Marktrecherche",
      "Geschriebene, optimierte Artikel",
      "Veröffentlichung in Ihrem CMS",
      "Backlink-Aufbau",
      "Berichte aus Search Console und Analytics",
    ],
    publishesTitle: "Veröffentlicht",
    publishesAccent: "direkt",
    publishesTitleEnd: "auf Ihrer Website",
    publishesSub:
      "Einmal verbinden. Kein manuelles Hochladen, kein Kopieren und Einfügen — Artikel erscheinen von selbst auf Ihrer Website, mit Bildern.",
    publishesPlugin:
      "Unser WordPress-Plugin verbindet sich mit einem einzigen Schlüssel und funktioniert auch dann, wenn Ihr Hoster die WordPress-API blockiert.",
    platformOther: "Jede Website per Webhook",
    trackedTitle: "Sie sehen genau, was sich verändert hat",
    trackedSub:
      "Kein monatliches PDF. Ein Dashboard, das Ihre eigenen Daten aus Search Console und Analytics liest.",
    tracked: [
      { label: "Positionen und Klicks", detail: "Aus der Search Console" },
      { label: "KI-Sichtbarkeit", detail: "Ob Assistenten Sie nennen" },
      { label: "Erhaltene Backlinks", detail: "Täglich geprüft" },
      {
        label: "Veröffentlichte Artikel",
        detail: "Und was sie gebracht haben",
      },
    ],
    networkEyebrow: "Ein geprüftes Backlink-Netzwerk",
    networkTitle: "Ein Backlink-Netzwerk,",
    networkTitleRest: "das mit jedem neuen Kunden stärker wird.",
    networkHeading: "Automatischer Linktausch",
    networkPoints: [
      "Jeder Kunde gibt und erhält Links",
      "Links kommen aus verwandten Branchen, nie aus fremden",
      "Platziert in echten Artikeln, nicht auf einer Linkseite",
      "Täglich geprüft — wird ein Link entfernt, erhalten Sie Ihr Guthaben zurück",
    ],
    networkHowLink: "So funktioniert der Tausch",
    networkWhyTitle: "Warum tauschen statt kaufen",
    networkWhyBody:
      "Links zu kaufen verstößt gegen die Richtlinien von Google und kann abgestraft werden. Hier steht jeder Link in einem echten Artikel auf der Website eines echten Unternehmens, das diesen Artikel wollte. Genau deshalb funktioniert das Netzwerk über Tausch.",
    pricingEyebrow: "Preise",
    pricingTitle: "Klein anfangen.",
    pricingTitleAccent: "Wachsen, wenn Sie so weit sind.",
    pricingSub:
      "Eine kostenlose Prüfung zum Start, kein Vertrag, jederzeit kündbar.",
    seeAllPlans: "Alle Leistungen jedes Tarifs ansehen",
    mostPopular: "Am beliebtesten",
    getStartedPlan: "Loslegen",
    perMonth: " / Monat",
    unavailable:
      "Die Preise sind derzeit nicht verfügbar. Bitte versuchen Sie es in Kürze erneut.",
    planArticles: (n) => `${n} Artikel pro Monat`,
    planWebsites: (n) => `${n} ${n === 1 ? "Website" : "Websites"}`,
    planCredits: (n) => `${n} Link-Guthaben`,
    closingTitle: "Starten Sie heute Ihr Wachstum auf Autopilot",
    closingSub:
      "Prüfen Sie Ihre Website kostenlos und sehen Sie, was sie bremst. Ohne Konto.",
    cancelAnytime: "Jederzeit kündbar",
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
      articles: (n) =>
        `${n} ${n === 1 ? "Artikel" : "Artikel"} pro Monat geschrieben`,
      keywords: (n) => `${n} Suchbegriffe überwacht`,
      websites: (n) => `${n} ${n === 1 ? "Website" : "Websites"}`,
      credits: (n) =>
        `${n} ${n === 1 ? "Link-Guthaben" : "Link-Guthaben"} pro Monat`,
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
