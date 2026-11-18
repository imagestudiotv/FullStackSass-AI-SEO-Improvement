import type { Locale } from "@/lib/i18n/config";

/**
 * The homepage's "Top features" shell (client's design, 2026-11-18,
 * repget_features_premium.html): nine capabilities, each with its nav line,
 * headline, description, perks and the words of its drawn product preview,
 * in every language.
 *
 * The design overclaimed in places; these words say what RepGet does:
 *  - AI visibility asks Claude only (lib/geo/check.ts ENGINE), weekly
 *    (inngest/functions/check-geo.ts). The other rows are the audit's AI
 *    crawler check (lib/audit/ai-crawlers.ts) and the free llms.txt tool.
 *  - Replies in other people's discussions are posted by the customer, in
 *    one click (lib/social/platforms.ts); RepGet publishes own posts.
 *  - Videos: 20 ideas a day (lib/video/formats.ts IDEAS_PER_DAY); the ones
 *    approved become reels, Stories or carousels.
 *  - Backlinks: niche-matched sites, links inside real articles, checked
 *    daily, credits back when one is removed (lib/backlinks, backlinkExchange).
 *  - The audit checks indexing, titles, headings and links, not schema
 *    (lib/audit/rules.ts ISSUE_LABELS); nothing reads business listings.
 *  - Growth Copilot proposes and the customer confirms
 *    (lib/chat/actions-catalog.ts); there is no weekly plan.
 * The figures in the previews (91 / 100, 12.8k, 07 ...) are samples and are
 * labelled so.
 */

type Pair = [string, string];
type Triple = [string, string, string];

/** What every capability has: its tab, the panel's head and the perks under it. */
export type FeatureBase = {
  /** The tab's name in the list on the left. */
  nav: string;
  /** The tab's small second line. */
  navSub: string;
  /** The breadcrumb's last part (drawn upper-case). */
  category: string;
  /** Two lines; the second is drawn in the gradient. */
  headline: Pair;
  description: string;
  /** The preview window's title bar. */
  studio: string;
  /** Under the icon beside the headline (drawn upper-case). */
  tag: string;
  perks: Triple;
};

export type FeaturesCopy = {
  /** The section's h2, over the tab list ("EXPLORE THE PLATFORM"). */
  eyebrow: string;
  count: string;
  engineTitle: string;
  engineLine: string;
  workspace: string;
  preview: string;
  /** The preview label on phones. */
  previewShort: string;
  /** The four story bullets, as a group. */
  highlights: string;
  /** One bullet; {n} its number, {label} the capability. */
  jump: string;
  scroll: string;
  next: string;
  cta: string;
  social: FeatureBase & {
    posterTop: string;
    poster: Pair;
    format: string;
    queueTitle: string;
    queueCount: string;
    /** Name, what is in it, status: Ready, Review, Ready, Scheduled. */
    rows: [Triple, Triple, Triple, Triple];
    footer: string;
  };
  conversations: FeatureBase & {
    sourceNote: string;
    question: string;
    fit: string;
    replyLabel: string;
    reply: string;
    status: string;
    queue: string;
    found: string;
    queueText: string;
    rows: [Pair, Pair, Pair];
  };
  seo: FeatureBase & {
    crumb: string;
    title: string;
    abstract: string;
    sections: string;
    status: string;
    cluster: string;
    keywords: Triple;
    calendar: string;
    calendarNote: string;
  };
  backlinks: FeatureBase & {
    /** The network's nodes: two above, the centre, two below. */
    nodes: [string, string, string, string, string];
    foot: string;
    kicker: string;
    title: string;
    pill: string;
    quality: string;
    qualityNote: string;
    steps: Triple;
    notice: string;
  };
  ai: FeatureBase & {
    answerTitle: string;
    illustration: string;
    question: string;
    sample: string;
    answer: string;
    domain: string;
    domainNote: string;
    citation: string;
    opsTitle: string;
    opsText: string;
    rows: [Pair, Pair, Pair];
  };
  marketing: FeatureBase & {
    review: string;
    found: string;
    siteLabel: string;
    site: Pair;
    siteText: string;
    fixes: [Pair, Pair, Pair];
  };
  technical: FeatureBase & {
    kicker: string;
    title: string;
    rows: [Pair, Pair, Pair];
    review: string;
    scoreLabel: string;
    scoreText: string;
    first: string;
  };
  analytics: FeatureBase & {
    graphTitle: string;
    graphNote: string;
    trend: string;
    value: string;
    change: string;
    weeks: [string, string, string, string];
    search: string;
    searchValue: string;
    searchNote: string;
    ai: string;
    aiNote: string;
    next: string;
    nextText: string;
  };
  copilot: FeatureBase & {
    kicker: string;
    title: string;
    rows: [Pair, Pair, Pair];
    sideTitle: string;
    sideText: string;
  };
};

/** The capabilities in the design's order. */
export const FEATURE_KEYS = [
  "social",
  "conversations",
  "seo",
  "backlinks",
  "ai",
  "marketing",
  "technical",
  "analytics",
  "copilot",
] as const satisfies readonly (keyof FeaturesCopy)[];

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** The four the scroll story steps through (social, backlinks, AI, analytics). */
export const FEATURE_HIGHLIGHTS = [0, 3, 4, 7] as const;

