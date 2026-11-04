import type { Locale } from "@/lib/i18n/config";

/**
 * The homepage's "Top features" selector (client's design, 2026-11-03,
 * `rgx-dashboard-functional-tabs`): seven features, each with its kicker,
 * title, chips, a drawn preview (two cards) and a description, in every
 * language. The figures are the design's illustrative ones and are the same
 * everywhere.
 */

/** The design's small line icons (`hp-icon-*`) a chip or a platform tile can carry. */
export type FeatureIcon =
  | "ig"
  | "yt"
  | "fb"
  | "share"
  | "search"
  | "spark"
  | "content"
  | "globe"
  | "store"
  | "chart"
  | "shield"
  | "brief"
  | "users";

export type FeatureChip = { icon: FeatureIcon; label: string };
export type FeatureRow = { title: string; detail: string };
export type FeatureStat = { label: string; value: string; note: string };

/**
 * One card of a preview. Its parts are drawn in this order: platform tiles,
 * a reply queue, checks, a roadmap, stats, tags, then the text and the bars.
 */
export type FeatureCard = {
  title: string;
  platforms?: FeatureChip[];
  queue?: FeatureRow[];
  checks?: FeatureRow[];
  roadmap?: FeatureRow[];
  stats?: FeatureStat[];
  tags?: string[];
  text?: string;
  bars?: boolean;
};

export type FeatureItem = {
  /** The tab's label in the list on the left. */
  nav: string;
  kicker: string;
  title: string;
  description: string;
  chips: FeatureChip[];
  /** The wide card and the side card of the preview canvas. */
  main: FeatureCard;
  side: FeatureCard;
};

export type FeaturesCopy = {
  /** "Top features" (drawn upper-case), the section's heading. */
  label: string;
  hint: string;
  mascotAlt: string;
  note: string;
  noteDetail: string;
  next: string;
  items: FeatureItem[];
};

type Pair = [string, string];
type Triple = [string, string, string];

/** The words of one language; the icons and the shape are shared below. */
type Words = {
  label: string;
  hint: string;
  mascotAlt: string;
  note: string;
  noteDetail: string;
  next: string;
  videos: { nav: string; kicker: string; desc: string; main: string; mainText: string; side: string; sideText: string };
  conversations: { nav: string; kicker: string; desc: string; main: string; rows: [Pair, Pair, Pair]; side: string; tags: string[] };
  seo: { nav: string; kicker: string; title: string; desc: string; articles: string; main: string; tags: string[]; mainText: string; side: string; stats: [Triple, Triple] };
  marketing: { nav: string; kicker: string; desc: string; chips: [string, string, string]; main: string; rows: [Pair, Pair, Pair]; side: string; sideText: string };
  technical: { nav: string; kicker: string; desc: string; ai: string; audit: string; main: string; rows: [Pair, Pair, Pair]; side: string; stats: [Triple, Triple] };
  analytics: { nav: string; kicker: string; desc: string; chips: [string, string, string]; main: string; stats: [Triple, Triple, Triple, Triple]; side: string; sideText: string };
  cmo: { nav: string; kicker: string; desc: string; chips: [string, string, string]; main: string; rows: [Pair, Pair, Pair, Pair]; side: string; sideText: string };
};

const rows = (list: Pair[]): FeatureRow[] => list.map(([title, detail]) => ({ title, detail }));
const stats = (list: Triple[]): FeatureStat[] => list.map(([label, value, note]) => ({ label, value, note }));

