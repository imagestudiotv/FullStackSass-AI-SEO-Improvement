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
  /**
   * The steps, by id (growth-plan/flow-steps.ts): the three read from the
   * site, the plan to choose, the account (not for someone signed in on
   * arrival) and billing, the last one.
   */
  phases: { business: string; pages: string; plan: string; choose: string; account: string; billing: string };
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
   * The plan choice (step "choose"; the name is older than the billing step,
   * whose words are `checkout`). Payment details are never asked on RepGet:
   * the billing step hands over to Stripe's or PayPal's checkout, and every
   * promise matches the onboarding plan step's.
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
    /** The three steps after this one; the second says {host}. */
    next: [string, string, string];
  };
  /** Since 2026-11-20: the words around the steps once every step can be opened. */
  flow: {
    /** A read step whose answer waits for earlier work: what RepGet does next. {pages}, {domain}. */
    queuedPages: string;
    queuedPlan: string;
    /** Above the newest lines of the work log, inside a step still loading. */
    liveTitle: string;
    /** The step list's line for the account step, before and after: {email}. */
    accountTodo: string;
    accountDone: string;
    /** The step list's line for billing, before and after the account. */
    checkoutLocked: string;
    checkoutReady: string;
    /** The plan choice's line with yearly billing: {plan}, {price}. */
    chosenYearly: string;
    /** Continue's words on the plan choice: to the account step, or straight to billing when signed in. */
    toAccount: string;
    toCheckout: string;
    /** The yearly switch on the plan choice; {percent} is the real saving. */
    payYearly: string;
    save: string;
  };
  /** The account step: sign-up inside the flow, as /sign-up does it (the form's own words are the sign-up page's). */
  account: {
    heading: string;
    /** {host}. */
    intro: string;
    /** The first says {host}. */
    perks: [string, string, string];
    /** The same three when Free is chosen: no card, no payment page. */
    freePerks: [string, string, string];
    /** {email}. */
    signedIn: string;
    /** The link to the usual sign-up page, the fallback. */
    fallback: string;
  };
  /**
   * The billing step: the website added to the account, then Free started or
   * the paid plan's order and the existing Stripe and PayPal checkouts. Every
   * line about money is the onboarding plan step's rule (checkout-terms.ts).
   */
  checkout: {
    heading: string;
    /** {name}. */
    intro: string;
    /** {host}. */
    needAccount: string;
    /** {host}. */
    preparing: string;
    preparingDetail: string;
    /** {message}. */
    failed: string;
    retry: string;
    fallback: string;
    /** {host}. */
    hasPlan: string;
    hasPlanContinue: string;
    changePlan: string;
    billedMonthly: string;
    billedYearly: string;
    /** "Due today" when PayPal, unlike the card, would charge today. */
    todayCard: string;
    /** "{zero} today · {days} days free." */
    trialLine: string;
    /** {price}; the Repget ones also {percent}. */
    thenMonth: string;
    thenMonthRepget: string;
    thenYear: string;
    thenYearRepget: string;
    chargedMonth: string;
    chargedYear: string;
    startTrial: string;
    pay: string;
    starting: string;
    paypal: string;
    paypalStarting: string;
    /** The email code: {days}; {plan}; {email}. */
    emailTrial: string;
    emailFree: string;
    sendCode: string;
    sendTo: string;
    codeLabel: string;
    codePlaceholder: string;
    confirm: string;
    sentTo: string;
    resend: string;
    noticeSent: string;
    noticeConfirmed: string;
    noticeSendFailed: string;
    noticeInvalid: string;
    noticeExpired: string;
    /** When Free's launch spots are gone. */
    freeFull: string;
    /** {plan}. */
    startingFree: string;
  };
};