const en: FeaturesCopy = {
  eyebrow: "Explore the platform",
  count: "9 capabilities",
  engineTitle: "One connected growth engine.",
  engineLine: "Content · SEO · Authority · AI",
  workspace: "The growth workspace",
  preview: "Illustrative product preview",
  previewShort: "Demo preview",
  highlights: "Scroll highlights",
  jump: "Jump to highlight {n}: {label}",
  scroll: "Scroll to explore",
  next: "Next feature",
  cta: "Start free trial",
  social: {
    nav: "Social content",
    navSub: "Create · adapt · publish",
    category: "Social content",
    headline: ["Create once.", "Show up everywhere."],
    description:
      "20 new ideas a day from your website. The ones you approve become short videos, Stories and carousels for Instagram, TikTok, YouTube and Facebook, published from one place.",
    studio: "Content Studio",
    tag: "Create & distribute",
    perks: ["One creative workflow", "Made for each platform", "Review before publishing"],
    posterTop: "REPGET / STUDIO",
    poster: ["Your brand.", "Everywhere."],
    format: "Short video · 9:16",
    queueTitle: "Your content, adapted.",
    queueCount: "4 channel previews",
    rows: [
      ["Instagram Reel", "Caption + video", "Ready"],
      ["TikTok video", "Vertical video + hook", "Review"],
      ["YouTube Short", "Title + description", "Ready"],
      ["Facebook carousel", "Slides + caption", "Scheduled"],
    ],
    footer: "Approve content before it goes live",
  },
  conversations: {
    nav: "Social conversations",
    navSub: "Reddit · X · Threads",
    category: "Social opportunities",
    headline: ["Find the right conversations.", "Join with confidence."],
    description:
      "Discover relevant discussions and prepare useful, native replies. You stay in control of what gets posted.",
    studio: "Opportunity Inbox",
    tag: "Discover & respond",
    perks: ["Relevant opportunities", "Draft helpful replies", "You post in one click"],
    sourceNote: "Example conversation",
    question: "“How do small businesses get found in AI search?”",
    fit: "A conversation that matches your business and your expertise.",
    replyLabel: "Suggested reply",
    reply:
      "Start with clear service pages, specific answers and credible sources. Then check whether AI assistants mention you, and fill the gaps.",
    status: "Ready for you to post",
    queue: "Opportunity queue",
    found: "3 found",
    queueText: "Relevant discussions, gathered in one place.",
    rows: [
      ["Reddit · Search visibility", "Draft reply ready to review"],
      ["X · Content automation", "A new topic to consider"],
      ["Threads · Founder growth", "Start a useful conversation"],
    ],
  },
  seo: {
    nav: "SEO content engine",
    navSub: "Research · write · publish",
    category: "Search content",
    headline: ["Turn search demand.", "Into great content."],
    description:
      "Build a consistent publishing engine with researched topics, AI-written drafts and publishing straight to your site.",
    studio: "Content Planner",
    tag: "Research & publish",
    perks: ["Keyword opportunities", "Editorial workflow", "CMS publishing"],
    crumb: "Article draft / Search opportunity",
    title: "How to become more visible in Google and AI answers",
    abstract: "A structured article with a useful outline, clear entity signals and a search-focused editorial plan.",
    sections: "Key sections",
    status: "Draft ready for review",
    cluster: "Topic cluster",
    keywords: ["AI visibility", "Brand mentions", "Organic search"],
    calendar: "Publishing calendar",
    calendarNote: "Illustrative queued topics",
  },
  backlinks: {
    nav: "Backlink network",
    navSub: "Relevance · checks · authority",
    category: "Backlinks & authority",
    headline: ["Build links.", "Build lasting authority."],
    description:
      "Earn links from businesses in a related field, each one written into a real article on their website and checked every day.",
    studio: "Authority Network",
    tag: "Match & verify",
    perks: ["Related sites only", "Inside real articles", "Checked every day"],
    nodes: ["Related business", "Niche match", "Your website", "Real article", "Checked daily"],
    foot: "Only connections that make sense for your business",
    kicker: "Your authority workflow",
    title: "Earn meaningful mentions.",
    pill: "Network",
    quality: "Relevance comes first",
    qualityNote: "Matched by niche, never at random",
    steps: ["Matched with a related site", "Link written into a real article", "Checked every day"],
    notice: "Credits back if a link is removed",
  },
  ai: {
    nav: "AI search visibility",
    navSub: "Mentions · citations · GEO",
    category: "AI search visibility",
    headline: ["Don’t just rank.", "Become part of the answer."],
    description:
      "Check every week whether Claude recommends your business for the questions your customers ask, see who it names instead, and make sure AI crawlers can read your site.",
    studio: "AI Visibility Monitor",
    tag: "Monitor & improve",
    perks: ["Track AI mentions", "See who is named instead", "Check AI crawler access"],
    answerTitle: "Example AI answer",
    illustration: "Illustration",
    question: "“Which tools help a brand grow across SEO and social?”",
    sample: "Sample response",
    answer:
      "A connected growth platform can combine content planning, social publishing, website SEO and authority building. Helpful comparison pages and well-structured brand information may make a site easier to understand.",
    domain: "yourbrand.com",
    domainNote: "Example of a possible cited source",
    citation: "Citation",
    opsTitle: "Understand your AI presence.",
    opsText: "Track your visibility and spot the gaps, week by week.",
    rows: [
      ["Claude", "Weekly mention check"],
      ["AI crawlers", "robots.txt access"],
      ["llms.txt", "Free generator"],
    ],
  },
  marketing: {
    nav: "Marketing improvements",
    navSub: "Copy · titles · conversion",
    category: "Marketing opportunities",
    headline: ["Make every visit.", "Count for more."],
    description:
      "Spot practical improvements that turn more visits into customers: titles Google shows but few people click, and a clearer offer and call to action on your homepage.",
    studio: "Growth Recommendations",
    tag: "Audit & optimize",
    perks: ["Actionable opportunities", "Clearer messaging", "Prioritized improvements"],
    review: "Homepage review",
    found: "Improvement found",
    siteLabel: "Your site / Suggested copy",
    site: ["Get discovered.", "Grow everywhere."],
    siteText: "A clearer promise, supported by proof and one obvious next step.",
    fixes: [
      ["Clarify your main offer", "Lead with the outcome, not only product features"],
      ["Focus your call to action", "Make the next step obvious"],
      ["Rewrite titles that get few clicks", "Seen often in Google, rarely clicked"],
    ],
  },
  technical: {
    nav: "Technical SEO",
    navSub: "Indexing · metadata · health",
    category: "Technical SEO",
    headline: ["Remove the friction.", "Get discovered."],
    description:
      "Understand technical blockers, review search readiness and prioritize the fixes that help platforms find and understand your site.",
    studio: "Site Health Audit",
    tag: "Diagnose & improve",
    perks: ["Technical site audits", "Titles & descriptions", "Prioritized fixes"],
    kicker: "Site audit / Example",
    title: "Make your site search-ready.",
    rows: [
      ["Indexing readiness", "Noindex tags, canonicals and broken pages"],
      ["Page discoverability", "Titles, headings and internal links"],
      ["AI crawler access", "What your robots.txt allows"],
    ],
    review: "Review",
    scoreLabel: "Illustrative site health",
    scoreText: "A single place to see what needs attention and where to begin.",
    first: "Fix high-impact issues first",
  },
  analytics: {
    nav: "Analytics & growth",
    navSub: "Measure · learn · improve",
    category: "Connected analytics",
    headline: ["See what works.", "Do more of it."],
    description:
      "Search Console, Google Analytics, your articles, backlinks and AI visibility in one view. Understand your progress and make the next decision with clarity.",
    studio: "Growth Overview",
    tag: "Measure & learn",
    perks: ["Connected reporting", "Search Console & Analytics", "Practical next steps"],
    graphTitle: "Clicks from Google",
    graphNote: "Illustrative performance trend",
    trend: "↗ Trending up",
    value: "12.8k",
    change: "+24% sample",
    weeks: ["Week 1", "Week 4", "Week 8", "Week 12"],
    search: "Search",
    searchValue: "↗ 18%",
    searchNote: "Illustrative trend",
    ai: "AI visibility",
    aiNote: "Sample tracked questions",
    next: "Next opportunity",
    nextText: "Expand on the topics bringing qualified interest.",
  },
  copilot: {
    nav: "AI Growth Copilot",
    navSub: "Strategy · priorities · actions",
    category: "Your AI growth copilot",
    headline: ["An AI growth partner.", "Not another dashboard."],
    description:
      "Turn your data and goals into a clear set of next steps across SEO, social, content and brand visibility.",
    studio: "Growth Copilot",
    tag: "Plan & act",
    perks: ["Recommendations", "Clear priorities", "You confirm every action"],
    kicker: "Suggested next steps / Demo",
    title: "Here’s what to focus on next.",
    rows: [
      ["Strengthen one high-intent page", "Clarify the value proposition and next step"],
      ["Publish a useful search answer", "Address a question your audience asks"],
      ["Join two relevant conversations", "Review suggested replies before posting"],
    ],
    sideTitle: "One plan. Every channel.",
    sideText: "Use your connected data to make smarter marketing decisions, with control over every proposed action.",
  },
};

