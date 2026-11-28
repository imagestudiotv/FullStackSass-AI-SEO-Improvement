import type { Locale } from "@/lib/i18n/config";

/**
 * The pricing page (client's design of 2026-11-11,
 * RepGet_Pricing_Direct_Purchase_Trial_Notice.html), in every language.
 *
 * English is the design's text, word for word. The other languages use the
 * formal address (usted / vous / Lei / Sie). Plan names (Launch, Grow, Scale,
 * Grow + Visibility) stay in English: they are product names.
 *
 * The figures are NOT written here. Prices, articles, social posts and search
 * terms come from the plans table, the rows checkout charges
 * (scripts/plan-catalog.mjs): `{articles}`, `{posts}`, `{terms}`, `{price}`,
 * `{regular}`, `{pct}` and `{n}` are filled in by the page. `**words**` are
 * bold.
 */

export type PricingTierId = "launch" | "grow" | "scale";

export type PerkItem = { strong: string; small: string };

export type PricingPlanWords = {
  tag: string;
  desc: string;
  cta: string;
  includedLabel: string;
  features: string[];
  /** The visibility perks: only Scale's, since 2026-11-24 (with Grow they are sold as Grow + Visibility, `bundle.bonuses`). */
  perks?: PerkItem[];
};

export type PricingFaqItem = { q: string; a: string; link?: string };

export type PricingPageCopy = {
  hero: { titleLead: string; titleAccent: string; body: string; pills: [string, string, string] };
  bundle: {
    flag: string;
    /** What the bundle is, beside its flag. No saving and no struck price: the owner's decision (2026-11-27). */
    includes: string;
    lede: string;
    priceLabel: string;
    perMonth: string;
    featureKicker: string;
    /** "Get featured on *Social channels* & our *Blog.*": `*words*` in the accent colour. */
    featureTitle: string;
    featureBody: string;
    cta: string;
    ctaLabel: string;
    noteStrong: string;
    note: string;
    coreEyebrow: string;
    corePill: string;
    stats: [PerkItem, PerkItem, PerkItem];
    coreFeatures: string[];
    bonusEyebrow: string;
    bonusPill: string;
    bonusIntro: string;
    bonuses: [PerkItem, PerkItem, PerkItem];
  };
  billing: { sectionLabel: string; label: string; monthly: string; yearly: string; saving: string; savingPlain: string };
  card: {
    offerBadge: string;
    wasLabel: string;
    perMonth: string;
    monthlyCaption: string;
    yearlyCaption: string;
    /** Without the REPGET offer (REPGET_OFFER_ENABLED off): the regular price, said plainly. */
    plainMonthlyCaption: string;
    plainYearlyCaption: string;
    more: string;
    popular: string;
    perksTitle: string;
    perksLabel: string;
    priority: string;
  };
  plans: Record<PricingTierId, PricingPlanWords>;
  compare: {
    eyebrow: string;
    title: string;
    body: string;
    included: string;
    articles: string;
    posts: string;
    terms: string;
    websites: string;
    copilot: PerkItem;
    social: PerkItem;
    cms: string;
    audits: string;
    visibility: string;
    backlinks: string;
    blog: PerkItem;
    channels: PerkItem;
    email: PerkItem;
    custom: string;
    statusPriority: string;
    usageNote: string;
  };
  faq: {
    eyebrow: string;
    titleLines: string[];
    description: string;
    contactLead: string;
    contact: string;
    panelTop: string;
    scrollMore: string;
    regionLabel: string;
    count: string;
    scrollInside: string;
    groups: { title: string; items: PricingFaqItem[] }[];
  };
  trial: {
    eyebrow: string;
    titleLines: [string, string];
    body: string;
    points: [string, string, string];
    cta: string;
    card1Kicker: string;
    card1Title: string;
    card1Status: string;
    card2Kicker: string;
    card2Title: string;
    card2Stats: [PerkItem, PerkItem, PerkItem];
    note: string;
    noteLink: string;
    noteEnd: string;
  };
};

const en: PricingPageCopy = {
  hero: {
    titleLead: "One platform.",
    titleAccent: "More ways to grow.",
    body: "From Google and AI search to the social feeds your customers follow. Create content, build authority and track progress in one connected workspace.",
    pills: ["Free to start", "Cancel anytime", "3-day money-back guarantee"],
  },
  bundle: {
    flag: "GROWTH, AMPLIFIED.",
    includes: "THE FULL GROW PLAN + FEATURED VISIBILITY",
    lede: "The full Grow plan. Plus a bigger stage for your brand.",
    priceLabel: "Grow plus Visibility bundle, {price} per month",
    perMonth: "/ month",
    featureKicker: "VISIBILITY INCLUDED",
    featureTitle: "Get featured on *Social channels* & our *Blog.*",
    featureBody: "Plus promotion to RepGet's email audience, alongside every tool in the Grow plan.",
    cta: "Buy Grow + Visibility",
    ctaLabel: "Buy Grow plus Visibility, {price} per month with no free trial",
    noteStrong: "Direct purchase.",
    note: "{price} billed at checkout, then monthly. The 3-day free trial does not apply to this offer.",
    coreEyebrow: "01 / THE COMPLETE GROW PLAN",
    corePill: "All standard features",
    stats: [
      { strong: "branded articles / mo", small: "1 a day" },
      { strong: "social posts / mo", small: "For your channels" },
      { strong: "search terms", small: "Researched & clustered" },
    ],
    coreFeatures: [
      "One connected website",
      "Auto-publish to major CMSs",
      "Weekly AI answer checks, with web search",
      "Site audits & article meta descriptions",
      "Backlink partner network access",
      "SEO-focused content & keyword targeting",
      "**AI Growth Copilot** & data-informed guidance",
      "**AI Social Opportunities** & suggested replies",
    ],
    bonusEyebrow: "02 / FEATURED VISIBILITY BENEFITS",
    bonusPill: "INCLUDED WITH THIS BUNDLE",
    bonusIntro: "Added promotion beyond your own channels",
    bonuses: [
      { strong: "Featured on RepGet social channels", small: "Get featured across RepGet's social channels" },
      { strong: "RepGet blog feature", small: "Introduce your business to readers of our blog" },
      { strong: "Email spotlight", small: "Promotion to RepGet's subscriber audience" },
    ],
  },
  billing: {
    sectionLabel: "Pricing plans",
    label: "Choose billing period",
    monthly: "Monthly",
    yearly: "Yearly",
    saving: "Yearly: 2 months free, plus 40% off",
    savingPlain: "Yearly: 2 months free",
  },
  card: {
    offerBadge: "40% OFF",
    wasLabel: "regular price",
    perMonth: "/ month",
    monthlyCaption: "40% off regular price · billed monthly",
    yearlyCaption: "Billed {price}/year · was {regular}/year",
    plainMonthlyCaption: "Billed monthly",
    plainYearlyCaption: "Billed {price}/year",
    more: "Explore full feature comparison",
    popular: "Most popular",
    perksTitle: "Included visibility perks",
    perksLabel: "Included promotional visibility benefits",
    priority: "PRIORITY",
  },
  plans: {
    launch: {
      tag: "Get discovered",
      desc: "For entrepreneurs ready to build a consistent online presence.",
      cta: "Start with Launch",
      includedLabel: "Your monthly growth toolkit",
      features: [
        "**{articles} SEO articles**",
        "**{posts} social posts** to keep showing up",
        "**{terms} search terms** researched",
        "**1 website** connected",
        "Weekly AI answer checks, with web search",
        "SEO audit, on-page optimization and backlinks",
        "CMS auto-publishing",
        "**AI Growth Copilot** with insights from your website data",
        "**AI Social Opportunities** to discover conversations and draft replies",
      ],
    },
    grow: {
      tag: "Reach more people",
      desc: "For growing brands that want more consistent reach and output.",
      cta: "Start with Grow",
      includedLabel: "Everything in Free, plus backlinks and more volume",
      features: [
        "**{articles} SEO articles**",
        "**{posts} social posts** across platforms",
        "**{terms} search terms** researched",
        "**1 website** connected",
        "Weekly AI answer checks, with web search",
        "SEO audit, on-page optimization and backlinks",
        "CMS auto-publishing",
        "**AI Growth Copilot** with insights from your website data",
        "**AI Social Opportunities** to discover conversations and draft replies",
      ],
    },
    scale: {
      tag: "Maximum momentum",
      desc: "For ambitious teams producing more across every channel.",
      cta: "Start with Scale",
      includedLabel: "Everything in Grow, plus more capacity",
      features: [
        "**{articles} SEO articles**",
        "**{posts} social posts** across platforms",
        "**{terms} search terms** researched",
        "**1 website** connected",
        "Weekly AI answer checks, with web search",
        "SEO audit, on-page optimization and backlinks",
        "**Custom feature requests**",
        "**AI Growth Copilot** with insights from your website data",
        "**AI Social Opportunities** to discover conversations and draft replies",
      ],
      perks: [
        { strong: "Priority RepGet blog feature", small: "Featured editorial exposure" },
        { strong: "Priority RepGet social channel feature", small: "Promotion across RepGet's social audience" },
        { strong: "Priority email spotlight", small: "Promotion to RepGet's subscriber audience" },
      ],
    },
  },
  compare: {
    eyebrow: "Side by side",
    title: "Compare your options.",
    body: "Start free, then choose the monthly output that fits your business. Grow and Scale include the complete growth platform, backlinks included.",
    included: "Included",
    articles: "Branded SEO articles / month",
    posts: "Social posts / month",
    terms: "Search terms researched",
    websites: "Websites per subscription",
    copilot: { strong: "AI Growth Copilot", small: "Website insights, recommendations & approved actions" },
    social: { strong: "AI Social Opportunities", small: "Find discussions, draft replies & publish with approval" },
    cms: "CMS auto-publishing",
    audits: "SEO site audits & article meta descriptions",
    visibility: "Weekly AI answer checks, with web search",
    backlinks: "Backlink partner network",
    blog: { strong: "RepGet blog feature", small: "Featured placement on RepGet's blog" },
    channels: { strong: "RepGet social channel feature", small: "Promotion through RepGet social channels" },
    email: { strong: "Email spotlight", small: "Promotion to RepGet's subscribers" },
    custom: "Custom feature requests",
    statusPriority: "Priority",
    usageNote:
      "AI Growth Copilot includes five free messages per day in the current workspace, with additional messages billed in credits. Some social publishing and engagement actions also use credits. Connected channels and supported actions may vary.",
  },
  faq: {
    eyebrow: "FAQ",
    titleLines: ["Frequently", "asked", "questions"],
    description: "Clear answers about your free trial, pricing, content creation and online visibility.",
    contactLead: "Still have a question?",
    contact: "Contact us",
    panelTop: "YOUR QUESTIONS, ANSWERED",
    scrollMore: "SCROLL FOR MORE",
    regionLabel: "RepGet FAQs, scroll to see more questions",
    count: "{n} answers to explore",
    scrollInside: "Scroll inside the panel",
    groups: [
      {
        title: "FREE TRIAL & GETTING STARTED",
        items: [
          {
            q: "Is the Free plan really free?",
            a: "Yes. Free costs nothing and needs no credit card: each month it includes 4 AI SEO articles, 8 social posts, 1 limited SEO audit and 1 AI visibility snapshot, with 10 search terms, 1 connected website and 3 Growth Copilot requests a day. Backlinks, AI video production and advanced automation need a paid plan, and you can upgrade or buy credits at any time. Free places are limited during the launch.",
          },
          {
            q: "What happens after the free trial?",
            a: "When your 3-day free trial ends, the plan you chose during signup starts and the first payment is taken, unless you cancel before the trial ends. The exact start date, charges and renewal terms are shown in your checkout.",
          },
          {
            q: "What is included in the free trial?",
            a: "Your free trial gives you your plan's full, normal service for three days: every feature of the plan, at the plan's daily pace, plus 15 credits per day for social distribution and content creation features. Nothing is charged today, by card or PayPal.",
          },
          {
            q: "Do I need SEO experience to get started?",
            a: "No. RepGet brings keyword research, content creation, technical SEO checks and publishing into one workspace. You can start with your website and review suggested improvements as you go.",
          },
          {
            q: "Which plan should I choose?",
            a: "Free lets you try RepGet at no cost, with a few articles and social posts each month. Grow offers more articles and social posts plus backlinks, and Scale adds higher monthly volumes. Compare the article, social and research limits above to find the right fit.",
          },
        ],
      },
      {
        title: "BILLING & SUBSCRIPTIONS",
        items: [
          {
            q: "Can I choose monthly or annual billing?",
            a: "Yes. Use the Monthly and Yearly switch above to compare prices. The annual option displays an equivalent monthly rate; the annual total is billed upfront according to the plan selected.",
          },
          {
            q: "Can I cancel my subscription?",
            a: "You can manage cancellation through your account. Access and billing after cancellation follow the subscription terms presented at signup.",
          },
          {
            q: "Is there a refund guarantee?",
            a: "RepGet offers a 3-day money-back guarantee on the first subscription payment, subject to the published refund policy.",
            link: "Read the refund policy.",
          },
          {
            q: "Can I upgrade when my business grows?",
            a: "You can choose a plan with more content, social posts and research capacity. Check the billing dashboard or contact support for the upgrade terms applicable to your account.",
          },
        ],
      },
      {
        title: "CONTENT, SOCIAL & AUTOMATION",
        items: [
          {
            q: "Can RepGet publish articles to my website?",
            a: "RepGet supports publishing workflows for WordPress, Shopify, Ghost, Webflow and other supported platforms. Connect your site and configure the publishing settings appropriate for your workflow.",
          },
          {
            q: "Do articles come with images and SEO metadata?",
            a: "Every article comes with a title, a meta description and internal links to pages that exist on your site. A cover image is added when image generation is available; if it is not, the article is still written and published, without one. RepGet does not add schema markup (structured data) to your articles.",
          },
          {
            q: "Can I review content before it goes live?",
            a: "Partly. A website's first article is published live as soon as it is written, whatever publishing mode is set, so you can see a real post on your site. New websites then publish each article live on its planned day. You can switch to sending articles to your CMS as drafts, or keeping them in RepGet until you approve them, in the website's publishing settings.",
          },
          {
            q: "What can I use my trial credits for?",
            a: "During the first three days, the 15 daily trial credits are available for eligible social distribution and content creation features. Usage and eligibility are shown in your workspace.",
          },
          {
            q: "What is AI Growth Copilot?",
            a: "Growth Copilot is your AI assistant inside RepGet. Ask questions about your website traffic, articles, site health, AI search visibility, backlinks and social activity. It uses available data from your connected workspace to explain what is happening and can suggest or carry out supported actions once you confirm them.",
          },
          {
            q: "How do AI Social Opportunities work?",
            a: "RepGet helps you find relevant discussions across supported social channels, drafts contextual replies and keeps conversations organized in one workspace. You review and approve what to publish. Connecting channels and publishing or reply actions may require credits.",
          },
          {
            q: "Are Growth Copilot messages unlimited?",
            a: "The workspace currently shows five free Growth Copilot messages each day, followed by one credit for each additional message. See your account for current allowances and credit requirements.",
          },
        ],
      },
      {
        title: "SEO, AI VISIBILITY & BACKLINKS",
        items: [
          {
            q: "How does RepGet research keywords in my niche?",
            a: "RepGet researches and clusters search terms so you can plan content around relevant topics. Research allowances depend on your plan: Free includes 10 terms, Grow includes 300, and Scale includes 1,200.",
          },
          {
            q: "Which AI assistants does RepGet check?",
            a: "RepGet checks {assistants}. Each week it puts the questions you track (20 on Grow, 50 on Scale; Free takes one snapshot of 5 questions a month) to each assistant it checks, through the API with web search on, several times, in your language, and records in how many answers your business is named, and where. {notChecked} are not checked, so treat it as the view of the assistants named here rather than a measure of all AI search.",
          },
          {
            q: "How do backlink credits work?",
            a: "Paid plans provide access to RepGet's partner backlink network. Credit requirements vary by opportunity, and extra credits may be available to purchase. A listing or credit balance does not guarantee a specific placement.",
          },
          {
            q: "Does RepGet guarantee top Google rankings?",
            a: "No platform can guarantee a particular search position or AI mention. RepGet provides research, content and optimization tools designed to support steady improvements over time.",
          },
        ],
      },
      {
        title: "VISIBILITY PERKS & PROMOTION",
        items: [
          {
            q: "Do Grow and Scale include promotional features?",
            a: "Scale does: it includes priority versions of a RepGet blog feature, social-channel exposure and an email spotlight. Grow does not include them. To have them with the Grow plan, choose Grow + Visibility.",
          },
          {
            q: "What does priority promotion mean in Scale?",
            a: "Scale gives promotional placements priority over standard placements, subject to availability. Priority is not a guarantee of search rankings, traffic or conversions.",
          },
          {
            q: "What is included in Grow + Visibility?",
            a: "Grow + Visibility combines the standard Grow subscription with the featured promotion benefits shown above: a RepGet blog feature, social channel promotion and an email spotlight. Grow on its own does not include these promotional features; Scale includes priority versions of them.",
          },
          {
            q: "Does Grow + Visibility include the 3-day free trial?",
            a: "No. Grow + Visibility is a direct-purchase subscription. Your first {price} payment is collected at checkout, and monthly billing begins when you subscribe. The 3-day free trial is not included with this promotional bundle.",
          },
          {
            q: "Where could my business be featured?",
            a: "The offer highlights RepGet social channels, an editorial feature on the RepGet blog and exposure through subscriber email communications.",
          },
          {
            q: "Are the promotional bonuses unlimited every month?",
            a: "No. The promotional features are extras on top of the monthly platform subscription, not unlimited posts, emails or guaranteed ranking results.",
          },
        ],
      },
    ],
  },
  trial: {
    eyebrow: "Try it before your first payment",
    titleLines: ["Start with proof.", "Not promises."],
    body: "For three days you get your plan's full, normal service: every feature, at the plan's daily pace, plus 15 credits per day for social distribution and content creation features. Nothing is charged today, and your plan starts after the trial unless you cancel before it ends.",
    points: ["3 days free", "Every plan feature", "No charge today"],
    cta: "Get started with RepGet",
    card1Kicker: "YOUR CONTENT WORKSPACE",
    card1Title: "How customers discover your business online",
    card1Status: "✓ Article ready for review",
    card2Kicker: "CONNECTED GROWTH",
    card2Title: "One clear view of your output",
    card2Stats: [
      { strong: "SEO", small: "Content" },
      { strong: "AI", small: "Visibility" },
      { strong: "↗", small: "Backlinks" },
    ],
    note: "Your free trial lasts three days. Paid subscription billing follows the terms shown during signup. RepGet also offers a 3-day money-back guarantee on your first subscription payment; see our",
    noteLink: "refund policy",
    noteEnd: ".",
  },
};

