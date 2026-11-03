import type { Locale } from "@/lib/i18n/config";

/**
 * The words of the redesigned homepage (client's design, 2026-11-03:
 * RepGet_Full_Homepage_CTA_Official_Footer.html), in every language.
 *
 * Only what is NEW lives here. Anything the old homepage already said - the
 * reassurances under the hero, the video's title, the pricing labels, the
 * FAQ, the closing call - still comes from messages.ts `home` / `faq`, so it
 * is translated once.
 *
 * Markup in the strings, kept deliberately small:
 *  - `*word*` is drawn in the accent colour (headings);
 *  - `**words**` are bold (paragraphs).
 * Rendered by `rich()` in app/(marketing)/_home/text.tsx. A translator moves
 * the marks with the words they belong to; they never contain HTML.
 *
 * NO INVENTED NUMBERS. The design came with a "4.9/5" rating, "+200% organic
 * clicks", "90+ posts a month" and a ticking counter of 12,840: none of them
 * measured. The rating pill shows real reviewers only, the counter is a real
 * count from the database (lib/marketing/content-count.ts), and the cards
 * describe what the product does instead of quoting results.
 *
 * Formal address throughout: usted, vous, Lei, Sie.
 */
export type HomeRedesignCopy = {
  hero: {
    eyebrow: string;
    /** Two lines; `*word*` is the orange one. */
    titleLine1: string;
    titleLine2: string;
    /** `**bold**` allowed. */
    description: string;
    /** Under the avatars when there are published reviews. */
    reviewsLink: string;
    websiteLabel: string;
    emailLabel: string;
    websitePlaceholder: string;
    emailPlaceholder: string;
    startTrial: string;
    useEmail: string;
    useWebsite: string;
    invalidWebsite: string;
    invalidEmail: string;
    /** The six floating cards, in order: social, SEO, AI, backlinks, content, insights. */
    cards: { title: string; detail: string }[];
  };
  ribbon: {
    label: string;
    /** Under the real count. */
    counterLabel: string;
  };
  features: {
    eyebrow: string;
    hint: string;
    next: string;
    /** Under the panel: these are drawings, not an account. */
    note: string;
    noteDetail: string;
    items: {
      nav: string;
      kicker: string;
      title: string;
      description: string;
      chips: string[];
      /** The preview's main card. */
      listTitle: string;
      list: { title: string; detail: string }[];
      /** The preview's side card. */
      sideTitle: string;
      sideBody: string;
      tags: string[];
    }[];
  };
  engines: {
    eyebrow: string;
    title: string;
    sub: string;
    link: string;
    illustration: string;
    search: { title: string; body: string; foot: string; label: string; value: string; rise: string; weeks: string[] };
    social: { title: string; body: string; foot: string; calendar: string; scheduled: string; queue: string; channels: string; ready: string };
    ai: { title: string; body: string; foot: string; question: string; answer: string; found: string };
    links: { title: string; body: string; foot: string; label: string; network: string };
  };
  video: {
    eyebrow: string;
    caption: string;
    /** Shown while the muted preview plays: the visitor can turn the sound on in the player. */
    mutedHint: string;
  };
  steps: {
    kicker: string;
    title: string;
    titleAccent: string;
    sub: string;
    items: { title: string; body: string }[];
    emailInstead: string;
    planLabel: string;
    recommended: string;
    setupLabel: string;
    yourWebsite: string;
    connectReview: string;
    ready: string;
    connected: string;
    cta: string;
    footnote: string;
  };
  copilot: {
    strip: string;
    kicker: string;
    title: string;
    body: string;
    points: { lead: string; text: string }[];
    connect: string;
    watch: string;
    channelsConnected: string;
    userMessage: string;
    status: string;
    lines: string[];
    input: string;
  };
  founder: {
    eyebrow: string;
    role: string;
    /** `**bold**` allowed. */
    body: string;
    body2: string;
    yearsValue: string;
    yearsLabel: string;
    ledValue: string;
    ledLabel: string;
  };
  reviews: {
    kicker: string;
    title: string;
    lead: string;
    proof: string;
    pills: string[];
    readMore: string;
    readLess: string;
    showMore: string;
    showLess: string;
    videoTag: string;
    videoOverline: string;
    videoCaption: string;
    videoTitle: string;
    videoNote: string;
    videoLink: string;
    uiLines: string[];
  };
  pricing: {
    eyebrow: string;
    title: string;
    sub: string;
    included: string[];
    allInOne: string;
    articles: string;
    keywords: string;
    everything: string;
    features: string[];
    scaleExtra: string[];
    moreTitle: string;
    moreBody: string;
    talk: string;
  };
  faq: { eyebrow: string; contactLead: string; contact: string };
  cta: {
    overline: string;
    title: string;
    body: string;
    primary: string;
    secondary: string;
    points: string[];
    pills: string[];
    panelTitle: string;
    panelBody: string;
    items: { title: string; body: string }[];
  };
  /** The header's two mega-menus. */
  menu: {
    features: string;
    integrations: string;
    featuresOverline: string;
    featuresTitle: string;
    featuresTagline: string;
    next: string;
    open: string;
    bottom: string;
    tools: { title: string; sub: string; kicker: string; heading: string; body: string; steps: string[] }[];
    socialHead: string;
    socialSub: string;
    platforms: string;
    siteHead: string;
    siteSub: string;
    connections: string;
    footerTitle: string;
    footerBody: string;
    explore: string;
  };
};

