import type { Locale } from "@/lib/i18n/config";

/**
 * The growth plan page (/growth-plan?domain=, client 2026-11-18 after
 * explee.com's auto funnel): the homepage field's website, researched,
 * checked and turned into a plan before sign-up, in every language.
 *
 * Placeholders in braces are filled by growth-plan-flow.tsx with what was
 * read from the visitor's own site. Every promise matches the product:
 * articles every day, videos and slideshows, replies and posts for Reddit, X
 * and Threads, and the weekly AI visibility check, which asks Claude only
 * (lib/geo/check.ts).
 */
export type GrowthPlanCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  /** While working: {domain}. */
  title: string;
  /** Once the plan is ready: {name}. */
  titleDone: string;
  intro: string;
  /** The four steps, in order: the three read from the site, then the plan to buy (growth-plan/flow-steps.ts). */
  phases: [string, string, string, string];
  /** Accessible name of the step list. */
  phasesLabel: string;
  /** The working log beside the steps. */
  logTitle: string;
  logLabel: string;
  log: {
    open: string;
    found: string;
    platform: string;
    language: string;
    noPreview: string;
    auditStart: string;
    auditWaiting: string;
    pages: string;
    score: string;
    problems: string;
    crawlersOpen: string;
    crawlersBlocked: string;
    auditFailed: string;
    planStart: string;
    planDone: string;
  };
  research: {
    heading: string;
    loading: string;
    website: string;
    platform: string;
    language: string;
    unknown: string;
    noDescription: string;
  };
  audit: {
    heading: string;
    loading: string;
    checks: string[];
    score: string;
    pages: string;
    critical: string;
    warnings: string;
    more: string;
    none: string;
    failed: string;
  };
  plan: {
    heading: string;
    fix: [string, string];
    healthy: [string, string];
    articles: [string, string];
    articlesIn: string;
    videos: [string, string];
    aiOpen: [string, string];
    aiBlocked: [string, string];
    conversations: [string, string];
  };
  cta: {
    title: string;
    body: string;
    start: string;
    google: string;
    plans: string;
    note: string;
  };
  another: string;
  /** "Step 2 of 4" on a step's button: {index}, {total}. */
  stepOf: string;
  /** The buttons under each step and the auto-continue's words. */
  nav: {
    continue: string;
    back: string;
    pause: string;
    resume: string;
    /** Beside the filling bar. */
    auto: string;
    /** While the visitor's pointer or keyboard is in the card. */
    held: string;
    working: string;
    /** Continue's words on the plan step, which leads to the plans. */
    toBilling: string;
    /** Read out by screen readers when the step changes: {index}, {total}, {label}. */
    announce: string;
  };
  /** Each step's line in the step list once its answer is in. */
  summary: {
    waiting: string;
    working: string;
    /** {score}, {count}. */
    pages: string;
    /** {score}. */
    pagesClean: string;
    pagesSkipped: string;
    /** {count}. */
    plan: string;
    billingPick: string;
    /** {plan}, {price}. */
    billingChosen: string;
  };
  /**
   * The last step: the plans and the way to payment. Payment details are
   * never asked here: the chosen plan goes through sign-up to the plan step's
   * Stripe or PayPal checkout, and every promise matches that step's.
   */
  billing: {
    heading: string;
    /** {name}. */
    intro: string;
    options: string;
    popular: string;
    perMonth: string;
    /** {price} a month, {total} a year. */
    yearly: string;
    selected: string;
    orderTitle: string;
    website: string;
    plan: string;
    today: string;
    /** {days}. */
    trial: string;
    /** {price}. */
    then: string;
    noCard: string;
    /** With PayPal, and without it (a plan with no PayPal plan, or PayPal off). */
    methods: string;
    methodsCard: string;
    card: string;
    paypal: string;
    secure: string;
    continue: string;
    nextTitle: string;
    /** The three steps after this page; the second says {host}. */
    next: [string, string, string];
  };
};