const es: PricingPageCopy = {
  hero: {
    titleLead: "Una plataforma.",
    titleAccent: "Más formas de crecer.",
    body: "De Google y la búsqueda con IA a las redes sociales que siguen sus clientes. Cree contenido, gane autoridad y siga su progreso en un único espacio de trabajo conectado.",
    pills: ["Empiece gratis", "Cancele cuando quiera", "Garantía de reembolso de 3 días"],
  },
  bundle: {
    flag: "CRECIMIENTO, AMPLIFICADO.",
    includes: "EL PLAN GROW COMPLETO + VISIBILIDAD DESTACADA",
    lede: "El plan Grow completo. Y un escenario más grande para su marca.",
    priceLabel: "Paquete Grow más Visibility, {price} al mes",
    perMonth: "/ mes",
    featureKicker: "VISIBILIDAD INCLUIDA",
    featureTitle: "Aparezca en nuestras *redes sociales* y en nuestro *blog.*",
    featureBody: "Además de promoción ante la audiencia de correo de RepGet, junto con todas las herramientas del plan Grow.",
    cta: "Comprar Grow + Visibility",
    ctaLabel: "Comprar Grow más Visibility, {price} al mes sin prueba gratuita",
    noteStrong: "Compra directa.",
    note: "Se cobran {price} al pagar y después cada mes. La prueba gratuita de 3 días no se aplica a esta oferta.",
    coreEyebrow: "01 / EL PLAN GROW COMPLETO",
    corePill: "Todas las funciones estándar",
    stats: [
      { strong: "artículos de marca / mes", small: "1 al día" },
      { strong: "publicaciones sociales / mes", small: "Para sus canales" },
      { strong: "términos de búsqueda", small: "Investigados y agrupados" },
    ],
    coreFeatures: [
      "Un sitio web conectado",
      "Publicación automática en los principales CMS",
      "Comprobación semanal de respuestas de IA, con búsqueda web",
      "Auditorías del sitio y metadescripciones de los artículos",
      "Acceso a la red de socios de backlinks",
      "Contenido orientado al SEO y a palabras clave",
      "**AI Growth Copilot** y recomendaciones basadas en datos",
      "**AI Social Opportunities** y respuestas sugeridas",
    ],
    bonusEyebrow: "02 / VENTAJAS DE VISIBILIDAD DESTACADA",
    bonusPill: "INCLUIDO EN ESTE PAQUETE",
    bonusIntro: "Promoción adicional más allá de sus propios canales",
    bonuses: [
      { strong: "Presencia en las redes sociales de RepGet", small: "Aparezca en los canales sociales de RepGet" },
      { strong: "Artículo en el blog de RepGet", small: "Presente su negocio a los lectores de nuestro blog" },
      { strong: "Mención en nuestro correo", small: "Promoción ante los suscriptores de RepGet" },
    ],
  },
  billing: {
    sectionLabel: "Planes de precios",
    label: "Elija el periodo de facturación",
    monthly: "Mensual",
    yearly: "Anual",
    saving: "Anual: 2 meses gratis y un 40 % de descuento",
    savingPlain: "Anual: 2 meses gratis",
  },
  card: {
    offerBadge: "40 % DTO.",
    wasLabel: "precio normal",
    perMonth: "/ mes",
    monthlyCaption: "40 % de descuento sobre el precio normal · facturación mensual",
    yearlyCaption: "Facturado {price}/año · antes {regular}/año",
    plainMonthlyCaption: "Facturación mensual",
    plainYearlyCaption: "Facturado {price}/año",
    more: "Ver la comparación completa",
    popular: "El más popular",
    perksTitle: "Ventajas de visibilidad incluidas",
    perksLabel: "Ventajas de visibilidad promocional incluidas",
    priority: "PRIORIDAD",
  },
  plans: {
    launch: {
      tag: "Hágase visible",
      desc: "Para emprendedores listos para construir una presencia en línea constante.",
      cta: "Empezar con Launch",
      includedLabel: "Su kit mensual de crecimiento",
      features: [
        "**{articles} artículos SEO**",
        "**{posts} publicaciones sociales** para seguir presente",
        "**{terms} términos de búsqueda** investigados",
        "**1 sitio web** conectado",
        "Comprobación semanal de respuestas de IA, con búsqueda web",
        "Auditoría SEO, optimización on-page y backlinks",
        "Publicación automática en su CMS",
        "**AI Growth Copilot** con información a partir de los datos de su sitio",
        "**AI Social Opportunities** para descubrir conversaciones y redactar respuestas",
      ],
    },
    grow: {
      tag: "Llegue a más personas",
      desc: "Para marcas en crecimiento que buscan un alcance y una producción más constantes.",
      cta: "Empezar con Grow",
      includedLabel: "Todo lo de Free, más backlinks y más volumen",
      features: [
        "**{articles} artículos SEO**",
        "**{posts} publicaciones sociales** en varias plataformas",
        "**{terms} términos de búsqueda** investigados",
        "**1 sitio web** conectado",
        "Comprobación semanal de respuestas de IA, con búsqueda web",
        "Auditoría SEO, optimización on-page y backlinks",
        "Publicación automática en su CMS",
        "**AI Growth Copilot** con información a partir de los datos de su sitio",
        "**AI Social Opportunities** para descubrir conversaciones y redactar respuestas",
      ],
    },
    scale: {
      tag: "Máximo impulso",
      desc: "Para equipos ambiciosos que producen más en todos los canales.",
      cta: "Empezar con Scale",
      includedLabel: "Todo lo de Grow, con más capacidad",
      features: [
        "**{articles} artículos SEO**",
        "**{posts} publicaciones sociales** en varias plataformas",
        "**{terms} términos de búsqueda** investigados",
        "**1 sitio web** conectado",
        "Comprobación semanal de respuestas de IA, con búsqueda web",
        "Auditoría SEO, optimización on-page y backlinks",
        "**Solicitudes de funciones a medida**",
        "**AI Growth Copilot** con información a partir de los datos de su sitio",
        "**AI Social Opportunities** para descubrir conversaciones y redactar respuestas",
      ],
      perks: [
        { strong: "Artículo prioritario en el blog de RepGet", small: "Visibilidad editorial destacada" },
        { strong: "Presencia prioritaria en las redes de RepGet", small: "Promoción ante la audiencia social de RepGet" },
        { strong: "Mención prioritaria en nuestro correo", small: "Promoción ante los suscriptores de RepGet" },
      ],
    },
  },
  compare: {
    eyebrow: "Cara a cara",
    title: "Compare sus opciones.",
    body: "Empiece gratis y elija después el volumen mensual que mejor se adapte a su negocio. Grow y Scale incluyen la plataforma de crecimiento completa, backlinks incluidos.",
    included: "Incluido",
    articles: "Artículos SEO de marca / mes",
    posts: "Publicaciones sociales / mes",
    terms: "Términos de búsqueda investigados",
    websites: "Sitios web por suscripción",
    copilot: { strong: "AI Growth Copilot", small: "Información del sitio, recomendaciones y acciones aprobadas" },
    social: { strong: "AI Social Opportunities", small: "Encuentre conversaciones, redacte respuestas y publique con aprobación" },
    cms: "Publicación automática en su CMS",
    audits: "Auditorías SEO y metadescripciones de los artículos",
    visibility: "Comprobación semanal de respuestas de IA, con búsqueda web",
    backlinks: "Red de socios de backlinks",
    blog: { strong: "Artículo en el blog de RepGet", small: "Espacio destacado en el blog de RepGet" },
    channels: { strong: "Presencia en las redes sociales de RepGet", small: "Promoción en los canales sociales de RepGet" },
    email: { strong: "Mención en nuestro correo", small: "Promoción ante los suscriptores de RepGet" },
    custom: "Solicitudes de funciones a medida",
    statusPriority: "Prioridad",
    usageNote:
      "AI Growth Copilot incluye cinco mensajes gratuitos al día en el espacio de trabajo actual; los mensajes adicionales se cobran en créditos. Algunas acciones de publicación e interacción en redes también usan créditos. Los canales conectados y las acciones disponibles pueden variar.",
  },
  faq: {
    eyebrow: "Preguntas frecuentes",
    titleLines: ["Preguntas", "más", "frecuentes"],
    description: "Respuestas claras sobre su prueba gratuita, los precios, la creación de contenido y la visibilidad en línea.",
    contactLead: "¿Le queda alguna pregunta?",
    contact: "Contáctenos",
    panelTop: "SUS PREGUNTAS, RESPONDIDAS",
    scrollMore: "DESPLÁCESE PARA VER MÁS",
    regionLabel: "Preguntas frecuentes de RepGet; desplácese para ver más preguntas",
    count: "{n} respuestas para explorar",
    scrollInside: "Desplácese dentro del panel",
    groups: [
      {
        title: "PRUEBA GRATUITA Y PRIMEROS PASOS",
        items: [
          {
            q: "¿El plan Free es realmente gratis?",
            a: "Sí. Free no cuesta nada y no requiere tarjeta de crédito: cada mes incluye 4 artículos SEO con IA, 8 publicaciones sociales, 1 auditoría SEO limitada y 1 instantánea de visibilidad en IA, con 10 términos de búsqueda, 1 sitio web conectado y 3 consultas a Growth Copilot al día. Los backlinks, la producción de vídeo con IA y la automatización avanzada requieren un plan de pago, y puede mejorar su plan o comprar créditos en cualquier momento. Las plazas gratuitas son limitadas durante el lanzamiento.",
          },
          {
            q: "¿Qué ocurre después de la prueba gratuita?",
            a: "Cuando termina su prueba gratuita de 3 días, empieza el plan que eligió al registrarse y se cobra el primer pago, salvo que cancele antes de que termine la prueba. La fecha de inicio exacta, los cargos y las condiciones de renovación se muestran al pagar.",
          },
          {
            q: "¿Qué incluye la prueba gratuita?",
            a: "Su prueba gratuita le da el servicio completo y normal de su plan durante tres días: todas las funciones del plan, a su ritmo diario, más 15 créditos al día para las funciones de distribución en redes y creación de contenido. Hoy no se cobra nada, con tarjeta o con PayPal.",
          },
          {
            q: "¿Necesito experiencia en SEO para empezar?",
            a: "No. RepGet reúne la investigación de palabras clave, la creación de contenido, las revisiones técnicas de SEO y la publicación en un solo espacio de trabajo. Puede empezar con su sitio web y revisar las mejoras sugeridas sobre la marcha.",
          },
          {
            q: "¿Qué plan debería elegir?",
            a: "Free le permite probar RepGet sin coste, con algunos artículos y publicaciones sociales cada mes. Grow ofrece más artículos y publicaciones sociales, además de backlinks, y Scale añade volúmenes mensuales mayores. Compare arriba los límites de artículos, publicaciones e investigación para encontrar el más adecuado.",
          },
        ],
      },
      {
        title: "FACTURACIÓN Y SUSCRIPCIONES",
        items: [
          {
            q: "¿Puedo elegir facturación mensual o anual?",
            a: "Sí. Use el selector Mensual / Anual de arriba para comparar precios. La opción anual muestra un importe mensual equivalente; el total anual se factura por adelantado según el plan elegido.",
          },
          {
            q: "¿Puedo cancelar mi suscripción?",
            a: "Puede gestionar la cancelación desde su cuenta. El acceso y la facturación tras la cancelación siguen las condiciones de suscripción presentadas al registrarse.",
          },
          {
            q: "¿Hay garantía de reembolso?",
            a: "RepGet ofrece una garantía de reembolso de 3 días sobre el primer pago de la suscripción, sujeta a la política de reembolsos publicada.",
            link: "Lea la política de reembolsos.",
          },
          {
            q: "¿Puedo cambiar a un plan superior cuando mi negocio crezca?",
            a: "Puede elegir un plan con más contenido, publicaciones sociales y capacidad de investigación. Consulte el panel de facturación o contacte con soporte para conocer las condiciones de cambio aplicables a su cuenta.",
          },
        ],
      },
      {
        title: "CONTENIDO, REDES Y AUTOMATIZACIÓN",
        items: [
          {
            q: "¿Puede RepGet publicar artículos en mi sitio web?",
            a: "RepGet admite flujos de publicación para WordPress, Shopify, Ghost, Webflow y otras plataformas compatibles. Conecte su sitio y configure los ajustes de publicación adecuados para su forma de trabajar.",
          },
          {
            q: "¿Los artículos incluyen imágenes y metadatos SEO?",
            a: "Cada artículo incluye un título, una metadescripción y enlaces internos a páginas que existen en su sitio. Se añade una imagen de portada cuando la generación de imágenes está disponible; si no lo está, el artículo se escribe y se publica igualmente, sin imagen. RepGet no añade marcado schema (datos estructurados) a sus artículos.",
          },
          {
            q: "¿Puedo revisar el contenido antes de que se publique?",
            a: "En parte. El primer artículo de un sitio se publica en directo en cuanto está escrito, sea cual sea el modo de publicación, para que vea una entrada real en su sitio. Después, los sitios nuevos publican cada artículo en directo el día previsto. En los ajustes de publicación del sitio puede elegir enviarlos a su CMS como borradores o guardarlos en RepGet hasta que los apruebe.",
          },
          {
            q: "¿Para qué puedo usar mis créditos de prueba?",
            a: "Durante los tres primeros días, los 15 créditos diarios de prueba están disponibles para las funciones elegibles de distribución en redes y creación de contenido. El uso y la elegibilidad se muestran en su espacio de trabajo.",
          },
          {
            q: "¿Qué es AI Growth Copilot?",
            a: "Growth Copilot es su asistente de IA dentro de RepGet. Pregúntele por el tráfico de su sitio web, sus artículos, el estado del sitio, la visibilidad en búsquedas con IA, los backlinks y la actividad en redes. Usa los datos disponibles de su espacio de trabajo conectado para explicar lo que ocurre y puede sugerir o realizar las acciones compatibles una vez que usted las confirme.",
          },
          {
            q: "¿Cómo funcionan las AI Social Opportunities?",
            a: "RepGet le ayuda a encontrar conversaciones relevantes en los canales sociales compatibles, redacta respuestas adaptadas al contexto y mantiene las conversaciones organizadas en un solo espacio de trabajo. Usted revisa y aprueba lo que se publica. Conectar canales y publicar o responder puede requerir créditos.",
          },
          {
            q: "¿Los mensajes de Growth Copilot son ilimitados?",
            a: "Actualmente, el espacio de trabajo ofrece cinco mensajes gratuitos de Growth Copilot al día; cada mensaje adicional cuesta un crédito. Consulte su cuenta para ver las asignaciones y los créditos necesarios actuales.",
          },
        ],
      },
      {
        title: "SEO, VISIBILIDAD EN IA Y BACKLINKS",
        items: [
          {
            q: "¿Cómo investiga RepGet las palabras clave de mi sector?",
            a: "RepGet investiga y agrupa términos de búsqueda para que pueda planificar contenido sobre temas relevantes. La investigación depende de su plan: Free incluye 10 términos, Grow incluye 300 y Scale incluye 1.200.",
          },
          {
            q: "¿Qué asistentes de IA comprueba RepGet?",
            a: "RepGet comprueba {assistants}. Cada semana hace a cada asistente que comprueba, a través de su API y con la búsqueda web activada, las preguntas que usted sigue (20 en Grow, 50 en Scale; Free hace una instantánea de 5 preguntas al mes), varias veces, en su idioma, y registra en cuántas respuestas aparece nombrado su negocio y en qué lugar. No se comprueban {notChecked}, así que considérelo la visión de los asistentes indicados aquí, no una medición de toda la búsqueda con IA.",
          },
          {
            q: "¿Cómo funcionan los créditos de backlinks?",
            a: "Los planes de pago dan acceso a la red de socios de backlinks de RepGet. Los créditos necesarios varían según la oportunidad y es posible comprar créditos adicionales. Un listado o un saldo de créditos no garantiza una colocación concreta.",
          },
          {
            q: "¿Garantiza RepGet los primeros puestos en Google?",
            a: "Ninguna plataforma puede garantizar una posición concreta en las búsquedas ni una mención en IA. RepGet ofrece herramientas de investigación, contenido y optimización pensadas para lograr mejoras constantes con el tiempo.",
          },
        ],
      },
      {
        title: "VENTAJAS DE VISIBILIDAD Y PROMOCIÓN",
        items: [
          {
            q: "¿Grow y Scale incluyen funciones promocionales?",
            a: "Scale sí: incluye versiones prioritarias de un artículo en el blog de RepGet, presencia en las redes sociales y una mención en nuestro correo. Grow no las incluye. Para tener estas ventajas con el plan Grow, elija Grow + Visibility.",
          },
          {
            q: "¿Qué significa la promoción prioritaria en Scale?",
            a: "Scale da prioridad a sus colocaciones promocionales frente a las colocaciones estándar, según disponibilidad. La prioridad no garantiza posiciones en buscadores, tráfico ni conversiones.",
          },
          {
            q: "¿Qué incluye Grow + Visibility?",
            a: "Grow + Visibility combina la suscripción estándar a Grow con las ventajas de promoción destacada mostradas arriba: un artículo en el blog de RepGet, promoción en redes sociales y una mención en nuestro correo. Grow por sí solo no incluye estas funciones promocionales; Scale incluye versiones prioritarias de ellas.",
          },
          {
            q: "¿Grow + Visibility incluye la prueba gratuita de 3 días?",
            a: "No. Grow + Visibility es una suscripción de compra directa. Su primer pago de {price} se cobra al pagar y la facturación mensual empieza cuando se suscribe. La prueba gratuita de 3 días no está incluida en este paquete promocional.",
          },
          {
            q: "¿Dónde podría aparecer mi negocio?",
            a: "La oferta destaca los canales sociales de RepGet, un artículo editorial en el blog de RepGet y visibilidad en los correos a nuestros suscriptores.",
          },
          {
            q: "¿Las ventajas promocionales son ilimitadas cada mes?",
            a: "No. Las funciones promocionales son extras de la suscripción mensual a la plataforma, no publicaciones ni correos ilimitados, ni resultados de posicionamiento garantizados.",
          },
        ],
      },
    ],
  },
  trial: {
    eyebrow: "Pruébelo antes de su primer pago",
    titleLines: ["Empiece con pruebas.", "No con promesas."],
    body: "Durante tres días tiene el servicio completo y normal de su plan: todas las funciones, a su ritmo diario, más 15 créditos al día para las funciones de distribución en redes y creación de contenido. Hoy no se cobra nada, y su plan empieza después de la prueba salvo que cancele antes de que termine.",
    points: ["3 días gratis", "Todas las funciones del plan", "Sin cargo hoy"],
    cta: "Empezar con RepGet",
    card1Kicker: "SU ESPACIO DE CONTENIDO",
    card1Title: "Cómo descubren los clientes su negocio en línea",
    card1Status: "✓ Artículo listo para revisar",
    card2Kicker: "CRECIMIENTO CONECTADO",
    card2Title: "Una visión clara de su producción",
    card2Stats: [
      { strong: "SEO", small: "Contenido" },
      { strong: "IA", small: "Visibilidad" },
      { strong: "↗", small: "Backlinks" },
    ],
    note: "Su prueba gratuita dura tres días. La facturación de la suscripción de pago sigue las condiciones mostradas al registrarse. RepGet también ofrece una garantía de reembolso de 3 días sobre su primer pago de suscripción; consulte nuestra",
    noteLink: "política de reembolsos",
    noteEnd: ".",
  },
};