const en: HomeRedesignCopy = {
  hero: {
    eyebrow: "One growth platform for search, AI & social",
    titleLine1: "Get *found* on Google & AI.",
    titleLine2: "Grow across *social.*",
    description:
      "Your AI growth team for **SEO, content, backlinks and social.** Create once, get discovered, and reach customers everywhere.",
    reviewsLink: "Read what customers say",
    websiteLabel: "Your website address",
    emailLabel: "Your email address",
    websitePlaceholder: "yourwebsite.com",
    emailPlaceholder: "you@company.com",
    startTrial: "Start free trial",
    useEmail: "Use your email instead",
    useWebsite: "Use your website instead",
    invalidWebsite: "Please enter a website address, like yourwebsite.com.",
    invalidEmail: "Please enter a valid email address.",
    cards: [
      { title: "Social", detail: "Posts and videos for your channels" },
      { title: "SEO", detail: "Articles that answer real searches" },
      { title: "AI Mentions", detail: "ChatGPT, Gemini and more" },
      { title: "Backlinks", detail: "Relevant links from real sites" },
      { title: "Content", detail: "Articles written and published" },
      { title: "Insights", detail: "Search and AI results in one place" },
    ],
  },
  ribbon: {
    label: "Search, AI and social platforms",
    counterLabel: "Articles, posts and videos created with RepGet",
  },
  features: {
    eyebrow: "Top features",
    hint: "Pick a feature to see it in action",
    next: "Next feature",
    note: "Feature preview.",
    noteDetail: "Drawings of the product, not a real account.",
    items: [
      {
        nav: "Videos and slideshows every day",
        kicker: "Social content",
        title: "Videos and slideshows every day",
        description:
          "Ready-to-post short videos and slideshows for Instagram, TikTok, YouTube and Facebook. Approve them and publish from one place.",
        chips: ["Instagram", "YouTube", "TikTok"],
        listTitle: "Today's ideas",
        list: [
          { title: "3 tips your customers ask about", detail: "Video, 30 seconds" },
          { title: "Before and after", detail: "Slideshow, 6 slides" },
          { title: "Behind the scenes", detail: "Video, 45 seconds" },
        ],
        sideTitle: "Select platforms",
        sideBody: "Approve once: RepGet writes the caption and publishes at the time you choose.",
        tags: ["Instagram", "TikTok", "YouTube", "Facebook", "Pinterest"],
      },
      {
        nav: "Replies and posts on Reddit, Threads and more",
        kicker: "Community distribution",
        title: "Replies and posts where your customers talk",
        description:
          "Stay visible in real conversations. RepGet finds the discussions and drafts native replies and short posts around your offer.",
        chips: ["Reddit", "Threads", "Bluesky"],
        listTitle: "Reply queue",
        list: [
          { title: "Answer a question about your service", detail: "Reddit, a matching discussion" },
          { title: "Turn today's article into a short post", detail: "Threads, ready to review" },
          { title: "Join a conversation in your niche", detail: "Bluesky, reply drafted" },
        ],
        sideTitle: "Conversation themes",
        sideBody: "Picked from your website and your keywords.",
        tags: ["Your services", "Your city", "Common questions", "Your niche"],
      },
      {
        nav: "Blog articles for SEO and GEO",
        kicker: "SEO and GEO",
        title: "Blog articles that rank on Google and in AI answers",
        description:
          "Keyword opportunities become useful articles, written for classic search and for AI assistants, and published on your schedule.",
        chips: ["SEO", "GEO", "Articles"],
        listTitle: "Today's article brief",
        list: [
          { title: "Keyword chosen", detail: "Real search demand, realistic competition" },
          { title: "Outline and sources", detail: "Facts checked before writing" },
          { title: "Title, meta and images", detail: "Ready to publish" },
        ],
        sideTitle: "Publishing calendar",
        sideBody: "Articles are planned ahead and published to your site automatically.",
        tags: ["WordPress", "Shopify", "Webflow", "Wix", "Ghost"],
      },
      {
        nav: "Marketing fixes for your site",
        kicker: "Marketing fixes",
        title: "Clear fixes for your website and listings",
        description:
          "RepGet spots practical improvements to your pages, your offer and your profiles, and tells you which ones matter first.",
        chips: ["Website", "Listings", "Conversion"],
        listTitle: "High-impact fixes",
        list: [
          { title: "Strengthen your main call to action", detail: "Clearer words, fewer steps" },
          { title: "Make your offer easier to scan", detail: "Lead with what you do best" },
          { title: "Keep your profiles consistent", detail: "Same services, same details everywhere" },
        ],
        sideTitle: "Suggested focus",
        sideBody: "Quick wins first, deeper improvements next.",
        tags: ["Copy", "Structure", "Trust", "Speed"],
      },
      {
        nav: "Technical SEO and GEO checks",
        kicker: "Technical SEO",
        title: "Technical SEO and GEO checks for your site",
        description:
          "Find what stops search engines and AI assistants from reading your pages, then fix the essentials in order.",
        chips: ["SEO", "AI", "Audit"],
        listTitle: "Technical audit",
        list: [
          { title: "Structured data", detail: "Organisation, website and service details" },
          { title: "Indexing", detail: "Sitemap, robots and canonical tags" },
          { title: "AI readability", detail: "Clear facts about your business" },
        ],
        sideTitle: "Priority order",
        sideBody: "Every issue comes with what to change and why it matters.",
        tags: ["Speed", "Mobile", "Schema", "Links"],
      },
      {
        nav: "Analytics for search, AI and social",
        kicker: "Growth reporting",
        title: "Search, AI and social results in one view",
        description:
          "See clicks, rankings, AI mentions, published content and new links together, instead of in separate tools.",
        chips: ["Reporting", "Search", "Social"],
        listTitle: "Cross-channel overview",
        list: [
          { title: "Google clicks and rankings", detail: "From Search Console" },
          { title: "AI mentions", detail: "ChatGPT, Gemini, Claude and Perplexity" },
          { title: "Content and links", detail: "What was published and placed" },
        ],
        sideTitle: "What changed",
        sideBody: "Follow search, social and authority together.",
        tags: ["Clicks", "Mentions", "Articles", "Backlinks"],
      },
      {
        nav: "Your Growth Copilot",
        kicker: "Growth Copilot",
        title: "Your AI growth lead, in one conversation",
        description:
          "Ask the Growth Copilot what to do next. It turns your goals into a clear plan across content, SEO, AI search and social.",
        chips: ["Strategy", "Planning", "Actions"],
        listTitle: "This month's plan",
        list: [
          { title: "Sharpen your positioning", detail: "Homepage and offer" },
          { title: "Publish authority content", detail: "Articles and social posts" },
          { title: "Expand distribution", detail: "Communities and channels" },
        ],
        sideTitle: "What you get",
        sideBody: "A suggested plan and daily actions, without a complicated marketing stack.",
        tags: ["Ideas", "Priorities", "Next steps"],
      },
    ],
  },
  engines: {
    eyebrow: "One platform. Four growth engines.",
    title: "Growth from *every direction.*",
    sub: "Search, social, AI and authority working together, not in separate tools.",
    link: "See how the workflow connects",
    illustration: "Illustration",
    search: {
      title: "SEO that climbs.",
      body: "Be discovered when customers are searching.",
      foot: "Audits · Keywords · Rankings",
      label: "Organic visibility",
      value: "Going up",
      rise: "Growth trend",
      weeks: ["Week 1", "Week 4", "Week 8"],
    },
    social: {
      title: "Social that travels.",
      body: "One idea, beautifully distributed everywhere.",
      foot: "Plan · Create · Distribute",
      calendar: "Publishing calendar",
      scheduled: "Scheduled",
      queue: "One content queue",
      channels: "Multiple channels",
      ready: "Ready to publish",
    },
    ai: {
      title: "AI that mentions you.",
      body: "Become part of the answers people trust.",
      foot: "Monitor · Understand · Improve",
      question: "Which platform helps my business grow online?",
      answer: "**RepGet** brings search visibility, AI mentions and social content into one workflow.",
      found: "Brand found in AI answers",
    },
    links: {
      title: "Backlinks that build.",
      body: "Strengthen your brand with relevant links.",
      foot: "Backlinks · Indexing · Reports",
      label: "Relevant website mentions",
      network: "Authority network",
    },
  },
  video: {
    eyebrow: "The platform in action",
    caption: "Official RepGet walkthrough · about 2 minutes",
    mutedHint: "Playing without sound. Use the player to turn it on.",
  },
  steps: {
    kicker: "From sign-up to setup",
    title: "Be ready before your next coffee.",
    titleAccent: "Get started in 3 simple steps.",
    sub: "A few details to set up your growth workspace. No technical experience needed.",
    items: [
      { title: "Enter your website or email", body: "Share your domain, or use your email if you do not have a website yet." },
      { title: "Choose your plan", body: "Pick the level of SEO, content, backlinks and social growth that fits your business." },
      { title: "Connect your website", body: "Link your site or publishing platform, then review your workspace. You can add a website later, too." },
    ],
    emailInstead: "Or start with your email instead",
    planLabel: "Your growth plan",
    recommended: "Recommended",
    setupLabel: "Website setup",
    yourWebsite: "Your website",
    connectReview: "Connect and review setup",
    ready: "Ready to configure your workspace",
    connected: "Connected",
    cta: "Start free trial",
    footnote: "Start with a website or just your email.",
  },
  copilot: {
    strip: "Connect your website and favourite accounts",
    kicker: "Website + Social + AI Copilot",
    title: "Meet your Growth AI Copilot.",
    body: "Connect your website, your social channels and your data, then manage everything from one simple conversation.",
    points: [
      { lead: "Connect.", text: "Add your domain, search data and social profiles." },
      { lead: "Ask.", text: "Get audits, content plans, post ideas and growth actions." },
      { lead: "Publish.", text: "Approve once and let RepGet handle the work." },
    ],
    connect: "Connect your setup",
    watch: "Watch the demo",
    channelsConnected: "4 channels connected",
    userMessage: "Connect my website, Instagram and TikTok, then build me a growth plan for this month.",
    status: "Growth Copilot is connecting your website and channels",
    lines: ["Website audit ready", "Social accounts connected", "Drafting SEO, AI and social actions"],
    input: "Ask anything about your growth…",
  },
  founder: {
    eyebrow: "Built by",
    role: "Founder of RepGet",
    body:
      "After years creating for businesses and building digital projects, I wanted a simpler way to grow online. **RepGet brings SEO, AI visibility, content, backlinks and social distribution together** in one practical platform.",
    body2: "The idea is simple. Less time juggling tools, more time creating, connecting and growing.",
    yearsValue: "14+ years",
    yearsLabel: "creative production",
    ledValue: "Founder-led",
    ledLabel: "human-first growth",
  },
  reviews: {
    kicker: "Customer stories",
    title: "Loved by people who *build and grow.*",
    lead: "From creative studios to founders and agencies, here is what customers have shared about using RepGet.",
    proof: "Feedback from RepGet customers",
    pills: [
      "Better search visibility",
      "More consistent publishing",
      "Higher-quality enquiries",
      "Stronger AI discovery",
      "Clearer content planning",
      "Less manual SEO work",
      "Content and backlinks together",
      "A more reliable lead flow",
    ],
    readMore: "Read more",
    readLess: "Read less",
    showMore: "Show more reviews",
    showLess: "Show fewer reviews",
    videoTag: "Platform video",
    videoOverline: "See the platform in action",
    videoCaption: "Real product walkthrough",
    videoTitle: "See what one connected growth platform looks like.",
    videoNote: "This video shows RepGet itself. It is a product walkthrough, not a customer endorsement.",
    videoLink: "Watch the full demo",
    uiLines: ["More discoverable", "Better content planning", "Every channel connected"],
  },
  pricing: {
    eyebrow: "Simple, transparent growth",
    title: "One platform. *Everything to grow.*",
    sub: "SEO articles, backlinks, AI search visibility and social content. Every plan gives you the complete growth workflow, with more capacity as you scale.",
    included: ["SEO & articles", "AI visibility", "Backlinks", "Social publishing", "Growth Copilot"],
    allInOne: "All-in-one",
    articles: "SEO articles / month",
    keywords: "keywords tracked",
    everything: "Everything in the plan before, with more capacity",
    features: [
      "Website SEO and AI-readiness audit",
      "Keyword research, article writing and publishing",
      "Social content for your connected channels",
      "AI visibility across ChatGPT, Gemini, Claude and Perplexity",
      "Growth Copilot",
    ],
    scaleExtra: ["Priority processing: your articles are written first"],
    moreTitle: "Need more capacity?",
    moreBody: "Add more credits, backlinks or brand workspaces as your business grows.",
    talk: "Talk to our team",
  },
  faq: { eyebrow: "FAQ", contactLead: "Still have a question?", contact: "Contact us" },
  cta: {
    overline: "Ready to grow",
    title: "Your website could be *growing faster.*",
    body: "Start with a free website check, or create {n} free articles and see how RepGet turns one growth idea into SEO, AI visibility, backlinks and social momentum.",
    primary: "Check my website for free",
    secondary: "Create {n} articles for free",
    points: ["No account needed for the check", "Cancel any time", "Results in minutes"],
    pills: ["SEO", "Social", "AI Search", "Copilot"],
    panelTitle: "Everything in one place",
    panelBody: "Start free, then move into the full RepGet workflow when you are ready.",
    items: [
      { title: "Free website check", body: "See what is holding your website back, with clear next steps." },
      { title: "{n} free articles", body: "Try the content workflow before you commit." },
      { title: "Growth Copilot", body: "Ask for ideas, priorities and actions in one conversation." },
      { title: "Search and social workflow", body: "Create, adapt, publish and grow from one platform." },
    ],
  },
  menu: {
    features: "Features",
    integrations: "Integrations",
    featuresOverline: "Explore the platform",
    featuresTitle: "Everything you need to grow.",
    featuresTagline: "Six tools. One connected growth system.",
    next: "Next feature",
    open: "Learn more",
    bottom: "From first search to loyal customers. All connected in RepGet.",
    tools: [
      {
        title: "Content",
        sub: "Plan & publish",
        kicker: "Content & publishing",
        heading: "Go from idea to published.",
        body: "Build a consistent content engine with topic planning, AI-assisted drafts, review and publishing to your website.",
        steps: ["Plan topics", "Review drafts", "Publish"],
      },
      {
        title: "Social",
        sub: "Create & distribute",
        kicker: "Social content",
        heading: "Create once. Show up everywhere.",
        body: "Turn your ideas into ready-to-post social content, tailored for each platform, with a publishing calendar.",
        steps: ["Create", "Adapt", "Schedule"],
      },
      {
        title: "SEO",
        sub: "Get discovered",
        kicker: "Search visibility",
        heading: "Get found by the right customers.",
        body: "Understand your website's health, uncover search opportunities and see what to improve first.",
        steps: ["Audit", "Prioritise", "Improve"],
      },
      {
        title: "Backlinks",
        sub: "Build authority",
        kicker: "Backlinks & authority",
        heading: "Build authority that lasts.",
        body: "Earn relevant placements from our partner network and strengthen your website with useful references.",
        steps: ["Discover", "Qualify", "Build"],
      },
      {
        title: "AI Search",
        sub: "Earn mentions",
        kicker: "AI search visibility",
        heading: "Be part of the answer.",
        body: "See how AI assistants talk about your business and find ways to be mentioned more often.",
        steps: ["Monitor", "Understand", "Improve"],
      },
      {
        title: "Growth",
        sub: "See what works",
        kicker: "Reporting & growth",
        heading: "See what is moving the needle.",
        body: "Bring search, content and social activity into one clear picture, so every next decision is easier.",
        steps: ["Connect", "Measure", "Grow"],
      },
    ],
    socialHead: "Social channels",
    socialSub: "Create once. Make it native to every channel.",
    platforms: "{n} platforms",
    siteHead: "Website & data",
    siteSub: "Publish to your site. Measure what matters.",
    connections: "{n} connections",
    footerTitle: "Beyond social. Your complete growth engine.",
    footerBody: "Create content, grow in search, build authority and get discovered by AI.",
    explore: "See the setup guides",
  },
};