function build(w: Words): FeaturesCopy {
  return {
    label: w.label,
    hint: w.hint,
    mascotAlt: w.mascotAlt,
    note: w.note,
    noteDetail: w.noteDetail,
    next: w.next,
    items: [
      {
        nav: w.videos.nav,
        kicker: w.videos.kicker,
        title: w.videos.nav,
        description: w.videos.desc,
        chips: [
          { icon: "ig", label: "Instagram" },
          { icon: "yt", label: "YouTube" },
          { icon: "fb", label: "Facebook" },
        ],
        main: {
          title: w.videos.main,
          platforms: [
            { icon: "ig", label: "Instagram" },
            { icon: "yt", label: "YouTube" },
            { icon: "fb", label: "Facebook" },
            { icon: "share", label: "TikTok" },
          ],
          text: w.videos.mainText,
        },
        side: { title: w.videos.side, text: w.videos.sideText, bars: true },
      },
      {
        nav: w.conversations.nav,
        kicker: w.conversations.kicker,
        title: w.conversations.nav,
        description: w.conversations.desc,
        chips: [
          { icon: "share", label: "Reddit" },
          { icon: "share", label: "X" },
          { icon: "share", label: "Threads" },
        ],
        main: { title: w.conversations.main, queue: rows(w.conversations.rows) },
        side: { title: w.conversations.side, tags: w.conversations.tags },
      },
      {
        nav: w.seo.nav,
        kicker: w.seo.kicker,
        title: w.seo.title,
        description: w.seo.desc,
        chips: [
          { icon: "search", label: "SEO" },
          { icon: "spark", label: "GEO" },
          { icon: "content", label: w.seo.articles },
        ],
        main: { title: w.seo.main, tags: w.seo.tags, text: w.seo.mainText },
        side: { title: w.seo.side, stats: stats(w.seo.stats) },
      },
      {
        nav: w.marketing.nav,
        kicker: w.marketing.kicker,
        title: w.marketing.nav,
        description: w.marketing.desc,
        chips: [
          { icon: "globe", label: w.marketing.chips[0] },
          { icon: "store", label: w.marketing.chips[1] },
          { icon: "chart", label: w.marketing.chips[2] },
        ],
        main: { title: w.marketing.main, checks: rows(w.marketing.rows) },
        side: { title: w.marketing.side, text: w.marketing.sideText },
      },
      {
        nav: w.technical.nav,
        kicker: w.technical.kicker,
        title: w.technical.nav,
        description: w.technical.desc,
        chips: [
          { icon: "search", label: "SEO" },
          { icon: "spark", label: w.technical.ai },
          { icon: "shield", label: w.technical.audit },
        ],
        main: { title: w.technical.main, checks: rows(w.technical.rows) },
        side: { title: w.technical.side, stats: stats(w.technical.stats) },
      },
      {
        nav: w.analytics.nav,
        kicker: w.analytics.kicker,
        title: w.analytics.nav,
        description: w.analytics.desc,
        chips: [
          { icon: "chart", label: w.analytics.chips[0] },
          { icon: "search", label: w.analytics.chips[1] },
          { icon: "share", label: w.analytics.chips[2] },
        ],
        main: { title: w.analytics.main, stats: stats(w.analytics.stats) },
        side: { title: w.analytics.side, text: w.analytics.sideText },
      },
      {
        nav: w.cmo.nav,
        kicker: w.cmo.kicker,
        title: w.cmo.nav,
        description: w.cmo.desc,
        chips: [
          { icon: "spark", label: w.cmo.chips[0] },
          { icon: "brief", label: w.cmo.chips[1] },
          { icon: "users", label: w.cmo.chips[2] },
        ],
        main: { title: w.cmo.main, roadmap: rows(w.cmo.rows) },
        side: { title: w.cmo.side, text: w.cmo.sideText },
      },
    ],
  };
}