const en: GrowthPlanCopy = {
  metaTitle: "Your free growth plan | RepGet",
  metaDescription: "Enter your website and RepGet researches your business, checks your pages and builds your growth plan in about a minute.",
  eyebrow: "Your free growth plan",
  title: "Getting to know {domain}",
  titleDone: "Your growth plan for {name} is ready",
  intro: "RepGet is reading your website, checking your pages and turning what it finds into a plan. It takes about a minute.",
  phases: ["Research your business", "Check your pages", "Build your growth plan", "Choose your plan"],
  phasesLabel: "Progress",
  logTitle: "RepGet at work",
  logLabel: "What RepGet is doing",
  log: {
    open: "Opening {domain}",
    found: "Found {name}",
    platform: "Built with {platform}",
    language: "Written in {language}",
    noPreview: "The homepage was slow to answer, carrying on",
    auditStart: "Checking up to {pages} pages",
    auditWaiting: "Reading titles, descriptions, headings, links and robots.txt",
    pages: "Pages checked: {count}",
    score: "SEO score: {score}/100",
    problems: "Critical problems: {critical} · Warnings: {warnings}",
    crawlersOpen: "AI crawlers: all allowed",
    crawlersBlocked: "AI crawlers blocked: {owners}",
    auditFailed: "Page check skipped: {message}",
    planStart: "Writing your growth plan",
    planDone: "Plan ready",
  },
  research: {
    heading: "Your business",
    loading: "Reading {domain}…",
    website: "Website",
    platform: "Platform",
    language: "Language",
    unknown: "Not stated",
    noDescription: "Your homepage does not describe the business yet: that is one of the first things to fix.",
  },
  audit: {
    heading: "What we found on your pages",
    loading: "Checking your pages. This can take up to a minute.",
    checks: ["Page titles and descriptions", "Headings and content", "Links and images", "robots.txt and AI crawlers"],
    score: "SEO score",
    pages: "Pages checked",
    critical: "Critical",
    warnings: "Warnings",
    more: "+{count} more findings in your account",
    none: "No problems on the pages we checked.",
    failed: "We could not check your pages this time: {message}",
  },
  plan: {
    heading: "Your growth plan",
    fix: ["Fix the {count} problems we found", "Each one is listed in RepGet with how to fix it."],
    healthy: ["Keep your pages healthy", "RepGet's full check reads many more pages than this free one."],
    articles: ["A new SEO article every day", "Researched topics for {name}, written for Google and AI answers, published to your website."],
    articlesIn: "A new SEO article every day, in {language}",
    videos: ["Videos and slideshows for your socials", "Made from {name}'s own website, ready to review and post."],
    aiOpen: ["Show up in AI answers", "AI crawlers can read your site. Every week RepGet checks how Claude describes {name}."],
    aiBlocked: ["Let AI assistants read your site", "Your robots.txt blocks {owners}. RepGet shows what to change, and every week checks how Claude describes {name}."],
    conversations: ["Join the right conversations", "RepGet prepares helpful replies and short posts for Reddit, X and Threads."],
  },
  cta: {
    title: "Put this plan to work",
    body: "Try RepGet free for {days} days.",
    start: "Start my free trial",
    google: "Continue with Google",
    plans: "See plans and prices",
    note: "Your website is already filled in.",
  },
  another: "Check another website",
  stepOf: "Step {index} of {total}",
  nav: {
    continue: "Continue",
    back: "Back",
    pause: "Pause",
    resume: "Resume",
    auto: "Continues by itself in a few seconds",
    held: "Paused while you read",
    working: "Working on it…",
    toBilling: "Choose your plan",
    announce: "Step {index} of {total}: {label}",
  },
  summary: {
    waiting: "Up next",
    working: "Working…",
    pages: "{score}/100 · {count} to fix",
    pagesClean: "{score}/100 · no problems found",
    pagesSkipped: "Check skipped",
    plan: "{count} actions for your site",
    billingPick: "Pick a plan",
    billingChosen: "{plan} · {price}/month",
  },
  billing: {
    heading: "Choose your plan",
    intro: "Pick how much RepGet does for {name} each month. Payment details come next, on a secure page.",
    options: "Plans",
    popular: "Most popular",
    perMonth: "/month",
    yearly: "or {price}/month billed yearly ({total}/year)",
    selected: "Selected",
    orderTitle: "Your order",
    website: "Website",
    plan: "Plan",
    today: "Due today",
    trial: "{days}-day free trial for new accounts",
    then: "Then {price}/month. Cancel anytime before the trial ends and pay nothing.",
    noCard: "No card needed",
    methods: "Pay by card or PayPal",
    methodsCard: "Pay by card",
    card: "Card",
    paypal: "PayPal",
    secure: "Card and PayPal details are entered on Stripe's or PayPal's secure page, never on RepGet.",
    continue: "Create account & continue",
    nextTitle: "What happens next",
    next: ["Create your account with email or Google", "Confirm {host}, already filled in", "Add payment details on the secure checkout"],
  },
};