const es: HomeRedesignCopy = {
  hero: {
    eyebrow: "Una plataforma de crecimiento para búsqueda, IA y redes",
    titleLine1: "Aparezca en *Google* y en la IA.",
    titleLine2: "Crezca en las *redes.*",
    description:
      "Su equipo de crecimiento con IA para **SEO, contenido, backlinks y redes sociales.** Cree una vez, hágase visible y llegue a sus clientes en todas partes.",
    reviewsLink: "Lea lo que dicen los clientes",
    websiteLabel: "La dirección de su sitio web",
    emailLabel: "Su correo electrónico",
    websitePlaceholder: "susitioweb.com",
    emailPlaceholder: "usted@empresa.com",
    startTrial: "Empezar la prueba gratis",
    useEmail: "Usar su correo en su lugar",
    useWebsite: "Usar su sitio web en su lugar",
    invalidWebsite: "Escriba la dirección de un sitio web, como susitioweb.com.",
    invalidEmail: "Escriba un correo electrónico válido.",
    cards: [
      { title: "Redes", detail: "Publicaciones y vídeos para sus canales" },
      { title: "SEO", detail: "Artículos que responden a búsquedas reales" },
      { title: "Menciones en IA", detail: "ChatGPT, Gemini y más" },
      { title: "Backlinks", detail: "Enlaces relevantes de sitios reales" },
      { title: "Contenido", detail: "Artículos escritos y publicados" },
      { title: "Resultados", detail: "Búsqueda e IA en un solo lugar" },
    ],
  },
  ribbon: {
    label: "Plataformas de búsqueda, IA y redes",
    counterLabel: "Artículos, publicaciones y vídeos creados con RepGet",
  },
  features: {
    eyebrow: "Funciones principales",
    hint: "Elija una función para verla en acción",
    next: "Siguiente función",
    note: "Vista previa de la función.",
    noteDetail: "Dibujos del producto, no una cuenta real.",
    items: [
      {
        nav: "Vídeos y presentaciones cada día",
        kicker: "Contenido social",
        title: "Vídeos y presentaciones cada día",
        description:
          "Vídeos cortos y presentaciones listos para Instagram, TikTok, YouTube y Facebook. Apruébelos y publíquelos desde un solo lugar.",
        chips: ["Instagram", "YouTube", "TikTok"],
        listTitle: "Ideas de hoy",
        list: [
          { title: "3 consejos que piden sus clientes", detail: "Vídeo, 30 segundos" },
          { title: "Antes y después", detail: "Presentación, 6 diapositivas" },
          { title: "Entre bastidores", detail: "Vídeo, 45 segundos" },
        ],
        sideTitle: "Elija las plataformas",
        sideBody: "Apruebe una vez: RepGet escribe el texto y publica a la hora que usted elija.",
        tags: ["Instagram", "TikTok", "YouTube", "Facebook", "Pinterest"],
      },
      {
        nav: "Respuestas y publicaciones en Reddit, Threads y más",
        kicker: "Distribución en comunidades",
        title: "Respuestas y publicaciones donde hablan sus clientes",
        description:
          "Esté presente en conversaciones reales. RepGet encuentra los debates y redacta respuestas naturales y publicaciones breves sobre su oferta.",
        chips: ["Reddit", "Threads", "Bluesky"],
        listTitle: "Respuestas en cola",
        list: [
          { title: "Responder una pregunta sobre su servicio", detail: "Reddit, un debate relacionado" },
          { title: "Convertir el artículo de hoy en una publicación", detail: "Threads, lista para revisar" },
          { title: "Participar en una conversación de su sector", detail: "Bluesky, respuesta redactada" },
        ],
        sideTitle: "Temas de conversación",
        sideBody: "Elegidos a partir de su sitio web y sus palabras clave.",
        tags: ["Sus servicios", "Su ciudad", "Preguntas frecuentes", "Su sector"],
      },
      {
        nav: "Artículos de blog para SEO y GEO",
        kicker: "SEO y GEO",
        title: "Artículos que posicionan en Google y en respuestas de IA",
        description:
          "Las oportunidades de palabras clave se convierten en artículos útiles, escritos para la búsqueda clásica y para los asistentes de IA, y publicados según su calendario.",
        chips: ["SEO", "GEO", "Artículos"],
        listTitle: "Resumen del artículo de hoy",
        list: [
          { title: "Palabra clave elegida", detail: "Demanda real, competencia asumible" },
          { title: "Estructura y fuentes", detail: "Datos comprobados antes de escribir" },
          { title: "Título, meta e imágenes", detail: "Listo para publicar" },
        ],
        sideTitle: "Calendario de publicación",
        sideBody: "Los artículos se planifican con antelación y se publican en su sitio automáticamente.",
        tags: ["WordPress", "Shopify", "Webflow", "Wix", "Ghost"],
      },
      {
        nav: "Mejoras de marketing para su sitio",
        kicker: "Mejoras de marketing",
        title: "Mejoras claras para su sitio y sus perfiles",
        description:
          "RepGet detecta mejoras prácticas en sus páginas, su oferta y sus perfiles, y le indica cuáles importan primero.",
        chips: ["Sitio web", "Perfiles", "Conversión"],
        listTitle: "Mejoras de mayor impacto",
        list: [
          { title: "Reforzar su llamada a la acción", detail: "Palabras más claras, menos pasos" },
          { title: "Hacer su oferta más fácil de leer", detail: "Empiece por lo que mejor hace" },
          { title: "Mantener sus perfiles coherentes", detail: "Mismos servicios y datos en todas partes" },
        ],
        sideTitle: "Enfoque sugerido",
        sideBody: "Primero las mejoras rápidas, después las más profundas.",
        tags: ["Textos", "Estructura", "Confianza", "Velocidad"],
      },
      {
        nav: "Revisiones técnicas de SEO y GEO",
        kicker: "SEO técnico",
        title: "Revisiones técnicas de SEO y GEO para su sitio",
        description:
          "Descubra qué impide a los buscadores y a los asistentes de IA leer sus páginas y corrija lo esencial por orden.",
        chips: ["SEO", "IA", "Auditoría"],
        listTitle: "Auditoría técnica",
        list: [
          { title: "Datos estructurados", detail: "Organización, sitio web y servicios" },
          { title: "Indexación", detail: "Sitemap, robots y etiquetas canónicas" },
          { title: "Legibilidad para la IA", detail: "Datos claros sobre su negocio" },
        ],
        sideTitle: "Orden de prioridad",
        sideBody: "Cada problema indica qué cambiar y por qué importa.",
        tags: ["Velocidad", "Móvil", "Schema", "Enlaces"],
      },
      {
        nav: "Analítica de búsqueda, IA y redes",
        kicker: "Informes de crecimiento",
        title: "Resultados de búsqueda, IA y redes en una vista",
        description:
          "Vea juntos los clics, las posiciones, las menciones en IA, el contenido publicado y los nuevos enlaces, sin herramientas separadas.",
        chips: ["Informes", "Búsqueda", "Redes"],
        listTitle: "Vista de todos los canales",
        list: [
          { title: "Clics y posiciones en Google", detail: "Desde Search Console" },
          { title: "Menciones en IA", detail: "ChatGPT, Gemini, Claude y Perplexity" },
          { title: "Contenido y enlaces", detail: "Lo que se ha publicado y colocado" },
        ],
        sideTitle: "Qué ha cambiado",
        sideBody: "Siga la búsqueda, las redes y la autoridad a la vez.",
        tags: ["Clics", "Menciones", "Artículos", "Backlinks"],
      },
      {
        nav: "Su Growth Copilot",
        kicker: "Growth Copilot",
        title: "Su responsable de crecimiento con IA, en una conversación",
        description:
          "Pregunte al Growth Copilot qué hacer a continuación. Convierte sus objetivos en un plan claro de contenido, SEO, búsqueda con IA y redes.",
        chips: ["Estrategia", "Plan", "Acciones"],
        listTitle: "El plan de este mes",
        list: [
          { title: "Afinar su posicionamiento", detail: "Página de inicio y oferta" },
          { title: "Publicar contenido de autoridad", detail: "Artículos y publicaciones" },
          { title: "Ampliar la distribución", detail: "Comunidades y canales" },
        ],
        sideTitle: "Qué obtiene",
        sideBody: "Un plan sugerido y acciones diarias, sin herramientas de marketing complicadas.",
        tags: ["Ideas", "Prioridades", "Próximos pasos"],
      },
    ],
  },
  engines: {
    eyebrow: "Una plataforma. Cuatro motores de crecimiento.",
    title: "Crecimiento en *todas direcciones.*",
    sub: "Búsqueda, redes, IA y autoridad trabajando juntas, no en herramientas separadas.",
    link: "Vea cómo se conecta todo",
    illustration: "Ilustración",
    search: {
      title: "SEO que sube.",
      body: "Aparezca cuando sus clientes buscan.",
      foot: "Auditorías · Palabras clave · Posiciones",
      label: "Visibilidad orgánica",
      value: "En aumento",
      rise: "Tendencia",
      weeks: ["Semana 1", "Semana 4", "Semana 8"],
    },
    social: {
      title: "Redes que viajan.",
      body: "Una idea, bien distribuida en todas partes.",
      foot: "Planificar · Crear · Distribuir",
      calendar: "Calendario de publicación",
      scheduled: "Programado",
      queue: "Una sola cola de contenido",
      channels: "Varios canales",
      ready: "Listo para publicar",
    },
    ai: {
      title: "IA que le menciona.",
      body: "Forme parte de las respuestas en las que la gente confía.",
      foot: "Vigilar · Entender · Mejorar",
      question: "¿Qué plataforma ayuda a mi negocio a crecer en internet?",
      answer: "**RepGet** reúne la visibilidad en búsqueda, las menciones en IA y el contenido social en un solo flujo.",
      found: "Marca encontrada en respuestas de IA",
    },
    links: {
      title: "Backlinks que construyen.",
      body: "Refuerce su marca con enlaces relevantes.",
      foot: "Backlinks · Indexación · Informes",
      label: "Menciones en sitios relevantes",
      network: "Red de autoridad",
    },
  },
  video: {
    eyebrow: "La plataforma en acción",
    caption: "Recorrido oficial de RepGet · unos 2 minutos",
    mutedHint: "Se reproduce sin sonido. Actívelo desde el reproductor.",
  },
  steps: {
    kicker: "Del registro a la configuración",
    title: "Listo antes de su próximo café.",
    titleAccent: "Empiece en 3 pasos sencillos.",
    sub: "Unos pocos datos para preparar su espacio de crecimiento. Sin conocimientos técnicos.",
    items: [
      { title: "Escriba su sitio web o su correo", body: "Indique su dominio, o use su correo si todavía no tiene sitio web." },
      { title: "Elija su plan", body: "Elija el nivel de SEO, contenido, backlinks y redes que se ajusta a su negocio." },
      { title: "Conecte su sitio web", body: "Enlace su sitio o su plataforma de publicación y revise su espacio. También puede añadir el sitio más tarde." },
    ],
    emailInstead: "O empiece con su correo",
    planLabel: "Su plan de crecimiento",
    recommended: "Recomendado",
    setupLabel: "Configuración del sitio",
    yourWebsite: "Su sitio web",
    connectReview: "Conectar y revisar",
    ready: "Listo para configurar su espacio",
    connected: "Conectado",
    cta: "Empezar la prueba gratis",
    footnote: "Empiece con un sitio web o solo con su correo.",
  },
  copilot: {
    strip: "Conecte su sitio web y sus cuentas favoritas",
    kicker: "Sitio web + Redes + Copiloto de IA",
    title: "Conozca su Growth Copilot de IA.",
    body: "Conecte su sitio web, sus redes y sus datos, y gestione todo desde una conversación sencilla.",
    points: [
      { lead: "Conecte.", text: "Añada su dominio, sus datos de búsqueda y sus perfiles sociales." },
      { lead: "Pregunte.", text: "Obtenga auditorías, planes de contenido, ideas y acciones de crecimiento." },
      { lead: "Publique.", text: "Apruebe una vez y RepGet se encarga del trabajo." },
    ],
    connect: "Conectar su configuración",
    watch: "Ver la demostración",
    channelsConnected: "4 canales conectados",
    userMessage: "Conecta mi sitio web, Instagram y TikTok, y prepárame un plan de crecimiento para este mes.",
    status: "Growth Copilot está conectando su sitio y sus canales",
    lines: ["Auditoría del sitio lista", "Cuentas sociales conectadas", "Preparando acciones de SEO, IA y redes"],
    input: "Pregunte lo que quiera sobre su crecimiento…",
  },
  founder: {
    eyebrow: "Creado por",
    role: "Fundador de RepGet",
    body:
      "Después de años creando para empresas y desarrollando proyectos digitales, quería una forma más sencilla de crecer en internet. **RepGet reúne SEO, visibilidad en IA, contenido, backlinks y distribución en redes** en una plataforma práctica.",
    body2: "La idea es sencilla: menos tiempo con herramientas, más tiempo para crear, conectar y crecer.",
    yearsValue: "Más de 14 años",
    yearsLabel: "de producción creativa",
    ledValue: "Dirigido por su fundador",
    ledLabel: "crecimiento con trato humano",
  },
  reviews: {
    kicker: "Historias de clientes",
    title: "Elegido por quienes *crean y crecen.*",
    lead: "De estudios creativos a fundadores y agencias: esto es lo que los clientes han contado sobre RepGet.",
    proof: "Opiniones de clientes de RepGet",
    pills: [
      "Más visibilidad en búsquedas",
      "Publicación más constante",
      "Consultas de más calidad",
      "Más presencia en la IA",
      "Planificación de contenido más clara",
      "Menos trabajo manual de SEO",
      "Contenido y backlinks juntos",
      "Un flujo de clientes más fiable",
    ],
    readMore: "Leer más",
    readLess: "Leer menos",
    showMore: "Ver más opiniones",
    showLess: "Ver menos opiniones",
    videoTag: "Vídeo de la plataforma",
    videoOverline: "Vea la plataforma en acción",
    videoCaption: "Recorrido real del producto",
    videoTitle: "Así es una plataforma de crecimiento conectada.",
    videoNote: "Este vídeo muestra RepGet. Es un recorrido del producto, no una recomendación de un cliente.",
    videoLink: "Ver la demostración completa",
    uiLines: ["Más visible", "Mejor planificación", "Todos los canales conectados"],
  },
  pricing: {
    eyebrow: "Crecimiento sencillo y transparente",
    title: "Una plataforma. *Todo para crecer.*",
    sub: "Artículos SEO, backlinks, visibilidad en búsquedas con IA y contenido social. Cada plan incluye el flujo completo, con más capacidad a medida que crece.",
    included: ["SEO y artículos", "Visibilidad en IA", "Backlinks", "Publicación en redes", "Growth Copilot"],
    allInOne: "Todo en uno",
    articles: "artículos SEO / mes",
    keywords: "palabras clave seguidas",
    everything: "Todo lo del plan anterior, con más capacidad",
    features: [
      "Auditoría SEO y de preparación para la IA",
      "Investigación de palabras clave, redacción y publicación",
      "Contenido social para sus canales conectados",
      "Visibilidad en ChatGPT, Gemini, Claude y Perplexity",
      "Growth Copilot",
    ],
    scaleExtra: ["Prioridad: sus artículos se escriben primero"],
    moreTitle: "¿Necesita más capacidad?",
    moreBody: "Añada más créditos, backlinks o espacios de marca a medida que crece su negocio.",
    talk: "Hable con nuestro equipo",
  },
  faq: { eyebrow: "Preguntas", contactLead: "¿Le queda alguna duda?", contact: "Contáctenos" },
  cta: {
    overline: "Listo para crecer",
    title: "Su sitio web podría *crecer más rápido.*",
    body: "Empiece con una revisión gratuita de su sitio o cree {n} artículos gratis y vea cómo RepGet convierte una idea en SEO, visibilidad en IA, backlinks e impulso en redes.",
    primary: "Revisar mi sitio gratis",
    secondary: "Crear {n} artículos gratis",
    points: ["Sin cuenta para la revisión", "Cancele cuando quiera", "Resultados en minutos"],
    pills: ["SEO", "Redes", "Búsqueda con IA", "Copilot"],
    panelTitle: "Todo en un solo lugar",
    panelBody: "Empiece gratis y pase al flujo completo de RepGet cuando quiera.",
    items: [
      { title: "Revisión gratuita del sitio", body: "Vea qué frena a su sitio, con pasos claros." },
      { title: "{n} artículos gratis", body: "Pruebe el flujo de contenido antes de comprometerse." },
      { title: "Growth Copilot", body: "Pida ideas, prioridades y acciones en una conversación." },
      { title: "Búsqueda y redes juntas", body: "Cree, adapte, publique y crezca desde una plataforma." },
    ],
  },
  menu: {
    features: "Funciones",
    integrations: "Integraciones",
    featuresOverline: "Explore la plataforma",
    featuresTitle: "Todo lo que necesita para crecer.",
    featuresTagline: "Seis herramientas. Un sistema de crecimiento conectado.",
    next: "Siguiente función",
    open: "Más información",
    bottom: "De la primera búsqueda a clientes fieles. Todo conectado en RepGet.",
    tools: [
      { title: "Contenido", sub: "Planificar y publicar", kicker: "Contenido y publicación", heading: "De la idea a la publicación.", body: "Un motor de contenido constante: planificación de temas, borradores con IA, revisión y publicación en su sitio.", steps: ["Planificar", "Revisar", "Publicar"] },
      { title: "Redes", sub: "Crear y distribuir", kicker: "Contenido social", heading: "Cree una vez. Aparezca en todas partes.", body: "Convierta sus ideas en contenido listo para cada red, con un calendario de publicación.", steps: ["Crear", "Adaptar", "Programar"] },
      { title: "SEO", sub: "Hacerse visible", kicker: "Visibilidad en búsquedas", heading: "Que le encuentren los clientes adecuados.", body: "Conozca la salud de su sitio, descubra oportunidades de búsqueda y vea qué mejorar primero.", steps: ["Auditar", "Priorizar", "Mejorar"] },
      { title: "Backlinks", sub: "Ganar autoridad", kicker: "Backlinks y autoridad", heading: "Autoridad que perdura.", body: "Consiga enlaces relevantes de nuestra red de socios y refuerce su sitio con referencias útiles.", steps: ["Descubrir", "Validar", "Construir"] },
      { title: "Búsqueda con IA", sub: "Ganar menciones", kicker: "Visibilidad en IA", heading: "Forme parte de la respuesta.", body: "Vea cómo hablan de su negocio los asistentes de IA y cómo conseguir más menciones.", steps: ["Vigilar", "Entender", "Mejorar"] },
      { title: "Crecimiento", sub: "Ver qué funciona", kicker: "Informes y crecimiento", heading: "Vea qué le hace avanzar.", body: "Búsqueda, contenido y redes en una sola imagen clara, para decidir mejor el siguiente paso.", steps: ["Conectar", "Medir", "Crecer"] },
    ],
    socialHead: "Redes sociales",
    socialSub: "Cree una vez. Adaptado a cada red.",
    platforms: "{n} plataformas",
    siteHead: "Sitio web y datos",
    siteSub: "Publique en su sitio. Mida lo que importa.",
    connections: "{n} conexiones",
    footerTitle: "Más allá de las redes. Su motor de crecimiento completo.",
    footerBody: "Cree contenido, crezca en búsquedas, gane autoridad y aparezca en la IA.",
    explore: "Ver las guías de configuración",
  },
};