const fr: PricingPageCopy = {
  hero: {
    titleLead: "Une plateforme.",
    titleAccent: "Plus de façons de grandir.",
    body: "De Google et la recherche par IA aux réseaux sociaux que suivent vos clients. Créez du contenu, renforcez votre autorité et suivez vos progrès dans un seul espace de travail connecté.",
    pills: ["Démarrage gratuit", "Résiliable à tout moment", "Garantie satisfait ou remboursé de 3 jours"],
  },
  bundle: {
    flag: "LA CROISSANCE, AMPLIFIÉE.",
    includes: "LE PLAN GROW COMPLET + VISIBILITÉ MISE EN AVANT",
    lede: "La formule Grow complète. Et une plus grande scène pour votre marque.",
    priceLabel: "Offre Grow plus Visibility, {price} par mois",
    perMonth: "/ mois",
    featureKicker: "VISIBILITÉ INCLUSE",
    featureTitle: "Soyez mis en avant sur nos *réseaux sociaux* et notre *blog.*",
    featureBody: "Avec une promotion auprès de l'audience e-mail de RepGet, en plus de tous les outils de la formule Grow.",
    cta: "Acheter Grow + Visibility",
    ctaLabel: "Acheter Grow plus Visibility, {price} par mois sans essai gratuit",
    noteStrong: "Achat direct.",
    note: "{price} facturés au paiement, puis chaque mois. L'essai gratuit de 3 jours ne s'applique pas à cette offre.",
    coreEyebrow: "01 / LA FORMULE GROW COMPLÈTE",
    corePill: "Toutes les fonctions standard",
    stats: [
      { strong: "articles de marque / mois", small: "1 par jour" },
      { strong: "publications sociales / mois", small: "Pour vos canaux" },
      { strong: "termes de recherche", small: "Étudiés et regroupés" },
    ],
    coreFeatures: [
      "Un site web connecté",
      "Publication automatique sur les principaux CMS",
      "Vérification hebdomadaire des réponses de l’IA, avec recherche web",
      "Audits du site et méta-descriptions des articles",
      "Accès au réseau de partenaires de backlinks",
      "Contenu axé SEO et ciblage de mots-clés",
      "**AI Growth Copilot** et conseils fondés sur vos données",
      "**AI Social Opportunities** et réponses suggérées",
    ],
    bonusEyebrow: "02 / AVANTAGES DE VISIBILITÉ MISE EN AVANT",
    bonusPill: "INCLUS DANS CETTE OFFRE",
    bonusIntro: "Une promotion supplémentaire au-delà de vos propres canaux",
    bonuses: [
      { strong: "Mise en avant sur les réseaux de RepGet", small: "Soyez mis en avant sur les réseaux sociaux de RepGet" },
      { strong: "Article sur le blog RepGet", small: "Présentez votre entreprise aux lecteurs de notre blog" },
      { strong: "Mise en avant par e-mail", small: "Promotion auprès des abonnés de RepGet" },
    ],
  },
  billing: {
    sectionLabel: "Formules et tarifs",
    label: "Choisissez la période de facturation",
    monthly: "Mensuel",
    yearly: "Annuel",
    saving: "Annuel : 2 mois offerts, et 40 % de réduction",
    savingPlain: "Annuel : 2 mois offerts",
  },
  card: {
    offerBadge: "-40 %",
    wasLabel: "prix normal",
    perMonth: "/ mois",
    monthlyCaption: "40 % de réduction sur le prix normal · facturé chaque mois",
    yearlyCaption: "Facturé {price}/an · au lieu de {regular}/an",
    plainMonthlyCaption: "Facturé chaque mois",
    plainYearlyCaption: "Facturé {price}/an",
    more: "Voir la comparaison complète",
    popular: "La plus choisie",
    perksTitle: "Avantages de visibilité inclus",
    perksLabel: "Avantages de visibilité promotionnelle inclus",
    priority: "PRIORITAIRE",
  },
  plans: {
    launch: {
      tag: "Faites-vous connaître",
      desc: "Pour les entrepreneurs prêts à bâtir une présence en ligne régulière.",
      cta: "Commencer avec Launch",
      includedLabel: "Votre boîte à outils de croissance mensuelle",
      features: [
        "**{articles} articles SEO**",
        "**{posts} publications sociales** pour rester présent",
        "**{terms} termes de recherche** étudiés",
        "**1 site web** connecté",
        "Vérification hebdomadaire des réponses de l’IA, avec recherche web",
        "Audit SEO, optimisation on-page et backlinks",
        "Publication automatique sur votre CMS",
        "**AI Growth Copilot** avec des analyses tirées des données de votre site",
        "**AI Social Opportunities** pour trouver des conversations et rédiger des réponses",
      ],
    },
    grow: {
      tag: "Touchez plus de monde",
      desc: "Pour les marques en croissance qui veulent une portée et une production plus régulières.",
      cta: "Commencer avec Grow",
      includedLabel: "Tout Free, plus les backlinks et plus de volume",
      features: [
        "**{articles} articles SEO**",
        "**{posts} publications sociales** sur plusieurs plateformes",
        "**{terms} termes de recherche** étudiés",
        "**1 site web** connecté",
        "Vérification hebdomadaire des réponses de l’IA, avec recherche web",
        "Audit SEO, optimisation on-page et backlinks",
        "Publication automatique sur votre CMS",
        "**AI Growth Copilot** avec des analyses tirées des données de votre site",
        "**AI Social Opportunities** pour trouver des conversations et rédiger des réponses",
      ],
    },
    scale: {
      tag: "Élan maximal",
      desc: "Pour les équipes ambitieuses qui produisent davantage sur chaque canal.",
      cta: "Commencer avec Scale",
      includedLabel: "Tout Grow, avec plus de capacité",
      features: [
        "**{articles} articles SEO**",
        "**{posts} publications sociales** sur plusieurs plateformes",
        "**{terms} termes de recherche** étudiés",
        "**1 site web** connecté",
        "Vérification hebdomadaire des réponses de l’IA, avec recherche web",
        "Audit SEO, optimisation on-page et backlinks",
        "**Demandes de fonctionnalités sur mesure**",
        "**AI Growth Copilot** avec des analyses tirées des données de votre site",
        "**AI Social Opportunities** pour trouver des conversations et rédiger des réponses",
      ],
      perks: [
        { strong: "Article prioritaire sur le blog RepGet", small: "Une visibilité éditoriale mise en avant" },
        { strong: "Mise en avant prioritaire sur les réseaux de RepGet", small: "Promotion auprès de l'audience sociale de RepGet" },
        { strong: "Mise en avant prioritaire par e-mail", small: "Promotion auprès des abonnés de RepGet" },
      ],
    },
  },
  compare: {
    eyebrow: "Côte à côte",
    title: "Comparez vos options.",
    body: "Commencez gratuitement, puis choisissez le volume mensuel adapté à votre entreprise. Grow et Scale incluent la plateforme de croissance complète, backlinks compris.",
    included: "Inclus",
    articles: "Articles SEO de marque / mois",
    posts: "Publications sociales / mois",
    terms: "Termes de recherche étudiés",
    websites: "Sites web par abonnement",
    copilot: { strong: "AI Growth Copilot", small: "Analyses du site, recommandations et actions approuvées" },
    social: { strong: "AI Social Opportunities", small: "Trouvez des discussions, rédigez des réponses et publiez après validation" },
    cms: "Publication automatique sur votre CMS",
    audits: "Audits SEO et méta-descriptions des articles",
    visibility: "Vérification hebdomadaire des réponses de l’IA, avec recherche web",
    backlinks: "Réseau de partenaires de backlinks",
    blog: { strong: "Article sur le blog RepGet", small: "Un emplacement mis en avant sur le blog de RepGet" },
    channels: { strong: "Mise en avant sur les réseaux de RepGet", small: "Promotion via les réseaux sociaux de RepGet" },
    email: { strong: "Mise en avant par e-mail", small: "Promotion auprès des abonnés de RepGet" },
    custom: "Demandes de fonctionnalités sur mesure",
    statusPriority: "Prioritaire",
    usageNote:
      "AI Growth Copilot comprend cinq messages gratuits par jour dans l'espace de travail actuel ; les messages supplémentaires sont facturés en crédits. Certaines actions de publication et d'interaction sur les réseaux utilisent aussi des crédits. Les canaux connectés et les actions prises en charge peuvent varier.",
  },
  faq: {
    eyebrow: "FAQ",
    titleLines: ["Questions", "fréquemment", "posées"],
    description: "Des réponses claires sur votre essai gratuit, les tarifs, la création de contenu et la visibilité en ligne.",
    contactLead: "Vous avez encore une question ?",
    contact: "Contactez-nous",
    panelTop: "VOS QUESTIONS, NOS RÉPONSES",
    scrollMore: "FAITES DÉFILER POUR EN VOIR PLUS",
    regionLabel: "FAQ RepGet, faites défiler pour voir plus de questions",
    count: "{n} réponses à découvrir",
    scrollInside: "Faites défiler dans le panneau",
    groups: [
      {
        title: "ESSAI GRATUIT ET PREMIERS PAS",
        items: [
          {
            q: "Le plan Free est-il vraiment gratuit ?",
            a: "Oui. Free ne coûte rien et ne demande aucune carte bancaire : chaque mois, il comprend 4 articles SEO rédigés par l'IA, 8 publications sociales, 1 audit SEO limité et 1 instantané de visibilité IA, avec 10 termes de recherche, 1 site web connecté et 3 demandes à Growth Copilot par jour. Les backlinks, la production vidéo par l'IA et l'automatisation avancée nécessitent un plan payant, et vous pouvez passer à un plan supérieur ou acheter des crédits à tout moment. Les places gratuites sont limitées pendant le lancement.",
          },
          {
            q: "Que se passe-t-il après l'essai gratuit ?",
            a: "À la fin de votre essai gratuit de 3 jours, la formule choisie à l'inscription démarre et le premier paiement est prélevé, sauf si vous résiliez avant la fin de l'essai. La date de début exacte, les montants et les conditions de renouvellement sont indiqués lors du paiement.",
          },
          {
            q: "Que comprend l'essai gratuit ?",
            a: "Votre essai gratuit vous donne le service complet et normal de votre formule pendant trois jours : toutes les fonctions de la formule, à son rythme quotidien, plus 15 crédits par jour pour les fonctions de diffusion sur les réseaux et de création de contenu. Rien n'est facturé aujourd'hui, par carte ou PayPal.",
          },
          {
            q: "Faut-il une expérience du SEO pour commencer ?",
            a: "Non. RepGet réunit la recherche de mots-clés, la création de contenu, les vérifications SEO techniques et la publication dans un seul espace de travail. Vous pouvez commencer avec votre site web et examiner les améliorations suggérées au fur et à mesure.",
          },
          {
            q: "Quelle formule choisir ?",
            a: "Free vous permet d'essayer RepGet gratuitement, avec quelques articles et publications sociales chaque mois. Grow offre davantage d'articles et de publications sociales, ainsi que des backlinks, et Scale ajoute des volumes mensuels plus élevés. Comparez ci-dessus les limites d'articles, de publications et de recherche pour trouver la bonne formule.",
          },
        ],
      },
      {
        title: "FACTURATION ET ABONNEMENTS",
        items: [
          {
            q: "Puis-je choisir une facturation mensuelle ou annuelle ?",
            a: "Oui. Utilisez le sélecteur Mensuel / Annuel ci-dessus pour comparer les prix. L'option annuelle affiche un montant mensuel équivalent ; le total annuel est facturé d'avance selon la formule choisie.",
          },
          {
            q: "Puis-je résilier mon abonnement ?",
            a: "Vous pouvez gérer la résiliation depuis votre compte. L'accès et la facturation après résiliation suivent les conditions d'abonnement présentées à l'inscription.",
          },
          {
            q: "Existe-t-il une garantie de remboursement ?",
            a: "RepGet offre une garantie satisfait ou remboursé de 3 jours sur le premier paiement de l'abonnement, selon la politique de remboursement publiée.",
            link: "Lire la politique de remboursement.",
          },
          {
            q: "Puis-je passer à une formule supérieure quand mon activité se développe ?",
            a: "Vous pouvez choisir une formule offrant plus de contenu, de publications sociales et de capacité de recherche. Consultez le tableau de bord de facturation ou contactez le support pour connaître les conditions applicables à votre compte.",
          },
        ],
      },
      {
        title: "CONTENU, RÉSEAUX SOCIAUX ET AUTOMATISATION",
        items: [
          {
            q: "RepGet peut-il publier des articles sur mon site ?",
            a: "RepGet prend en charge la publication sur WordPress, Shopify, Ghost, Webflow et d'autres plateformes compatibles. Connectez votre site et configurez les paramètres de publication adaptés à votre façon de travailler.",
          },
          {
            q: "Les articles comprennent-ils des images et des métadonnées SEO ?",
            a: "Chaque article comprend un titre, une méta-description et des liens internes vers des pages qui existent sur votre site. Une image de couverture est ajoutée quand la génération d'images est disponible ; sinon, l'article est tout de même rédigé et publié, sans image. RepGet n'ajoute pas de balisage schema (données structurées) à vos articles.",
          },
          {
            q: "Puis-je relire le contenu avant sa mise en ligne ?",
            a: "En partie. Le premier article d'un site est publié en ligne dès qu'il est rédigé, quel que soit le mode de publication, pour que vous voyiez un vrai article sur votre site. Ensuite, les nouveaux sites publient chaque article en ligne à la date prévue. Dans les paramètres de publication du site, vous pouvez choisir de les envoyer à votre CMS en brouillon ou de les garder dans RepGet jusqu'à votre validation.",
          },
          {
            q: "À quoi servent mes crédits d'essai ?",
            a: "Pendant les trois premiers jours, les 15 crédits d'essai quotidiens sont disponibles pour les fonctions éligibles de diffusion sur les réseaux et de création de contenu. L'utilisation et l'éligibilité sont indiquées dans votre espace de travail.",
          },
          {
            q: "Qu'est-ce qu'AI Growth Copilot ?",
            a: "Growth Copilot est votre assistant IA dans RepGet. Posez-lui des questions sur le trafic de votre site, vos articles, la santé du site, la visibilité dans la recherche par IA, les backlinks et l'activité sur les réseaux. Il s'appuie sur les données disponibles de votre espace de travail connecté pour expliquer ce qui se passe et peut suggérer ou effectuer les actions prises en charge une fois que vous les avez confirmées.",
          },
          {
            q: "Comment fonctionnent les AI Social Opportunities ?",
            a: "RepGet vous aide à trouver des discussions pertinentes sur les réseaux sociaux pris en charge, rédige des réponses adaptées au contexte et garde les conversations organisées dans un seul espace de travail. Vous relisez et approuvez ce qui est publié. La connexion des canaux et les publications ou réponses peuvent nécessiter des crédits.",
          },
          {
            q: "Les messages de Growth Copilot sont-ils illimités ?",
            a: "L'espace de travail propose actuellement cinq messages Growth Copilot gratuits par jour, puis un crédit par message supplémentaire. Consultez votre compte pour connaître les allocations et les crédits nécessaires.",
          },
        ],
      },
      {
        title: "SEO, VISIBILITÉ DANS L'IA ET BACKLINKS",
        items: [
          {
            q: "Comment RepGet étudie-t-il les mots-clés de mon secteur ?",
            a: "RepGet étudie et regroupe les termes de recherche pour vous permettre de planifier du contenu autour de sujets pertinents. Le volume de recherche dépend de votre formule : Free comprend 10 termes, Grow 300 et Scale 1 200.",
          },
          {
            q: "Quels assistants d'IA RepGet vérifie-t-il ?",
            a: "RepGet vérifie {assistants}. Chaque semaine, il pose à chaque assistant vérifié, via son API et avec la recherche web activée, les questions que vous suivez (20 avec Grow, 50 avec Scale ; Free prend un instantané de 5 questions par mois), plusieurs fois, dans votre langue, et note dans combien de réponses votre entreprise est citée, et à quel endroit. {notChecked} ne sont pas vérifiés : voyez-y le point de vue des assistants cités ici, pas une mesure de toute la recherche par IA.",
          },
          {
            q: "Comment fonctionnent les crédits de backlinks ?",
            a: "Les formules payantes donnent accès au réseau de partenaires de backlinks de RepGet. Les crédits nécessaires varient selon l'opportunité, et des crédits supplémentaires peuvent être achetés. Une annonce ou un solde de crédits ne garantit pas un emplacement précis.",
          },
          {
            q: "RepGet garantit-il les premières places sur Google ?",
            a: "Aucune plateforme ne peut garantir une position de recherche ou une mention dans l'IA. RepGet fournit des outils de recherche, de contenu et d'optimisation conçus pour favoriser des progrès réguliers dans le temps.",
          },
        ],
      },
      {
        title: "AVANTAGES DE VISIBILITÉ ET PROMOTION",
        items: [
          {
            q: "Grow et Scale comprennent-elles des fonctions promotionnelles ?",
            a: "Scale, oui : cette formule comprend des versions prioritaires d'un article sur le blog RepGet, d'une présence sur les réseaux sociaux et d'une mise en avant par e-mail. Grow ne les comprend pas. Pour en bénéficier avec la formule Grow, choisissez Grow + Visibility.",
          },
          {
            q: "Que signifie la promotion prioritaire dans Scale ?",
            a: "Scale donne à vos mises en avant la priorité sur les mises en avant standard, selon les disponibilités. La priorité ne garantit ni positions dans les moteurs de recherche, ni trafic, ni conversions.",
          },
          {
            q: "Que comprend Grow + Visibility ?",
            a: "Grow + Visibility associe l'abonnement Grow standard aux avantages de promotion présentés ci-dessus : un article sur le blog RepGet, une promotion sur les réseaux sociaux et une mise en avant par e-mail. La formule Grow seule ne comprend pas ces fonctions promotionnelles ; Scale en comprend des versions prioritaires.",
          },
          {
            q: "Grow + Visibility comprend-elle l'essai gratuit de 3 jours ?",
            a: "Non. Grow + Visibility est un abonnement en achat direct. Votre premier paiement de {price} est encaissé lors du paiement, et la facturation mensuelle commence dès votre souscription. L'essai gratuit de 3 jours n'est pas inclus dans cette offre promotionnelle.",
          },
          {
            q: "Où mon entreprise pourrait-elle être mise en avant ?",
            a: "L'offre met en avant les réseaux sociaux de RepGet, un article éditorial sur le blog RepGet et une visibilité dans les e-mails envoyés aux abonnés.",
          },
          {
            q: "Les avantages promotionnels sont-ils illimités chaque mois ?",
            a: "Non. Les fonctions promotionnelles sont des extras de l'abonnement mensuel à la plateforme, et non des publications ou e-mails illimités ni des résultats de classement garantis.",
          },
        ],
      },
    ],
  },
  trial: {
    eyebrow: "Essayez avant votre premier paiement",
    titleLines: ["Des preuves.", "Pas des promesses."],
    body: "Pendant trois jours, vous profitez du service complet et normal de votre formule : toutes les fonctions, à son rythme quotidien, plus 15 crédits par jour pour les fonctions de diffusion sur les réseaux et de création de contenu. Rien n'est facturé aujourd'hui, et votre formule démarre après l'essai, sauf si vous résiliez avant sa fin.",
    points: ["3 jours offerts", "Toutes les fonctions", "Aucun paiement aujourd'hui"],
    cta: "Commencer avec RepGet",
    card1Kicker: "VOTRE ESPACE DE CONTENU",
    card1Title: "Comment les clients découvrent votre entreprise en ligne",
    card1Status: "✓ Article prêt à relire",
    card2Kicker: "CROISSANCE CONNECTÉE",
    card2Title: "Une vue claire de votre production",
    card2Stats: [
      { strong: "SEO", small: "Contenu" },
      { strong: "IA", small: "Visibilité" },
      { strong: "↗", small: "Backlinks" },
    ],
    note: "Votre essai gratuit dure trois jours. La facturation de l'abonnement payant suit les conditions indiquées à l'inscription. RepGet offre aussi une garantie satisfait ou remboursé de 3 jours sur votre premier paiement d'abonnement ; consultez notre",
    noteLink: "politique de remboursement",
    noteEnd: ".",
  },
};