const en: GrowthPlanCopy = {
  metaTitle: "Your free growth plan | RepGet",
  metaDescription: "Enter your website and RepGet researches your business, checks your pages and builds your growth plan in about a minute.",
  eyebrow: "Your free growth plan",
  title: "Getting to know {domain}",
  titleDone: "Your growth plan for {name} is ready",
  intro: "RepGet is reading your website, checking your pages and turning what it finds into a plan. It takes about a minute.",
  phases: {
    business: "Research your business",
    pages: "Check your pages",
    plan: "Build your growth plan",
    choose: "Choose your plan",
    account: "Your account",
    billing: "Billing",
  },
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
    next: ["Create your account with email or Google, on the next step", "We add {host} to your account", "Pay on Stripe's or PayPal's secure page"],
  },
  flow: {
    queuedPages: "Next, RepGet checks up to {pages} pages of {domain}: titles, descriptions, headings, links and AI crawler access. It starts as soon as your business is read.",
    queuedPlan: "Next, RepGet turns what it found into a plan for your site. It starts as soon as your pages are checked.",
    liveTitle: "RepGet right now",
    accountTodo: "Email or Google",
    accountDone: "Signed in as {email}",
    checkoutLocked: "After your account",
    checkoutReady: "Order and payment",
    chosenYearly: "{plan} · {price}/month, yearly",
    toAccount: "Create your account",
    toCheckout: "Go to billing",
    payYearly: "Pay yearly",
    save: "save {percent}%",
  },
  account: {
    heading: "Create your account",
    intro: "Your growth plan for {host} goes into it. Billing is the next step, right here.",
    perks: ["We add {host} to your account for you", "Payment details only on Stripe's or PayPal's secure page", "Cancel anytime"],
    freePerks: ["We add {host} to your account for you", "No credit card needed for Free", "Upgrade anytime"],
    signedIn: "You are signed in as {email}.",
    fallback: "Prefer the usual sign-up page?",
  },
  checkout: {
    heading: "Billing",
    intro: "Your order for {name}. You start it here.",
    needAccount: "Create your account first: {host} and your plan are kept in it, then you start here.",
    preparing: "Adding {host} to your account…",
    preparingDetail: "As in setup: your website is created and RepGet starts analysing it.",
    failed: "Billing could not be prepared: {message}",
    retry: "Try again",
    fallback: "Continue on the usual setup pages",
    hasPlan: "{host} already has a plan. Setup carries on from here.",
    hasPlanContinue: "Continue setup",
    changePlan: "Change plan",
    billedMonthly: "Billed monthly",
    billedYearly: "Billed yearly",
    todayCard: "Due today by card",
    trialLine: "{zero} today · {days} days free.",
    thenMonth: "Then {price}/month, unless you cancel before the trial ends.",
    thenMonthRepget: "Then {price}/month with your {percent}% discount, unless you cancel before the trial ends.",
    thenYear: "Then {price}/year, unless you cancel before the trial ends.",
    thenYearRepget: "Then your discounted annual plan begins at the total shown at checkout, unless you cancel before the trial ends.",
    chargedMonth: "{price} a month, charged today. This workspace has already had its free trial.",
    chargedYear: "{price} a year, charged today. This workspace has already had its free trial.",
    startTrial: "Start free trial",
    pay: "Continue to payment",
    starting: "Starting checkout…",
    paypal: "Pay with PayPal",
    paypalStarting: "Redirecting to PayPal…",
    emailTrial: "Confirm your email to start your {days}-day free trial",
    emailFree: "Confirm your email to start {plan}",
    sendCode: "Email me a code",
    sendTo: "We send it to {email}.",
    codeLabel: "Confirmation code",
    codePlaceholder: "6-digit code",
    confirm: "Confirm",
    sentTo: "Sent to {email}.",
    resend: "Send a new code",
    noticeSent: "We sent a 6-digit code to {email}.",
    noticeConfirmed: "Email confirmed.",
    noticeSendFailed: "We could not send the code. Please try again in a minute.",
    noticeInvalid: "That code is not right. Check the email and try again.",
    noticeExpired: "That code no longer works. Send a new one.",
    freeFull: "Choose a paid plan",
    startingFree: "Starting {plan}…",
  },
};