const fr: HomeRedesignCopy = {
  hero: {
    eyebrow: "Une plateforme de croissance pour la recherche, l’IA et les réseaux",
    titleLine1: "Soyez *trouvé* sur Google et l’IA.",
    titleLine2: "Grandissez sur les *réseaux.*",
    description:
      "Votre équipe de croissance IA pour **le SEO, le contenu, les backlinks et les réseaux sociaux.** Créez une fois, gagnez en visibilité et touchez vos clients partout.",
    reviewsLink: "Lire les avis des clients",
    websiteLabel: "L’adresse de votre site",
    emailLabel: "Votre adresse e-mail",
    websitePlaceholder: "votresite.com",
    emailPlaceholder: "vous@entreprise.com",
    startTrial: "Commencer l’essai gratuit",
    useEmail: "Utiliser votre e-mail à la place",
    useWebsite: "Utiliser votre site à la place",
    invalidWebsite: "Saisissez l’adresse d’un site, par exemple votresite.com.",
    invalidEmail: "Saisissez une adresse e-mail valide.",
    cards: [
      { title: "Réseaux", detail: "Publications et vidéos pour vos canaux" },
      { title: "SEO", detail: "Des articles qui répondent à de vraies recherches" },
      { title: "Mentions IA", detail: "ChatGPT, Gemini et plus" },
      { title: "Backlinks", detail: "Des liens pertinents de vrais sites" },
      { title: "Contenu", detail: "Articles rédigés et publiés" },
      { title: "Résultats", detail: "Recherche et IA au même endroit" },
    ],
  },
  ribbon: {
    label: "Plateformes de recherche, d’IA et de réseaux",
    counterLabel: "Articles, publications et vidéos créés avec RepGet",
  },
  features: {
    eyebrow: "Fonctionnalités clés",
    hint: "Choisissez une fonctionnalité pour la voir en action",
    next: "Fonctionnalité suivante",
    note: "Aperçu de la fonctionnalité.",
    noteDetail: "Des illustrations du produit, pas un vrai compte.",
    items: [
      {
        nav: "Vidéos et diaporamas chaque jour",
        kicker: "Contenu social",
        title: "Vidéos et diaporamas chaque jour",
        description:
          "Des vidéos courtes et des diaporamas prêts à publier sur Instagram, TikTok, YouTube et Facebook. Validez-les et publiez depuis un seul endroit.",
        chips: ["Instagram", "YouTube", "TikTok"],
        listTitle: "Les idées du jour",
        list: [
          { title: "3 conseils que vos clients demandent", detail: "Vidéo, 30 secondes" },
          { title: "Avant / après", detail: "Diaporama, 6 visuels" },
          { title: "Dans les coulisses", detail: "Vidéo, 45 secondes" },
        ],
        sideTitle: "Choisir les plateformes",
        sideBody: "Validez une fois : RepGet rédige la légende et publie à l’heure choisie.",
        tags: ["Instagram", "TikTok", "YouTube", "Facebook", "Pinterest"],
      },
      {
        nav: "Réponses et publications sur Reddit, Threads et plus",
        kicker: "Diffusion dans les communautés",
        title: "Réponses et publications là où vos clients discutent",
        description:
          "Restez présent dans les vraies conversations. RepGet trouve les discussions et rédige des réponses naturelles et de courtes publications autour de votre offre.",
        chips: ["Reddit", "Threads", "Bluesky"],
        listTitle: "Réponses en attente",
        list: [
          { title: "Répondre à une question sur votre service", detail: "Reddit, une discussion liée" },
          { title: "Transformer l’article du jour en publication", detail: "Threads, prête à relire" },
          { title: "Rejoindre une conversation de votre secteur", detail: "Bluesky, réponse rédigée" },
        ],
        sideTitle: "Thèmes de conversation",
        sideBody: "Choisis à partir de votre site et de vos mots-clés.",
        tags: ["Vos services", "Votre ville", "Questions fréquentes", "Votre secteur"],
      },
      {
        nav: "Articles de blog pour le SEO et le GEO",
        kicker: "SEO et GEO",
        title: "Des articles qui se positionnent sur Google et dans les réponses IA",
        description:
          "Les opportunités de mots-clés deviennent des articles utiles, écrits pour la recherche classique et pour les assistants IA, et publiés selon votre calendrier.",
        chips: ["SEO", "GEO", "Articles"],
        listTitle: "Le brief de l’article du jour",
        list: [
          { title: "Mot-clé choisi", detail: "Vraie demande, concurrence réaliste" },
          { title: "Plan et sources", detail: "Faits vérifiés avant la rédaction" },
          { title: "Titre, méta et images", detail: "Prêt à publier" },
        ],
        sideTitle: "Calendrier de publication",
        sideBody: "Les articles sont planifiés à l’avance et publiés automatiquement sur votre site.",
        tags: ["WordPress", "Shopify", "Webflow", "Wix", "Ghost"],
      },
      {
        nav: "Améliorations marketing pour votre site",
        kicker: "Améliorations marketing",
        title: "Des améliorations claires pour votre site et vos fiches",
        description:
          "RepGet repère des améliorations concrètes pour vos pages, votre offre et vos profils, et vous dit lesquelles comptent d’abord.",
        chips: ["Site", "Fiches", "Conversion"],
        listTitle: "Améliorations à fort impact",
        list: [
          { title: "Renforcer votre appel à l’action", detail: "Des mots plus clairs, moins d’étapes" },
          { title: "Rendre votre offre plus lisible", detail: "Commencez par ce que vous faites le mieux" },
          { title: "Garder des profils cohérents", detail: "Mêmes services et infos partout" },
        ],
        sideTitle: "Priorité suggérée",
        sideBody: "D’abord les gains rapides, puis les améliorations de fond.",
        tags: ["Textes", "Structure", "Confiance", "Vitesse"],
      },
      {
        nav: "Contrôles SEO et GEO techniques",
        kicker: "SEO technique",
        title: "Contrôles SEO et GEO techniques de votre site",
        description:
          "Trouvez ce qui empêche les moteurs de recherche et les assistants IA de lire vos pages, puis corrigez l’essentiel dans l’ordre.",
        chips: ["SEO", "IA", "Audit"],
        listTitle: "Audit technique",
        list: [
          { title: "Données structurées", detail: "Organisation, site et services" },
          { title: "Indexation", detail: "Sitemap, robots et balises canoniques" },
          { title: "Lisibilité pour l’IA", detail: "Des faits clairs sur votre activité" },
        ],
        sideTitle: "Ordre de priorité",
        sideBody: "Chaque problème indique quoi changer et pourquoi.",
        tags: ["Vitesse", "Mobile", "Schema", "Liens"],
      },
      {
        nav: "Statistiques recherche, IA et réseaux",
        kicker: "Suivi de la croissance",
        title: "Recherche, IA et réseaux dans une seule vue",
        description:
          "Voyez ensemble les clics, les positions, les mentions IA, le contenu publié et les nouveaux liens, sans outils séparés.",
        chips: ["Rapports", "Recherche", "Réseaux"],
        listTitle: "Vue de tous les canaux",
        list: [
          { title: "Clics et positions Google", detail: "Depuis la Search Console" },
          { title: "Mentions IA", detail: "ChatGPT, Gemini, Claude et Perplexity" },
          { title: "Contenu et liens", detail: "Ce qui a été publié et placé" },
        ],
        sideTitle: "Ce qui a changé",
        sideBody: "Suivez la recherche, les réseaux et l’autorité ensemble.",
        tags: ["Clics", "Mentions", "Articles", "Backlinks"],
      },
      {
        nav: "Votre Growth Copilot",
        kicker: "Growth Copilot",
        title: "Votre responsable croissance IA, dans une conversation",
        description:
          "Demandez au Growth Copilot quoi faire ensuite. Il transforme vos objectifs en un plan clair pour le contenu, le SEO, la recherche IA et les réseaux.",
        chips: ["Stratégie", "Plan", "Actions"],
        listTitle: "Le plan du mois",
        list: [
          { title: "Affiner votre positionnement", detail: "Page d’accueil et offre" },
          { title: "Publier du contenu d’autorité", detail: "Articles et publications" },
          { title: "Élargir la diffusion", detail: "Communautés et canaux" },
        ],
        sideTitle: "Ce que vous obtenez",
        sideBody: "Un plan suggéré et des actions quotidiennes, sans outils marketing compliqués.",
        tags: ["Idées", "Priorités", "Prochaines étapes"],
      },
    ],
  },
  engines: {
    eyebrow: "Une plateforme. Quatre moteurs de croissance.",
    title: "La croissance dans *toutes les directions.*",
    sub: "Recherche, réseaux, IA et autorité qui travaillent ensemble, pas dans des outils séparés.",
    link: "Voir comment tout se connecte",
    illustration: "Illustration",
    search: {
      title: "Un SEO qui progresse.",
      body: "Soyez trouvé quand vos clients cherchent.",
      foot: "Audits · Mots-clés · Positions",
      label: "Visibilité organique",
      value: "En hausse",
      rise: "Tendance",
      weeks: ["Semaine 1", "Semaine 4", "Semaine 8"],
    },
    social: {
      title: "Des réseaux qui portent.",
      body: "Une idée, bien diffusée partout.",
      foot: "Planifier · Créer · Diffuser",
      calendar: "Calendrier de publication",
      scheduled: "Programmé",
      queue: "Une seule file de contenu",
      channels: "Plusieurs canaux",
      ready: "Prêt à publier",
    },
    ai: {
      title: "Une IA qui vous cite.",
      body: "Faites partie des réponses auxquelles on se fie.",
      foot: "Suivre · Comprendre · Améliorer",
      question: "Quelle plateforme aide mon entreprise à grandir en ligne ?",
      answer: "**RepGet** réunit visibilité dans la recherche, mentions IA et contenu social dans un seul flux.",
      found: "Marque trouvée dans les réponses IA",
    },
    links: {
      title: "Des backlinks qui construisent.",
      body: "Renforcez votre marque avec des liens pertinents.",
      foot: "Backlinks · Indexation · Rapports",
      label: "Mentions sur des sites pertinents",
      network: "Réseau d’autorité",
    },
  },
  video: {
    eyebrow: "La plateforme en action",
    caption: "Présentation officielle de RepGet · environ 2 minutes",
    mutedHint: "Lecture sans le son. Activez-le dans le lecteur.",
  },
  steps: {
    kicker: "De l’inscription à la configuration",
    title: "Prêt avant votre prochain café.",
    titleAccent: "Démarrez en 3 étapes simples.",
    sub: "Quelques informations pour préparer votre espace de croissance. Aucune compétence technique nécessaire.",
    items: [
      { title: "Saisissez votre site ou votre e-mail", body: "Indiquez votre domaine, ou votre e-mail si vous n’avez pas encore de site." },
      { title: "Choisissez votre formule", body: "Choisissez le niveau de SEO, de contenu, de backlinks et de réseaux qui convient à votre activité." },
      { title: "Connectez votre site", body: "Reliez votre site ou votre outil de publication, puis vérifiez votre espace. Vous pouvez aussi ajouter un site plus tard." },
    ],
    emailInstead: "Ou commencez avec votre e-mail",
    planLabel: "Votre formule de croissance",
    recommended: "Recommandé",
    setupLabel: "Configuration du site",
    yourWebsite: "Votre site",
    connectReview: "Connecter et vérifier",
    ready: "Prêt à configurer votre espace",
    connected: "Connecté",
    cta: "Commencer l’essai gratuit",
    footnote: "Commencez avec un site ou simplement votre e-mail.",
  },
  copilot: {
    strip: "Connectez votre site et vos comptes préférés",
    kicker: "Site + Réseaux + Copilote IA",
    title: "Découvrez votre Growth Copilot IA.",
    body: "Connectez votre site, vos réseaux et vos données, puis pilotez tout depuis une simple conversation.",
    points: [
      { lead: "Connectez.", text: "Ajoutez votre domaine, vos données de recherche et vos profils sociaux." },
      { lead: "Demandez.", text: "Obtenez des audits, des plans de contenu, des idées et des actions." },
      { lead: "Publiez.", text: "Validez une fois et laissez RepGet s’occuper du reste." },
    ],
    connect: "Connecter votre configuration",
    watch: "Voir la démo",
    channelsConnected: "4 canaux connectés",
    userMessage: "Connecte mon site, Instagram et TikTok, puis prépare-moi un plan de croissance pour ce mois-ci.",
    status: "Growth Copilot connecte votre site et vos canaux",
    lines: ["Audit du site prêt", "Comptes sociaux connectés", "Préparation des actions SEO, IA et réseaux"],
    input: "Posez une question sur votre croissance…",
  },
  founder: {
    eyebrow: "Créé par",
    role: "Fondateur de RepGet",
    body:
      "Après des années à créer pour des entreprises et à mener des projets numériques, je voulais une façon plus simple de grandir en ligne. **RepGet réunit le SEO, la visibilité IA, le contenu, les backlinks et la diffusion sur les réseaux** dans une plateforme pratique.",
    body2: "L’idée est simple : moins de temps à jongler entre les outils, plus de temps pour créer, échanger et grandir.",
    yearsValue: "Plus de 14 ans",
    yearsLabel: "de production créative",
    ledValue: "Dirigé par son fondateur",
    ledLabel: "une croissance à visage humain",
  },
  reviews: {
    kicker: "Témoignages clients",
    title: "Apprécié par ceux qui *créent et grandissent.*",
    lead: "Studios créatifs, fondateurs, agences : voici ce que des clients ont partagé sur RepGet.",
    proof: "Avis de clients RepGet",
    pills: [
      "Plus de visibilité dans la recherche",
      "Une publication plus régulière",
      "Des demandes de meilleure qualité",
      "Plus de présence dans l’IA",
      "Un planning de contenu plus clair",
      "Moins de SEO manuel",
      "Contenu et backlinks ensemble",
      "Un flux de prospects plus fiable",
    ],
    readMore: "Lire la suite",
    readLess: "Réduire",
    showMore: "Voir plus d’avis",
    showLess: "Voir moins d’avis",
    videoTag: "Vidéo de la plateforme",
    videoOverline: "Voir la plateforme en action",
    videoCaption: "Vraie présentation du produit",
    videoTitle: "À quoi ressemble une plateforme de croissance connectée.",
    videoNote: "Cette vidéo présente RepGet. C’est une démonstration du produit, pas une recommandation de client.",
    videoLink: "Voir la démo complète",
    uiLines: ["Plus visible", "Meilleur planning", "Tous les canaux connectés"],
  },
  pricing: {
    eyebrow: "Une croissance simple et transparente",
    title: "Une plateforme. *Tout pour grandir.*",
    sub: "Articles SEO, backlinks, visibilité dans la recherche IA et contenu social. Chaque formule comprend tout le flux de croissance, avec plus de capacité quand vous grandissez.",
    included: ["SEO et articles", "Visibilité IA", "Backlinks", "Publication sur les réseaux", "Growth Copilot"],
    allInOne: "Tout-en-un",
    articles: "articles SEO / mois",
    keywords: "mots-clés suivis",
    everything: "Tout ce que contient la formule précédente, avec plus de capacité",
    features: [
      "Audit SEO et de préparation à l’IA",
      "Recherche de mots-clés, rédaction et publication",
      "Contenu social pour vos canaux connectés",
      "Visibilité dans ChatGPT, Gemini, Claude et Perplexity",
      "Growth Copilot",
    ],
    scaleExtra: ["Traitement prioritaire : vos articles sont rédigés en premier"],
    moreTitle: "Besoin de plus de capacité ?",
    moreBody: "Ajoutez des crédits, des backlinks ou des espaces de marque au fil de votre croissance.",
    talk: "Parler à notre équipe",
  },
  faq: { eyebrow: "FAQ", contactLead: "Une autre question ?", contact: "Contactez-nous" },
  cta: {
    overline: "Prêt à grandir",
    title: "Votre site pourrait *grandir plus vite.*",
    body: "Commencez par une analyse gratuite de votre site, ou créez {n} articles gratuits et voyez comment RepGet transforme une idée en SEO, visibilité IA, backlinks et élan sur les réseaux.",
    primary: "Analyser mon site gratuitement",
    secondary: "Créer {n} articles gratuits",
    points: ["Aucun compte pour l’analyse", "Résiliable à tout moment", "Résultats en quelques minutes"],
    pills: ["SEO", "Réseaux", "Recherche IA", "Copilot"],
    panelTitle: "Tout au même endroit",
    panelBody: "Commencez gratuitement, puis passez au flux complet de RepGet quand vous êtes prêt.",
    items: [
      { title: "Analyse gratuite du site", body: "Voyez ce qui freine votre site, avec des étapes claires." },
      { title: "{n} articles gratuits", body: "Testez le flux de contenu avant de vous engager." },
      { title: "Growth Copilot", body: "Demandez des idées, des priorités et des actions en une conversation." },
      { title: "Recherche et réseaux ensemble", body: "Créez, adaptez, publiez et grandissez depuis une plateforme." },
    ],
  },
  menu: {
    features: "Fonctionnalités",
    integrations: "Intégrations",
    featuresOverline: "Découvrir la plateforme",
    featuresTitle: "Tout ce qu’il faut pour grandir.",
    featuresTagline: "Six outils. Un système de croissance connecté.",
    next: "Fonctionnalité suivante",
    open: "En savoir plus",
    bottom: "De la première recherche aux clients fidèles. Tout est connecté dans RepGet.",
    tools: [
      { title: "Contenu", sub: "Planifier et publier", kicker: "Contenu et publication", heading: "De l’idée à la publication.", body: "Un moteur de contenu régulier : planification des sujets, brouillons assistés par l’IA, relecture et publication sur votre site.", steps: ["Planifier", "Relire", "Publier"] },
      { title: "Réseaux", sub: "Créer et diffuser", kicker: "Contenu social", heading: "Créez une fois. Soyez partout.", body: "Transformez vos idées en contenu prêt à publier, adapté à chaque réseau, avec un calendrier de publication.", steps: ["Créer", "Adapter", "Programmer"] },
      { title: "SEO", sub: "Être trouvé", kicker: "Visibilité dans la recherche", heading: "Soyez trouvé par les bons clients.", body: "Comprenez la santé de votre site, découvrez des opportunités et voyez quoi améliorer d’abord.", steps: ["Auditer", "Prioriser", "Améliorer"] },
      { title: "Backlinks", sub: "Gagner en autorité", kicker: "Backlinks et autorité", heading: "Une autorité qui dure.", body: "Obtenez des liens pertinents de notre réseau de partenaires et renforcez votre site avec des références utiles.", steps: ["Découvrir", "Qualifier", "Construire"] },
      { title: "Recherche IA", sub: "Être cité", kicker: "Visibilité dans l’IA", heading: "Faites partie de la réponse.", body: "Voyez comment les assistants IA parlent de votre entreprise et comment être cité plus souvent.", steps: ["Suivre", "Comprendre", "Améliorer"] },
      { title: "Croissance", sub: "Voir ce qui marche", kicker: "Rapports et croissance", heading: "Voyez ce qui fait la différence.", body: "Recherche, contenu et réseaux dans une seule vue claire, pour mieux décider de la suite.", steps: ["Connecter", "Mesurer", "Grandir"] },
    ],
    socialHead: "Réseaux sociaux",
    socialSub: "Créez une fois. Natif sur chaque réseau.",
    platforms: "{n} plateformes",
    siteHead: "Site et données",
    siteSub: "Publiez sur votre site. Mesurez l’essentiel.",
    connections: "{n} connexions",
    footerTitle: "Au-delà des réseaux. Votre moteur de croissance complet.",
    footerBody: "Créez du contenu, progressez dans la recherche, gagnez en autorité et soyez cité par l’IA.",
    explore: "Voir les guides de configuration",
  },
};