const es: GrowthPlanCopy = {
  metaTitle: "Su plan de crecimiento gratuito | RepGet",
  metaDescription: "Introduzca su sitio web y RepGet investiga su negocio, revisa sus páginas y prepara su plan de crecimiento en un minuto.",
  eyebrow: "Su plan de crecimiento gratuito",
  title: "Conociendo {domain}",
  titleDone: "Su plan de crecimiento para {name} está listo",
  intro: "RepGet está leyendo su sitio web, revisando sus páginas y convirtiendo lo que encuentra en un plan. Tarda alrededor de un minuto.",
  phases: ["Investigar su negocio", "Revisar sus páginas", "Preparar su plan de crecimiento", "Elegir su plan"],
  phasesLabel: "Progreso",
  logTitle: "RepGet trabajando",
  logLabel: "Lo que está haciendo RepGet",
  log: {
    open: "Abriendo {domain}",
    found: "Encontrado: {name}",
    platform: "Creado con {platform}",
    language: "Escrito en {language}",
    noPreview: "La página de inicio tardó en responder, seguimos",
    auditStart: "Revisando hasta {pages} páginas",
    auditWaiting: "Leyendo títulos, descripciones, encabezados, enlaces y robots.txt",
    pages: "Páginas revisadas: {count}",
    score: "Puntuación SEO: {score}/100",
    problems: "Problemas críticos: {critical} · Avisos: {warnings}",
    crawlersOpen: "Rastreadores de IA: todos permitidos",
    crawlersBlocked: "Rastreadores de IA bloqueados: {owners}",
    auditFailed: "Revisión de páginas omitida: {message}",
    planStart: "Redactando su plan de crecimiento",
    planDone: "Plan listo",
  },
  research: {
    heading: "Su negocio",
    loading: "Leyendo {domain}…",
    website: "Sitio web",
    platform: "Plataforma",
    language: "Idioma",
    unknown: "No indicado",
    noDescription: "Su página de inicio aún no describe el negocio: es una de las primeras cosas que conviene corregir.",
  },
  audit: {
    heading: "Lo que encontramos en sus páginas",
    loading: "Revisando sus páginas. Puede tardar hasta un minuto.",
    checks: ["Títulos y descripciones", "Encabezados y contenido", "Enlaces e imágenes", "robots.txt y rastreadores de IA"],
    score: "Puntuación SEO",
    pages: "Páginas revisadas",
    critical: "Críticos",
    warnings: "Avisos",
    more: "+{count} hallazgos más en su cuenta",
    none: "Ningún problema en las páginas revisadas.",
    failed: "Esta vez no pudimos revisar sus páginas: {message}",
  },
  plan: {
    heading: "Su plan de crecimiento",
    fix: ["Corrija los {count} problemas encontrados", "Cada uno aparece en RepGet con cómo corregirlo."],
    healthy: ["Mantenga sus páginas en forma", "La revisión completa de RepGet lee muchas más páginas que esta gratuita."],
    articles: ["Un nuevo artículo SEO cada día", "Temas investigados para {name}, escritos para Google y las respuestas de IA, publicados en su sitio web."],
    articlesIn: "Un nuevo artículo SEO cada día, en {language}",
    videos: ["Vídeos y presentaciones para sus redes", "Creados a partir del propio sitio web de {name}, listos para revisar y publicar."],
    aiOpen: ["Aparezca en las respuestas de IA", "Los rastreadores de IA pueden leer su sitio. Cada semana RepGet comprueba cómo describe Claude a {name}."],
    aiBlocked: ["Deje que los asistentes de IA lean su sitio", "Su robots.txt bloquea a {owners}. RepGet le indica qué cambiar y cada semana comprueba cómo describe Claude a {name}."],
    conversations: ["Participe en las conversaciones adecuadas", "RepGet prepara respuestas útiles y publicaciones breves para Reddit, X y Threads."],
  },
  cta: {
    title: "Ponga este plan en marcha",
    body: "Pruebe RepGet gratis durante {days} días.",
    start: "Empezar mi prueba gratuita",
    google: "Continuar con Google",
    plans: "Ver planes y precios",
    note: "Su sitio web ya está rellenado.",
  },
  another: "Revisar otro sitio web",
  stepOf: "Paso {index} de {total}",
  nav: {
    continue: "Continuar",
    back: "Atrás",
    pause: "Pausar",
    resume: "Reanudar",
    auto: "Continúa solo en unos segundos",
    held: "En pausa mientras lee",
    working: "Trabajando…",
    toBilling: "Elegir su plan",
    announce: "Paso {index} de {total}: {label}",
  },
  summary: {
    waiting: "A continuación",
    working: "Trabajando…",
    pages: "{score}/100 · {count} por corregir",
    pagesClean: "{score}/100 · sin problemas",
    pagesSkipped: "Revisión omitida",
    plan: "{count} acciones para su sitio",
    billingPick: "Elija un plan",
    billingChosen: "{plan} · {price}/mes",
  },
  billing: {
    heading: "Elija su plan",
    intro: "Elija cuánto hace RepGet por {name} cada mes. Los datos de pago vienen después, en una página segura.",
    options: "Planes",
    popular: "El más popular",
    perMonth: "/mes",
    yearly: "o {price}/mes con pago anual ({total}/año)",
    selected: "Seleccionado",
    orderTitle: "Su pedido",
    website: "Sitio web",
    plan: "Plan",
    today: "A pagar hoy",
    trial: "Prueba gratuita de {days} días para cuentas nuevas",
    then: "Después {price}/mes. Cancele en cualquier momento antes de que termine la prueba y no pagará nada.",
    noCard: "Sin tarjeta",
    methods: "Pague con tarjeta o PayPal",
    methodsCard: "Pague con tarjeta",
    card: "Tarjeta",
    paypal: "PayPal",
    secure: "Los datos de la tarjeta o de PayPal se introducen en la página segura de Stripe o PayPal, nunca en RepGet.",
    continue: "Crear cuenta y continuar",
    nextTitle: "Qué pasa después",
    next: ["Cree su cuenta con email o Google", "Confirme {host}, ya rellenado", "Añada los datos de pago en el pago seguro"],
  },
};