const es: FeaturesCopy = {
  eyebrow: "Explore la plataforma",
  count: "9 funciones",
  engineTitle: "Un único motor de crecimiento conectado.",
  engineLine: "Contenido · SEO · Autoridad · IA",
  workspace: "El espacio de crecimiento",
  preview: "Vista previa ilustrativa del producto",
  previewShort: "Vista de demostración",
  highlights: "Puntos destacados",
  jump: "Ir al punto destacado {n}: {label}",
  scroll: "Desplácese para explorar",
  next: "Siguiente función",
  cta: "Empezar la prueba gratis",
  social: {
    nav: "Contenido social",
    navSub: "Crear · adaptar · publicar",
    category: "Contenido social",
    headline: ["Cree una vez.", "Aparezca en todas partes."],
    description:
      "20 ideas nuevas al día a partir de su sitio web. Las que apruebe se convierten en vídeos cortos, Stories y carruseles para Instagram, TikTok, YouTube y Facebook, publicados desde un solo lugar.",
    studio: "Estudio de contenido",
    tag: "Crear y distribuir",
    perks: ["Un solo flujo creativo", "Pensado para cada plataforma", "Revisión antes de publicar"],
    posterTop: "REPGET / ESTUDIO",
    poster: ["Su marca.", "En todas partes."],
    format: "Vídeo corto · 9:16",
    queueTitle: "Su contenido, adaptado.",
    queueCount: "4 vistas previas por canal",
    rows: [
      ["Reel de Instagram", "Texto + vídeo", "Listo"],
      ["Vídeo de TikTok", "Vídeo vertical + gancho", "Revisar"],
      ["YouTube Short", "Título + descripción", "Listo"],
      ["Carrusel de Facebook", "Diapositivas + texto", "Programado"],
    ],
    footer: "Apruebe el contenido antes de que se publique",
  },
  conversations: {
    nav: "Conversaciones sociales",
    navSub: "Reddit · X · Threads",
    category: "Oportunidades sociales",
    headline: ["Encuentre las conversaciones adecuadas.", "Participe con confianza."],
    description:
      "Descubra debates relevantes y prepare respuestas útiles y naturales. Usted decide qué se publica.",
    studio: "Bandeja de oportunidades",
    tag: "Descubrir y responder",
    perks: ["Oportunidades relevantes", "Borradores de respuestas útiles", "Usted publica con un clic"],
    sourceNote: "Conversación de ejemplo",
    question: "“¿Cómo consiguen las pequeñas empresas aparecer en la búsqueda con IA?”",
    fit: "Una conversación que encaja con su negocio y su experiencia.",
    replyLabel: "Respuesta sugerida",
    reply:
      "Empiece por páginas de servicios claras, respuestas concretas y fuentes fiables. Después compruebe si los asistentes de IA le mencionan y cubra lo que falte.",
    status: "Lista para que usted la publique",
    queue: "Cola de oportunidades",
    found: "3 encontradas",
    queueText: "Debates relevantes, reunidos en un solo lugar.",
    rows: [
      ["Reddit · Visibilidad en buscadores", "Borrador de respuesta listo para revisar"],
      ["X · Automatización de contenido", "Un tema nuevo a considerar"],
      ["Threads · Crecimiento para fundadores", "Inicie una conversación útil"],
    ],
  },
  seo: {
    nav: "Motor de contenido SEO",
    navSub: "Investigar · escribir · publicar",
    category: "Contenido para búsqueda",
    headline: ["Convierta lo que se busca", "en contenido que funciona."],
    description:
      "Cree un motor de publicación constante con temas investigados, borradores escritos con IA y publicación directa en su sitio.",
    studio: "Planificador de contenido",
    tag: "Investigar y publicar",
    perks: ["Oportunidades de palabras clave", "Flujo editorial", "Publicación en su CMS"],
    crumb: "Borrador de artículo / Oportunidad de búsqueda",
    title: "Cómo ganar visibilidad en Google y en las respuestas de IA",
    abstract: "Un artículo estructurado con un esquema útil, señales de entidad claras y un plan editorial orientado a la búsqueda.",
    sections: "Secciones clave",
    status: "Borrador listo para revisar",
    cluster: "Grupo de temas",
    keywords: ["Visibilidad en IA", "Menciones de marca", "Búsqueda orgánica"],
    calendar: "Calendario de publicación",
    calendarNote: "Temas en cola, a modo ilustrativo",
  },
  backlinks: {
    nav: "Red de backlinks",
    navSub: "Relevancia · controles · autoridad",
    category: "Backlinks y autoridad",
    headline: ["Consiga enlaces.", "Construya una autoridad duradera."],
    description:
      "Gane enlaces de negocios de un sector afín, cada uno integrado en un artículo real de su sitio web y comprobado cada día.",
    studio: "Red de autoridad",
    tag: "Emparejar y verificar",
    perks: ["Solo sitios afines", "Dentro de artículos reales", "Comprobados cada día"],
    nodes: ["Negocio afín", "Mismo nicho", "Su sitio web", "Artículo real", "Comprobado a diario"],
    foot: "Solo conexiones que tienen sentido para su negocio",
    kicker: "Su flujo de autoridad",
    title: "Consiga menciones que cuentan.",
    pill: "Red",
    quality: "La relevancia, primero",
    qualityNote: "Emparejado por nicho, nunca al azar",
    steps: ["Emparejado con un sitio afín", "Enlace integrado en un artículo real", "Comprobado cada día"],
    notice: "Le devolvemos los créditos si se retira un enlace",
  },
  ai: {
    nav: "Visibilidad en búsqueda con IA",
    navSub: "Menciones · citas · GEO",
    category: "Visibilidad en búsqueda con IA",
    headline: ["No se limite a posicionarse.", "Forme parte de la respuesta."],
    description:
      "Compruebe cada semana si Claude recomienda su negocio para las preguntas de sus clientes, vea a quién nombra en su lugar y asegúrese de que los rastreadores de IA pueden leer su sitio.",
    studio: "Monitor de visibilidad en IA",
    tag: "Medir y mejorar",
    perks: ["Siga sus menciones en IA", "Vea a quién se nombra en su lugar", "Acceso de los rastreadores de IA"],
    answerTitle: "Respuesta de IA de ejemplo",
    illustration: "Ilustración",
    question: "“¿Qué herramientas ayudan a una marca a crecer en SEO y redes sociales?”",
    sample: "Respuesta de ejemplo",
    answer:
      "Una plataforma de crecimiento conectada puede combinar planificación de contenido, publicación en redes sociales, SEO del sitio web y construcción de autoridad. Las páginas comparativas útiles y una información de marca bien estructurada pueden hacer que un sitio sea más fácil de entender.",
    domain: "sumarca.com",
    domainNote: "Ejemplo de una posible fuente citada",
    citation: "Cita",
    opsTitle: "Entienda su presencia en la IA.",
    opsText: "Siga su visibilidad y detecte lo que falta, semana a semana.",
    rows: [
      ["Claude", "Control semanal de menciones"],
      ["Rastreadores de IA", "Acceso en robots.txt"],
      ["llms.txt", "Generador gratuito"],
    ],
  },
  marketing: {
    nav: "Mejoras de marketing",
    navSub: "Textos · títulos · conversión",
    category: "Oportunidades de marketing",
    headline: ["Haga que cada visita", "cuente más."],
    description:
      "Detecte mejoras prácticas que convierten más visitas en clientes: títulos que Google muestra pero en los que pocos hacen clic, y una oferta y una llamada a la acción más claras en su página de inicio.",
    studio: "Recomendaciones de crecimiento",
    tag: "Auditar y optimizar",
    perks: ["Oportunidades concretas", "Mensajes más claros", "Mejoras por prioridad"],
    review: "Revisión de la página de inicio",
    found: "Mejora detectada",
    siteLabel: "Su sitio / Texto sugerido",
    site: ["Hágase descubrir.", "Crezca en todas partes."],
    siteText: "Una promesa más clara, respaldada por pruebas y con un siguiente paso evidente.",
    fixes: [
      ["Aclare su oferta principal", "Empiece por el resultado, no solo por las funciones"],
      ["Centre su llamada a la acción", "Haga evidente el siguiente paso"],
      ["Reescriba los títulos con pocos clics", "Se ven a menudo en Google, se pulsan poco"],
    ],
  },
  technical: {
    nav: "SEO técnico",
    navSub: "Indexación · metadatos · salud",
    category: "SEO técnico",
    headline: ["Elimine los obstáculos.", "Hágase descubrir."],
    description:
      "Entienda los bloqueos técnicos, revise si su sitio está listo para la búsqueda y priorice las correcciones que ayudan a las plataformas a encontrarlo y entenderlo.",
    studio: "Auditoría de salud del sitio",
    tag: "Diagnosticar y mejorar",
    perks: ["Auditorías técnicas del sitio", "Títulos y descripciones", "Correcciones por prioridad"],
    kicker: "Auditoría del sitio / Ejemplo",
    title: "Prepare su sitio para la búsqueda.",
    rows: [
      ["Preparación para la indexación", "Etiquetas noindex, canónicas y páginas rotas"],
      ["Visibilidad de las páginas", "Títulos, encabezados y enlaces internos"],
      ["Acceso de los rastreadores de IA", "Lo que permite su robots.txt"],
    ],
    review: "Revisar",
    scoreLabel: "Salud del sitio ilustrativa",
    scoreText: "Un solo lugar para ver qué necesita atención y por dónde empezar.",
    first: "Corrija primero lo de mayor impacto",
  },
  analytics: {
    nav: "Analítica y crecimiento",
    navSub: "Medir · aprender · mejorar",
    category: "Analítica conectada",
    headline: ["Vea qué funciona.", "Haga más de eso."],
    description:
      "Search Console, Google Analytics, sus artículos, backlinks y su visibilidad en IA en una sola vista. Entienda su progreso y tome la siguiente decisión con claridad.",
    studio: "Resumen de crecimiento",
    tag: "Medir y aprender",
    perks: ["Informes conectados", "Search Console y Analytics", "Próximos pasos prácticos"],
    graphTitle: "Clics desde Google",
    graphNote: "Tendencia ilustrativa",
    trend: "↗ Al alza",
    value: "12,8 k",
    change: "+24 % de ejemplo",
    weeks: ["Semana 1", "Semana 4", "Semana 8", "Semana 12"],
    search: "Búsqueda",
    searchValue: "↗ 18 %",
    searchNote: "Tendencia ilustrativa",
    ai: "Visibilidad en IA",
    aiNote: "Preguntas seguidas de ejemplo",
    next: "Próxima oportunidad",
    nextText: "Amplíe los temas que atraen interés cualificado.",
  },
  copilot: {
    nav: "Growth Copilot con IA",
    navSub: "Estrategia · prioridades · acciones",
    category: "Su copiloto de crecimiento con IA",
    headline: ["Un socio de crecimiento con IA.", "No otro panel más."],
    description:
      "Convierta sus datos y objetivos en un conjunto claro de próximos pasos en SEO, redes sociales, contenido y visibilidad de marca.",
    studio: "Growth Copilot",
    tag: "Planificar y actuar",
    perks: ["Recomendaciones", "Prioridades claras", "Usted confirma cada acción"],
    kicker: "Próximos pasos sugeridos / Demo",
    title: "Esto es en lo que debe centrarse ahora.",
    rows: [
      ["Refuerce una página con alta intención", "Aclare la propuesta de valor y el siguiente paso"],
      ["Publique una respuesta útil para la búsqueda", "Responda a una pregunta que se hace su público"],
      ["Participe en dos conversaciones relevantes", "Revise las respuestas sugeridas antes de publicarlas"],
    ],
    sideTitle: "Un plan. Todos los canales.",
    sideText: "Use sus datos conectados para tomar mejores decisiones de marketing, con control sobre cada acción propuesta.",
  },
};