const it: HomeRedesignCopy = {
  hero: {
    eyebrow: "Un’unica piattaforma di crescita per ricerca, IA e social",
    titleLine1: "Si faccia *trovare* su Google e nell’IA.",
    titleLine2: "Cresca sui *social.*",
    description:
      "Il Suo team di crescita con IA per **SEO, contenuti, backlink e social.** Crei una volta, si faccia trovare e raggiunga i clienti ovunque.",
    reviewsLink: "Legga cosa dicono i clienti",
    websiteLabel: "L’indirizzo del Suo sito",
    emailLabel: "Il Suo indirizzo email",
    websitePlaceholder: "ilsuosito.com",
    emailPlaceholder: "lei@azienda.com",
    startTrial: "Inizi la prova gratuita",
    useEmail: "Usi l’email al suo posto",
    useWebsite: "Usi il sito al suo posto",
    invalidWebsite: "Inserisca l’indirizzo di un sito, ad esempio ilsuosito.com.",
    invalidEmail: "Inserisca un indirizzo email valido.",
    cards: [
      { title: "Social", detail: "Post e video per i Suoi canali" },
      { title: "SEO", detail: "Articoli che rispondono a ricerche reali" },
      { title: "Menzioni IA", detail: "ChatGPT, Gemini e altri" },
      { title: "Backlink", detail: "Link pertinenti da siti reali" },
      { title: "Contenuti", detail: "Articoli scritti e pubblicati" },
      { title: "Risultati", detail: "Ricerca e IA in un unico posto" },
    ],
  },
  ribbon: {
    label: "Piattaforme di ricerca, IA e social",
    counterLabel: "Articoli, post e video creati con RepGet",
  },
  features: {
    eyebrow: "Funzioni principali",
    hint: "Scelga una funzione per vederla in azione",
    next: "Funzione successiva",
    note: "Anteprima della funzione.",
    noteDetail: "Illustrazioni del prodotto, non un account reale.",
    items: [
      {
        nav: "Video e slideshow ogni giorno",
        kicker: "Contenuti social",
        title: "Video e slideshow ogni giorno",
        description:
          "Video brevi e slideshow pronti per Instagram, TikTok, YouTube e Facebook. Li approvi e li pubblichi da un unico posto.",
        chips: ["Instagram", "YouTube", "TikTok"],
        listTitle: "Le idee di oggi",
        list: [
          { title: "3 consigli che i clienti chiedono", detail: "Video, 30 secondi" },
          { title: "Prima e dopo", detail: "Slideshow, 6 slide" },
          { title: "Dietro le quinte", detail: "Video, 45 secondi" },
        ],
        sideTitle: "Scelga le piattaforme",
        sideBody: "Approvi una volta: RepGet scrive la didascalia e pubblica all’ora che sceglie.",
        tags: ["Instagram", "TikTok", "YouTube", "Facebook", "Pinterest"],
      },
      {
        nav: "Risposte e post su Reddit, Threads e altri",
        kicker: "Distribuzione nelle community",
        title: "Risposte e post dove parlano i Suoi clienti",
        description:
          "Resti presente nelle conversazioni reali. RepGet trova le discussioni e prepara risposte naturali e post brevi sulla Sua offerta.",
        chips: ["Reddit", "Threads", "Bluesky"],
        listTitle: "Risposte in coda",
        list: [
          { title: "Rispondere a una domanda sul Suo servizio", detail: "Reddit, una discussione affine" },
          { title: "Trasformare l’articolo di oggi in un post", detail: "Threads, pronto da rivedere" },
          { title: "Partecipare a una conversazione del settore", detail: "Bluesky, risposta pronta" },
        ],
        sideTitle: "Temi di conversazione",
        sideBody: "Scelti dal Suo sito e dalle Sue parole chiave.",
        tags: ["I Suoi servizi", "La Sua città", "Domande frequenti", "Il Suo settore"],
      },
      {
        nav: "Articoli di blog per SEO e GEO",
        kicker: "SEO e GEO",
        title: "Articoli che si posizionano su Google e nelle risposte IA",
        description:
          "Le opportunità di parole chiave diventano articoli utili, scritti per la ricerca classica e per gli assistenti IA, e pubblicati secondo il Suo calendario.",
        chips: ["SEO", "GEO", "Articoli"],
        listTitle: "Il brief dell’articolo di oggi",
        list: [
          { title: "Parola chiave scelta", detail: "Domanda reale, concorrenza sostenibile" },
          { title: "Struttura e fonti", detail: "Fatti verificati prima di scrivere" },
          { title: "Titolo, meta e immagini", detail: "Pronto da pubblicare" },
        ],
        sideTitle: "Calendario di pubblicazione",
        sideBody: "Gli articoli sono pianificati in anticipo e pubblicati sul Suo sito in automatico.",
        tags: ["WordPress", "Shopify", "Webflow", "Wix", "Ghost"],
      },
      {
        nav: "Miglioramenti di marketing per il sito",
        kicker: "Miglioramenti di marketing",
        title: "Miglioramenti chiari per il Suo sito e i Suoi profili",
        description:
          "RepGet individua miglioramenti concreti per le Sue pagine, la Sua offerta e i Suoi profili, e Le dice quali contano prima.",
        chips: ["Sito", "Profili", "Conversioni"],
        listTitle: "Miglioramenti ad alto impatto",
        list: [
          { title: "Rafforzare la call to action", detail: "Parole più chiare, meno passaggi" },
          { title: "Rendere l’offerta più leggibile", detail: "Parta da ciò che fa meglio" },
          { title: "Mantenere i profili coerenti", detail: "Stessi servizi e dati ovunque" },
        ],
        sideTitle: "Priorità suggerita",
        sideBody: "Prima i risultati rapidi, poi i miglioramenti più profondi.",
        tags: ["Testi", "Struttura", "Fiducia", "Velocità"],
      },
      {
        nav: "Controlli tecnici SEO e GEO",
        kicker: "SEO tecnico",
        title: "Controlli tecnici SEO e GEO per il Suo sito",
        description:
          "Scopra cosa impedisce a motori di ricerca e assistenti IA di leggere le Sue pagine e sistemi l’essenziale in ordine.",
        chips: ["SEO", "IA", "Audit"],
        listTitle: "Audit tecnico",
        list: [
          { title: "Dati strutturati", detail: "Organizzazione, sito e servizi" },
          { title: "Indicizzazione", detail: "Sitemap, robots e tag canonici" },
          { title: "Leggibilità per l’IA", detail: "Informazioni chiare sulla Sua attività" },
        ],
        sideTitle: "Ordine di priorità",
        sideBody: "Ogni problema indica cosa cambiare e perché conta.",
        tags: ["Velocità", "Mobile", "Schema", "Link"],
      },
      {
        nav: "Analisi di ricerca, IA e social",
        kicker: "Report di crescita",
        title: "Risultati di ricerca, IA e social in un’unica vista",
        description:
          "Veda insieme clic, posizioni, menzioni IA, contenuti pubblicati e nuovi link, senza strumenti separati.",
        chips: ["Report", "Ricerca", "Social"],
        listTitle: "Panoramica di tutti i canali",
        list: [
          { title: "Clic e posizioni su Google", detail: "Da Search Console" },
          { title: "Menzioni IA", detail: "ChatGPT, Gemini, Claude e Perplexity" },
          { title: "Contenuti e link", detail: "Cosa è stato pubblicato e inserito" },
        ],
        sideTitle: "Cosa è cambiato",
        sideBody: "Segua insieme ricerca, social e autorevolezza.",
        tags: ["Clic", "Menzioni", "Articoli", "Backlink"],
      },
      {
        nav: "Il Suo Growth Copilot",
        kicker: "Growth Copilot",
        title: "Il Suo responsabile della crescita con IA, in una conversazione",
        description:
          "Chieda al Growth Copilot cosa fare dopo. Trasforma i Suoi obiettivi in un piano chiaro per contenuti, SEO, ricerca IA e social.",
        chips: ["Strategia", "Piano", "Azioni"],
        listTitle: "Il piano del mese",
        list: [
          { title: "Affinare il posizionamento", detail: "Home page e offerta" },
          { title: "Pubblicare contenuti autorevoli", detail: "Articoli e post" },
          { title: "Ampliare la distribuzione", detail: "Community e canali" },
        ],
        sideTitle: "Cosa ottiene",
        sideBody: "Un piano suggerito e azioni quotidiane, senza strumenti di marketing complicati.",
        tags: ["Idee", "Priorità", "Prossimi passi"],
      },
    ],
  },
  engines: {
    eyebrow: "Una piattaforma. Quattro motori di crescita.",
    title: "Crescita in *ogni direzione.*",
    sub: "Ricerca, social, IA e autorevolezza che lavorano insieme, non in strumenti separati.",
    link: "Veda come si collega tutto",
    illustration: "Illustrazione",
    search: {
      title: "Una SEO che sale.",
      body: "Si faccia trovare quando i clienti cercano.",
      foot: "Audit · Parole chiave · Posizioni",
      label: "Visibilità organica",
      value: "In crescita",
      rise: "Tendenza",
      weeks: ["Settimana 1", "Settimana 4", "Settimana 8"],
    },
    social: {
      title: "Social che arrivano lontano.",
      body: "Un’idea, distribuita bene ovunque.",
      foot: "Pianificare · Creare · Distribuire",
      calendar: "Calendario di pubblicazione",
      scheduled: "Programmato",
      queue: "Un’unica coda di contenuti",
      channels: "Più canali",
      ready: "Pronto da pubblicare",
    },
    ai: {
      title: "Un’IA che La cita.",
      body: "Entri nelle risposte di cui le persone si fidano.",
      foot: "Monitorare · Capire · Migliorare",
      question: "Quale piattaforma aiuta la mia attività a crescere online?",
      answer: "**RepGet** riunisce visibilità nella ricerca, menzioni IA e contenuti social in un unico flusso.",
      found: "Marchio trovato nelle risposte IA",
    },
    links: {
      title: "Backlink che costruiscono.",
      body: "Rafforzi il Suo marchio con link pertinenti.",
      foot: "Backlink · Indicizzazione · Report",
      label: "Menzioni su siti pertinenti",
      network: "Rete di autorevolezza",
    },
  },
  video: {
    eyebrow: "La piattaforma in azione",
    caption: "Presentazione ufficiale di RepGet · circa 2 minuti",
    mutedHint: "In riproduzione senza audio. Lo attivi dal lettore.",
  },
  steps: {
    kicker: "Dalla registrazione alla configurazione",
    title: "Pronto prima del prossimo caffè.",
    titleAccent: "Inizi in 3 semplici passi.",
    sub: "Pochi dati per preparare il Suo spazio di crescita. Nessuna competenza tecnica richiesta.",
    items: [
      { title: "Inserisca il sito o l’email", body: "Indichi il Suo dominio, o usi l’email se non ha ancora un sito." },
      { title: "Scelga il piano", body: "Scelga il livello di SEO, contenuti, backlink e social adatto alla Sua attività." },
      { title: "Colleghi il Suo sito", body: "Colleghi il sito o la piattaforma di pubblicazione, poi controlli il Suo spazio. Può anche aggiungere il sito più tardi." },
    ],
    emailInstead: "Oppure inizi con l’email",
    planLabel: "Il Suo piano di crescita",
    recommended: "Consigliato",
    setupLabel: "Configurazione del sito",
    yourWebsite: "Il Suo sito",
    connectReview: "Colleghi e controlli",
    ready: "Pronto a configurare il Suo spazio",
    connected: "Collegato",
    cta: "Inizi la prova gratuita",
    footnote: "Inizi con un sito o solo con l’email.",
  },
  copilot: {
    strip: "Colleghi il Suo sito e i Suoi account preferiti",
    kicker: "Sito + Social + Copilota IA",
    title: "Scopra il Suo Growth Copilot IA.",
    body: "Colleghi sito, canali social e dati, poi gestisca tutto da una semplice conversazione.",
    points: [
      { lead: "Colleghi.", text: "Aggiunga dominio, dati di ricerca e profili social." },
      { lead: "Chieda.", text: "Ottenga audit, piani di contenuti, idee e azioni di crescita." },
      { lead: "Pubblichi.", text: "Approvi una volta e RepGet si occupa del lavoro." },
    ],
    connect: "Colleghi la Sua configurazione",
    watch: "Guardi la demo",
    channelsConnected: "4 canali collegati",
    userMessage: "Collega il mio sito, Instagram e TikTok, poi preparami un piano di crescita per questo mese.",
    status: "Growth Copilot sta collegando il Suo sito e i Suoi canali",
    lines: ["Audit del sito pronto", "Account social collegati", "Preparazione di azioni SEO, IA e social"],
    input: "Chieda qualsiasi cosa sulla Sua crescita…",
  },
  founder: {
    eyebrow: "Creato da",
    role: "Fondatore di RepGet",
    body:
      "Dopo anni passati a creare per le aziende e a sviluppare progetti digitali, volevo un modo più semplice per crescere online. **RepGet riunisce SEO, visibilità nell’IA, contenuti, backlink e distribuzione sui social** in un’unica piattaforma pratica.",
    body2: "L’idea è semplice: meno tempo a destreggiarsi tra strumenti, più tempo per creare, connettersi e crescere.",
    yearsValue: "Oltre 14 anni",
    yearsLabel: "di produzione creativa",
    ledValue: "Guidato dal fondatore",
    ledLabel: "crescita a misura d’uomo",
  },
  reviews: {
    kicker: "Storie dei clienti",
    title: "Scelto da chi *crea e cresce.*",
    lead: "Da studi creativi a fondatori e agenzie: ecco cosa hanno raccontato i clienti di RepGet.",
    proof: "Opinioni dei clienti di RepGet",
    pills: [
      "Più visibilità nella ricerca",
      "Pubblicazione più costante",
      "Richieste di qualità migliore",
      "Più presenza nell’IA",
      "Pianificazione dei contenuti più chiara",
      "Meno lavoro SEO manuale",
      "Contenuti e backlink insieme",
      "Un flusso di contatti più affidabile",
    ],
    readMore: "Leggi tutto",
    readLess: "Riduci",
    showMore: "Mostra altre recensioni",
    showLess: "Mostra meno recensioni",
    videoTag: "Video della piattaforma",
    videoOverline: "Veda la piattaforma in azione",
    videoCaption: "Presentazione reale del prodotto",
    videoTitle: "Ecco com’è una piattaforma di crescita collegata.",
    videoNote: "Questo video mostra RepGet. È una presentazione del prodotto, non la raccomandazione di un cliente.",
    videoLink: "Guardi la demo completa",
    uiLines: ["Più visibile", "Pianificazione migliore", "Tutti i canali collegati"],
  },
  pricing: {
    eyebrow: "Crescita semplice e trasparente",
    title: "Una piattaforma. *Tutto per crescere.*",
    sub: "Articoli SEO, backlink, visibilità nella ricerca IA e contenuti social. Ogni piano include l’intero flusso di crescita, con più capacità man mano che cresce.",
    included: ["SEO e articoli", "Visibilità IA", "Backlink", "Pubblicazione social", "Growth Copilot"],
    allInOne: "Tutto in uno",
    articles: "articoli SEO / mese",
    keywords: "parole chiave monitorate",
    everything: "Tutto quello del piano precedente, con più capacità",
    features: [
      "Audit SEO e di preparazione all’IA",
      "Ricerca di parole chiave, scrittura e pubblicazione",
      "Contenuti social per i Suoi canali collegati",
      "Visibilità in ChatGPT, Gemini, Claude e Perplexity",
      "Growth Copilot",
    ],
    scaleExtra: ["Elaborazione prioritaria: i Suoi articoli vengono scritti per primi"],
    moreTitle: "Le serve più capacità?",
    moreBody: "Aggiunga crediti, backlink o spazi per altri marchi man mano che la Sua attività cresce.",
    talk: "Parli con il nostro team",
  },
  faq: { eyebrow: "FAQ", contactLead: "Ha ancora una domanda?", contact: "Ci contatti" },
  cta: {
    overline: "Pronto a crescere",
    title: "Il Suo sito potrebbe *crescere più in fretta.*",
    body: "Inizi con un controllo gratuito del sito, o crei {n} articoli gratis e veda come RepGet trasforma un’idea in SEO, visibilità IA, backlink e slancio sui social.",
    primary: "Controlli il mio sito gratis",
    secondary: "Crei {n} articoli gratis",
    points: ["Nessun account per il controllo", "Disdetta in qualsiasi momento", "Risultati in pochi minuti"],
    pills: ["SEO", "Social", "Ricerca IA", "Copilot"],
    panelTitle: "Tutto in un unico posto",
    panelBody: "Inizi gratis, poi passi al flusso completo di RepGet quando è pronto.",
    items: [
      { title: "Controllo gratuito del sito", body: "Veda cosa frena il Suo sito, con passi chiari." },
      { title: "{n} articoli gratis", body: "Provi il flusso dei contenuti prima di impegnarsi." },
      { title: "Growth Copilot", body: "Chieda idee, priorità e azioni in una conversazione." },
      { title: "Ricerca e social insieme", body: "Crei, adatti, pubblichi e cresca da un’unica piattaforma." },
    ],
  },
  menu: {
    features: "Funzioni",
    integrations: "Integrazioni",
    featuresOverline: "Esplori la piattaforma",
    featuresTitle: "Tutto ciò che serve per crescere.",
    featuresTagline: "Sei strumenti. Un sistema di crescita collegato.",
    next: "Funzione successiva",
    open: "Scopra di più",
    bottom: "Dalla prima ricerca ai clienti fedeli. Tutto collegato in RepGet.",
    tools: [
      { title: "Contenuti", sub: "Pianificare e pubblicare", kicker: "Contenuti e pubblicazione", heading: "Dall’idea alla pubblicazione.", body: "Un motore di contenuti costante: pianificazione dei temi, bozze con l’IA, revisione e pubblicazione sul Suo sito.", steps: ["Pianificare", "Rivedere", "Pubblicare"] },
      { title: "Social", sub: "Creare e distribuire", kicker: "Contenuti social", heading: "Crei una volta. Sia ovunque.", body: "Trasformi le Sue idee in contenuti pronti, adattati a ogni piattaforma, con un calendario di pubblicazione.", steps: ["Creare", "Adattare", "Programmare"] },
      { title: "SEO", sub: "Farsi trovare", kicker: "Visibilità nella ricerca", heading: "Si faccia trovare dai clienti giusti.", body: "Capisca la salute del Suo sito, scopra opportunità di ricerca e veda cosa migliorare prima.", steps: ["Analizzare", "Dare priorità", "Migliorare"] },
      { title: "Backlink", sub: "Costruire autorevolezza", kicker: "Backlink e autorevolezza", heading: "Un’autorevolezza che dura.", body: "Ottenga link pertinenti dalla nostra rete di partner e rafforzi il sito con riferimenti utili.", steps: ["Scoprire", "Valutare", "Costruire"] },
      { title: "Ricerca IA", sub: "Ottenere menzioni", kicker: "Visibilità nell’IA", heading: "Entri nella risposta.", body: "Veda come gli assistenti IA parlano della Sua attività e come essere citato più spesso.", steps: ["Monitorare", "Capire", "Migliorare"] },
      { title: "Crescita", sub: "Vedere cosa funziona", kicker: "Report e crescita", heading: "Veda cosa fa la differenza.", body: "Ricerca, contenuti e social in un’unica vista chiara, per decidere meglio il passo successivo.", steps: ["Collegare", "Misurare", "Crescere"] },
    ],
    socialHead: "Canali social",
    socialSub: "Crei una volta. Nativo su ogni canale.",
    platforms: "{n} piattaforme",
    siteHead: "Sito e dati",
    siteSub: "Pubblichi sul sito. Misuri ciò che conta.",
    connections: "{n} collegamenti",
    footerTitle: "Oltre i social. Il Suo motore di crescita completo.",
    footerBody: "Crei contenuti, cresca nella ricerca, costruisca autorevolezza e si faccia trovare dall’IA.",
    explore: "Veda le guide di configurazione",
  },
};