const es: GrowthPlanCopy = {
  metaTitle: "Su plan de crecimiento gratuito | RepGet",
  metaDescription: "Introduzca su sitio web y RepGet investiga su negocio, revisa sus páginas y prepara su plan de crecimiento en un minuto.",
  eyebrow: "Su plan de crecimiento gratuito",
  title: "Conociendo {domain}",
  titleDone: "Su plan de crecimiento para {name} está listo",
  intro: "RepGet está leyendo su sitio web, revisando sus páginas y convirtiendo lo que encuentra en un plan. Tarda alrededor de un minuto.",
  phases: {
    business: "Investigar su negocio",
    pages: "Revisar sus páginas",
    plan: "Preparar su plan de crecimiento",
    choose: "Elegir su plan",
    account: "Su cuenta",
    billing: "Facturación",
  },
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
    next: ["Cree su cuenta con email o Google, en el siguiente paso", "Añadimos {host} a su cuenta", "Pague en la página segura de Stripe o PayPal"],
  },
  flow: {
    queuedPages: "Después, RepGet revisa hasta {pages} páginas de {domain}: títulos, descripciones, encabezados, enlaces y acceso de los rastreadores de IA. Empieza en cuanto termine de leer su negocio.",
    queuedPlan: "Después, RepGet convierte lo encontrado en un plan para su sitio. Empieza en cuanto se revisen sus páginas.",
    liveTitle: "RepGet ahora mismo",
    accountTodo: "Email o Google",
    accountDone: "Sesión iniciada como {email}",
    checkoutLocked: "Después de su cuenta",
    checkoutReady: "Pedido y pago",
    chosenYearly: "{plan} · {price}/mes, anual",
    toAccount: "Crear su cuenta",
    toCheckout: "Ir a facturación",
    payYearly: "Pago anual",
    save: "ahorre un {percent}%",
  },
  account: {
    heading: "Cree su cuenta",
    intro: "Su plan de crecimiento para {host} se guarda en ella. La facturación es el siguiente paso, aquí mismo.",
    perks: ["Añadimos {host} a su cuenta por usted", "Los datos de pago, solo en la página segura de Stripe o PayPal", "Cancele cuando quiera"],
    freePerks: ["Añadimos {host} a su cuenta por usted", "Sin tarjeta de crédito para el plan Free", "Mejore su plan cuando quiera"],
    signedIn: "Ha iniciado sesión como {email}.",
    fallback: "¿Prefiere la página de registro habitual?",
  },
  checkout: {
    heading: "Facturación",
    intro: "Su pedido para {name}. Lo inicia aquí.",
    needAccount: "Primero cree su cuenta: {host} y su plan se guardan en ella, y luego empieza aquí.",
    preparing: "Añadiendo {host} a su cuenta…",
    preparingDetail: "Como en la configuración: se crea su sitio web y RepGet empieza a analizarlo.",
    failed: "No se pudo preparar la facturación: {message}",
    retry: "Intentar de nuevo",
    fallback: "Continuar en las páginas de configuración habituales",
    hasPlan: "{host} ya tiene un plan. La configuración continúa desde aquí.",
    hasPlanContinue: "Continuar la configuración",
    changePlan: "Cambiar de plan",
    billedMonthly: "Facturación mensual",
    billedYearly: "Facturación anual",
    todayCard: "A pagar hoy con tarjeta",
    trialLine: "{zero} hoy · {days} días gratis.",
    thenMonth: "Después {price}/mes, salvo que cancele antes de que termine la prueba.",
    thenMonthRepget: "Después {price}/mes con su descuento del {percent}%, salvo que cancele antes de que termine la prueba.",
    thenYear: "Después {price}/año, salvo que cancele antes de que termine la prueba.",
    thenYearRepget: "Después empieza su plan anual con descuento, por el total que se muestra al pagar, salvo que cancele antes de que termine la prueba.",
    chargedMonth: "{price} al mes, cobrado hoy. Este espacio de trabajo ya tuvo su prueba gratuita.",
    chargedYear: "{price} al año, cobrado hoy. Este espacio de trabajo ya tuvo su prueba gratuita.",
    startTrial: "Empezar la prueba gratuita",
    pay: "Continuar al pago",
    starting: "Abriendo el pago…",
    paypal: "Pagar con PayPal",
    paypalStarting: "Redirigiendo a PayPal…",
    emailTrial: "Confirme su email para empezar su prueba gratuita de {days} días",
    emailFree: "Confirme su email para empezar {plan}",
    sendCode: "Enviarme un código",
    sendTo: "Lo enviamos a {email}.",
    codeLabel: "Código de confirmación",
    codePlaceholder: "Código de 6 dígitos",
    confirm: "Confirmar",
    sentTo: "Enviado a {email}.",
    resend: "Enviar un código nuevo",
    noticeSent: "Hemos enviado un código de 6 dígitos a {email}.",
    noticeConfirmed: "Email confirmado.",
    noticeSendFailed: "No pudimos enviar el código. Inténtelo de nuevo en un minuto.",
    noticeInvalid: "El código no es correcto. Revise el email e inténtelo de nuevo.",
    noticeExpired: "Ese código ya no sirve. Pida uno nuevo.",
    freeFull: "Elegir un plan de pago",
    startingFree: "Activando {plan}…",
  },
};