const en: Words = {
  label: "Top features",
  hint: "Select the RepGet capabilities you want to highlight",
  mascotAlt: "RepGet gecko and owl mascots",
  note: "Feature-focused preview.",
  noteDetail: "Show the strongest capabilities instead of exposing the whole dashboard.",
  next: "Next feature",
  videos: {
    nav: "20 videos and slideshows a day",
    kicker: "SOCIAL CONTENT",
    desc: "Create ready-to-post short videos and slideshows for Instagram, TikTok, YouTube and Facebook, then approve and publish from one place.",
    main: "Select platforms",
    mainText: "Approve once, then RepGet writes the caption, picks the best time and publishes.",
    side: "Content created",
    sideText: "Illustrative weekly output",
  },
  conversations: {
    nav: "Replies and posts on Reddit, X and Threads",
    kicker: "COMMUNITY DISTRIBUTION",
    desc: "Keep your business visible inside real conversations. RepGet prepares native replies, short posts and thread-style content around your offer.",
    main: "Reply queue",
    rows: [
      ["Answer a local SEO question", "Reddit, r/smallbusiness"],
      ["Turn today’s insight into a short post", "X, 4 post options"],
      ["Join an ongoing founder conversation", "Threads, 2 reply drafts"],
    ],
    side: "Conversation themes",
    tags: ["SEO tips", "ChatGPT visibility", "Backlinks", "Wedding vendors", "Local services"],
  },
  seo: {
    nav: "A new blog article every day, SEO and GEO",
    kicker: "SEO AND GEO",
    title: "A new blog article every day",
    desc: "Turn keyword opportunities into useful daily articles designed for both classic search and AI discovery.",
    articles: "Articles",
    main: "Today’s article brief",
    tags: ["Destination wedding photographer Italy", "Wedding content creator guide", "Lake Como editorial shoot"],
    mainText: "Draft in progress. Structure, title, meta and distribution are prepared automatically.",
    side: "Publishing cadence",
    stats: [
      ["Articles queued", "07", "Ready this week"],
      ["Keywords found", "34", "New opportunities"],
    ],
  },
  marketing: {
    nav: "Marketing fixes for your site and listing",
    kicker: "MARKETING FIXES",
    desc: "RepGet spots practical conversion improvements across your website, local presence and product positioning.",
    chips: ["Website", "Listings", "Conversion"],
    main: "High-impact fixes",
    rows: [
      ["Strengthen your main call to action", "Clearer wording can improve trial starts"],
      ["Clean up your offer hierarchy", "Lead with search, AI and social in one line"],
      ["Improve profile consistency", "Align service descriptions across channels"],
    ],
    side: "Suggested focus",
    sideText: "Quick wins first, deeper improvements next. Better copy, better structure, better conversion path.",
  },
  technical: {
    nav: "Technical SEO and GEO fixes for your site",
    kicker: "TECHNICAL SEO",
    desc: "Check what blocks discovery, indexing and AI understanding, then fix the essentials in priority order.",
    ai: "AI",
    audit: "Audit",
    main: "Technical audit",
    rows: [
      ["Schema clarity", "Organization, WebSite and service structure improved"],
      ["Indexing readiness", "Sitemap, robots and canonicals reviewed"],
      ["AI readability", "Pages rewritten for cleaner entity signals"],
    ],
    side: "Priority score",
    stats: [
      ["Critical fixes", "03", "Handle first"],
      ["Site health", "91%", "Illustrative score"],
    ],
  },
  analytics: {
    nav: "Analytics, site, product and social",
    kicker: "GROWTH REPORTING",
    desc: "See what is improving across traffic, visibility, content output and social distribution in one clean view.",
    chips: ["Reporting", "Search", "Social"],
    main: "Cross-channel overview",
    stats: [
      ["Organic clicks", "+200%", "From SEO growth"],
      ["AI mentions", "12", "Tracked this month"],
      ["Posts created", "90+", "Across channels"],
      ["Backlinks", "20", "Relevant placements"],
    ],
    side: "What changed",
    sideText: "Follow search, social and authority together, not as separate reports from separate tools.",
  },
  cmo: {
    nav: "Your AI CMO",
    kicker: "AI CMO",
    desc: "RepGet can think like a growth lead, turning your goals into a clear weekly plan across content, SEO, AI search and distribution.",
    chips: ["Strategy", "Planning", "Support"],
    main: "This week’s strategy",
    rows: [
      ["Week 1, sharpen positioning", "Hero and offer"],
      ["Week 2, publish authority content", "3 articles, 18 social assets"],
      ["Week 3, expand distribution", "Reddit, X and Threads"],
      ["Week 4, review and scale", "Double down on winners"],
    ],
    side: "What you get",
    sideText: "A suggested plan, daily actions, and a human-friendly workflow instead of a complicated marketing stack.",
  },
};