const de: HomeRedesignCopy = {
  hero: {
    eyebrow: "Eine Wachstumsplattform für Suche, KI und Social Media",
    titleLine1: "Bei Google und KI *gefunden* werden.",
    titleLine2: "Auf *Social Media* wachsen.",
    description:
      "Ihr KI-Wachstumsteam für **SEO, Inhalte, Backlinks und Social Media.** Einmal erstellen, gefunden werden und Kunden überall erreichen.",
    reviewsLink: "Lesen Sie, was Kunden sagen",
    websiteLabel: "Ihre Website-Adresse",
    emailLabel: "Ihre E-Mail-Adresse",
    websitePlaceholder: "ihrewebsite.de",
    emailPlaceholder: "sie@firma.de",
    startTrial: "Kostenlos testen",
    useEmail: "Stattdessen E-Mail verwenden",
    useWebsite: "Stattdessen Website verwenden",
    invalidWebsite: "Bitte geben Sie eine Website-Adresse ein, z. B. ihrewebsite.de.",
    invalidEmail: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    cards: [
      { title: "Social Media", detail: "Beiträge und Videos für Ihre Kanäle" },
      { title: "SEO", detail: "Artikel zu echten Suchanfragen" },
      { title: "KI-Erwähnungen", detail: "ChatGPT, Gemini und mehr" },
      { title: "Backlinks", detail: "Relevante Links von echten Websites" },
      { title: "Inhalte", detail: "Artikel geschrieben und veröffentlicht" },
      { title: "Ergebnisse", detail: "Suche und KI an einem Ort" },
    ],
  },
  ribbon: {
    label: "Such-, KI- und Social-Media-Plattformen",
    counterLabel: "Mit RepGet erstellte Artikel, Beiträge und Videos",
  },
  features: {
    eyebrow: "Wichtigste Funktionen",
    hint: "Wählen Sie eine Funktion, um sie in Aktion zu sehen",
    next: "Nächste Funktion",
    note: "Funktionsvorschau.",
    noteDetail: "Zeichnungen des Produkts, kein echtes Konto.",
    items: [
      {
        nav: "Videos und Slideshows jeden Tag",
        kicker: "Social-Media-Inhalte",
        title: "Videos und Slideshows jeden Tag",
        description:
          "Kurze Videos und Slideshows, fertig für Instagram, TikTok, YouTube und Facebook. Freigeben und an einem Ort veröffentlichen.",
        chips: ["Instagram", "YouTube", "TikTok"],
        listTitle: "Ideen für heute",
        list: [
          { title: "3 Tipps, nach denen Kunden fragen", detail: "Video, 30 Sekunden" },
          { title: "Vorher und nachher", detail: "Slideshow, 6 Folien" },
          { title: "Hinter den Kulissen", detail: "Video, 45 Sekunden" },
        ],
        sideTitle: "Plattformen wählen",
        sideBody: "Einmal freigeben: RepGet schreibt den Text und veröffentlicht zur gewählten Zeit.",
        tags: ["Instagram", "TikTok", "YouTube", "Facebook", "Pinterest"],
      },
      {
        nav: "Antworten und Beiträge auf Reddit, Threads und mehr",
        kicker: "Verbreitung in Communitys",
        title: "Antworten und Beiträge dort, wo Ihre Kunden sprechen",
        description:
          "Bleiben Sie in echten Gesprächen sichtbar. RepGet findet Diskussionen und entwirft passende Antworten und kurze Beiträge zu Ihrem Angebot.",
        chips: ["Reddit", "Threads", "Bluesky"],
        listTitle: "Antworten in der Warteschlange",
        list: [
          { title: "Eine Frage zu Ihrer Leistung beantworten", detail: "Reddit, eine passende Diskussion" },
          { title: "Den heutigen Artikel zum Beitrag machen", detail: "Threads, bereit zur Prüfung" },
          { title: "An einem Gespräch Ihrer Branche teilnehmen", detail: "Bluesky, Antwort entworfen" },
        ],
        sideTitle: "Gesprächsthemen",
        sideBody: "Ausgewählt anhand Ihrer Website und Ihrer Keywords.",
        tags: ["Ihre Leistungen", "Ihre Stadt", "Häufige Fragen", "Ihre Branche"],
      },
      {
        nav: "Blogartikel für SEO und GEO",
        kicker: "SEO und GEO",
        title: "Artikel, die bei Google und in KI-Antworten ranken",
        description:
          "Keyword-Chancen werden zu nützlichen Artikeln, geschrieben für die klassische Suche und für KI-Assistenten, und nach Ihrem Plan veröffentlicht.",
        chips: ["SEO", "GEO", "Artikel"],
        listTitle: "Briefing für den heutigen Artikel",
        list: [
          { title: "Keyword ausgewählt", detail: "Echte Nachfrage, machbarer Wettbewerb" },
          { title: "Gliederung und Quellen", detail: "Fakten vor dem Schreiben geprüft" },
          { title: "Titel, Meta und Bilder", detail: "Bereit zur Veröffentlichung" },
        ],
        sideTitle: "Veröffentlichungsplan",
        sideBody: "Artikel werden im Voraus geplant und automatisch auf Ihrer Website veröffentlicht.",
        tags: ["WordPress", "Shopify", "Webflow", "Wix", "Ghost"],
      },
      {
        nav: "Marketing-Verbesserungen für Ihre Website",
        kicker: "Marketing-Verbesserungen",
        title: "Klare Verbesserungen für Ihre Website und Profile",
        description:
          "RepGet findet konkrete Verbesserungen für Ihre Seiten, Ihr Angebot und Ihre Profile und zeigt, welche zuerst zählen.",
        chips: ["Website", "Profile", "Conversion"],
        listTitle: "Verbesserungen mit großer Wirkung",
        list: [
          { title: "Ihren Call-to-Action stärken", detail: "Klarere Worte, weniger Schritte" },
          { title: "Ihr Angebot leichter lesbar machen", detail: "Mit Ihrer größten Stärke beginnen" },
          { title: "Profile einheitlich halten", detail: "Überall dieselben Leistungen und Angaben" },
        ],
        sideTitle: "Empfohlener Fokus",
        sideBody: "Zuerst schnelle Erfolge, dann tiefere Verbesserungen.",
        tags: ["Texte", "Struktur", "Vertrauen", "Tempo"],
      },
      {
        nav: "Technische SEO- und GEO-Prüfungen",
        kicker: "Technisches SEO",
        title: "Technische SEO- und GEO-Prüfungen für Ihre Website",
        description:
          "Finden Sie heraus, was Suchmaschinen und KI-Assistenten am Lesen Ihrer Seiten hindert, und beheben Sie das Wichtigste der Reihe nach.",
        chips: ["SEO", "KI", "Audit"],
        listTitle: "Technisches Audit",
        list: [
          { title: "Strukturierte Daten", detail: "Organisation, Website und Leistungen" },
          { title: "Indexierung", detail: "Sitemap, robots und Canonical-Tags" },
          { title: "Lesbarkeit für KI", detail: "Klare Fakten über Ihr Unternehmen" },
        ],
        sideTitle: "Reihenfolge",
        sideBody: "Zu jedem Problem steht, was zu ändern ist und warum.",
        tags: ["Tempo", "Mobil", "Schema", "Links"],
      },
      {
        nav: "Auswertungen für Suche, KI und Social Media",
        kicker: "Wachstumsberichte",
        title: "Suche, KI und Social Media in einer Ansicht",
        description:
          "Sehen Sie Klicks, Rankings, KI-Erwähnungen, veröffentlichte Inhalte und neue Links zusammen statt in getrennten Tools.",
        chips: ["Berichte", "Suche", "Social Media"],
        listTitle: "Alle Kanäle im Überblick",
        list: [
          { title: "Google-Klicks und Rankings", detail: "Aus der Search Console" },
          { title: "KI-Erwähnungen", detail: "ChatGPT, Gemini, Claude und Perplexity" },
          { title: "Inhalte und Links", detail: "Was veröffentlicht und platziert wurde" },
        ],
        sideTitle: "Was sich geändert hat",
        sideBody: "Suche, Social Media und Autorität gemeinsam verfolgen.",
        tags: ["Klicks", "Erwähnungen", "Artikel", "Backlinks"],
      },
      {
        nav: "Ihr Growth Copilot",
        kicker: "Growth Copilot",
        title: "Ihre KI-Wachstumsleitung, in einem Gespräch",
        description:
          "Fragen Sie den Growth Copilot, was als Nächstes zu tun ist. Er macht aus Ihren Zielen einen klaren Plan für Inhalte, SEO, KI-Suche und Social Media.",
        chips: ["Strategie", "Plan", "Aktionen"],
        listTitle: "Der Plan für diesen Monat",
        list: [
          { title: "Positionierung schärfen", detail: "Startseite und Angebot" },
          { title: "Inhalte mit Autorität veröffentlichen", detail: "Artikel und Beiträge" },
          { title: "Reichweite ausbauen", detail: "Communitys und Kanäle" },
        ],
        sideTitle: "Was Sie bekommen",
        sideBody: "Einen Vorschlag für den Plan und tägliche Aktionen, ohne komplizierte Marketing-Tools.",
        tags: ["Ideen", "Prioritäten", "Nächste Schritte"],
      },
    ],
  },
  engines: {
    eyebrow: "Eine Plattform. Vier Wachstumsmotoren.",
    title: "Wachstum aus *allen Richtungen.*",
    sub: "Suche, Social Media, KI und Autorität arbeiten zusammen statt in getrennten Tools.",
    link: "So greift alles ineinander",
    illustration: "Illustration",
    search: {
      title: "SEO, das steigt.",
      body: "Gefunden werden, wenn Kunden suchen.",
      foot: "Audits · Keywords · Rankings",
      label: "Organische Sichtbarkeit",
      value: "Steigend",
      rise: "Trend",
      weeks: ["Woche 1", "Woche 4", "Woche 8"],
    },
    social: {
      title: "Social Media, das ankommt.",
      body: "Eine Idee, überall gut verteilt.",
      foot: "Planen · Erstellen · Verteilen",
      calendar: "Veröffentlichungsplan",
      scheduled: "Geplant",
      queue: "Eine Warteschlange für Inhalte",
      channels: "Mehrere Kanäle",
      ready: "Bereit zur Veröffentlichung",
    },
    ai: {
      title: "KI, die Sie nennt.",
      body: "Teil der Antworten werden, denen Menschen vertrauen.",
      foot: "Beobachten · Verstehen · Verbessern",
      question: "Welche Plattform hilft meinem Unternehmen, online zu wachsen?",
      answer: "**RepGet** vereint Sichtbarkeit in der Suche, KI-Erwähnungen und Social-Media-Inhalte in einem Ablauf.",
      found: "Marke in KI-Antworten gefunden",
    },
    links: {
      title: "Backlinks, die aufbauen.",
      body: "Stärken Sie Ihre Marke mit relevanten Links.",
      foot: "Backlinks · Indexierung · Berichte",
      label: "Erwähnungen auf relevanten Websites",
      network: "Autoritätsnetzwerk",
    },
  },
  video: {
    eyebrow: "Die Plattform in Aktion",
    caption: "Offizieller RepGet-Rundgang · etwa 2 Minuten",
    mutedHint: "Läuft ohne Ton. Schalten Sie ihn im Player ein.",
  },
  steps: {
    kicker: "Von der Anmeldung zur Einrichtung",
    title: "Startklar vor dem nächsten Kaffee.",
    titleAccent: "In 3 einfachen Schritten loslegen.",
    sub: "Ein paar Angaben, um Ihren Wachstumsbereich einzurichten. Keine technischen Kenntnisse nötig.",
    items: [
      { title: "Website oder E-Mail eingeben", body: "Geben Sie Ihre Domain an, oder Ihre E-Mail, wenn Sie noch keine Website haben." },
      { title: "Tarif wählen", body: "Wählen Sie den Umfang an SEO, Inhalten, Backlinks und Social Media, der zu Ihrem Unternehmen passt." },
      { title: "Website verbinden", body: "Verbinden Sie Ihre Website oder Ihr Publishing-Tool und prüfen Sie Ihren Bereich. Eine Website können Sie auch später hinzufügen." },
    ],
    emailInstead: "Oder mit Ihrer E-Mail starten",
    planLabel: "Ihr Wachstumstarif",
    recommended: "Empfohlen",
    setupLabel: "Website-Einrichtung",
    yourWebsite: "Ihre Website",
    connectReview: "Verbinden und prüfen",
    ready: "Bereit zur Einrichtung Ihres Bereichs",
    connected: "Verbunden",
    cta: "Kostenlos testen",
    footnote: "Starten Sie mit einer Website oder nur mit Ihrer E-Mail.",
  },
  copilot: {
    strip: "Verbinden Sie Ihre Website und Ihre Lieblingskonten",
    kicker: "Website + Social Media + KI-Copilot",
    title: "Lernen Sie Ihren Growth Copilot kennen.",
    body: "Verbinden Sie Website, Social-Media-Kanäle und Daten und steuern Sie alles in einem einfachen Gespräch.",
    points: [
      { lead: "Verbinden.", text: "Fügen Sie Domain, Suchdaten und Social-Media-Profile hinzu." },
      { lead: "Fragen.", text: "Erhalten Sie Audits, Inhaltspläne, Ideen und Wachstumsaktionen." },
      { lead: "Veröffentlichen.", text: "Einmal freigeben, RepGet erledigt die Arbeit." },
    ],
    connect: "Einrichtung verbinden",
    watch: "Demo ansehen",
    channelsConnected: "4 Kanäle verbunden",
    userMessage: "Verbinde meine Website, Instagram und TikTok und erstelle mir einen Wachstumsplan für diesen Monat.",
    status: "Growth Copilot verbindet Ihre Website und Kanäle",
    lines: ["Website-Audit fertig", "Social-Media-Konten verbunden", "SEO-, KI- und Social-Aktionen in Arbeit"],
    input: "Fragen Sie alles zu Ihrem Wachstum…",
  },
  founder: {
    eyebrow: "Entwickelt von",
    role: "Gründer von RepGet",
    body:
      "Nach Jahren, in denen ich für Unternehmen gestaltet und digitale Projekte aufgebaut habe, wollte ich einen einfacheren Weg, online zu wachsen. **RepGet vereint SEO, KI-Sichtbarkeit, Inhalte, Backlinks und Social-Media-Verbreitung** in einer praktischen Plattform.",
    body2: "Die Idee ist einfach: weniger Zeit mit Tools jonglieren, mehr Zeit zum Gestalten, Vernetzen und Wachsen.",
    yearsValue: "Über 14 Jahre",
    yearsLabel: "kreative Produktion",
    ledValue: "Vom Gründer geführt",
    ledLabel: "Wachstum mit persönlichem Kontakt",
  },
  reviews: {
    kicker: "Kundenstimmen",
    title: "Geschätzt von Menschen, die *aufbauen und wachsen.*",
    lead: "Von Kreativstudios bis zu Gründern und Agenturen: Das erzählen Kunden über RepGet.",
    proof: "Feedback von RepGet-Kunden",
    pills: [
      "Mehr Sichtbarkeit in der Suche",
      "Regelmäßigeres Veröffentlichen",
      "Hochwertigere Anfragen",
      "Mehr Präsenz in der KI",
      "Klarere Inhaltsplanung",
      "Weniger manuelle SEO-Arbeit",
      "Inhalte und Backlinks zusammen",
      "Ein verlässlicherer Strom an Anfragen",
    ],
    readMore: "Weiterlesen",
    readLess: "Weniger anzeigen",
    showMore: "Mehr Bewertungen anzeigen",
    showLess: "Weniger Bewertungen anzeigen",
    videoTag: "Plattform-Video",
    videoOverline: "Die Plattform in Aktion",
    videoCaption: "Echter Produktrundgang",
    videoTitle: "So sieht eine vernetzte Wachstumsplattform aus.",
    videoNote: "Dieses Video zeigt RepGet selbst. Es ist ein Produktrundgang, keine Kundenempfehlung.",
    videoLink: "Ganze Demo ansehen",
    uiLines: ["Besser auffindbar", "Bessere Planung", "Alle Kanäle verbunden"],
  },
  pricing: {
    eyebrow: "Einfaches, transparentes Wachstum",
    title: "Eine Plattform. *Alles zum Wachsen.*",
    sub: "SEO-Artikel, Backlinks, Sichtbarkeit in der KI-Suche und Social-Media-Inhalte. Jeder Tarif enthält den kompletten Ablauf, mit mehr Kapazität, wenn Sie wachsen.",
    included: ["SEO und Artikel", "KI-Sichtbarkeit", "Backlinks", "Social-Media-Veröffentlichung", "Growth Copilot"],
    allInOne: "Alles in einem",
    articles: "SEO-Artikel / Monat",
    keywords: "verfolgte Keywords",
    everything: "Alles aus dem vorherigen Tarif, mit mehr Kapazität",
    features: [
      "SEO- und KI-Bereitschafts-Audit der Website",
      "Keyword-Recherche, Schreiben und Veröffentlichen",
      "Social-Media-Inhalte für Ihre verbundenen Kanäle",
      "Sichtbarkeit in ChatGPT, Gemini, Claude und Perplexity",
      "Growth Copilot",
    ],
    scaleExtra: ["Vorrangige Bearbeitung: Ihre Artikel werden zuerst geschrieben"],
    moreTitle: "Mehr Kapazität nötig?",
    moreBody: "Fügen Sie mehr Credits, Backlinks oder Markenbereiche hinzu, während Ihr Unternehmen wächst.",
    talk: "Mit unserem Team sprechen",
  },
  faq: { eyebrow: "FAQ", contactLead: "Noch eine Frage?", contact: "Kontaktieren Sie uns" },
  cta: {
    overline: "Bereit zu wachsen",
    title: "Ihre Website könnte *schneller wachsen.*",
    body: "Starten Sie mit einem kostenlosen Website-Check oder erstellen Sie {n} kostenlose Artikel und sehen Sie, wie RepGet aus einer Idee SEO, KI-Sichtbarkeit, Backlinks und Social-Media-Schwung macht.",
    primary: "Website kostenlos prüfen",
    secondary: "{n} Artikel kostenlos erstellen",
    points: ["Kein Konto für den Check nötig", "Jederzeit kündbar", "Ergebnisse in Minuten"],
    pills: ["SEO", "Social Media", "KI-Suche", "Copilot"],
    panelTitle: "Alles an einem Ort",
    panelBody: "Kostenlos starten und zum vollen RepGet-Ablauf wechseln, wenn Sie bereit sind.",
    items: [
      { title: "Kostenloser Website-Check", body: "Sehen Sie, was Ihre Website bremst, mit klaren nächsten Schritten." },
      { title: "{n} kostenlose Artikel", body: "Testen Sie den Inhaltsablauf, bevor Sie sich festlegen." },
      { title: "Growth Copilot", body: "Ideen, Prioritäten und Aktionen in einem Gespräch." },
      { title: "Suche und Social Media zusammen", body: "Erstellen, anpassen, veröffentlichen und wachsen auf einer Plattform." },
    ],
  },
  menu: {
    features: "Funktionen",
    integrations: "Integrationen",
    featuresOverline: "Die Plattform entdecken",
    featuresTitle: "Alles, was Sie zum Wachsen brauchen.",
    featuresTagline: "Sechs Werkzeuge. Ein vernetztes Wachstumssystem.",
    next: "Nächste Funktion",
    open: "Mehr erfahren",
    bottom: "Von der ersten Suche bis zum treuen Kunden. Alles vernetzt in RepGet.",
    tools: [
      { title: "Inhalte", sub: "Planen und veröffentlichen", kicker: "Inhalte und Veröffentlichung", heading: "Von der Idee zur Veröffentlichung.", body: "Ein verlässlicher Inhaltsmotor: Themenplanung, KI-gestützte Entwürfe, Prüfung und Veröffentlichung auf Ihrer Website.", steps: ["Planen", "Prüfen", "Veröffentlichen"] },
      { title: "Social Media", sub: "Erstellen und verteilen", kicker: "Social-Media-Inhalte", heading: "Einmal erstellen. Überall präsent sein.", body: "Machen Sie aus Ihren Ideen fertige Inhalte, angepasst an jede Plattform, mit einem Veröffentlichungsplan.", steps: ["Erstellen", "Anpassen", "Planen"] },
      { title: "SEO", sub: "Gefunden werden", kicker: "Sichtbarkeit in der Suche", heading: "Von den richtigen Kunden gefunden werden.", body: "Verstehen Sie den Zustand Ihrer Website, entdecken Sie Suchchancen und sehen Sie, was Sie zuerst verbessern sollten.", steps: ["Prüfen", "Priorisieren", "Verbessern"] },
      { title: "Backlinks", sub: "Autorität aufbauen", kicker: "Backlinks und Autorität", heading: "Autorität, die bleibt.", body: "Erhalten Sie relevante Links aus unserem Partnernetzwerk und stärken Sie Ihre Website mit nützlichen Verweisen.", steps: ["Entdecken", "Bewerten", "Aufbauen"] },
      { title: "KI-Suche", sub: "Erwähnt werden", kicker: "Sichtbarkeit in der KI", heading: "Teil der Antwort werden.", body: "Sehen Sie, wie KI-Assistenten über Ihr Unternehmen sprechen und wie Sie öfter genannt werden.", steps: ["Beobachten", "Verstehen", "Verbessern"] },
      { title: "Wachstum", sub: "Sehen, was wirkt", kicker: "Berichte und Wachstum", heading: "Sehen, was wirklich wirkt.", body: "Suche, Inhalte und Social Media in einem klaren Bild, damit jede nächste Entscheidung leichter fällt.", steps: ["Verbinden", "Messen", "Wachsen"] },
    ],
    socialHead: "Social-Media-Kanäle",
    socialSub: "Einmal erstellen. Passend für jeden Kanal.",
    platforms: "{n} Plattformen",
    siteHead: "Website und Daten",
    siteSub: "Auf Ihrer Website veröffentlichen. Messen, was zählt.",
    connections: "{n} Verbindungen",
    footerTitle: "Mehr als Social Media. Ihr kompletter Wachstumsmotor.",
    footerBody: "Inhalte erstellen, in der Suche wachsen, Autorität aufbauen und von der KI gefunden werden.",
    explore: "Zu den Einrichtungsanleitungen",
  },
};

const COPY: Record<Locale, HomeRedesignCopy> = { en, es, fr, it, de };

export function homeRedesignCopy(locale: Locale): HomeRedesignCopy {
  return COPY[locale];
}

/** Every language's header menu words, for the client-side header (see site-chrome.ts). */
export function homeMenuCopy(locale: Locale): HomeRedesignCopy["menu"] {
  return COPY[locale].menu;
}