const it: PricingPageCopy = {
  hero: {
    titleLead: "Una piattaforma.",
    titleAccent: "Più modi per crescere.",
    body: "Da Google e dalla ricerca con l'IA ai social che i suoi clienti seguono. Crei contenuti, costruisca autorevolezza e segua i progressi in un unico spazio di lavoro connesso.",
    pills: ["Inizio gratuito", "Disdetta in qualsiasi momento", "Garanzia soddisfatti o rimborsati di 3 giorni"],
  },
  bundle: {
    flag: "CRESCITA, AMPLIFICATA.",
    includes: "IL PIANO GROW COMPLETO + VISIBILITÀ IN EVIDENZA",
    lede: "Il piano Grow completo. In più, un palcoscenico più grande per il suo marchio.",
    priceLabel: "Pacchetto Grow più Visibility, {price} al mese",
    perMonth: "/ mese",
    featureKicker: "VISIBILITÀ INCLUSA",
    featureTitle: "Compaia sui nostri *canali social* e sul nostro *blog.*",
    featureBody: "In più, promozione presso il pubblico email di RepGet, insieme a tutti gli strumenti del piano Grow.",
    cta: "Acquista Grow + Visibility",
    ctaLabel: "Acquista Grow più Visibility, {price} al mese senza prova gratuita",
    noteStrong: "Acquisto diretto.",
    note: "{price} addebitati al pagamento, poi ogni mese. La prova gratuita di 3 giorni non si applica a questa offerta.",
    coreEyebrow: "01 / IL PIANO GROW COMPLETO",
    corePill: "Tutte le funzioni standard",
    stats: [
      { strong: "articoli brandizzati / mese", small: "1 al giorno" },
      { strong: "post social / mese", small: "Per i suoi canali" },
      { strong: "termini di ricerca", small: "Analizzati e raggruppati" },
    ],
    coreFeatures: [
      "Un sito web collegato",
      "Pubblicazione automatica sui principali CMS",
      "Controllo settimanale delle risposte dell'IA, con ricerca web",
      "Audit del sito e meta description degli articoli",
      "Accesso alla rete di partner per i backlink",
      "Contenuti orientati alla SEO e alle parole chiave",
      "**AI Growth Copilot** e indicazioni basate sui dati",
      "**AI Social Opportunities** e risposte suggerite",
    ],
    bonusEyebrow: "02 / VANTAGGI DI VISIBILITÀ IN EVIDENZA",
    bonusPill: "INCLUSO IN QUESTO PACCHETTO",
    bonusIntro: "Promozione aggiuntiva oltre ai suoi canali",
    bonuses: [
      { strong: "Presenza sui canali social di RepGet", small: "Compaia sui canali social di RepGet" },
      { strong: "Articolo sul blog di RepGet", small: "Presenti la sua attività ai lettori del nostro blog" },
      { strong: "Spazio nella nostra email", small: "Promozione presso gli iscritti di RepGet" },
    ],
  },
  billing: {
    sectionLabel: "Piani e prezzi",
    label: "Scelga il periodo di fatturazione",
    monthly: "Mensile",
    yearly: "Annuale",
    saving: "Annuale: 2 mesi gratis, più il 40% di sconto",
    savingPlain: "Annuale: 2 mesi gratis",
  },
  card: {
    offerBadge: "-40%",
    wasLabel: "prezzo normale",
    perMonth: "/ mese",
    monthlyCaption: "40% di sconto sul prezzo normale · fatturazione mensile",
    yearlyCaption: "Fatturato {price}/anno · prima {regular}/anno",
    plainMonthlyCaption: "Fatturazione mensile",
    plainYearlyCaption: "Fatturato {price}/anno",
    more: "Vedi il confronto completo",
    popular: "Il più scelto",
    perksTitle: "Vantaggi di visibilità inclusi",
    perksLabel: "Vantaggi di visibilità promozionale inclusi",
    priority: "PRIORITÀ",
  },
  plans: {
    launch: {
      tag: "Si faccia trovare",
      desc: "Per imprenditori pronti a costruire una presenza online costante.",
      cta: "Inizia con Launch",
      includedLabel: "Il suo kit mensile per crescere",
      features: [
        "**{articles} articoli SEO**",
        "**{posts} post social** per restare presente",
        "**{terms} termini di ricerca** analizzati",
        "**1 sito web** collegato",
        "Controllo settimanale delle risposte dell'IA, con ricerca web",
        "Audit SEO, ottimizzazione on-page e backlink",
        "Pubblicazione automatica sul CMS",
        "**AI Growth Copilot** con analisi basate sui dati del suo sito",
        "**AI Social Opportunities** per scoprire conversazioni e preparare risposte",
      ],
    },
    grow: {
      tag: "Raggiunga più persone",
      desc: "Per marchi in crescita che vogliono una portata e una produzione più costanti.",
      cta: "Inizia con Grow",
      includedLabel: "Tutto Free, più backlink e più volume",
      features: [
        "**{articles} articoli SEO**",
        "**{posts} post social** su più piattaforme",
        "**{terms} termini di ricerca** analizzati",
        "**1 sito web** collegato",
        "Controllo settimanale delle risposte dell'IA, con ricerca web",
        "Audit SEO, ottimizzazione on-page e backlink",
        "Pubblicazione automatica sul CMS",
        "**AI Growth Copilot** con analisi basate sui dati del suo sito",
        "**AI Social Opportunities** per scoprire conversazioni e preparare risposte",
      ],
    },
    scale: {
      tag: "Massimo slancio",
      desc: "Per team ambiziosi che producono di più su ogni canale.",
      cta: "Inizia con Scale",
      includedLabel: "Tutto Grow, con più capacità",
      features: [
        "**{articles} articoli SEO**",
        "**{posts} post social** su più piattaforme",
        "**{terms} termini di ricerca** analizzati",
        "**1 sito web** collegato",
        "Controllo settimanale delle risposte dell'IA, con ricerca web",
        "Audit SEO, ottimizzazione on-page e backlink",
        "**Richieste di funzioni personalizzate**",
        "**AI Growth Copilot** con analisi basate sui dati del suo sito",
        "**AI Social Opportunities** per scoprire conversazioni e preparare risposte",
      ],
      perks: [
        { strong: "Articolo prioritario sul blog di RepGet", small: "Visibilità editoriale in evidenza" },
        { strong: "Presenza prioritaria sui canali social di RepGet", small: "Promozione presso il pubblico social di RepGet" },
        { strong: "Spazio prioritario nella nostra email", small: "Promozione presso gli iscritti di RepGet" },
      ],
    },
  },
  compare: {
    eyebrow: "Fianco a fianco",
    title: "Confronti le opzioni.",
    body: "Inizi gratis, poi scelga il volume mensile più adatto alla sua attività. Grow e Scale includono la piattaforma di crescita completa, backlink compresi.",
    included: "Incluso",
    articles: "Articoli SEO brandizzati / mese",
    posts: "Post social / mese",
    terms: "Termini di ricerca analizzati",
    websites: "Siti web per abbonamento",
    copilot: { strong: "AI Growth Copilot", small: "Analisi del sito, consigli e azioni approvate" },
    social: { strong: "AI Social Opportunities", small: "Trovi discussioni, prepari risposte e pubblichi previa approvazione" },
    cms: "Pubblicazione automatica sul CMS",
    audits: "Audit SEO e meta description degli articoli",
    visibility: "Controllo settimanale delle risposte dell'IA, con ricerca web",
    backlinks: "Rete di partner per i backlink",
    blog: { strong: "Articolo sul blog di RepGet", small: "Uno spazio in evidenza sul blog di RepGet" },
    channels: { strong: "Presenza sui canali social di RepGet", small: "Promozione attraverso i canali social di RepGet" },
    email: { strong: "Spazio nella nostra email", small: "Promozione presso gli iscritti di RepGet" },
    custom: "Richieste di funzioni personalizzate",
    statusPriority: "Priorità",
    usageNote:
      "AI Growth Copilot include cinque messaggi gratuiti al giorno nello spazio di lavoro attuale; i messaggi aggiuntivi sono addebitati in crediti. Anche alcune azioni di pubblicazione e interazione sui social usano crediti. I canali collegati e le azioni disponibili possono variare.",
  },
  faq: {
    eyebrow: "FAQ",
    titleLines: ["Domande", "frequenti", ""],
    description: "Risposte chiare su prova gratuita, prezzi, creazione di contenuti e visibilità online.",
    contactLead: "Ha ancora una domanda?",
    contact: "Ci contatti",
    panelTop: "LE SUE DOMANDE, LE NOSTRE RISPOSTE",
    scrollMore: "SCORRA PER ALTRE",
    regionLabel: "FAQ di RepGet, scorra per vedere altre domande",
    count: "{n} risposte da scoprire",
    scrollInside: "Scorra all'interno del pannello",
    groups: [
      {
        title: "PROVA GRATUITA E PRIMI PASSI",
        items: [
          {
            q: "Il piano Free è davvero gratuito?",
            a: "Sì. Free non costa nulla e non richiede la carta di credito: ogni mese include 4 articoli SEO con IA, 8 post social, 1 audit SEO limitato e 1 istantanea di visibilità IA, con 10 termini di ricerca, 1 sito web collegato e 3 richieste a Growth Copilot al giorno. Backlink, produzione video con IA e automazione avanzata richiedono un piano a pagamento, e può passare a un piano superiore o acquistare crediti in qualsiasi momento. I posti gratuiti sono limitati durante il lancio.",
          },
          {
            q: "Che cosa succede dopo la prova gratuita?",
            a: "Al termine della prova gratuita di 3 giorni, il piano scelto in fase di registrazione inizia e viene addebitato il primo pagamento, a meno che non disdica prima della fine della prova. La data di inizio esatta, gli addebiti e le condizioni di rinnovo sono indicati al pagamento.",
          },
          {
            q: "Che cosa include la prova gratuita?",
            a: "La prova gratuita le offre per tre giorni il servizio completo e normale del suo piano: tutte le funzioni del piano, al suo ritmo giornaliero, più 15 crediti al giorno per le funzioni di distribuzione sui social e di creazione di contenuti. Oggi non viene addebitato nulla, con carta o PayPal.",
          },
          {
            q: "Serve esperienza di SEO per iniziare?",
            a: "No. RepGet riunisce ricerca delle parole chiave, creazione di contenuti, controlli SEO tecnici e pubblicazione in un unico spazio di lavoro. Può iniziare dal suo sito web e valutare i miglioramenti suggeriti strada facendo.",
          },
          {
            q: "Quale piano scegliere?",
            a: "Free le permette di provare RepGet senza costi, con alcuni articoli e post social ogni mese. Grow offre più articoli e post social, oltre ai backlink, e Scale aggiunge volumi mensili più alti. Confronti sopra i limiti di articoli, post e ricerca per trovare il piano giusto.",
          },
        ],
      },
      {
        title: "FATTURAZIONE E ABBONAMENTI",
        items: [
          {
            q: "Posso scegliere la fatturazione mensile o annuale?",
            a: "Sì. Usi il selettore Mensile / Annuale qui sopra per confrontare i prezzi. L'opzione annuale mostra un importo mensile equivalente; il totale annuale viene fatturato in anticipo in base al piano scelto.",
          },
          {
            q: "Posso disdire l'abbonamento?",
            a: "Può gestire la disdetta dal suo account. L'accesso e la fatturazione dopo la disdetta seguono le condizioni di abbonamento presentate in fase di registrazione.",
          },
          {
            q: "C'è una garanzia di rimborso?",
            a: "RepGet offre una garanzia soddisfatti o rimborsati di 3 giorni sul primo pagamento dell'abbonamento, secondo la politica di rimborso pubblicata.",
            link: "Legga la politica di rimborso.",
          },
          {
            q: "Posso passare a un piano superiore quando la mia attività cresce?",
            a: "Può scegliere un piano con più contenuti, post social e capacità di ricerca. Consulti la pagina di fatturazione o contatti l'assistenza per le condizioni di passaggio valide per il suo account.",
          },
        ],
      },
      {
        title: "CONTENUTI, SOCIAL E AUTOMAZIONE",
        items: [
          {
            q: "RepGet può pubblicare articoli sul mio sito?",
            a: "RepGet supporta la pubblicazione su WordPress, Shopify, Ghost, Webflow e altre piattaforme compatibili. Colleghi il suo sito e configuri le impostazioni di pubblicazione adatte al suo modo di lavorare.",
          },
          {
            q: "Gli articoli includono immagini e metadati SEO?",
            a: "Ogni articolo ha un titolo, una meta description e link interni a pagine che esistono sul suo sito. Un'immagine di copertina viene aggiunta quando la generazione di immagini è disponibile; altrimenti l'articolo viene comunque scritto e pubblicato, senza immagine. RepGet non aggiunge markup schema (dati strutturati) ai suoi articoli.",
          },
          {
            q: "Posso rivedere i contenuti prima della pubblicazione?",
            a: "In parte. Il primo articolo di un sito viene pubblicato online appena è scritto, qualunque sia la modalità di pubblicazione, così vede un vero articolo sul suo sito. Poi i nuovi siti pubblicano ogni articolo online nel giorno previsto. Nelle impostazioni di pubblicazione del sito può scegliere di inviarli al CMS come bozze o di tenerli in RepGet finché non li approva.",
          },
          {
            q: "Per che cosa posso usare i crediti della prova?",
            a: "Nei primi tre giorni, i 15 crediti di prova giornalieri sono disponibili per le funzioni idonee di distribuzione sui social e di creazione di contenuti. L'utilizzo e l'idoneità sono indicati nel suo spazio di lavoro.",
          },
          {
            q: "Che cos'è AI Growth Copilot?",
            a: "Growth Copilot è il suo assistente IA all'interno di RepGet. Gli chieda del traffico del suo sito, degli articoli, dello stato del sito, della visibilità nella ricerca con l'IA, dei backlink e dell'attività sui social. Usa i dati disponibili del suo spazio di lavoro collegato per spiegare che cosa sta succedendo e può suggerire o eseguire le azioni supportate dopo la sua conferma.",
          },
          {
            q: "Come funzionano le AI Social Opportunities?",
            a: "RepGet la aiuta a trovare discussioni pertinenti sui canali social supportati, prepara risposte adatte al contesto e tiene le conversazioni organizzate in un unico spazio di lavoro. Lei rivede e approva ciò che viene pubblicato. Il collegamento dei canali e le azioni di pubblicazione o risposta possono richiedere crediti.",
          },
          {
            q: "I messaggi di Growth Copilot sono illimitati?",
            a: "Attualmente lo spazio di lavoro offre cinque messaggi gratuiti di Growth Copilot al giorno, poi un credito per ogni messaggio aggiuntivo. Consulti il suo account per le disponibilità e i crediti richiesti attuali.",
          },
        ],
      },
      {
        title: "SEO, VISIBILITÀ NELL'IA E BACKLINK",
        items: [
          {
            q: "Come ricerca RepGet le parole chiave del mio settore?",
            a: "RepGet ricerca e raggruppa i termini di ricerca per aiutarla a pianificare contenuti su argomenti pertinenti. Il volume di ricerca dipende dal piano: Free include 10 termini, Grow 300 e Scale 1.200.",
          },
          {
            q: "Quali assistenti IA controlla RepGet?",
            a: "RepGet controlla {assistants}. Ogni settimana pone a ciascun assistente controllato, tramite la sua API e con la ricerca web attiva, le domande che lei monitora (20 con Grow, 50 con Scale; Free scatta un'istantanea di 5 domande al mese), più volte, nella sua lingua, e registra in quante risposte la sua attività viene nominata, e in che punto. {notChecked} non vengono controllati: lo consideri il punto di vista degli assistenti indicati qui, non una misura di tutta la ricerca con l'IA.",
          },
          {
            q: "Come funzionano i crediti per i backlink?",
            a: "I piani a pagamento danno accesso alla rete di partner per i backlink di RepGet. I crediti richiesti variano a seconda dell'opportunità ed è possibile acquistarne altri. Un annuncio o un saldo di crediti non garantisce un collocamento specifico.",
          },
          {
            q: "RepGet garantisce le prime posizioni su Google?",
            a: "Nessuna piattaforma può garantire una determinata posizione nei risultati o una menzione nell'IA. RepGet fornisce strumenti di ricerca, contenuti e ottimizzazione pensati per favorire miglioramenti costanti nel tempo.",
          },
        ],
      },
      {
        title: "VANTAGGI DI VISIBILITÀ E PROMOZIONE",
        items: [
          {
            q: "Grow e Scale includono funzioni promozionali?",
            a: "Scale sì: include versioni prioritarie di un articolo sul blog di RepGet, della visibilità sui canali social e di uno spazio nella nostra email. Grow non include questi vantaggi. Per averli con il piano Grow, scelga Grow + Visibility.",
          },
          {
            q: "Che cosa significa promozione prioritaria in Scale?",
            a: "Scale dà ai suoi collocamenti promozionali la priorità rispetto a quelli standard, secondo disponibilità. La priorità non garantisce posizioni nei risultati di ricerca, traffico o conversioni.",
          },
          {
            q: "Che cosa include Grow + Visibility?",
            a: "Grow + Visibility unisce l'abbonamento Grow standard ai vantaggi di promozione in evidenza illustrati sopra: un articolo sul blog di RepGet, promozione sui canali social e uno spazio nella nostra email. Grow da solo non include queste funzioni promozionali; Scale ne include versioni prioritarie.",
          },
          {
            q: "Grow + Visibility include la prova gratuita di 3 giorni?",
            a: "No. Grow + Visibility è un abbonamento ad acquisto diretto. Il primo pagamento di {price} viene addebitato al momento del pagamento e la fatturazione mensile inizia con la sottoscrizione. La prova gratuita di 3 giorni non è inclusa in questo pacchetto promozionale.",
          },
          {
            q: "Dove potrebbe comparire la mia attività?",
            a: "L'offerta mette in evidenza i canali social di RepGet, un articolo editoriale sul blog di RepGet e visibilità nelle email inviate agli iscritti.",
          },
          {
            q: "I vantaggi promozionali sono illimitati ogni mese?",
            a: "No. Le funzioni promozionali sono extra in aggiunta all'abbonamento mensile alla piattaforma, non post o email illimitati né risultati di posizionamento garantiti.",
          },
        ],
      },
    ],
  },
  trial: {
    eyebrow: "Provi prima del primo pagamento",
    titleLines: ["Inizi con i fatti.", "Non con le promesse."],
    body: "Per tre giorni ha il servizio completo e normale del suo piano: tutte le funzioni, al suo ritmo giornaliero, più 15 crediti al giorno per le funzioni di distribuzione sui social e di creazione di contenuti. Oggi non viene addebitato nulla e il piano parte dopo la prova, a meno che non disdica prima della fine.",
    points: ["3 giorni gratis", "Tutte le funzioni del piano", "Nessun addebito oggi"],
    cta: "Inizi con RepGet",
    card1Kicker: "IL SUO SPAZIO PER I CONTENUTI",
    card1Title: "Come i clienti scoprono la sua attività online",
    card1Status: "✓ Articolo pronto per la revisione",
    card2Kicker: "CRESCITA CONNESSA",
    card2Title: "Una visione chiara della sua produzione",
    card2Stats: [
      { strong: "SEO", small: "Contenuti" },
      { strong: "IA", small: "Visibilità" },
      { strong: "↗", small: "Backlink" },
    ],
    note: "La prova gratuita dura tre giorni. La fatturazione dell'abbonamento a pagamento segue le condizioni indicate in fase di registrazione. RepGet offre anche una garanzia soddisfatti o rimborsati di 3 giorni sul primo pagamento dell'abbonamento; consulti la nostra",
    noteLink: "politica di rimborso",
    noteEnd: ".",
  },
};