const es: Words = {
  label: "Funciones principales",
  hint: "Seleccione las capacidades de RepGet que desea destacar",
  mascotAlt: "Las mascotas de RepGet, el geco y el búho",
  note: "Vista previa centrada en las funciones.",
  noteDetail: "Muestre las capacidades más potentes en lugar de todo el panel.",
  next: "Siguiente función",
  videos: {
    nav: "20 vídeos y presentaciones al día",
    kicker: "CONTENIDO SOCIAL",
    desc: "Cree vídeos cortos y presentaciones listos para publicar en Instagram, TikTok, YouTube y Facebook; después apruébelos y publíquelos desde un solo lugar.",
    main: "Seleccione plataformas",
    mainText: "Apruebe una vez y RepGet escribe el texto, elige el mejor momento y publica.",
    side: "Contenido creado",
    sideText: "Producción semanal ilustrativa",
  },
  conversations: {
    nav: "Respuestas y publicaciones en Reddit, X y Threads",
    kicker: "DISTRIBUCIÓN EN COMUNIDADES",
    desc: "Mantenga su negocio visible en conversaciones reales. RepGet prepara respuestas naturales, publicaciones breves y contenido en hilos en torno a su oferta.",
    main: "Cola de respuestas",
    rows: [
      ["Responder una pregunta de SEO local", "Reddit, r/smallbusiness"],
      ["Convertir la idea de hoy en una publicación breve", "X, 4 opciones de publicación"],
      ["Unirse a una conversación entre fundadores", "Threads, 2 borradores de respuesta"],
    ],
    side: "Temas de conversación",
    tags: ["Consejos de SEO", "Visibilidad en ChatGPT", "Backlinks", "Proveedores de bodas", "Servicios locales"],
  },
  seo: {
    nav: "Un nuevo artículo de blog cada día, SEO y GEO",
    kicker: "SEO Y GEO",
    title: "Un nuevo artículo de blog cada día",
    desc: "Convierta oportunidades de palabras clave en artículos diarios útiles, pensados tanto para la búsqueda clásica como para el descubrimiento con IA.",
    articles: "Artículos",
    main: "Briefing del artículo de hoy",
    tags: ["Fotógrafo de bodas de destino en Italia", "Guía para creadores de contenido de bodas", "Sesión editorial en el lago de Como"],
    mainText: "Borrador en curso. La estructura, el título, la meta descripción y la distribución se preparan automáticamente.",
    side: "Ritmo de publicación",
    stats: [
      ["Artículos en cola", "07", "Listos esta semana"],
      ["Palabras clave", "34", "Nuevas oportunidades"],
    ],
  },
  marketing: {
    nav: "Mejoras de marketing para su sitio y su ficha",
    kicker: "MEJORAS DE MARKETING",
    desc: "RepGet detecta mejoras prácticas de conversión en su sitio web, su presencia local y el posicionamiento de su producto.",
    chips: ["Sitio web", "Fichas", "Conversión"],
    main: "Mejoras de alto impacto",
    rows: [
      ["Refuerce su llamada a la acción principal", "Un texto más claro puede aumentar las pruebas iniciadas"],
      ["Ordene la jerarquía de su oferta", "Empiece por búsqueda, IA y redes sociales en una sola línea"],
      ["Mejore la coherencia de sus perfiles", "Alinee las descripciones de servicios en todos los canales"],
    ],
    side: "Enfoque sugerido",
    sideText: "Primero las mejoras rápidas, después las más profundas. Mejor texto, mejor estructura, mejor camino de conversión.",
  },
  technical: {
    nav: "Correcciones técnicas de SEO y GEO para su sitio",
    kicker: "SEO TÉCNICO",
    desc: "Compruebe qué bloquea el descubrimiento, la indexación y la comprensión por parte de la IA, y corrija lo esencial por orden de prioridad.",
    ai: "IA",
    audit: "Auditoría",
    main: "Auditoría técnica",
    rows: [
      ["Claridad del schema", "Mejor estructura de Organization, WebSite y servicios"],
      ["Preparación para la indexación", "Sitemap, robots y canónicas revisados"],
      ["Legibilidad para la IA", "Páginas reescritas con señales de entidad más claras"],
    ],
    side: "Puntuación de prioridad",
    stats: [
      ["Correcciones críticas", "03", "Atender primero"],
      ["Salud del sitio", "91 %", "Puntuación ilustrativa"],
    ],
  },
  analytics: {
    nav: "Analítica: sitio, producto y redes sociales",
    kicker: "INFORMES DE CRECIMIENTO",
    desc: "Vea qué mejora en tráfico, visibilidad, producción de contenido y distribución social en una sola vista clara.",
    chips: ["Informes", "Búsqueda", "Redes sociales"],
    main: "Resumen multicanal",
    stats: [
      ["Clics orgánicos", "+200 %", "Gracias al SEO"],
      ["Menciones en IA", "12", "Registradas este mes"],
      ["Publicaciones", "90+", "En todos los canales"],
      ["Backlinks", "20", "Ubicaciones relevantes"],
    ],
    side: "Qué ha cambiado",
    sideText: "Siga la búsqueda, las redes sociales y la autoridad juntas, no como informes separados de herramientas distintas.",
  },
  cmo: {
    nav: "Su CMO con IA",
    kicker: "CMO CON IA",
    desc: "RepGet puede pensar como un responsable de crecimiento y convertir sus objetivos en un plan semanal claro de contenido, SEO, búsqueda con IA y distribución.",
    chips: ["Estrategia", "Planificación", "Soporte"],
    main: "La estrategia de esta semana",
    rows: [
      ["Semana 1, afinar el posicionamiento", "Portada y oferta"],
      ["Semana 2, publicar contenido de autoridad", "3 artículos, 18 piezas sociales"],
      ["Semana 3, ampliar la distribución", "Reddit, X y Threads"],
      ["Semana 4, revisar y escalar", "Apueste por lo que funciona"],
    ],
    side: "Lo que obtiene",
    sideText: "Un plan sugerido, acciones diarias y un flujo de trabajo humano en lugar de un complicado conjunto de herramientas de marketing.",
  },
};