const fr: FeaturesCopy = {
  eyebrow: "Découvrez la plateforme",
  count: "9 fonctionnalités",
  engineTitle: "Un seul moteur de croissance connecté.",
  engineLine: "Contenu · SEO · Autorité · IA",
  workspace: "L’espace de croissance",
  preview: "Aperçu indicatif du produit",
  previewShort: "Aperçu démo",
  highlights: "Temps forts",
  jump: "Aller au temps fort {n} : {label}",
  scroll: "Faites défiler pour explorer",
  next: "Fonctionnalité suivante",
  cta: "Commencer l’essai gratuit",
  social: {
    nav: "Contenu social",
    navSub: "Créer · adapter · publier",
    category: "Contenu social",
    headline: ["Créez une fois.", "Soyez partout."],
    description:
      "20 nouvelles idées par jour, tirées de votre site. Celles que vous validez deviennent des vidéos courtes, des Stories et des carrousels pour Instagram, TikTok, YouTube et Facebook, publiés depuis un seul endroit.",
    studio: "Studio de contenu",
    tag: "Créer et diffuser",
    perks: ["Un seul flux créatif", "Pensé pour chaque plateforme", "Validation avant publication"],
    posterTop: "REPGET / STUDIO",
    poster: ["Votre marque.", "Partout."],
    format: "Vidéo courte · 9:16",
    queueTitle: "Votre contenu, adapté.",
    queueCount: "4 aperçus par canal",
    rows: [
      ["Reel Instagram", "Légende + vidéo", "Prêt"],
      ["Vidéo TikTok", "Vidéo verticale + accroche", "À revoir"],
      ["Short YouTube", "Titre + description", "Prêt"],
      ["Carrousel Facebook", "Diapositives + légende", "Planifié"],
    ],
    footer: "Validez le contenu avant sa mise en ligne",
  },
  conversations: {
    nav: "Conversations sociales",
    navSub: "Reddit · X · Threads",
    category: "Opportunités sociales",
    headline: ["Trouvez les bonnes conversations.", "Participez en toute confiance."],
    description:
      "Repérez les discussions pertinentes et préparez des réponses utiles et naturelles. Vous gardez la main sur ce qui est publié.",
    studio: "Boîte des opportunités",
    tag: "Repérer et répondre",
    perks: ["Opportunités pertinentes", "Brouillons de réponses utiles", "Vous publiez en un clic"],
    sourceNote: "Conversation d’exemple",
    question: "« Comment les petites entreprises se font-elles trouver dans la recherche IA ? »",
    fit: "Une conversation en phase avec votre activité et votre expertise.",
    replyLabel: "Réponse suggérée",
    reply:
      "Commencez par des pages de services claires, des réponses précises et des sources fiables. Vérifiez ensuite si les assistants IA vous citent, puis comblez les manques.",
    status: "Prête, à vous de la publier",
    queue: "File d’opportunités",
    found: "3 trouvées",
    queueText: "Les discussions pertinentes, réunies au même endroit.",
    rows: [
      ["Reddit · Visibilité dans la recherche", "Brouillon de réponse prêt à relire"],
      ["X · Automatisation du contenu", "Un nouveau sujet à envisager"],
      ["Threads · Croissance des fondateurs", "Lancer une conversation utile"],
    ],
  },
  seo: {
    nav: "Moteur de contenu SEO",
    navSub: "Rechercher · rédiger · publier",
    category: "Contenu pour la recherche",
    headline: ["Transformez la demande de recherche", "en contenu de qualité."],
    description:
      "Mettez en place un rythme de publication régulier, avec des sujets étudiés, des brouillons rédigés par l’IA et la publication directe sur votre site.",
    studio: "Planificateur de contenu",
    tag: "Rechercher et publier",
    perks: ["Opportunités de mots-clés", "Flux éditorial", "Publication sur votre CMS"],
    crumb: "Brouillon d’article / Opportunité de recherche",
    title: "Comment gagner en visibilité sur Google et dans les réponses de l’IA",
    abstract: "Un article structuré, avec un plan utile, des signaux d’entité clairs et une ligne éditoriale pensée pour la recherche.",
    sections: "Sections clés",
    status: "Brouillon prêt à relire",
    cluster: "Groupe de sujets",
    keywords: ["Visibilité IA", "Mentions de marque", "Recherche organique"],
    calendar: "Calendrier de publication",
    calendarNote: "Sujets en file, à titre indicatif",
  },
  backlinks: {
    nav: "Réseau de backlinks",
    navSub: "Pertinence · contrôles · autorité",
    category: "Backlinks et autorité",
    headline: ["Obtenez des liens.", "Bâtissez une autorité durable."],
    description:
      "Obtenez des liens d’entreprises d’un domaine proche, chacun intégré à un vrai article sur leur site et vérifié chaque jour.",
    studio: "Réseau d’autorité",
    tag: "Associer et vérifier",
    perks: ["Sites proches uniquement", "Dans de vrais articles", "Vérifiés chaque jour"],
    nodes: ["Entreprise proche", "Même niche", "Votre site", "Vrai article", "Vérifié chaque jour"],
    foot: "Seulement des liens qui ont du sens pour votre activité",
    kicker: "Votre parcours d’autorité",
    title: "Obtenez des mentions qui comptent.",
    pill: "Réseau",
    quality: "La pertinence d’abord",
    qualityNote: "Associé par niche, jamais au hasard",
    steps: ["Associé à un site proche", "Lien intégré à un vrai article", "Vérifié chaque jour"],
    notice: "Crédits remboursés si un lien est retiré",
  },
  ai: {
    nav: "Visibilité dans la recherche IA",
    navSub: "Mentions · citations · GEO",
    category: "Visibilité dans la recherche IA",
    headline: ["Ne vous contentez pas de vous classer.", "Faites partie de la réponse."],
    description:
      "Vérifiez chaque semaine si Claude recommande votre entreprise pour les questions de vos clients, voyez qui il cite à votre place et assurez-vous que les robots d’IA peuvent lire votre site.",
    studio: "Suivi de la visibilité IA",
    tag: "Suivre et améliorer",
    perks: ["Suivi des mentions IA", "Qui est cité à votre place", "Accès des robots d’IA"],
    answerTitle: "Exemple de réponse IA",
    illustration: "Exemple",
    question: "« Quels outils aident une marque à se développer en SEO et sur les réseaux sociaux ? »",
    sample: "Réponse d’exemple",
    answer:
      "Une plateforme de croissance connectée peut réunir la planification du contenu, la publication sur les réseaux sociaux, le SEO du site et le développement de l’autorité. Des pages comparatives utiles et des informations de marque bien structurées peuvent rendre un site plus facile à comprendre.",
    domain: "votremarque.fr",
    domainNote: "Exemple de source pouvant être citée",
    citation: "Source citée",
    opsTitle: "Comprenez votre présence dans l’IA.",
    opsText: "Suivez votre visibilité et repérez les manques, semaine après semaine.",
    rows: [
      ["Claude", "Contrôle hebdomadaire des mentions"],
      ["Robots d’IA", "Accès dans robots.txt"],
      ["llms.txt", "Générateur gratuit"],
    ],
  },
  marketing: {
    nav: "Améliorations marketing",
    navSub: "Textes · titres · conversion",
    category: "Opportunités marketing",
    headline: ["Faites compter", "chaque visite."],
    description:
      "Repérez des améliorations concrètes qui transforment plus de visites en clients : des titres que Google affiche mais sur lesquels peu de gens cliquent, une offre et un appel à l’action plus clairs sur votre page d’accueil.",
    studio: "Recommandations de croissance",
    tag: "Auditer et optimiser",
    perks: ["Opportunités concrètes", "Messages plus clairs", "Améliorations par priorité"],
    review: "Revue de la page d’accueil",
    found: "Amélioration repérée",
    siteLabel: "Votre site / Texte suggéré",
    site: ["Faites-vous découvrir.", "Grandissez partout."],
    siteText: "Une promesse plus claire, appuyée par des preuves et une étape suivante évidente.",
    fixes: [
      ["Clarifiez votre offre principale", "Mettez en avant le résultat, pas seulement les fonctionnalités"],
      ["Recentrez votre appel à l’action", "Rendez l’étape suivante évidente"],
      ["Réécrivez les titres peu cliqués", "Souvent vus dans Google, rarement cliqués"],
    ],
  },
  technical: {
    nav: "SEO technique",
    navSub: "Indexation · métadonnées · santé",
    category: "SEO technique",
    headline: ["Levez les obstacles.", "Faites-vous découvrir."],
    description:
      "Comprenez les blocages techniques, vérifiez que votre site est prêt pour la recherche et traitez en priorité les corrections qui aident les plateformes à le trouver et à le comprendre.",
    studio: "Audit de santé du site",
    tag: "Diagnostiquer et améliorer",
    perks: ["Audits techniques du site", "Titres et descriptions", "Corrections par priorité"],
    kicker: "Audit du site / Exemple",
    title: "Préparez votre site pour la recherche.",
    rows: [
      ["Préparation à l’indexation", "Balises noindex, canoniques et pages en erreur"],
      ["Visibilité des pages", "Titres, intertitres et liens internes"],
      ["Accès des robots d’IA", "Ce que votre robots.txt autorise"],
    ],
    review: "À revoir",
    scoreLabel: "Santé du site indicative",
    scoreText: "Un seul endroit pour voir ce qui demande votre attention et par où commencer.",
    first: "Corrigez d’abord ce qui compte le plus",
  },
  analytics: {
    nav: "Analytique et croissance",
    navSub: "Mesurer · apprendre · progresser",
    category: "Analytique connectée",
    headline: ["Voyez ce qui marche.", "Faites-en plus."],
    description:
      "Search Console, Google Analytics, vos articles, vos backlinks et votre visibilité IA dans une seule vue. Comprenez vos progrès et prenez la décision suivante en toute clarté.",
    studio: "Vue d’ensemble de la croissance",
    tag: "Mesurer et apprendre",
    perks: ["Rapports connectés", "Search Console et Analytics", "Prochaines étapes concrètes"],
    graphTitle: "Clics depuis Google",
    graphNote: "Tendance indicative",
    trend: "↗ En hausse",
    value: "12,8 k",
    change: "+24 % (exemple)",
    weeks: ["Semaine 1", "Semaine 4", "Semaine 8", "Semaine 12"],
    search: "Recherche",
    searchValue: "↗ 18 %",
    searchNote: "Tendance indicative",
    ai: "Visibilité IA",
    aiNote: "Questions suivies (exemple)",
    next: "Prochaine opportunité",
    nextText: "Développez les sujets qui attirent un intérêt qualifié.",
  },
  copilot: {
    nav: "Growth Copilot IA",
    navSub: "Stratégie · priorités · actions",
    category: "Votre copilote de croissance IA",
    headline: ["Un partenaire de croissance IA.", "Pas un tableau de bord de plus."],
    description:
      "Transformez vos données et vos objectifs en étapes claires pour le SEO, les réseaux sociaux, le contenu et la visibilité de votre marque.",
    studio: "Growth Copilot",
    tag: "Planifier et agir",
    perks: ["Recommandations", "Priorités claires", "Vous validez chaque action"],
    kicker: "Prochaines étapes suggérées / Démo",
    title: "Voici sur quoi vous concentrer maintenant.",
    rows: [
      ["Renforcez une page à forte intention", "Clarifiez la proposition de valeur et l’étape suivante"],
      ["Publiez une réponse utile pour la recherche", "Répondez à une question que se pose votre audience"],
      ["Rejoignez deux conversations pertinentes", "Relisez les réponses suggérées avant de publier"],
    ],
    sideTitle: "Un plan. Tous les canaux.",
    sideText:
      "Appuyez-vous sur vos données connectées pour prendre de meilleures décisions marketing, en gardant la main sur chaque action proposée.",
  },
};