const fr: GrowthPlanCopy = {
  metaTitle: "Votre plan de croissance gratuit | RepGet",
  metaDescription: "Saisissez votre site et RepGet étudie votre activité, vérifie vos pages et prépare votre plan de croissance en une minute environ.",
  eyebrow: "Votre plan de croissance gratuit",
  title: "Découverte de {domain}",
  titleDone: "Votre plan de croissance pour {name} est prêt",
  intro: "RepGet lit votre site, vérifie vos pages et transforme ce qu'il trouve en plan. Cela prend environ une minute.",
  phases: {
    business: "Étudier votre activité",
    pages: "Vérifier vos pages",
    plan: "Préparer votre plan de croissance",
    choose: "Choisir votre offre",
    account: "Votre compte",
    billing: "Facturation",
  },
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
    next: ["Créez votre compte par e-mail ou avec Google, à l’étape suivante", "Nous ajoutons {host} à votre compte", "Payez sur la page sécurisée de Stripe ou PayPal"],
  },
  flow: {
    queuedPages: "Ensuite, RepGet vérifie jusqu’à {pages} pages de {domain} : titres, descriptions, intertitres, liens et accès des robots d’IA. Cela commence dès que votre activité est lue.",
    queuedPlan: "Ensuite, RepGet transforme ce qu’il a trouvé en plan pour votre site. Cela commence dès que vos pages sont vérifiées.",
    liveTitle: "RepGet en ce moment",
    accountTodo: "E-mail ou Google",
    accountDone: "Connecté en tant que {email}",
    checkoutLocked: "Après votre compte",
    checkoutReady: "Commande et paiement",
    chosenYearly: "{plan} · {price}/mois, annuel",
    toAccount: "Créer votre compte",
    toCheckout: "Aller à la facturation",
    payYearly: "Paiement annuel",
    save: "économisez {percent} %",
  },
  account: {
    heading: "Créez votre compte",
    intro: "Votre plan de croissance pour {host} y est enregistré. La facturation est l’étape suivante, ici même.",
    perks: ["Nous ajoutons {host} à votre compte pour vous", "Les informations de paiement uniquement sur la page sécurisée de Stripe ou PayPal", "Résiliable à tout moment"],
    freePerks: ["Nous ajoutons {host} à votre compte pour vous", "Aucune carte bancaire pour le plan Free", "Passez à une offre supérieure à tout moment"],
    signedIn: "Vous êtes connecté en tant que {email}.",
    fallback: "Vous préférez la page d’inscription habituelle ?",
  },
  checkout: {
    heading: "Facturation",
    intro: "Votre commande pour {name}. Vous la démarrez ici.",
    needAccount: "Créez d’abord votre compte : {host} et votre offre y sont enregistrés, puis vous démarrez ici.",
    preparing: "Ajout de {host} à votre compte…",
    preparingDetail: "Comme lors de la configuration : votre site est créé et RepGet commence à l’analyser.",
    failed: "La facturation n’a pas pu être préparée : {message}",
    retry: "Réessayer",
    fallback: "Continuer sur les pages de configuration habituelles",
    hasPlan: "{host} a déjà une offre. La configuration continue à partir d’ici.",
    hasPlanContinue: "Continuer la configuration",
    changePlan: "Changer d’offre",
    billedMonthly: "Facturé chaque mois",
    billedYearly: "Facturé chaque année",
    todayCard: "À payer aujourd’hui par carte",
    trialLine: "{zero} aujourd’hui · {days} jours gratuits.",
    thenMonth: "Puis {price}/mois, sauf si vous résiliez avant la fin de l’essai.",
    thenMonthRepget: "Puis {price}/mois avec votre remise de {percent} %, sauf si vous résiliez avant la fin de l’essai.",
    thenYear: "Puis {price}/an, sauf si vous résiliez avant la fin de l’essai.",
    thenYearRepget: "Puis votre offre annuelle remisée démarre au total indiqué au paiement, sauf si vous résiliez avant la fin de l’essai.",
    chargedMonth: "{price} par mois, débité aujourd’hui. Cet espace de travail a déjà eu son essai gratuit.",
    chargedYear: "{price} par an, débité aujourd’hui. Cet espace de travail a déjà eu son essai gratuit.",
    startTrial: "Commencer l’essai gratuit",
    pay: "Continuer vers le paiement",
    starting: "Ouverture du paiement…",
    paypal: "Payer avec PayPal",
    paypalStarting: "Redirection vers PayPal…",
    emailTrial: "Confirmez votre e-mail pour commencer votre essai gratuit de {days} jours",
    emailFree: "Confirmez votre e-mail pour démarrer {plan}",
    sendCode: "M’envoyer un code",
    sendTo: "Nous l’envoyons à {email}.",
    codeLabel: "Code de confirmation",
    codePlaceholder: "Code à 6 chiffres",
    confirm: "Confirmer",
    sentTo: "Envoyé à {email}.",
    resend: "Envoyer un nouveau code",
    noticeSent: "Nous avons envoyé un code à 6 chiffres à {email}.",
    noticeConfirmed: "E-mail confirmé.",
    noticeSendFailed: "Nous n’avons pas pu envoyer le code. Réessayez dans une minute.",
    noticeInvalid: "Ce code n’est pas le bon. Vérifiez l’e-mail et réessayez.",
    noticeExpired: "Ce code ne fonctionne plus. Demandez-en un nouveau.",
    freeFull: "Choisir une offre payante",
    startingFree: "Activation de {plan}…",
  },
};