const fr: Words = {
  label: "Fonctionnalités clés",
  hint: "Sélectionnez les fonctionnalités RepGet que vous souhaitez mettre en avant",
  mascotAlt: "Les mascottes RepGet, le gecko et le hibou",
  note: "Aperçu centré sur les fonctionnalités.",
  noteDetail: "Montrez les capacités les plus fortes plutôt que tout le tableau de bord.",
  next: "Fonctionnalité suivante",
  videos: {
    nav: "20 vidéos et diaporamas par jour",
    kicker: "CONTENU SOCIAL",
    desc: "Créez des vidéos courtes et des diaporamas prêts à publier pour Instagram, TikTok, YouTube et Facebook, puis validez et publiez depuis un seul endroit.",
    main: "Choisir les plateformes",
    mainText: "Validez une fois : RepGet rédige la légende, choisit le meilleur moment et publie.",
    side: "Contenu créé",
    sideText: "Production hebdomadaire indicative",
  },
  conversations: {
    nav: "Réponses et posts sur Reddit, X et Threads",
    kicker: "DIFFUSION DANS LES COMMUNAUTÉS",
    desc: "Gardez votre entreprise visible au cœur de vraies conversations. RepGet prépare des réponses naturelles, des posts courts et des fils de discussion autour de votre offre.",
    main: "File de réponses",
    rows: [
      ["Répondre à une question de SEO local", "Reddit, r/smallbusiness"],
      ["Transformer l’idée du jour en post court", "X, 4 propositions de post"],
      ["Rejoindre une conversation entre fondateurs", "Threads, 2 brouillons de réponse"],
    ],
    side: "Thèmes de conversation",
    tags: ["Conseils SEO", "Visibilité dans ChatGPT", "Backlinks", "Prestataires de mariage", "Services locaux"],
  },
  seo: {
    nav: "Un nouvel article de blog chaque jour, SEO et GEO",
    kicker: "SEO ET GEO",
    title: "Un nouvel article de blog chaque jour",
    desc: "Transformez les opportunités de mots-clés en articles quotidiens utiles, conçus à la fois pour la recherche classique et pour la découverte par l’IA.",
    articles: "Articles",
    main: "Brief de l’article du jour",
    tags: ["Photographe de mariage à destination en Italie", "Guide du créateur de contenu mariage", "Shooting éditorial au lac de Côme"],
    mainText: "Brouillon en cours. La structure, le titre, la méta-description et la diffusion sont préparés automatiquement.",
    side: "Rythme de publication",
    stats: [
      ["Articles en file", "07", "Prêts cette semaine"],
      ["Mots-clés trouvés", "34", "Nouvelles opportunités"],
    ],
  },
  marketing: {
    nav: "Améliorations marketing pour votre site et votre fiche",
    kicker: "AMÉLIORATIONS MARKETING",
    desc: "RepGet repère des améliorations concrètes de conversion sur votre site, votre présence locale et le positionnement de votre produit.",
    chips: ["Site web", "Fiches", "Conversion"],
    main: "Améliorations à fort impact",
    rows: [
      ["Renforcez votre appel à l’action principal", "Une formulation plus claire peut augmenter les essais"],
      ["Clarifiez la hiérarchie de votre offre", "Mettez en avant recherche, IA et réseaux sociaux en une ligne"],
      ["Harmonisez vos profils", "Alignez les descriptions de services sur tous les canaux"],
    ],
    side: "Priorités suggérées",
    sideText: "D’abord les gains rapides, ensuite les améliorations de fond. De meilleurs textes, une meilleure structure, un meilleur parcours de conversion.",
  },
  technical: {
    nav: "Corrections SEO et GEO techniques pour votre site",
    kicker: "SEO TECHNIQUE",
    desc: "Vérifiez ce qui freine la découverte, l’indexation et la compréhension par l’IA, puis corrigez l’essentiel par ordre de priorité.",
    ai: "IA",
    audit: "Audit",
    main: "Audit technique",
    rows: [
      ["Clarté du schema", "Structure Organization, WebSite et services améliorée"],
      ["Préparation à l’indexation", "Sitemap, robots et canoniques vérifiés"],
      ["Lisibilité pour l’IA", "Pages réécrites pour des signaux d’entité plus nets"],
    ],
    side: "Score de priorité",
    stats: [
      ["Corrections critiques", "03", "À traiter d’abord"],
      ["Santé du site", "91 %", "Score indicatif"],
    ],
  },
  analytics: {
    nav: "Analytique : site, produit et réseaux sociaux",
    kicker: "SUIVI DE LA CROISSANCE",
    desc: "Voyez ce qui progresse en trafic, visibilité, production de contenu et diffusion sociale, dans une seule vue claire.",
    chips: ["Rapports", "Recherche", "Social"],
    main: "Vue d’ensemble multicanal",
    stats: [
      ["Clics organiques", "+200 %", "Grâce au SEO"],
      ["Mentions IA", "12", "Suivies ce mois-ci"],
      ["Posts créés", "90+", "Sur tous les canaux"],
      ["Backlinks", "20", "Placements pertinents"],
    ],
    side: "Ce qui a changé",
    sideText: "Suivez la recherche, le social et l’autorité ensemble, et non dans des rapports séparés issus d’outils différents.",
  },
  cmo: {
    nav: "Votre CMO IA",
    kicker: "CMO IA",
    desc: "RepGet peut raisonner comme un responsable de la croissance et transformer vos objectifs en un plan hebdomadaire clair : contenu, SEO, recherche IA et diffusion.",
    chips: ["Stratégie", "Planification", "Accompagnement"],
    main: "La stratégie de la semaine",
    rows: [
      ["Semaine 1, affiner le positionnement", "Accroche et offre"],
      ["Semaine 2, publier du contenu de référence", "3 articles, 18 contenus sociaux"],
      ["Semaine 3, élargir la diffusion", "Reddit, X et Threads"],
      ["Semaine 4, analyser et amplifier", "Miser sur ce qui marche"],
    ],
    side: "Ce que vous obtenez",
    sideText: "Un plan suggéré, des actions quotidiennes et une méthode de travail simple, au lieu d’une pile d’outils marketing compliquée.",
  },
};