const it: FeaturesCopy = {
  eyebrow: "Esplori la piattaforma",
  count: "9 funzionalità",
  engineTitle: "Un unico motore di crescita connesso.",
  engineLine: "Contenuti · SEO · Autorevolezza · IA",
  workspace: "Lo spazio della crescita",
  preview: "Anteprima illustrativa del prodotto",
  previewShort: "Anteprima demo",
  highlights: "Punti salienti",
  jump: "Vai al punto saliente {n}: {label}",
  scroll: "Scorra per esplorare",
  next: "Funzionalità successiva",
  cta: "Inizi la prova gratuita",
  social: {
    nav: "Contenuti social",
    navSub: "Crea · adatta · pubblica",
    category: "Contenuti social",
    headline: ["Crei una volta.", "Sia presente ovunque."],
    description:
      "20 nuove idee al giorno dal Suo sito. Quelle che approva diventano video brevi, storie e caroselli per Instagram, TikTok, YouTube e Facebook, pubblicati da un unico posto.",
    studio: "Studio contenuti",
    tag: "Crea e distribuisci",
    perks: ["Un unico flusso creativo", "Pensato per ogni piattaforma", "Revisione prima della pubblicazione"],
    posterTop: "REPGET / STUDIO",
    poster: ["Il Suo brand.", "Ovunque."],
    format: "Video breve · 9:16",
    queueTitle: "I Suoi contenuti, adattati.",
    queueCount: "4 anteprime per canale",
    rows: [
      ["Reel di Instagram", "Didascalia + video", "Pronto"],
      ["Video TikTok", "Video verticale + gancio", "Da rivedere"],
      ["Short di YouTube", "Titolo + descrizione", "Pronto"],
      ["Carosello Facebook", "Slide + didascalia", "Programmato"],
    ],
    footer: "Approvi i contenuti prima che vadano online",
  },
  conversations: {
    nav: "Conversazioni social",
    navSub: "Reddit · X · Threads",
    category: "Opportunità social",
    headline: ["Trovi le conversazioni giuste.", "Partecipi con sicurezza."],
    description:
      "Scopra le discussioni pertinenti e prepari risposte utili e naturali. È Lei a decidere cosa viene pubblicato.",
    studio: "Casella delle opportunità",
    tag: "Scopri e rispondi",
    perks: ["Opportunità pertinenti", "Bozze di risposte utili", "Pubblica Lei, con un clic"],
    sourceNote: "Conversazione di esempio",
    question: "“Come fanno le piccole imprese a farsi trovare nella ricerca con l’IA?”",
    fit: "Una conversazione in linea con la Sua attività e le Sue competenze.",
    replyLabel: "Risposta suggerita",
    reply:
      "Parta da pagine dei servizi chiare, risposte precise e fonti affidabili. Poi verifichi se gli assistenti IA La citano e colmi le lacune.",
    status: "Pronta da pubblicare",
    queue: "Coda delle opportunità",
    found: "3 trovate",
    queueText: "Le discussioni pertinenti, riunite in un unico posto.",
    rows: [
      ["Reddit · Visibilità nella ricerca", "Bozza di risposta pronta da rivedere"],
      ["X · Automazione dei contenuti", "Un nuovo tema da valutare"],
      ["Threads · Crescita per founder", "Avvii una conversazione utile"],
    ],
  },
  seo: {
    nav: "Motore di contenuti SEO",
    navSub: "Ricerca · scrittura · pubblicazione",
    category: "Contenuti per la ricerca",
    headline: ["Trasformi la domanda di ricerca", "in ottimi contenuti."],
    description:
      "Costruisca un ritmo di pubblicazione costante con argomenti studiati, bozze scritte con l’IA e la pubblicazione diretta sul Suo sito.",
    studio: "Pianificatore dei contenuti",
    tag: "Ricerca e pubblica",
    perks: ["Opportunità di parole chiave", "Flusso editoriale", "Pubblicazione sul CMS"],
    crumb: "Bozza dell’articolo / Opportunità di ricerca",
    title: "Come diventare più visibili su Google e nelle risposte dell’IA",
    abstract: "Un articolo strutturato, con una scaletta utile, segnali di entità chiari e un piano editoriale orientato alla ricerca.",
    sections: "Sezioni principali",
    status: "Bozza pronta da rivedere",
    cluster: "Cluster di argomenti",
    keywords: ["Visibilità nell’IA", "Menzioni del brand", "Ricerca organica"],
    calendar: "Calendario editoriale",
    calendarNote: "Argomenti in coda, a titolo illustrativo",
  },
  backlinks: {
    nav: "Rete di backlink",
    navSub: "Pertinenza · controlli · autorevolezza",
    category: "Backlink e autorevolezza",
    headline: ["Ottenga link.", "Costruisca un’autorevolezza duratura."],
    description:
      "Ottenga link da attività di settori affini, ciascuno inserito in un vero articolo sul loro sito e verificato ogni giorno.",
    studio: "Rete di autorevolezza",
    tag: "Abbina e verifica",
    perks: ["Solo siti affini", "Dentro articoli veri", "Verificati ogni giorno"],
    nodes: ["Attività affine", "Stessa nicchia", "Il Suo sito", "Articolo vero", "Verificato ogni giorno"],
    foot: "Solo collegamenti sensati per la Sua attività",
    kicker: "Il Suo percorso di autorevolezza",
    title: "Ottenga menzioni che contano.",
    pill: "Rete",
    quality: "Prima di tutto la pertinenza",
    qualityNote: "Abbinato per nicchia, mai a caso",
    steps: ["Abbinato a un sito affine", "Link inserito in un articolo vero", "Verificato ogni giorno"],
    notice: "Crediti restituiti se un link viene rimosso",
  },
  ai: {
    nav: "Visibilità nella ricerca IA",
    navSub: "Menzioni · citazioni · GEO",
    category: "Visibilità nella ricerca IA",
    headline: ["Non si limiti al posizionamento.", "Diventi parte della risposta."],
    description:
      "Verifichi ogni settimana se Claude consiglia la Sua attività per le domande dei Suoi clienti, veda chi nomina al Suo posto e si assicuri che i crawler IA possano leggere il Suo sito.",
    studio: "Monitor della visibilità IA",
    tag: "Monitora e migliora",
    perks: ["Monitoraggio delle menzioni IA", "Chi viene nominato al Suo posto", "Accesso dei crawler IA"],
    answerTitle: "Esempio di risposta IA",
    illustration: "Illustrazione",
    question: "“Quali strumenti aiutano un brand a crescere tra SEO e social?”",
    sample: "Risposta di esempio",
    answer:
      "Una piattaforma di crescita connessa può unire pianificazione dei contenuti, pubblicazione sui social, SEO del sito e costruzione dell’autorevolezza. Pagine di confronto utili e informazioni sul brand ben strutturate possono rendere un sito più facile da capire.",
    domain: "ilsuobrand.it",
    domainNote: "Esempio di possibile fonte citata",
    citation: "Citazione",
    opsTitle: "Capisca la Sua presenza nell’IA.",
    opsText: "Monitori la Sua visibilità e individui le lacune, settimana dopo settimana.",
    rows: [
      ["Claude", "Controllo settimanale delle menzioni"],
      ["Crawler IA", "Accesso in robots.txt"],
      ["llms.txt", "Generatore gratuito"],
    ],
  },
  marketing: {
    nav: "Miglioramenti di marketing",
    navSub: "Testi · titoli · conversione",
    category: "Opportunità di marketing",
    headline: ["Faccia contare di più", "ogni visita."],
    description:
      "Individui miglioramenti concreti che trasformano più visite in clienti: titoli che Google mostra ma che pochi cliccano, e un’offerta e una call to action più chiare sulla Sua homepage.",
    studio: "Consigli di crescita",
    tag: "Analizza e ottimizza",
    perks: ["Opportunità concrete", "Messaggi più chiari", "Miglioramenti per priorità"],
    review: "Revisione della homepage",
    found: "Miglioramento trovato",
    siteLabel: "Il Suo sito / Testo suggerito",
    site: ["Si faccia scoprire.", "Cresca ovunque."],
    siteText: "Una promessa più chiara, sostenuta da prove e con un passo successivo evidente.",
    fixes: [
      ["Chiarisca l’offerta principale", "Parta dal risultato, non solo dalle funzionalità"],
      ["Metta a fuoco la call to action", "Renda evidente il passo successivo"],
      ["Riscriva i titoli con pochi clic", "Visti spesso su Google, cliccati di rado"],
    ],
  },
  technical: {
    nav: "SEO tecnica",
    navSub: "Indicizzazione · metadati · salute",
    category: "SEO tecnica",
    headline: ["Elimini gli ostacoli.", "Si faccia trovare."],
    description:
      "Capisca i blocchi tecnici, verifichi se il sito è pronto per la ricerca e dia priorità alle correzioni che aiutano le piattaforme a trovarlo e a capirlo.",
    studio: "Audit della salute del sito",
    tag: "Diagnostica e migliora",
    perks: ["Audit tecnici del sito", "Titoli e descrizioni", "Correzioni per priorità"],
    kicker: "Audit del sito / Esempio",
    title: "Prepari il Suo sito per la ricerca.",
    rows: [
      ["Pronto per l’indicizzazione", "Tag noindex, canonical e pagine non funzionanti"],
      ["Visibilità delle pagine", "Titoli, intestazioni e link interni"],
      ["Accesso dei crawler IA", "Ciò che il Suo robots.txt consente"],
    ],
    review: "Da rivedere",
    scoreLabel: "Salute del sito indicativa",
    scoreText: "Un unico posto per vedere cosa richiede attenzione e da dove iniziare.",
    first: "Prima i problemi di maggiore impatto",
  },
  analytics: {
    nav: "Analisi e crescita",
    navSub: "Misura · impara · migliora",
    category: "Analisi connesse",
    headline: ["Veda cosa funziona.", "Ne faccia di più."],
    description:
      "Search Console, Google Analytics, i Suoi articoli, i backlink e la visibilità nell’IA in un’unica vista. Capisca i Suoi progressi e prenda la decisione successiva con chiarezza.",
    studio: "Panoramica della crescita",
    tag: "Misura e impara",
    perks: ["Report connessi", "Search Console e Analytics", "Passi successivi concreti"],
    graphTitle: "Clic da Google",
    graphNote: "Andamento illustrativo",
    trend: "↗ In crescita",
    value: "12,8k",
    change: "+24% di esempio",
    weeks: ["Settimana 1", "Settimana 4", "Settimana 8", "Settimana 12"],
    search: "Ricerca",
    searchValue: "↗ 18%",
    searchNote: "Andamento illustrativo",
    ai: "Visibilità IA",
    aiNote: "Domande monitorate di esempio",
    next: "Prossima opportunità",
    nextText: "Approfondisca gli argomenti che portano interesse qualificato.",
  },
  copilot: {
    nav: "Growth Copilot con IA",
    navSub: "Strategia · priorità · azioni",
    category: "Il Suo copilota di crescita IA",
    headline: ["Un partner di crescita con IA.", "Non l’ennesima dashboard."],
    description:
      "Trasformi dati e obiettivi in passi successivi chiari per SEO, social, contenuti e visibilità del brand.",
    studio: "Growth Copilot",
    tag: "Pianifica e agisci",
    perks: ["Consigli", "Priorità chiare", "Ogni azione la conferma Lei"],
    kicker: "Passi successivi suggeriti / Demo",
    title: "Ecco su cosa concentrarsi adesso.",
    rows: [
      ["Rafforzi una pagina ad alta intenzione", "Chiarisca la proposta di valore e il passo successivo"],
      ["Pubblichi una risposta utile per la ricerca", "Risponda a una domanda che il Suo pubblico si pone"],
      ["Partecipi a due conversazioni pertinenti", "Riveda le risposte suggerite prima di pubblicarle"],
    ],
    sideTitle: "Un piano. Ogni canale.",
    sideText: "Usi i Suoi dati collegati per prendere decisioni di marketing migliori, mantenendo il controllo su ogni azione proposta.",
  },
};