const fr: GrowthPlanCopy = {
  metaTitle: "Votre plan de croissance gratuit | RepGet",
  metaDescription: "Saisissez votre site et RepGet étudie votre activité, vérifie vos pages et prépare votre plan de croissance en une minute environ.",
  eyebrow: "Votre plan de croissance gratuit",
  title: "Découverte de {domain}",
  titleDone: "Votre plan de croissance pour {name} est prêt",
  intro: "RepGet lit votre site, vérifie vos pages et transforme ce qu'il trouve en plan. Cela prend environ une minute.",
  phases: ["Étudier votre activité", "Vérifier vos pages", "Préparer votre plan de croissance", "Choisir votre offre"],
  phasesLabel: "Progression",
  logTitle: "RepGet au travail",
  logLabel: "Ce que fait RepGet",
  log: {
    open: "Ouverture de {domain}",
    found: "Trouvé : {name}",
    platform: "Créé avec {platform}",
    language: "Rédigé en {language}",
    noPreview: "La page d'accueil a tardé à répondre, on continue",
    auditStart: "Vérification de {pages} pages au plus",
    auditWaiting: "Lecture des titres, descriptions, intertitres, liens et du robots.txt",
    pages: "Pages vérifiées : {count}",
    score: "Score SEO : {score}/100",
    problems: "Problèmes critiques : {critical} · Avertissements : {warnings}",
    crawlersOpen: "Robots d'IA : tous autorisés",
    crawlersBlocked: "Robots d'IA bloqués : {owners}",
    auditFailed: "Vérification des pages ignorée : {message}",
    planStart: "Rédaction de votre plan de croissance",
    planDone: "Plan prêt",
  },
  research: {
    heading: "Votre activité",
    loading: "Lecture de {domain}…",
    website: "Site web",
    platform: "Plateforme",
    language: "Langue",
    unknown: "Non indiqué",
    noDescription: "Votre page d'accueil ne décrit pas encore votre activité : c'est l'une des premières choses à corriger.",
  },
  audit: {
    heading: "Ce que nous avons trouvé sur vos pages",
    loading: "Vérification de vos pages. Cela peut prendre jusqu'à une minute.",
    checks: ["Titres et descriptions", "Intertitres et contenu", "Liens et images", "robots.txt et robots d'IA"],
    score: "Score SEO",
    pages: "Pages vérifiées",
    critical: "Critiques",
    warnings: "Avertissements",
    more: "+{count} autres constats dans votre compte",
    none: "Aucun problème sur les pages vérifiées.",
    failed: "Nous n'avons pas pu vérifier vos pages cette fois : {message}",
  },
  plan: {
    heading: "Votre plan de croissance",
    fix: ["Corrigez les {count} problèmes trouvés", "Chacun figure dans RepGet avec la façon de le corriger."],
    healthy: ["Gardez vos pages en bonne santé", "La vérification complète de RepGet lit bien plus de pages que celle-ci, gratuite."],
    articles: ["Un nouvel article SEO chaque jour", "Des sujets étudiés pour {name}, écrits pour Google et les réponses des IA, publiés sur votre site."],
    articlesIn: "Un nouvel article SEO chaque jour, en {language}",
    videos: ["Des vidéos et diaporamas pour vos réseaux", "Créés à partir du site de {name}, prêts à relire et à publier."],
    aiOpen: ["Apparaissez dans les réponses des IA", "Les robots d'IA peuvent lire votre site. Chaque semaine, RepGet vérifie comment Claude décrit {name}."],
    aiBlocked: ["Laissez les assistants IA lire votre site", "Votre robots.txt bloque {owners}. RepGet vous indique quoi modifier et vérifie chaque semaine comment Claude décrit {name}."],
    conversations: ["Participez aux bonnes conversations", "RepGet prépare des réponses utiles et des posts courts pour Reddit, X et Threads."],
  },
  cta: {
    title: "Mettez ce plan en œuvre",
    body: "Essayez RepGet gratuitement pendant {days} jours.",
    start: "Commencer mon essai gratuit",
    google: "Continuer avec Google",
    plans: "Voir les offres et les prix",
    note: "Votre site est déjà renseigné.",
  },
  another: "Vérifier un autre site",
  stepOf: "Étape {index} sur {total}",
  nav: {
    continue: "Continuer",
    back: "Retour",
    pause: "Pause",
    resume: "Reprendre",
    auto: "Continue tout seul dans quelques secondes",
    held: "En pause pendant votre lecture",
    working: "En cours…",
    toBilling: "Choisir votre offre",
    announce: "Étape {index} sur {total} : {label}",
  },
  summary: {
    waiting: "Ensuite",
    working: "En cours…",
    pages: "{score}/100 · {count} à corriger",
    pagesClean: "{score}/100 · aucun problème",
    pagesSkipped: "Vérification ignorée",
    plan: "{count} actions pour votre site",
    billingPick: "Choisissez une offre",
    billingChosen: "{plan} · {price}/mois",
  },
  billing: {
    heading: "Choisissez votre offre",
    intro: "Choisissez ce que RepGet fait pour {name} chaque mois. Les informations de paiement viennent ensuite, sur une page sécurisée.",
    options: "Offres",
    popular: "La plus choisie",
    perMonth: "/mois",
    yearly: "ou {price}/mois en paiement annuel ({total}/an)",
    selected: "Sélectionnée",
    orderTitle: "Votre commande",
    website: "Site web",
    plan: "Offre",
    today: "À payer aujourd’hui",
    trial: "Essai gratuit de {days} jours pour les nouveaux comptes",
    then: "Puis {price}/mois. Annulez à tout moment avant la fin de l’essai et vous ne payez rien.",
    noCard: "Sans carte bancaire",
    methods: "Payez par carte ou PayPal",
    methodsCard: "Payez par carte",
    card: "Carte",
    paypal: "PayPal",
    secure: "Les données de carte ou PayPal sont saisies sur la page sécurisée de Stripe ou PayPal, jamais sur RepGet.",
    continue: "Créer mon compte et continuer",
    nextTitle: "Et ensuite",
    next: ["Créez votre compte par e-mail ou avec Google", "Confirmez {host}, déjà renseigné", "Ajoutez vos informations de paiement sur la page sécurisée"],
  },
};