const it: Words = {
  label: "Funzionalità principali",
  hint: "Selezioni le funzionalità di RepGet che desidera mettere in evidenza",
  mascotAlt: "Le mascotte di RepGet, il geco e il gufo",
  note: "Anteprima centrata sulle funzionalità.",
  noteDetail: "Mostri le capacità più forti invece dell’intera dashboard.",
  next: "Funzionalità successiva",
  videos: {
    nav: "20 video e slideshow al giorno",
    kicker: "CONTENUTI SOCIAL",
    desc: "Crei video brevi e slideshow pronti da pubblicare per Instagram, TikTok, YouTube e Facebook, poi li approvi e li pubblichi da un unico posto.",
    main: "Selezioni le piattaforme",
    mainText: "Approvi una volta: RepGet scrive la didascalia, sceglie il momento migliore e pubblica.",
    side: "Contenuti creati",
    sideText: "Produzione settimanale indicativa",
  },
  conversations: {
    nav: "Risposte e post su Reddit, X e Threads",
    kicker: "DISTRIBUZIONE NELLE COMMUNITY",
    desc: "Mantenga la Sua attività visibile nelle conversazioni reali. RepGet prepara risposte naturali, post brevi e contenuti in stile thread attorno alla Sua offerta.",
    main: "Coda delle risposte",
    rows: [
      ["Rispondere a una domanda di SEO locale", "Reddit, r/smallbusiness"],
      ["Trasformare l’idea di oggi in un post breve", "X, 4 proposte di post"],
      ["Partecipare a una conversazione tra founder", "Threads, 2 bozze di risposta"],
    ],
    side: "Temi di conversazione",
    tags: ["Consigli SEO", "Visibilità su ChatGPT", "Backlink", "Fornitori per matrimoni", "Servizi locali"],
  },
  seo: {
    nav: "Un nuovo articolo del blog ogni giorno, SEO e GEO",
    kicker: "SEO E GEO",
    title: "Un nuovo articolo del blog ogni giorno",
    desc: "Trasformi le opportunità di parole chiave in articoli quotidiani utili, pensati sia per la ricerca classica sia per la scoperta tramite IA.",
    articles: "Articoli",
    main: "Brief dell’articolo di oggi",
    tags: ["Fotografo di matrimoni destination in Italia", "Guida per content creator di matrimoni", "Servizio editoriale sul lago di Como"],
    mainText: "Bozza in corso. Struttura, titolo, meta description e distribuzione vengono preparati in automatico.",
    side: "Ritmo di pubblicazione",
    stats: [
      ["Articoli in coda", "07", "Pronti questa settimana"],
      ["Parole chiave", "34", "Nuove opportunità"],
    ],
  },
  marketing: {
    nav: "Miglioramenti di marketing per il Suo sito e la Sua scheda",
    kicker: "MIGLIORAMENTI DI MARKETING",
    desc: "RepGet individua miglioramenti concreti della conversione sul Suo sito, sulla presenza locale e sul posizionamento del prodotto.",
    chips: ["Sito web", "Schede", "Conversione"],
    main: "Interventi ad alto impatto",
    rows: [
      ["Rafforzi la call to action principale", "Un testo più chiaro può aumentare le prove avviate"],
      ["Riordini la gerarchia dell’offerta", "Apra con ricerca, IA e social in una sola riga"],
      ["Renda coerenti i profili", "Allinei le descrizioni dei servizi su tutti i canali"],
    ],
    side: "Priorità suggerite",
    sideText: "Prima i risultati rapidi, poi i miglioramenti più profondi. Testi migliori, struttura migliore, percorso di conversione migliore.",
  },
  technical: {
    nav: "Correzioni tecniche SEO e GEO per il Suo sito",
    kicker: "SEO TECNICA",
    desc: "Verifichi cosa ostacola la scoperta, l’indicizzazione e la comprensione da parte dell’IA, poi corregga l’essenziale in ordine di priorità.",
    ai: "IA",
    audit: "Audit",
    main: "Audit tecnico",
    rows: [
      ["Chiarezza dello schema", "Struttura Organization, WebSite e servizi migliorata"],
      ["Pronto per l’indicizzazione", "Sitemap, robots e canonical verificati"],
      ["Leggibilità per l’IA", "Pagine riscritte con segnali di entità più chiari"],
    ],
    side: "Punteggio di priorità",
    stats: [
      ["Correzioni critiche", "03", "Da gestire subito"],
      ["Salute del sito", "91%", "Punteggio indicativo"],
    ],
  },
  analytics: {
    nav: "Analisi: sito, prodotto e social",
    kicker: "REPORT DI CRESCITA",
    desc: "Veda cosa migliora in traffico, visibilità, produzione di contenuti e distribuzione social in un’unica vista chiara.",
    chips: ["Report", "Ricerca", "Social"],
    main: "Panoramica multicanale",
    stats: [
      ["Clic organici", "+200%", "Dalla crescita SEO"],
      ["Menzioni nell’IA", "12", "Monitorate questo mese"],
      ["Post creati", "90+", "Su tutti i canali"],
      ["Backlink", "20", "Posizionamenti pertinenti"],
    ],
    side: "Cosa è cambiato",
    sideText: "Segua ricerca, social e autorevolezza insieme, non come report separati di strumenti diversi.",
  },
  cmo: {
    nav: "Il Suo CMO con IA",
    kicker: "CMO CON IA",
    desc: "RepGet può ragionare come un responsabile della crescita e trasformare i Suoi obiettivi in un piano settimanale chiaro per contenuti, SEO, ricerca IA e distribuzione.",
    chips: ["Strategia", "Pianificazione", "Supporto"],
    main: "La strategia di questa settimana",
    rows: [
      ["Settimana 1, affinare il posizionamento", "Hero e offerta"],
      ["Settimana 2, pubblicare contenuti autorevoli", "3 articoli, 18 contenuti social"],
      ["Settimana 3, ampliare la distribuzione", "Reddit, X e Threads"],
      ["Settimana 4, analizzare e scalare", "Puntare su ciò che funziona"],
    ],
    side: "Cosa ottiene",
    sideText: "Un piano suggerito, azioni quotidiane e un flusso di lavoro a misura d’uomo invece di un complicato insieme di strumenti di marketing.",
  },
};