const de: PricingPageCopy = {
  hero: {
    titleLead: "Eine Plattform.",
    titleAccent: "Mehr Wege zu wachsen.",
    body: "Von Google und KI-Suche bis zu den sozialen Netzwerken, denen Ihre Kunden folgen. Erstellen Sie Inhalte, bauen Sie Autorität auf und verfolgen Sie Ihre Fortschritte in einem vernetzten Arbeitsbereich.",
    pills: ["Kostenlos starten", "Jederzeit kündbar", "3-Tage-Geld-zurück-Garantie"],
  },
  bundle: {
    flag: "WACHSTUM, VERSTÄRKT.",
    includes: "DER KOMPLETTE GROW-PLAN + HERVORGEHOBENE SICHTBARKEIT",
    lede: "Der komplette Grow-Tarif. Dazu eine größere Bühne für Ihre Marke.",
    priceLabel: "Paket Grow plus Visibility, {price} pro Monat",
    perMonth: "/ Monat",
    featureKicker: "SICHTBARKEIT INKLUSIVE",
    featureTitle: "Präsentiert auf unseren *Social-Media-Kanälen* & unserem *Blog.*",
    featureBody: "Dazu Werbung bei der E-Mail-Zielgruppe von RepGet, neben allen Werkzeugen des Grow-Tarifs.",
    cta: "Grow + Visibility kaufen",
    ctaLabel: "Grow plus Visibility kaufen, {price} pro Monat ohne kostenlose Testphase",
    noteStrong: "Direktkauf.",
    note: "{price} werden beim Bezahlen berechnet, danach monatlich. Die 3-tägige kostenlose Testphase gilt für dieses Angebot nicht.",
    coreEyebrow: "01 / DER KOMPLETTE GROW-TARIF",
    corePill: "Alle Standardfunktionen",
    stats: [
      { strong: "Markenartikel / Monat", small: "1 täglich" },
      { strong: "Social-Media-Beiträge / Monat", small: "Für Ihre Kanäle" },
      { strong: "Suchbegriffe", small: "Recherchiert & gruppiert" },
    ],
    coreFeatures: [
      "Eine verbundene Website",
      "Automatisches Veröffentlichen in gängigen CMS",
      "Wöchentliche Prüfung von KI-Antworten, mit Websuche",
      "Website-Audits & Meta-Beschreibungen der Artikel",
      "Zugang zum Backlink-Partnernetzwerk",
      "SEO-orientierte Inhalte & Keyword-Targeting",
      "**AI Growth Copilot** & datenbasierte Empfehlungen",
      "**AI Social Opportunities** & Antwortvorschläge",
    ],
    bonusEyebrow: "02 / VORTEILE FÜR MEHR SICHTBARKEIT",
    bonusPill: "IN DIESEM PAKET ENTHALTEN",
    bonusIntro: "Zusätzliche Werbung über Ihre eigenen Kanäle hinaus",
    bonuses: [
      { strong: "Präsentiert auf den Social-Media-Kanälen von RepGet", small: "Präsentiert auf den Social-Media-Kanälen von RepGet" },
      { strong: "Beitrag im RepGet-Blog", small: "Stellen Sie Ihr Unternehmen den Lesern unseres Blogs vor" },
      { strong: "E-Mail-Spotlight", small: "Werbung bei den Abonnenten von RepGet" },
    ],
  },
  billing: {
    sectionLabel: "Tarife und Preise",
    label: "Abrechnungszeitraum wählen",
    monthly: "Monatlich",
    yearly: "Jährlich",
    saving: "Jährlich: 2 Monate gratis, dazu 40 % Rabatt",
    savingPlain: "Jährlich: 2 Monate gratis",
  },
  card: {
    offerBadge: "40 % RABATT",
    wasLabel: "regulärer Preis",
    perMonth: "/ Monat",
    monthlyCaption: "40 % Rabatt auf den regulären Preis · monatliche Abrechnung",
    yearlyCaption: "{price}/Jahr berechnet · statt {regular}/Jahr",
    plainMonthlyCaption: "Monatliche Abrechnung",
    plainYearlyCaption: "{price}/Jahr berechnet",
    more: "Zum vollständigen Funktionsvergleich",
    popular: "Am beliebtesten",
    perksTitle: "Enthaltene Sichtbarkeitsvorteile",
    perksLabel: "Enthaltene Werbe- und Sichtbarkeitsvorteile",
    priority: "PRIORITÄT",
  },
  plans: {
    launch: {
      tag: "Gefunden werden",
      desc: "Für Unternehmer, die eine beständige Online-Präsenz aufbauen möchten.",
      cta: "Mit Launch starten",
      includedLabel: "Ihr monatliches Wachstums-Toolkit",
      features: [
        "**{articles} SEO-Artikel**",
        "**{posts} Social-Media-Beiträge**, um präsent zu bleiben",
        "**{terms} Suchbegriffe** recherchiert",
        "**1 Website** verbunden",
        "Wöchentliche Prüfung von KI-Antworten, mit Websuche",
        "SEO-Audit, On-Page-Optimierung und Backlinks",
        "Automatisches Veröffentlichen im CMS",
        "**AI Growth Copilot** mit Erkenntnissen aus Ihren Website-Daten",
        "**AI Social Opportunities**, um Gespräche zu finden und Antworten zu entwerfen",
      ],
    },
    grow: {
      tag: "Mehr Menschen erreichen",
      desc: "Für wachsende Marken, die beständigere Reichweite und mehr Output wollen.",
      cta: "Mit Grow starten",
      includedLabel: "Alles aus Free, plus Backlinks und mehr Volumen",
      features: [
        "**{articles} SEO-Artikel**",
        "**{posts} Social-Media-Beiträge** auf mehreren Plattformen",
        "**{terms} Suchbegriffe** recherchiert",
        "**1 Website** verbunden",
        "Wöchentliche Prüfung von KI-Antworten, mit Websuche",
        "SEO-Audit, On-Page-Optimierung und Backlinks",
        "Automatisches Veröffentlichen im CMS",
        "**AI Growth Copilot** mit Erkenntnissen aus Ihren Website-Daten",
        "**AI Social Opportunities**, um Gespräche zu finden und Antworten zu entwerfen",
      ],
    },
    scale: {
      tag: "Maximaler Schwung",
      desc: "Für ambitionierte Teams, die auf allen Kanälen mehr produzieren.",
      cta: "Mit Scale starten",
      includedLabel: "Alles aus Grow, mit mehr Kapazität",
      features: [
        "**{articles} SEO-Artikel**",
        "**{posts} Social-Media-Beiträge** auf mehreren Plattformen",
        "**{terms} Suchbegriffe** recherchiert",
        "**1 Website** verbunden",
        "Wöchentliche Prüfung von KI-Antworten, mit Websuche",
        "SEO-Audit, On-Page-Optimierung und Backlinks",
        "**Individuelle Funktionswünsche**",
        "**AI Growth Copilot** mit Erkenntnissen aus Ihren Website-Daten",
        "**AI Social Opportunities**, um Gespräche zu finden und Antworten zu entwerfen",
      ],
      perks: [
        { strong: "Bevorzugter Beitrag im RepGet-Blog", small: "Hervorgehobene redaktionelle Sichtbarkeit" },
        { strong: "Bevorzugte Präsentation auf den RepGet-Kanälen", small: "Werbung bei der Social-Media-Zielgruppe von RepGet" },
        { strong: "Bevorzugtes E-Mail-Spotlight", small: "Werbung bei den Abonnenten von RepGet" },
      ],
    },
  },
  compare: {
    eyebrow: "Im direkten Vergleich",
    title: "Vergleichen Sie Ihre Optionen.",
    body: "Starten Sie kostenlos und wählen Sie dann das monatliche Volumen, das zu Ihrem Unternehmen passt. Grow und Scale enthalten die komplette Wachstumsplattform, Backlinks inklusive.",
    included: "Enthalten",
    articles: "SEO-Markenartikel / Monat",
    posts: "Social-Media-Beiträge / Monat",
    terms: "Recherchierte Suchbegriffe",
    websites: "Websites pro Abonnement",
    copilot: { strong: "AI Growth Copilot", small: "Website-Erkenntnisse, Empfehlungen & freigegebene Aktionen" },
    social: { strong: "AI Social Opportunities", small: "Diskussionen finden, Antworten entwerfen & nach Freigabe veröffentlichen" },
    cms: "Automatisches Veröffentlichen im CMS",
    audits: "SEO-Audits & Meta-Beschreibungen der Artikel",
    visibility: "Wöchentliche Prüfung von KI-Antworten, mit Websuche",
    backlinks: "Backlink-Partnernetzwerk",
    blog: { strong: "Beitrag im RepGet-Blog", small: "Hervorgehobene Platzierung im RepGet-Blog" },
    channels: { strong: "Präsentation auf den RepGet-Kanälen", small: "Werbung über die Social-Media-Kanäle von RepGet" },
    email: { strong: "E-Mail-Spotlight", small: "Werbung bei den Abonnenten von RepGet" },
    custom: "Individuelle Funktionswünsche",
    statusPriority: "Priorität",
    usageNote:
      "AI Growth Copilot enthält fünf kostenlose Nachrichten pro Tag im aktuellen Arbeitsbereich; weitere Nachrichten werden in Credits berechnet. Einige Veröffentlichungs- und Interaktionsaktionen in sozialen Netzwerken verbrauchen ebenfalls Credits. Verbundene Kanäle und unterstützte Aktionen können variieren.",
  },
  faq: {
    eyebrow: "FAQ",
    titleLines: ["Häufig", "gestellte", "Fragen"],
    description: "Klare Antworten zu Ihrer kostenlosen Testphase, den Preisen, der Erstellung von Inhalten und Ihrer Online-Sichtbarkeit.",
    contactLead: "Noch eine Frage?",
    contact: "Kontaktieren Sie uns",
    panelTop: "IHRE FRAGEN, BEANTWORTET",
    scrollMore: "SCROLLEN FÜR MEHR",
    regionLabel: "RepGet-FAQ, scrollen Sie, um weitere Fragen zu sehen",
    count: "{n} Antworten zum Entdecken",
    scrollInside: "Innerhalb des Feldes scrollen",
    groups: [
      {
        title: "KOSTENLOSE TESTPHASE & ERSTE SCHRITTE",
        items: [
          {
            q: "Ist der Free-Plan wirklich kostenlos?",
            a: "Ja. Free kostet nichts und braucht keine Kreditkarte: Jeden Monat enthält er 4 KI-SEO-Artikel, 8 Social-Media-Beiträge, 1 eingeschränktes SEO-Audit und 1 KI-Sichtbarkeits-Momentaufnahme, dazu 10 Suchbegriffe, 1 verbundene Website und 3 Growth-Copilot-Anfragen pro Tag. Backlinks, KI-Videoproduktion und erweiterte Automatisierung erfordern einen bezahlten Plan, und Sie können jederzeit upgraden oder Credits kaufen. Die kostenlosen Plätze sind während des Starts begrenzt.",
          },
          {
            q: "Was passiert nach der kostenlosen Testphase?",
            a: "Wenn Ihre 3-tägige kostenlose Testphase endet, beginnt der bei der Anmeldung gewählte Tarif und die erste Zahlung wird eingezogen, sofern Sie nicht vor dem Ende der Testphase kündigen. Das genaue Startdatum, die Beträge und die Verlängerungsbedingungen werden beim Bezahlen angezeigt.",
          },
          {
            q: "Was ist in der kostenlosen Testphase enthalten?",
            a: "Ihre kostenlose Testphase bietet Ihnen drei Tage lang den vollen, normalen Service Ihres Tarifs: alle Funktionen des Tarifs in seinem täglichen Tempo, dazu 15 Credits pro Tag für Funktionen zur Verbreitung in sozialen Netzwerken und zur Erstellung von Inhalten. Heute wird nichts berechnet, per Karte oder PayPal.",
          },
          {
            q: "Brauche ich SEO-Erfahrung, um zu starten?",
            a: "Nein. RepGet vereint Keyword-Recherche, Erstellung von Inhalten, technische SEO-Prüfungen und Veröffentlichung in einem Arbeitsbereich. Sie können mit Ihrer Website beginnen und die vorgeschlagenen Verbesserungen nach und nach prüfen.",
          },
          {
            q: "Welchen Tarif sollte ich wählen?",
            a: "Mit Free testen Sie RepGet kostenlos, mit einigen Artikeln und Social-Media-Beiträgen pro Monat. Grow bietet mehr Artikel und Social-Media-Beiträge sowie Backlinks, und Scale ergänzt höhere monatliche Volumen. Vergleichen Sie oben die Grenzen für Artikel, Beiträge und Recherche, um den passenden Tarif zu finden.",
          },
        ],
      },
      {
        title: "ABRECHNUNG & ABONNEMENTS",
        items: [
          {
            q: "Kann ich zwischen monatlicher und jährlicher Abrechnung wählen?",
            a: "Ja. Nutzen Sie den Schalter Monatlich / Jährlich oben, um die Preise zu vergleichen. Die jährliche Option zeigt einen entsprechenden Monatsbetrag; der Jahresbetrag wird je nach gewähltem Tarif im Voraus berechnet.",
          },
          {
            q: "Kann ich mein Abonnement kündigen?",
            a: "Sie können die Kündigung über Ihr Konto verwalten. Zugang und Abrechnung nach der Kündigung richten sich nach den bei der Anmeldung angezeigten Abonnementbedingungen.",
          },
          {
            q: "Gibt es eine Geld-zurück-Garantie?",
            a: "RepGet bietet eine 3-Tage-Geld-zurück-Garantie auf die erste Abonnementzahlung, gemäß der veröffentlichten Erstattungsrichtlinie.",
            link: "Erstattungsrichtlinie lesen.",
          },
          {
            q: "Kann ich upgraden, wenn mein Unternehmen wächst?",
            a: "Sie können einen Tarif mit mehr Inhalten, Social-Media-Beiträgen und Recherchekapazität wählen. Die für Ihr Konto geltenden Upgrade-Bedingungen finden Sie in der Abrechnungsübersicht oder beim Support.",
          },
        ],
      },
      {
        title: "INHALTE, SOCIAL MEDIA & AUTOMATISIERUNG",
        items: [
          {
            q: "Kann RepGet Artikel auf meiner Website veröffentlichen?",
            a: "RepGet unterstützt Veröffentlichungsabläufe für WordPress, Shopify, Ghost, Webflow und weitere unterstützte Plattformen. Verbinden Sie Ihre Website und richten Sie die passenden Veröffentlichungseinstellungen ein.",
          },
          {
            q: "Enthalten die Artikel Bilder und SEO-Metadaten?",
            a: "Jeder Artikel erhält einen Titel, eine Meta-Beschreibung und interne Links zu Seiten, die auf Ihrer Website existieren. Ein Titelbild wird hinzugefügt, wenn die Bilderstellung verfügbar ist; andernfalls wird der Artikel trotzdem geschrieben und veröffentlicht, ohne Bild. RepGet fügt Ihren Artikeln kein Schema-Markup (strukturierte Daten) hinzu.",
          },
          {
            q: "Kann ich Inhalte prüfen, bevor sie veröffentlicht werden?",
            a: "Teilweise. Der erste Artikel einer Website wird veröffentlicht, sobald er geschrieben ist, unabhängig vom Veröffentlichungsmodus, damit Sie einen echten Beitrag auf Ihrer Website sehen. Danach veröffentlichen neue Websites jeden Artikel an seinem geplanten Tag. In den Veröffentlichungseinstellungen der Website können Sie Artikel stattdessen als Entwurf an Ihr CMS senden oder in RepGet behalten, bis Sie sie freigeben.",
          },
          {
            q: "Wofür kann ich meine Test-Credits verwenden?",
            a: "In den ersten drei Tagen stehen die 15 täglichen Test-Credits für berechtigte Funktionen zur Verbreitung in sozialen Netzwerken und zur Erstellung von Inhalten zur Verfügung. Nutzung und Berechtigung werden in Ihrem Arbeitsbereich angezeigt.",
          },
          {
            q: "Was ist AI Growth Copilot?",
            a: "Growth Copilot ist Ihr KI-Assistent in RepGet. Fragen Sie ihn nach dem Traffic Ihrer Website, Ihren Artikeln, dem Zustand der Website, der Sichtbarkeit in der KI-Suche, Backlinks und Social-Media-Aktivität. Er nutzt die verfügbaren Daten Ihres verbundenen Arbeitsbereichs, um zu erklären, was passiert, und kann unterstützte Aktionen vorschlagen oder ausführen, sobald Sie sie bestätigen.",
          },
          {
            q: "Wie funktionieren AI Social Opportunities?",
            a: "RepGet hilft Ihnen, relevante Diskussionen auf unterstützten Social-Media-Kanälen zu finden, entwirft passende Antworten und hält Gespräche in einem Arbeitsbereich geordnet. Sie prüfen und genehmigen, was veröffentlicht wird. Das Verbinden von Kanälen sowie Veröffentlichungen und Antworten können Credits erfordern.",
          },
          {
            q: "Sind die Nachrichten an Growth Copilot unbegrenzt?",
            a: "Der Arbeitsbereich bietet derzeit fünf kostenlose Growth-Copilot-Nachrichten pro Tag, danach kostet jede weitere Nachricht einen Credit. Die aktuellen Kontingente und Credit-Anforderungen sehen Sie in Ihrem Konto.",
          },
        ],
      },
      {
        title: "SEO, KI-SICHTBARKEIT & BACKLINKS",
        items: [
          {
            q: "Wie recherchiert RepGet Keywords in meiner Branche?",
            a: "RepGet recherchiert und gruppiert Suchbegriffe, damit Sie Inhalte zu relevanten Themen planen können. Der Rechercheumfang hängt von Ihrem Tarif ab: Free umfasst 10 Begriffe, Grow 300 und Scale 1.200.",
          },
          {
            q: "Welche KI-Assistenten prüft RepGet?",
            a: "RepGet prüft {assistants}. Jede Woche stellt RepGet jedem geprüften Assistenten über dessen API mit eingeschalteter Websuche die Fragen, die Sie verfolgen (20 bei Grow, 50 bei Scale; Free macht eine Momentaufnahme mit 5 Fragen pro Monat), mehrmals, in Ihrer Sprache, und erfasst, in wie vielen Antworten und an welcher Stelle Ihr Unternehmen genannt wird. {notChecked} werden nicht geprüft. Sehen Sie es als Sicht der hier genannten Assistenten, nicht als Messung der gesamten KI-Suche.",
          },
          {
            q: "Wie funktionieren Backlink-Credits?",
            a: "Kostenpflichtige Tarife bieten Zugang zum Backlink-Partnernetzwerk von RepGet. Der Credit-Bedarf hängt von der jeweiligen Möglichkeit ab, und zusätzliche Credits können gekauft werden. Ein Eintrag oder ein Credit-Guthaben garantiert keine bestimmte Platzierung.",
          },
          {
            q: "Garantiert RepGet Top-Platzierungen bei Google?",
            a: "Keine Plattform kann eine bestimmte Suchposition oder KI-Erwähnung garantieren. RepGet bietet Werkzeuge für Recherche, Inhalte und Optimierung, die stetige Verbesserungen im Laufe der Zeit unterstützen.",
          },
        ],
      },
      {
        title: "SICHTBARKEITSVORTEILE & WERBUNG",
        items: [
          {
            q: "Enthalten Grow und Scale Werbefunktionen?",
            a: "Scale ja: Der Tarif umfasst bevorzugte Versionen eines Beitrags im RepGet-Blog, der Präsenz auf den Social-Media-Kanälen und eines E-Mail-Spotlights. Grow enthält diese Vorteile nicht. Wenn Sie sie zusammen mit dem Grow-Tarif möchten, wählen Sie Grow + Visibility.",
          },
          {
            q: "Was bedeutet bevorzugte Werbung bei Scale?",
            a: "Scale gibt Ihren Werbeplatzierungen Vorrang vor Standardplatzierungen, je nach Verfügbarkeit. Priorität ist keine Garantie für Suchplatzierungen, Traffic oder Conversions.",
          },
          {
            q: "Was ist in Grow + Visibility enthalten?",
            a: "Grow + Visibility verbindet das Standard-Abonnement Grow mit den oben gezeigten Werbevorteilen: einem Beitrag im RepGet-Blog, Werbung auf den Social-Media-Kanälen und einem E-Mail-Spotlight. Grow allein enthält diese Werbefunktionen nicht; Scale enthält bevorzugte Versionen davon.",
          },
          {
            q: "Enthält Grow + Visibility die 3-tägige kostenlose Testphase?",
            a: "Nein. Grow + Visibility ist ein Abonnement im Direktkauf. Ihre erste Zahlung von {price} wird beim Bezahlen eingezogen, und die monatliche Abrechnung beginnt mit Ihrem Abschluss. Die 3-tägige kostenlose Testphase ist in diesem Aktionspaket nicht enthalten.",
          },
          {
            q: "Wo könnte mein Unternehmen präsentiert werden?",
            a: "Das Angebot umfasst die Social-Media-Kanäle von RepGet, einen redaktionellen Beitrag im RepGet-Blog und Sichtbarkeit in E-Mails an unsere Abonnenten.",
          },
          {
            q: "Sind die Werbevorteile jeden Monat unbegrenzt?",
            a: "Nein. Die Werbefunktionen sind Extras zum monatlichen Abonnement der Plattform, keine unbegrenzten Beiträge oder E-Mails und keine garantierten Platzierungen.",
          },
        ],
      },
    ],
  },
  trial: {
    eyebrow: "Testen Sie vor Ihrer ersten Zahlung",
    titleLines: ["Beweise statt", "Versprechen."],
    body: "Drei Tage lang erhalten Sie den vollen, normalen Service Ihres Tarifs: alle Funktionen in seinem täglichen Tempo, dazu 15 Credits pro Tag für Funktionen zur Verbreitung in sozialen Netzwerken und zur Erstellung von Inhalten. Heute wird nichts berechnet, und Ihr Tarif beginnt nach der Testphase, sofern Sie nicht vor deren Ende kündigen.",
    points: ["3 Tage kostenlos", "Alle Tarif-Funktionen", "Heute keine Kosten"],
    cta: "Mit RepGet starten",
    card1Kicker: "IHR CONTENT-ARBEITSBEREICH",
    card1Title: "Wie Kunden Ihr Unternehmen online entdecken",
    card1Status: "✓ Artikel bereit zur Prüfung",
    card2Kicker: "VERNETZTES WACHSTUM",
    card2Title: "Ein klarer Blick auf Ihren Output",
    card2Stats: [
      { strong: "SEO", small: "Inhalte" },
      { strong: "KI", small: "Sichtbarkeit" },
      { strong: "↗", small: "Backlinks" },
    ],
    note: "Ihre kostenlose Testphase dauert drei Tage. Die Abrechnung des kostenpflichtigen Abonnements folgt den bei der Anmeldung angezeigten Bedingungen. RepGet bietet außerdem eine 3-Tage-Geld-zurück-Garantie auf Ihre erste Abonnementzahlung; siehe unsere",
    noteLink: "Erstattungsrichtlinie",
    noteEnd: ".",
  },
};

const COPY: Record<Locale, PricingPageCopy> = { en, es, fr, it, de };

export function pricingPageCopy(locale: Locale): PricingPageCopy {
  return COPY[locale];
}