const it: GrowthPlanCopy = {
  metaTitle: "Il tuo piano di crescita gratuito | RepGet",
  metaDescription: "Inserisci il tuo sito e RepGet studia la tua attività, controlla le tue pagine e prepara il tuo piano di crescita in circa un minuto.",
  eyebrow: "Il tuo piano di crescita gratuito",
  title: "Conosciamo {domain}",
  titleDone: "Il tuo piano di crescita per {name} è pronto",
  intro: "RepGet sta leggendo il tuo sito, controllando le tue pagine e trasformando ciò che trova in un piano. Ci vuole circa un minuto.",
  phases: ["Studiare la tua attività", "Controllare le tue pagine", "Preparare il tuo piano di crescita", "Scegliere il tuo piano"],
  phasesLabel: "Avanzamento",
  logTitle: "RepGet al lavoro",
  logLabel: "Cosa sta facendo RepGet",
  log: {
    open: "Apertura di {domain}",
    found: "Trovato: {name}",
    platform: "Realizzato con {platform}",
    language: "Scritto in {language}",
    noPreview: "La homepage ha risposto lentamente, andiamo avanti",
    auditStart: "Controllo di massimo {pages} pagine",
    auditWaiting: "Lettura di titoli, descrizioni, intestazioni, link e robots.txt",
    pages: "Pagine controllate: {count}",
    score: "Punteggio SEO: {score}/100",
    problems: "Problemi critici: {critical} · Avvisi: {warnings}",
    crawlersOpen: "Crawler di IA: tutti ammessi",
    crawlersBlocked: "Crawler di IA bloccati: {owners}",
    auditFailed: "Controllo delle pagine saltato: {message}",
    planStart: "Scrittura del tuo piano di crescita",
    planDone: "Piano pronto",
  },
  research: {
    heading: "La tua attività",
    loading: "Lettura di {domain}…",
    website: "Sito web",
    platform: "Piattaforma",
    language: "Lingua",
    unknown: "Non indicato",
    noDescription: "La tua homepage non descrive ancora l'attività: è una delle prime cose da sistemare.",
  },
  audit: {
    heading: "Cosa abbiamo trovato nelle tue pagine",
    loading: "Controllo delle tue pagine. Può richiedere fino a un minuto.",
    checks: ["Titoli e descrizioni", "Intestazioni e contenuti", "Link e immagini", "robots.txt e crawler di IA"],
    score: "Punteggio SEO",
    pages: "Pagine controllate",
    critical: "Critici",
    warnings: "Avvisi",
    more: "+{count} altri risultati nel tuo account",
    none: "Nessun problema nelle pagine controllate.",
    failed: "Questa volta non siamo riusciti a controllare le tue pagine: {message}",
  },
  plan: {
    heading: "Il tuo piano di crescita",
    fix: ["Risolvi i {count} problemi trovati", "Ognuno è elencato in RepGet con le istruzioni per risolverlo."],
    healthy: ["Mantieni le tue pagine in salute", "Il controllo completo di RepGet legge molte più pagine di questo gratuito."],
    articles: ["Un nuovo articolo SEO ogni giorno", "Argomenti studiati per {name}, scritti per Google e per le risposte delle IA, pubblicati sul tuo sito."],
    articlesIn: "Un nuovo articolo SEO ogni giorno, in {language}",
    videos: ["Video e slideshow per i tuoi social", "Creati a partire dal sito di {name}, pronti da rivedere e pubblicare."],
    aiOpen: ["Compari nelle risposte delle IA", "I crawler di IA possono leggere il tuo sito. Ogni settimana RepGet controlla come Claude descrive {name}."],
    aiBlocked: ["Lascia che gli assistenti IA leggano il tuo sito", "Il tuo robots.txt blocca {owners}. RepGet ti mostra cosa cambiare e ogni settimana controlla come Claude descrive {name}."],
    conversations: ["Partecipa alle conversazioni giuste", "RepGet prepara risposte utili e brevi post per Reddit, X e Threads."],
  },
  cta: {
    title: "Metti in pratica questo piano",
    body: "Prova RepGet gratis per {days} giorni.",
    start: "Inizia la mia prova gratuita",
    google: "Continua con Google",
    plans: "Vedi piani e prezzi",
    note: "Il tuo sito è già inserito.",
  },
  another: "Controlla un altro sito",
  stepOf: "Passo {index} di {total}",
  nav: {
    continue: "Continua",
    back: "Indietro",
    pause: "Pausa",
    resume: "Riprendi",
    auto: "Prosegue da solo tra qualche secondo",
    held: "In pausa mentre leggi",
    working: "Al lavoro…",
    toBilling: "Scegli il tuo piano",
    announce: "Passo {index} di {total}: {label}",
  },
  summary: {
    waiting: "Dopo",
    working: "Al lavoro…",
    pages: "{score}/100 · {count} da correggere",
    pagesClean: "{score}/100 · nessun problema",
    pagesSkipped: "Controllo saltato",
    plan: "{count} azioni per il tuo sito",
    billingPick: "Scegli un piano",
    billingChosen: "{plan} · {price}/mese",
  },
  billing: {
    heading: "Scegli il tuo piano",
    intro: "Scegli quanto fa RepGet per {name} ogni mese. I dati di pagamento arrivano dopo, su una pagina sicura.",
    options: "Piani",
    popular: "Il più scelto",
    perMonth: "/mese",
    yearly: "oppure {price}/mese con pagamento annuale ({total}/anno)",
    selected: "Selezionato",
    orderTitle: "Il tuo ordine",
    website: "Sito web",
    plan: "Piano",
    today: "Da pagare oggi",
    trial: "Prova gratuita di {days} giorni per i nuovi account",
    then: "Poi {price}/mese. Annulla quando vuoi prima della fine della prova e non paghi nulla.",
    noCard: "Nessuna carta richiesta",
    methods: "Paga con carta o PayPal",
    methodsCard: "Paga con carta",
    card: "Carta",
    paypal: "PayPal",
    secure: "I dati della carta o di PayPal si inseriscono sulla pagina sicura di Stripe o PayPal, mai su RepGet.",
    continue: "Crea l’account e continua",
    nextTitle: "Cosa succede dopo",
    next: ["Crea il tuo account con email o Google", "Conferma {host}, già inserito", "Aggiungi i dati di pagamento nel checkout sicuro"],
  },
};