const it: GrowthPlanCopy = {
  metaTitle: "Il tuo piano di crescita gratuito | RepGet",
  metaDescription: "Inserisci il tuo sito e RepGet studia la tua attività, controlla le tue pagine e prepara il tuo piano di crescita in circa un minuto.",
  eyebrow: "Il tuo piano di crescita gratuito",
  title: "Conosciamo {domain}",
  titleDone: "Il tuo piano di crescita per {name} è pronto",
  intro: "RepGet sta leggendo il tuo sito, controllando le tue pagine e trasformando ciò che trova in un piano. Ci vuole circa un minuto.",
  phases: {
    business: "Studiare la tua attività",
    pages: "Controllare le tue pagine",
    plan: "Preparare il tuo piano di crescita",
    choose: "Scegliere il tuo piano",
    account: "Il tuo account",
    billing: "Fatturazione",
  },
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
    next: ["Crea il tuo account con email o Google, al passo successivo", "Aggiungiamo {host} al tuo account", "Paga sulla pagina sicura di Stripe o PayPal"],
  },
  flow: {
    queuedPages: "Poi RepGet controlla fino a {pages} pagine di {domain}: titoli, descrizioni, intestazioni, link e accesso dei crawler AI. Inizia appena ha letto la tua attività.",
    queuedPlan: "Poi RepGet trasforma ciò che ha trovato in un piano per il tuo sito. Inizia appena le tue pagine sono controllate.",
    liveTitle: "RepGet in questo momento",
    accountTodo: "Email o Google",
    accountDone: "Accesso come {email}",
    checkoutLocked: "Dopo il tuo account",
    checkoutReady: "Ordine e pagamento",
    chosenYearly: "{plan} · {price}/mese, annuale",
    toAccount: "Crea il tuo account",
    toCheckout: "Vai alla fatturazione",
    payYearly: "Pagamento annuale",
    save: "risparmi il {percent}%",
  },
  account: {
    heading: "Crea il tuo account",
    intro: "Il tuo piano di crescita per {host} viene salvato qui. La fatturazione è il passo successivo, proprio qui.",
    perks: ["Aggiungiamo noi {host} al tuo account", "I dati di pagamento solo sulla pagina sicura di Stripe o PayPal", "Disdici quando vuoi"],
    freePerks: ["Aggiungiamo noi {host} al tuo account", "Nessuna carta di credito per il piano Free", "Passa a un piano superiore quando vuoi"],
    signedIn: "Hai effettuato l’accesso come {email}.",
    fallback: "Preferisci la solita pagina di registrazione?",
  },
  checkout: {
    heading: "Fatturazione",
    intro: "Il tuo ordine per {name}. Lo avvii qui.",
    needAccount: "Prima crea il tuo account: {host} e il tuo piano vengono salvati lì, poi inizi qui.",
    preparing: "Aggiunta di {host} al tuo account…",
    preparingDetail: "Come nella configurazione: il tuo sito viene creato e RepGet inizia ad analizzarlo.",
    failed: "Non è stato possibile preparare la fatturazione: {message}",
    retry: "Riprova",
    fallback: "Continua dalle solite pagine di configurazione",
    hasPlan: "{host} ha già un piano. La configurazione continua da qui.",
    hasPlanContinue: "Continua la configurazione",
    changePlan: "Cambia piano",
    billedMonthly: "Fatturato ogni mese",
    billedYearly: "Fatturato ogni anno",
    todayCard: "Da pagare oggi con carta",
    trialLine: "{zero} oggi · {days} giorni gratis.",
    thenMonth: "Poi {price}/mese, a meno che tu non disdica prima della fine della prova.",
    thenMonthRepget: "Poi {price}/mese con il tuo sconto del {percent}%, a meno che tu non disdica prima della fine della prova.",
    thenYear: "Poi {price}/anno, a meno che tu non disdica prima della fine della prova.",
    thenYearRepget: "Poi parte il tuo piano annuale scontato, al totale mostrato al pagamento, a meno che tu non disdica prima della fine della prova.",
    chargedMonth: "{price} al mese, addebitato oggi. Questo spazio di lavoro ha già avuto la sua prova gratuita.",
    chargedYear: "{price} all’anno, addebitato oggi. Questo spazio di lavoro ha già avuto la sua prova gratuita.",
    startTrial: "Inizia la prova gratuita",
    pay: "Continua al pagamento",
    starting: "Apertura del pagamento…",
    paypal: "Paga con PayPal",
    paypalStarting: "Reindirizzamento a PayPal…",
    emailTrial: "Conferma la tua email per iniziare la prova gratuita di {days} giorni",
    emailFree: "Conferma la tua email per iniziare {plan}",
    sendCode: "Inviami un codice",
    sendTo: "Lo inviamo a {email}.",
    codeLabel: "Codice di conferma",
    codePlaceholder: "Codice a 6 cifre",
    confirm: "Conferma",
    sentTo: "Inviato a {email}.",
    resend: "Invia un nuovo codice",
    noticeSent: "Abbiamo inviato un codice a 6 cifre a {email}.",
    noticeConfirmed: "Email confermata.",
    noticeSendFailed: "Non siamo riusciti a inviare il codice. Riprova tra un minuto.",
    noticeInvalid: "Il codice non è corretto. Controlla l’email e riprova.",
    noticeExpired: "Quel codice non è più valido. Richiedine uno nuovo.",
    freeFull: "Scegli un piano a pagamento",
    startingFree: "Attivazione di {plan}…",
  },
};