const de: FeaturesCopy = {
  eyebrow: "Die Plattform entdecken",
  count: "9 Funktionen",
  engineTitle: "Ein vernetzter Wachstumsmotor.",
  engineLine: "Content · SEO · Autorität · KI",
  workspace: "Ihr Wachstums-Workspace",
  preview: "Beispielhafte Produktvorschau",
  previewShort: "Demo-Vorschau",
  highlights: "Highlights beim Scrollen",
  jump: "Zu Highlight {n} springen: {label}",
  scroll: "Scrollen und entdecken",
  next: "Nächste Funktion",
  cta: "Kostenlos testen",
  social: {
    nav: "Social-Content",
    navSub: "Erstellen · anpassen · veröffentlichen",
    category: "Social-Content",
    headline: ["Einmal erstellen.", "Überall präsent sein."],
    description:
      "Jeden Tag 20 neue Ideen aus Ihrer Website. Was Sie freigeben, wird zu Kurzvideos, Stories und Karussells für Instagram, TikTok, YouTube und Facebook und an einem Ort veröffentlicht.",
    studio: "Content-Studio",
    tag: "Erstellen & verbreiten",
    perks: ["Ein kreativer Ablauf", "Für jede Plattform gemacht", "Freigabe vor dem Veröffentlichen"],
    posterTop: "REPGET / STUDIO",
    poster: ["Ihre Marke.", "Überall."],
    format: "Kurzvideo · 9:16",
    queueTitle: "Ihr Content, angepasst.",
    queueCount: "4 Kanalvorschauen",
    rows: [
      ["Instagram-Reel", "Bildunterschrift + Video", "Bereit"],
      ["TikTok-Video", "Hochformat + Hook", "Prüfen"],
      ["YouTube-Short", "Titel + Beschreibung", "Bereit"],
      ["Facebook-Karussell", "Slides + Bildunterschrift", "Geplant"],
    ],
    footer: "Inhalte freigeben, bevor sie live gehen",
  },
  conversations: {
    nav: "Social-Gespräche",
    navSub: "Reddit · X · Threads",
    category: "Social-Chancen",
    headline: ["Die richtigen Gespräche finden.", "Mit Zuversicht mitreden."],
    description:
      "Entdecken Sie relevante Diskussionen und bereiten Sie hilfreiche, natürliche Antworten vor. Sie entscheiden, was gepostet wird.",
    studio: "Chancen-Postfach",
    tag: "Entdecken & antworten",
    perks: ["Relevante Chancen", "Hilfreiche Antwortentwürfe", "Sie posten mit einem Klick"],
    sourceNote: "Beispielgespräch",
    question: "„Wie werden kleine Unternehmen in der KI-Suche gefunden?“",
    fit: "Ein Gespräch, das zu Ihrem Unternehmen und Ihrer Expertise passt.",
    replyLabel: "Antwortvorschlag",
    reply:
      "Beginnen Sie mit klaren Leistungsseiten, konkreten Antworten und glaubwürdigen Quellen. Prüfen Sie dann, ob KI-Assistenten Sie nennen, und schließen Sie die Lücken.",
    status: "Bereit, von Ihnen gepostet zu werden",
    queue: "Chancen-Warteschlange",
    found: "3 gefunden",
    queueText: "Relevante Diskussionen an einem Ort.",
    rows: [
      ["Reddit · Sichtbarkeit in der Suche", "Antwortentwurf bereit zur Prüfung"],
      ["X · Content-Automatisierung", "Ein neues Thema zum Überlegen"],
      ["Threads · Wachstum für Gründer", "Ein hilfreiches Gespräch beginnen"],
    ],
  },
  seo: {
    nav: "SEO-Content-Motor",
    navSub: "Recherchieren · schreiben · veröffentlichen",
    category: "Content für die Suche",
    headline: ["Aus Suchanfragen", "wird starker Content."],
    description:
      "Bauen Sie einen beständigen Veröffentlichungsrhythmus auf: mit recherchierten Themen, KI-geschriebenen Entwürfen und direkter Veröffentlichung auf Ihrer Website.",
    studio: "Content-Planer",
    tag: "Recherchieren & veröffentlichen",
    perks: ["Keyword-Chancen", "Redaktioneller Ablauf", "Veröffentlichung im CMS"],
    crumb: "Artikelentwurf / Suchchance",
    title: "Wie Sie bei Google und in KI-Antworten sichtbarer werden",
    abstract: "Ein strukturierter Artikel mit nützlicher Gliederung, klaren Entitätssignalen und einem suchorientierten Redaktionsplan.",
    sections: "Wichtige Abschnitte",
    status: "Entwurf bereit zur Prüfung",
    cluster: "Themencluster",
    keywords: ["KI-Sichtbarkeit", "Markenerwähnungen", "Organische Suche"],
    calendar: "Veröffentlichungskalender",
    calendarNote: "Geplante Themen, beispielhaft",
  },
  backlinks: {
    nav: "Backlink-Netzwerk",
    navSub: "Relevanz · Prüfungen · Autorität",
    category: "Backlinks & Autorität",
    headline: ["Links aufbauen.", "Dauerhafte Autorität aufbauen."],
    description:
      "Erhalten Sie Links von Unternehmen aus verwandten Branchen, jeder in einen echten Artikel auf deren Website eingebettet und täglich geprüft.",
    studio: "Autoritäts-Netzwerk",
    tag: "Zuordnen & prüfen",
    perks: ["Nur verwandte Websites", "In echten Artikeln", "Täglich geprüft"],
    nodes: ["Verwandtes Unternehmen", "Gleiche Nische", "Ihre Website", "Echter Artikel", "Täglich geprüft"],
    foot: "Nur Verbindungen, die für Ihr Unternehmen Sinn ergeben",
    kicker: "Ihr Weg zu mehr Autorität",
    title: "Erwähnungen, die zählen.",
    pill: "Netzwerk",
    quality: "Relevanz zuerst",
    qualityNote: "Nach Nische zugeordnet, nie zufällig",
    steps: ["Einer verwandten Website zugeordnet", "Link in einen echten Artikel eingebettet", "Täglich geprüft"],
    notice: "Credits zurück, wenn ein Link entfernt wird",
  },
  ai: {
    nav: "Sichtbarkeit in der KI-Suche",
    navSub: "Erwähnungen · Zitate · GEO",
    category: "Sichtbarkeit in der KI-Suche",
    headline: ["Nicht nur ranken.", "Teil der Antwort werden."],
    description:
      "Prüfen Sie jede Woche, ob Claude Ihr Unternehmen bei den Fragen Ihrer Kunden empfiehlt, sehen Sie, wen es stattdessen nennt, und stellen Sie sicher, dass KI-Crawler Ihre Website lesen können.",
    studio: "KI-Sichtbarkeitsmonitor",
    tag: "Beobachten & verbessern",
    perks: ["KI-Erwähnungen verfolgen", "Sehen, wer stattdessen genannt wird", "Zugriff der KI-Crawler prüfen"],
    answerTitle: "Beispiel einer KI-Antwort",
    illustration: "Illustration",
    question: "„Welche Tools helfen einer Marke, bei SEO und Social zu wachsen?“",
    sample: "Beispielantwort",
    answer:
      "Eine vernetzte Wachstumsplattform kann Content-Planung, Social-Publishing, Website-SEO und Autoritätsaufbau verbinden. Hilfreiche Vergleichsseiten und gut strukturierte Markeninformationen können eine Website leichter verständlich machen.",
    domain: "ihremarke.de",
    domainNote: "Beispiel einer möglichen zitierten Quelle",
    citation: "Quelle",
    opsTitle: "Verstehen Sie Ihre KI-Präsenz.",
    opsText: "Verfolgen Sie Ihre Sichtbarkeit und erkennen Sie Lücken, Woche für Woche.",
    rows: [
      ["Claude", "Wöchentliche Erwähnungsprüfung"],
      ["KI-Crawler", "Zugriff laut robots.txt"],
      ["llms.txt", "Kostenloser Generator"],
    ],
  },
  marketing: {
    nav: "Marketing-Verbesserungen",
    navSub: "Texte · Titel · Conversion",
    category: "Marketing-Chancen",
    headline: ["Machen Sie jeden Besuch", "wertvoller."],
    description:
      "Finden Sie praktische Verbesserungen, die mehr Besuche zu Kunden machen: Titel, die Google zeigt, die aber kaum jemand anklickt, und ein klareres Angebot samt Call-to-Action auf Ihrer Startseite.",
    studio: "Wachstumsempfehlungen",
    tag: "Prüfen & optimieren",
    perks: ["Konkrete Chancen", "Klarere Botschaften", "Verbesserungen nach Priorität"],
    review: "Prüfung der Startseite",
    found: "Verbesserung gefunden",
    siteLabel: "Ihre Website / Textvorschlag",
    site: ["Gefunden werden.", "Überall wachsen."],
    siteText: "Ein klareres Versprechen, gestützt durch Belege und einen klaren nächsten Schritt.",
    fixes: [
      ["Ihr Hauptangebot klarer machen", "Mit dem Ergebnis beginnen, nicht nur mit Funktionen"],
      ["Den Call-to-Action schärfen", "Den nächsten Schritt offensichtlich machen"],
      ["Titel mit wenigen Klicks neu schreiben", "Oft bei Google gesehen, selten angeklickt"],
    ],
  },
  technical: {
    nav: "Technisches SEO",
    navSub: "Indexierung · Metadaten · Zustand",
    category: "Technisches SEO",
    headline: ["Hürden beseitigen.", "Gefunden werden."],
    description:
      "Verstehen Sie technische Blockaden, prüfen Sie die Suchbereitschaft und priorisieren Sie die Korrekturen, die Plattformen helfen, Ihre Website zu finden und zu verstehen.",
    studio: "Website-Audit",
    tag: "Diagnostizieren & verbessern",
    perks: ["Technische Website-Audits", "Titel & Beschreibungen", "Korrekturen nach Priorität"],
    kicker: "Website-Audit / Beispiel",
    title: "Machen Sie Ihre Website suchbereit.",
    rows: [
      ["Bereit für die Indexierung", "Noindex-Tags, Canonicals und defekte Seiten"],
      ["Auffindbarkeit der Seiten", "Titel, Überschriften und interne Links"],
      ["Zugriff der KI-Crawler", "Was Ihre robots.txt erlaubt"],
    ],
    review: "Prüfen",
    scoreLabel: "Beispielhafter Website-Zustand",
    scoreText: "Ein Ort, der zeigt, was Aufmerksamkeit braucht und wo Sie anfangen.",
    first: "Zuerst die wirkungsvollsten Probleme beheben",
  },
  analytics: {
    nav: "Analysen & Wachstum",
    navSub: "Messen · lernen · verbessern",
    category: "Vernetzte Analysen",
    headline: ["Sehen, was funktioniert.", "Mehr davon machen."],
    description:
      "Search Console, Google Analytics, Ihre Artikel, Backlinks und KI-Sichtbarkeit in einer Ansicht. Verstehen Sie Ihren Fortschritt und treffen Sie die nächste Entscheidung mit Klarheit.",
    studio: "Wachstumsübersicht",
    tag: "Messen & lernen",
    perks: ["Vernetzte Berichte", "Search Console & Analytics", "Praktische nächste Schritte"],
    graphTitle: "Klicks aus Google",
    graphNote: "Beispielhafter Verlauf",
    trend: "↗ Steigend",
    value: "12,8 Tsd.",
    change: "+24 % Beispiel",
    weeks: ["Woche 1", "Woche 4", "Woche 8", "Woche 12"],
    search: "Suche",
    searchValue: "↗ 18 %",
    searchNote: "Beispielhafter Trend",
    ai: "KI-Sichtbarkeit",
    aiNote: "Beispielhaft verfolgte Fragen",
    next: "Nächste Chance",
    nextText: "Bauen Sie die Themen aus, die qualifiziertes Interesse bringen.",
  },
  copilot: {
    nav: "KI-Growth-Copilot",
    navSub: "Strategie · Prioritäten · Aktionen",
    category: "Ihr KI-Wachstums-Copilot",
    headline: ["Ein KI-Wachstumspartner.", "Kein weiteres Dashboard."],
    description:
      "Machen Sie aus Ihren Daten und Zielen klare nächste Schritte für SEO, Social, Content und Markensichtbarkeit.",
    studio: "Growth Copilot",
    tag: "Planen & handeln",
    perks: ["Empfehlungen", "Klare Prioritäten", "Sie bestätigen jede Aktion"],
    kicker: "Vorgeschlagene nächste Schritte / Demo",
    title: "Darauf sollten Sie sich als Nächstes konzentrieren.",
    rows: [
      ["Eine Seite mit hoher Kaufabsicht stärken", "Nutzenversprechen und nächsten Schritt klarer machen"],
      ["Eine hilfreiche Antwort für die Suche veröffentlichen", "Eine Frage beantworten, die Ihr Publikum stellt"],
      ["Bei zwei relevanten Gesprächen mitreden", "Antwortvorschläge vor dem Posten prüfen"],
    ],
    sideTitle: "Ein Plan. Jeder Kanal.",
    sideText: "Nutzen Sie Ihre verbundenen Daten für bessere Marketing-Entscheidungen, mit Kontrolle über jede vorgeschlagene Aktion.",
  },
};

const COPY: Record<Locale, FeaturesCopy> = { en, es, fr, it, de };

export function featuresCopy(locale: Locale): FeaturesCopy {
  return COPY[locale];
}