const de: GrowthPlanCopy = {
  metaTitle: "Ihr kostenloser Wachstumsplan | RepGet",
  metaDescription: "Geben Sie Ihre Website ein: RepGet analysiert Ihr Unternehmen, prüft Ihre Seiten und erstellt in etwa einer Minute Ihren Wachstumsplan.",
  eyebrow: "Ihr kostenloser Wachstumsplan",
  title: "Wir lernen {domain} kennen",
  titleDone: "Ihr Wachstumsplan für {name} ist fertig",
  intro: "RepGet liest Ihre Website, prüft Ihre Seiten und macht aus den Ergebnissen einen Plan. Das dauert etwa eine Minute.",
  phases: ["Ihr Unternehmen analysieren", "Ihre Seiten prüfen", "Ihren Wachstumsplan erstellen", "Ihren Plan wählen"],
  phasesLabel: "Fortschritt",
  logTitle: "RepGet bei der Arbeit",
  logLabel: "Was RepGet gerade tut",
  log: {
    open: "{domain} wird geöffnet",
    found: "Gefunden: {name}",
    platform: "Erstellt mit {platform}",
    language: "Sprache: {language}",
    noPreview: "Die Startseite hat langsam geantwortet, es geht weiter",
    auditStart: "Bis zu {pages} Seiten werden geprüft",
    auditWaiting: "Titel, Beschreibungen, Überschriften, Links und robots.txt werden gelesen",
    pages: "Geprüfte Seiten: {count}",
    score: "SEO-Wert: {score}/100",
    problems: "Kritische Probleme: {critical} · Warnungen: {warnings}",
    crawlersOpen: "KI-Crawler: alle zugelassen",
    crawlersBlocked: "Blockierte KI-Crawler: {owners}",
    auditFailed: "Seitenprüfung übersprungen: {message}",
    planStart: "Ihr Wachstumsplan wird geschrieben",
    planDone: "Plan fertig",
  },
  research: {
    heading: "Ihr Unternehmen",
    loading: "{domain} wird gelesen…",
    website: "Website",
    platform: "Plattform",
    language: "Sprache",
    unknown: "Nicht angegeben",
    noDescription: "Ihre Startseite beschreibt das Unternehmen noch nicht: Das ist eines der ersten Dinge, die Sie verbessern sollten.",
  },
  audit: {
    heading: "Was wir auf Ihren Seiten gefunden haben",
    loading: "Ihre Seiten werden geprüft. Das kann bis zu einer Minute dauern.",
    checks: ["Seitentitel und Beschreibungen", "Überschriften und Inhalte", "Links und Bilder", "robots.txt und KI-Crawler"],
    score: "SEO-Wert",
    pages: "Geprüfte Seiten",
    critical: "Kritisch",
    warnings: "Warnungen",
    more: "+{count} weitere Befunde in Ihrem Konto",
    none: "Keine Probleme auf den geprüften Seiten.",
    failed: "Ihre Seiten konnten diesmal nicht geprüft werden: {message}",
  },
  plan: {
    heading: "Ihr Wachstumsplan",
    fix: ["Beheben Sie die {count} gefundenen Probleme", "Jedes steht in RepGet, mit einer Anleitung zur Behebung."],
    healthy: ["Halten Sie Ihre Seiten in Form", "Die vollständige Prüfung von RepGet liest viel mehr Seiten als diese kostenlose."],
    articles: ["Jeden Tag ein neuer SEO-Artikel", "Recherchierte Themen für {name}, geschrieben für Google und KI-Antworten, veröffentlicht auf Ihrer Website."],
    articlesIn: "Jeden Tag ein neuer SEO-Artikel, auf {language}",
    videos: ["Videos und Slideshows für Ihre sozialen Kanäle", "Aus der eigenen Website von {name} erstellt, bereit zum Prüfen und Posten."],
    aiOpen: ["Erscheinen Sie in KI-Antworten", "KI-Crawler können Ihre Website lesen. Jede Woche prüft RepGet, wie Claude {name} beschreibt."],
    aiBlocked: ["Lassen Sie KI-Assistenten Ihre Website lesen", "Ihre robots.txt blockiert {owners}. RepGet zeigt, was zu ändern ist, und prüft jede Woche, wie Claude {name} beschreibt."],
    conversations: ["Beteiligen Sie sich an den richtigen Gesprächen", "RepGet bereitet hilfreiche Antworten und kurze Beiträge für Reddit, X und Threads vor."],
  },
  cta: {
    title: "Setzen Sie diesen Plan um",
    body: "Testen Sie RepGet {days} Tage kostenlos.",
    start: "Kostenlose Testphase starten",
    google: "Weiter mit Google",
    plans: "Pläne und Preise ansehen",
    note: "Ihre Website ist bereits eingetragen.",
  },
  another: "Andere Website prüfen",
  stepOf: "Schritt {index} von {total}",
  nav: {
    continue: "Weiter",
    back: "Zurück",
    pause: "Pause",
    resume: "Fortsetzen",
    auto: "Geht in wenigen Sekunden von selbst weiter",
    held: "Pausiert, während Sie lesen",
    working: "In Arbeit…",
    toBilling: "Plan wählen",
    announce: "Schritt {index} von {total}: {label}",
  },
  summary: {
    waiting: "Als Nächstes",
    working: "In Arbeit…",
    pages: "{score}/100 · {count} zu beheben",
    pagesClean: "{score}/100 · keine Probleme",
    pagesSkipped: "Prüfung übersprungen",
    plan: "{count} Maßnahmen für Ihre Website",
    billingPick: "Plan auswählen",
    billingChosen: "{plan} · {price}/Monat",
  },
  billing: {
    heading: "Wählen Sie Ihren Plan",
    intro: "Wählen Sie, wie viel RepGet jeden Monat für {name} erledigt. Die Zahlungsdaten folgen danach auf einer sicheren Seite.",
    options: "Pläne",
    popular: "Am beliebtesten",
    perMonth: "/Monat",
    yearly: "oder {price}/Monat bei jährlicher Zahlung ({total}/Jahr)",
    selected: "Ausgewählt",
    orderTitle: "Ihre Bestellung",
    website: "Website",
    plan: "Plan",
    today: "Heute fällig",
    trial: "{days} Tage kostenlos testen für neue Konten",
    then: "Danach {price}/Monat. Kündigen Sie jederzeit vor Ende des Tests und zahlen Sie nichts.",
    noCard: "Keine Karte nötig",
    methods: "Zahlen per Karte oder PayPal",
    methodsCard: "Zahlen per Karte",
    card: "Karte",
    paypal: "PayPal",
    secure: "Karten- und PayPal-Daten geben Sie auf der sicheren Seite von Stripe oder PayPal ein, nie bei RepGet.",
    continue: "Konto erstellen und weiter",
    nextTitle: "So geht es weiter",
    next: ["Konto per E-Mail oder Google erstellen", "{host} bestätigen, bereits eingetragen", "Zahlungsdaten im sicheren Checkout eingeben"],
  },
};

const COPY: Record<Locale, GrowthPlanCopy> = { en, es, fr, it, de };

export function growthPlanCopy(locale: Locale): GrowthPlanCopy {
  return COPY[locale];
}

/** Fills `{name}`-style placeholders; an unknown one is left as it is. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