const de: GrowthPlanCopy = {
  metaTitle: "Ihr kostenloser Wachstumsplan | RepGet",
  metaDescription: "Geben Sie Ihre Website ein: RepGet analysiert Ihr Unternehmen, prüft Ihre Seiten und erstellt in etwa einer Minute Ihren Wachstumsplan.",
  eyebrow: "Ihr kostenloser Wachstumsplan",
  title: "Wir lernen {domain} kennen",
  titleDone: "Ihr Wachstumsplan für {name} ist fertig",
  intro: "RepGet liest Ihre Website, prüft Ihre Seiten und macht aus den Ergebnissen einen Plan. Das dauert etwa eine Minute.",
  phases: {
    business: "Ihr Unternehmen analysieren",
    pages: "Ihre Seiten prüfen",
    plan: "Ihren Wachstumsplan erstellen",
    choose: "Ihren Plan wählen",
    account: "Ihr Konto",
    billing: "Abrechnung",
  },
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
    next: ["Konto per E-Mail oder Google erstellen, im nächsten Schritt", "Wir fügen {host} Ihrem Konto hinzu", "Auf der sicheren Seite von Stripe oder PayPal bezahlen"],
  },
  flow: {
    queuedPages: "Danach prüft RepGet bis zu {pages} Seiten von {domain}: Titel, Beschreibungen, Überschriften, Links und den Zugang für KI-Crawler. Das beginnt, sobald Ihr Unternehmen gelesen ist.",
    queuedPlan: "Danach macht RepGet aus den Ergebnissen einen Plan für Ihre Website. Das beginnt, sobald Ihre Seiten geprüft sind.",
    liveTitle: "RepGet gerade jetzt",
    accountTodo: "E-Mail oder Google",
    accountDone: "Angemeldet als {email}",
    checkoutLocked: "Nach Ihrem Konto",
    checkoutReady: "Bestellung und Zahlung",
    chosenYearly: "{plan} · {price}/Monat, jährlich",
    toAccount: "Konto erstellen",
    toCheckout: "Zur Abrechnung",
    payYearly: "Jährlich zahlen",
    save: "{percent} % sparen",
  },
  account: {
    heading: "Erstellen Sie Ihr Konto",
    intro: "Ihr Wachstumsplan für {host} wird darin gespeichert. Die Abrechnung ist der nächste Schritt, gleich hier.",
    perks: ["Wir fügen {host} Ihrem Konto für Sie hinzu", "Zahlungsdaten nur auf der sicheren Seite von Stripe oder PayPal", "Jederzeit kündbar"],
    freePerks: ["Wir fügen {host} Ihrem Konto für Sie hinzu", "Für Free ist keine Kreditkarte nötig", "Jederzeit upgraden"],
    signedIn: "Sie sind angemeldet als {email}.",
    fallback: "Lieber die gewohnte Registrierungsseite?",
  },
  checkout: {
    heading: "Abrechnung",
    intro: "Ihre Bestellung für {name}. Sie starten sie hier.",
    needAccount: "Erstellen Sie zuerst Ihr Konto: {host} und Ihr Plan werden darin gespeichert, dann starten Sie hier.",
    preparing: "{host} wird Ihrem Konto hinzugefügt…",
    preparingDetail: "Wie bei der Einrichtung: Ihre Website wird angelegt und RepGet beginnt mit der Analyse.",
    failed: "Die Abrechnung konnte nicht vorbereitet werden: {message}",
    retry: "Erneut versuchen",
    fallback: "Auf den gewohnten Einrichtungsseiten fortfahren",
    hasPlan: "{host} hat bereits einen Plan. Die Einrichtung geht hier weiter.",
    hasPlanContinue: "Einrichtung fortsetzen",
    changePlan: "Plan ändern",
    billedMonthly: "Monatliche Abrechnung",
    billedYearly: "Jährliche Abrechnung",
    todayCard: "Heute fällig per Karte",
    trialLine: "{zero} heute · {days} Tage kostenlos.",
    thenMonth: "Danach {price}/Monat, sofern Sie nicht vor Ende der Testphase kündigen.",
    thenMonthRepget: "Danach {price}/Monat mit Ihrem Rabatt von {percent} %, sofern Sie nicht vor Ende der Testphase kündigen.",
    thenYear: "Danach {price}/Jahr, sofern Sie nicht vor Ende der Testphase kündigen.",
    thenYearRepget: "Danach beginnt Ihr rabattierter Jahresplan zum beim Bezahlen angezeigten Gesamtbetrag, sofern Sie nicht vor Ende der Testphase kündigen.",
    chargedMonth: "{price} pro Monat, heute abgebucht. Dieser Workspace hatte seine kostenlose Testphase bereits.",
    chargedYear: "{price} pro Jahr, heute abgebucht. Dieser Workspace hatte seine kostenlose Testphase bereits.",
    startTrial: "Kostenlose Testphase starten",
    pay: "Weiter zur Zahlung",
    starting: "Zahlung wird geöffnet…",
    paypal: "Mit PayPal bezahlen",
    paypalStarting: "Weiterleitung zu PayPal…",
    emailTrial: "Bestätigen Sie Ihre E-Mail, um Ihre {days}-tägige kostenlose Testphase zu starten",
    emailFree: "Bestätigen Sie Ihre E-Mail, um {plan} zu starten",
    sendCode: "Code per E-Mail senden",
    sendTo: "Wir senden ihn an {email}.",
    codeLabel: "Bestätigungscode",
    codePlaceholder: "6-stelliger Code",
    confirm: "Bestätigen",
    sentTo: "Gesendet an {email}.",
    resend: "Neuen Code senden",
    noticeSent: "Wir haben einen 6-stelligen Code an {email} gesendet.",
    noticeConfirmed: "E-Mail bestätigt.",
    noticeSendFailed: "Der Code konnte nicht gesendet werden. Bitte versuchen Sie es in einer Minute erneut.",
    noticeInvalid: "Der Code stimmt nicht. Prüfen Sie die E-Mail und versuchen Sie es erneut.",
    noticeExpired: "Dieser Code gilt nicht mehr. Fordern Sie einen neuen an.",
    freeFull: "Einen kostenpflichtigen Plan wählen",
    startingFree: "{plan} wird gestartet…",
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