const de: Words = {
  label: "Top-Funktionen",
  hint: "Wählen Sie die RepGet-Funktionen, die Sie hervorheben möchten",
  mascotAlt: "Die RepGet-Maskottchen Gecko und Eule",
  note: "Funktionsorientierte Vorschau.",
  noteDetail: "Zeigen Sie die stärksten Funktionen statt des gesamten Dashboards.",
  next: "Nächste Funktion",
  videos: {
    nav: "20 Videos und Slideshows pro Tag",
    kicker: "SOCIAL-CONTENT",
    desc: "Erstellen Sie veröffentlichungsfertige Kurzvideos und Slideshows für Instagram, TikTok, YouTube und Facebook – und geben Sie sie an einem Ort frei und veröffentlichen Sie sie.",
    main: "Plattformen wählen",
    mainText: "Einmal freigeben, dann schreibt RepGet die Bildunterschrift, wählt den besten Zeitpunkt und veröffentlicht.",
    side: "Erstellte Inhalte",
    sideText: "Beispielhafte Wochenleistung",
  },
  conversations: {
    nav: "Antworten und Posts auf Reddit, X und Threads",
    kicker: "COMMUNITY-REICHWEITE",
    desc: "Halten Sie Ihr Unternehmen in echten Gesprächen sichtbar. RepGet bereitet natürliche Antworten, kurze Posts und Thread-Inhalte rund um Ihr Angebot vor.",
    main: "Antwort-Warteschlange",
    rows: [
      ["Eine Frage zu lokalem SEO beantworten", "Reddit, r/smallbusiness"],
      ["Die Erkenntnis des Tages als kurzen Post", "X, 4 Post-Vorschläge"],
      ["An einer Gründer-Diskussion teilnehmen", "Threads, 2 Antwortentwürfe"],
    ],
    side: "Gesprächsthemen",
    tags: ["SEO-Tipps", "Sichtbarkeit in ChatGPT", "Backlinks", "Hochzeitsdienstleister", "Lokale Dienstleistungen"],
  },
  seo: {
    nav: "Jeden Tag ein neuer Blogartikel, SEO und GEO",
    kicker: "SEO UND GEO",
    title: "Jeden Tag ein neuer Blogartikel",
    desc: "Machen Sie aus Keyword-Chancen täglich nützliche Artikel, die für die klassische Suche und für die KI-Suche gemacht sind.",
    articles: "Artikel",
    main: "Briefing für den heutigen Artikel",
    tags: ["Hochzeitsfotograf für Destination Weddings in Italien", "Leitfaden für Hochzeits-Content-Creator", "Editorial-Shooting am Comer See"],
    mainText: "Entwurf in Arbeit. Struktur, Titel, Meta-Angaben und Verbreitung werden automatisch vorbereitet.",
    side: "Veröffentlichungsrhythmus",
    stats: [
      ["Artikel geplant", "07", "Diese Woche fertig"],
      ["Keywords gefunden", "34", "Neue Chancen"],
    ],
  },
  marketing: {
    nav: "Marketing-Verbesserungen für Ihre Website und Ihren Eintrag",
    kicker: "MARKETING-VERBESSERUNGEN",
    desc: "RepGet findet praktische Conversion-Verbesserungen für Ihre Website, Ihre lokale Präsenz und die Positionierung Ihres Produkts.",
    chips: ["Website", "Einträge", "Conversion"],
    main: "Wirkungsvolle Verbesserungen",
    rows: [
      ["Ihren wichtigsten Call-to-Action stärken", "Klarere Worte können mehr Testanmeldungen bringen"],
      ["Die Struktur Ihres Angebots ordnen", "Suche, KI und Social in einer Zeile voranstellen"],
      ["Profile einheitlich gestalten", "Leistungsbeschreibungen über alle Kanäle angleichen"],
    ],
    side: "Empfohlener Fokus",
    sideText: "Zuerst schnelle Erfolge, dann tiefere Verbesserungen. Bessere Texte, bessere Struktur, besserer Weg zur Conversion.",
  },
  technical: {
    nav: "Technische SEO- und GEO-Korrekturen für Ihre Website",
    kicker: "TECHNISCHES SEO",
    desc: "Prüfen Sie, was Auffindbarkeit, Indexierung und das Verständnis durch KI blockiert, und beheben Sie das Wesentliche nach Priorität.",
    ai: "KI",
    audit: "Audit",
    main: "Technisches Audit",
    rows: [
      ["Klares Schema", "Struktur für Organization, WebSite und Leistungen verbessert"],
      ["Bereit für die Indexierung", "Sitemap, robots und Canonicals geprüft"],
      ["Lesbar für KI", "Seiten mit klareren Entitätssignalen neu geschrieben"],
    ],
    side: "Prioritäts-Score",
    stats: [
      ["Kritische Fehler", "03", "Zuerst erledigen"],
      ["Website-Zustand", "91 %", "Beispielhafter Wert"],
    ],
  },
  analytics: {
    nav: "Analysen: Website, Produkt und Social",
    kicker: "WACHSTUMSBERICHTE",
    desc: "Sehen Sie in einer übersichtlichen Ansicht, was sich bei Traffic, Sichtbarkeit, Content-Output und Social-Reichweite verbessert.",
    chips: ["Berichte", "Suche", "Social"],
    main: "Kanalübergreifende Übersicht",
    stats: [
      ["Organische Klicks", "+200 %", "Durch SEO-Wachstum"],
      ["KI-Erwähnungen", "12", "Diesen Monat erfasst"],
      ["Erstellte Posts", "90+", "Über alle Kanäle"],
      ["Backlinks", "20", "Relevante Platzierungen"],
    ],
    side: "Was sich verändert hat",
    sideText: "Verfolgen Sie Suche, Social und Autorität gemeinsam statt in getrennten Berichten aus getrennten Tools.",
  },
  cmo: {
    nav: "Ihr KI-CMO",
    kicker: "KI-CMO",
    desc: "RepGet denkt wie ein Growth Lead und macht aus Ihren Zielen einen klaren Wochenplan für Content, SEO, KI-Suche und Verbreitung.",
    chips: ["Strategie", "Planung", "Support"],
    main: "Die Strategie dieser Woche",
    rows: [
      ["Woche 1, Positionierung schärfen", "Hero und Angebot"],
      ["Woche 2, Fachinhalte veröffentlichen", "3 Artikel, 18 Social-Assets"],
      ["Woche 3, Reichweite ausbauen", "Reddit, X und Threads"],
      ["Woche 4, auswerten und skalieren", "Auf Gewinner setzen"],
    ],
    side: "Was Sie erhalten",
    sideText: "Einen Planvorschlag, tägliche Aufgaben und einen menschenfreundlichen Ablauf statt eines komplizierten Marketing-Stacks.",
  },
};

const COPY: Record<Locale, FeaturesCopy> = { en: build(en), es: build(es), fr: build(fr), it: build(it), de: build(de) };

export function featuresCopy(locale: Locale): FeaturesCopy {
  return COPY[locale];
}
