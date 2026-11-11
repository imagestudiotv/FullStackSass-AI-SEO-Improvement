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
  perks?: PerkItem[];
};

export type PricingFaqItem = { q: string; a: string; link?: string };

export type PricingPageCopy = {
  hero: { titleLead: string; titleAccent: string; body: string; pills: [string, string, string] };
  bundle: {
    flag: string;
    sale: string;
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
    priorityProcessing: string;
    custom: string;
    statusIncluded: string;
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
    sale: "SAVE {pct}% ON THE FULL BUNDLE",
    lede: "The full Grow plan. Plus a bigger stage for your brand.",
    priceLabel: "Grow plus Visibility bundle price {regular} per month, promotional price {price} per month",
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
      { strong: "branded articles / mo", small: "2 daily, with images" },
      { strong: "social posts / mo", small: "For your channels" },
      { strong: "search terms", small: "Researched & clustered" },
    ],
    coreFeatures: [
      "One connected website",
      "Auto-publish to major CMSs",
      "ChatGPT, Claude, Gemini & Perplexity tracking",
      "Site audits, metadata & schema",
      "Backlink partner network access",
      "SEO-focused content & keyword targeting",
      "**AI Growth Copilot** & data-informed guidance",
      "**AI Social Opportunities** & suggested replies",
    ],
    bonusEyebrow: "02 / FEATURED VISIBILITY BENEFITS",
    bonusPill: "INCLUDED WITH THIS BUNDLE",
    bonusIntro: "Added promotion beyond your own channels",
    bonuses: [
      { strong: "40K+ social followers", small: "Get featured across RepGet's social channels" },
      { strong: "DR 60 blog feature", small: "Introduce your business to readers of our blog" },
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
        "**{articles} SEO articles** with images",
        "**{posts} social posts** to keep showing up",
        "**{terms} search terms** researched",
        "**1 website** connected",
        "AI search visibility monitoring",
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
      includedLabel: "Everything in Launch, with more volume",
      features: [
        "**{articles} SEO articles** with images",
        "**{posts} social posts** across platforms",
        "**{terms} search terms** researched",
        "**1 website** connected",
        "AI search visibility monitoring",
        "SEO audit, on-page optimization and backlinks",
        "CMS auto-publishing",
        "**AI Growth Copilot** with insights from your website data",
        "**AI Social Opportunities** to discover conversations and draft replies",
      ],
      perks: [
        { strong: "DR 60+ RepGet blog feature", small: "Introduce your business to blog readers" },
        { strong: "Featured on RepGet social channels", small: "Reach RepGet's established social audience" },
        { strong: "Email spotlight", small: "Promotion to RepGet's subscriber audience" },
      ],
    },
    scale: {
      tag: "Maximum momentum",
      desc: "For ambitious teams producing more across every channel.",
      cta: "Start with Scale",
      includedLabel: "Everything in Grow, plus more capacity",
      features: [
        "**{articles} SEO articles** with images",
        "**{posts} social posts** across platforms",
        "**{terms} search terms** researched",
        "**1 website** connected",
        "AI search visibility monitoring",
        "SEO audit, on-page optimization and backlinks",
        "**Priority processing** and custom feature requests",
        "**AI Growth Copilot** with insights from your website data",
        "**AI Social Opportunities** to discover conversations and draft replies",
      ],
      perks: [
        { strong: "Priority DR 60+ RepGet blog feature", small: "Featured editorial exposure" },
        { strong: "Priority RepGet social channel feature", small: "Promotion across RepGet's social audience" },
        { strong: "Priority email spotlight", small: "Promotion to RepGet's subscriber audience" },
      ],
    },
  },
  compare: {
    eyebrow: "Side by side",
    title: "Compare your options.",
    body: "All three plans include the same core growth platform. Choose the output and processing level that fits your business.",
    included: "Included",
    articles: "Branded SEO articles / month",
    posts: "Social posts / month",
    terms: "Search terms researched",
    websites: "Websites per subscription",
    copilot: { strong: "AI Growth Copilot", small: "Website insights, recommendations & approved actions" },
    social: { strong: "AI Social Opportunities", small: "Find discussions, draft replies & publish with approval" },
    cms: "CMS auto-publishing",
    audits: "SEO audits, metadata & schema",
    visibility: "AI search visibility tracking",
    backlinks: "Backlink partner network",
    blog: { strong: "DR 60+ RepGet blog feature", small: "Featured placement on RepGet's blog" },
    channels: { strong: "RepGet social channel feature", small: "Promotion through RepGet social channels" },
    email: { strong: "Email spotlight", small: "Promotion to RepGet's subscribers" },
    priorityProcessing: "Priority processing",
    custom: "Custom feature requests",
    statusIncluded: "Included",
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
            q: "What happens after the free trial?",
            a: "After your free trial, you can continue with the paid subscription selected during signup. The exact start date, charges and renewal terms are shown in your checkout. Paid plans enable AI visibility tracking and access to the backlink partner network.",
          },
          {
            q: "What is included in the free trial?",
            a: "Your free trial includes 3 free researched articles, a website check and 15 credits per day during the first three days for social distribution and content creation features. AI visibility tracking and backlink network features become available with a paid plan.",
          },
          {
            q: "Do I need SEO experience to get started?",
            a: "No. RepGet brings keyword research, content creation, technical SEO checks and publishing into one workspace. You can start with your website and review suggested improvements as you go.",
          },
          {
            q: "Which plan should I choose?",
            a: "Launch is suited to a smaller monthly content workload, Grow offers more articles and social posts, and Scale adds higher monthly volumes and priority processing. Compare the article, social and research limits above to find the right fit.",
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
            a: "The Grow plan includes branded SEO articles with images, together with title, metadata and schema assistance. Available outputs and publishing options depend on the feature and plan.",
          },
          {
            q: "Can I review content before it goes live?",
            a: "You can work with generated content in the RepGet workspace and configure publishing workflows. Review your content and connected-site settings before enabling automatic publishing.",
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
            a: "RepGet researches and clusters search terms so you can plan content around relevant topics. Research allowances depend on your plan: Launch includes 300 terms, Grow includes 500, and Scale includes 1,500.",
          },
          {
            q: "Which AI search platforms can I track?",
            a: "Paid plans include visibility monitoring for AI-powered search experiences such as ChatGPT, Claude, Gemini and Perplexity.",
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
            a: "Yes. Grow includes a DR 60+ RepGet blog feature, social-channel exposure and an email spotlight. Scale includes priority versions of these benefits. The timing and scope of each placement are defined by RepGet's published promotion terms.",
          },
          {
            q: "What does priority promotion mean in Scale?",
            a: "Scale gives promotional placements priority over standard Grow placements, subject to availability and agreed campaign terms. Priority is not a guarantee of search rankings, traffic or conversions.",
          },
          {
            q: "What is included in Grow + Visibility?",
            a: "Grow + Visibility combines the standard Grow subscription with the featured promotion benefits shown above: a RepGet blog feature, social channel promotion and an email spotlight. Grow and Scale also offer these promotional features, with priority placements on Scale.",
          },
          {
            q: "Does Grow + Visibility include the 3-day free trial?",
            a: "No. Grow + Visibility is a direct-purchase subscription. Your first {price} payment is collected at checkout, and monthly billing begins when you subscribe. The 3-day free trial is not included with this promotional bundle.",
          },
          {
            q: "Where could my business be featured?",
            a: "The offer highlights RepGet social channels with a combined audience of 40K+ followers, an editorial feature on the RepGet blog and exposure through subscriber email communications.",
          },
          {
            q: "Are the promotional bonuses unlimited every month?",
            a: "No. The promotional features are extras on top of the monthly Grow platform subscription, not unlimited posts, emails or guaranteed ranking results. Their delivery schedule and scope should be defined in the offer terms.",
          },
        ],
      },
    ],
  },
  trial: {
    eyebrow: "Try it before your first payment",
    titleLines: ["Start with proof.", "Not promises."],
    body: "Your free trial includes 3 free researched articles, a website check and 15 credits per day during the first three days for social distribution and content creation features. AI visibility and backlink network features activate with following paid plan.",
    points: ["3 free articles", "Website check", "No charge today"],
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
    sale: "AHORRE UN {pct} % EN EL PAQUETE COMPLETO",
    lede: "El plan Grow completo. Y un escenario más grande para su marca.",
    priceLabel: "Precio del paquete Grow más Visibility {regular} al mes, precio promocional {price} al mes",
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
      { strong: "artículos de marca / mes", small: "2 al día, con imágenes" },
      { strong: "publicaciones sociales / mes", small: "Para sus canales" },
      { strong: "términos de búsqueda", small: "Investigados y agrupados" },
    ],
    coreFeatures: [
      "Un sitio web conectado",
      "Publicación automática en los principales CMS",
      "Seguimiento en ChatGPT, Claude, Gemini y Perplexity",
      "Auditorías del sitio, metadatos y schema",
      "Acceso a la red de socios de backlinks",
      "Contenido orientado al SEO y a palabras clave",
      "**AI Growth Copilot** y recomendaciones basadas en datos",
      "**AI Social Opportunities** y respuestas sugeridas",
    ],
    bonusEyebrow: "02 / VENTAJAS DE VISIBILIDAD DESTACADA",
    bonusPill: "INCLUIDO EN ESTE PAQUETE",
    bonusIntro: "Promoción adicional más allá de sus propios canales",
    bonuses: [
      { strong: "Más de 40K seguidores en redes", small: "Aparezca en los canales sociales de RepGet" },
      { strong: "Artículo en un blog DR 60", small: "Presente su negocio a los lectores de nuestro blog" },
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
        "**{articles} artículos SEO** con imágenes",
        "**{posts} publicaciones sociales** para seguir presente",
        "**{terms} términos de búsqueda** investigados",
        "**1 sitio web** conectado",
        "Seguimiento de la visibilidad en búsquedas con IA",
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
      includedLabel: "Todo lo de Launch, con más volumen",
      features: [
        "**{articles} artículos SEO** con imágenes",
        "**{posts} publicaciones sociales** en varias plataformas",
        "**{terms} términos de búsqueda** investigados",
        "**1 sitio web** conectado",
        "Seguimiento de la visibilidad en búsquedas con IA",
        "Auditoría SEO, optimización on-page y backlinks",
        "Publicación automática en su CMS",
        "**AI Growth Copilot** con información a partir de los datos de su sitio",
        "**AI Social Opportunities** para descubrir conversaciones y redactar respuestas",
      ],
      perks: [
        { strong: "Artículo en el blog de RepGet (DR 60+)", small: "Presente su negocio a los lectores del blog" },
        { strong: "Presencia en las redes sociales de RepGet", small: "Llegue a la audiencia social consolidada de RepGet" },
        { strong: "Mención en nuestro correo", small: "Promoción ante los suscriptores de RepGet" },
      ],
    },
    scale: {
      tag: "Máximo impulso",
      desc: "Para equipos ambiciosos que producen más en todos los canales.",
      cta: "Empezar con Scale",
      includedLabel: "Todo lo de Grow, con más capacidad",
      features: [
        "**{articles} artículos SEO** con imágenes",
        "**{posts} publicaciones sociales** en varias plataformas",
        "**{terms} términos de búsqueda** investigados",
        "**1 sitio web** conectado",
        "Seguimiento de la visibilidad en búsquedas con IA",
        "Auditoría SEO, optimización on-page y backlinks",
        "**Procesamiento prioritario** y solicitudes de funciones a medida",
        "**AI Growth Copilot** con información a partir de los datos de su sitio",
        "**AI Social Opportunities** para descubrir conversaciones y redactar respuestas",
      ],
      perks: [
        { strong: "Artículo prioritario en el blog de RepGet (DR 60+)", small: "Visibilidad editorial destacada" },
        { strong: "Presencia prioritaria en las redes de RepGet", small: "Promoción ante la audiencia social de RepGet" },
        { strong: "Mención prioritaria en nuestro correo", small: "Promoción ante los suscriptores de RepGet" },
      ],
    },
  },
  compare: {
    eyebrow: "Cara a cara",
    title: "Compare sus opciones.",
    body: "Los tres planes incluyen la misma plataforma de crecimiento. Elija el volumen y el nivel de procesamiento que mejor se adapten a su negocio.",
    included: "Incluido",
    articles: "Artículos SEO de marca / mes",
    posts: "Publicaciones sociales / mes",
    terms: "Términos de búsqueda investigados",
    websites: "Sitios web por suscripción",
    copilot: { strong: "AI Growth Copilot", small: "Información del sitio, recomendaciones y acciones aprobadas" },
    social: { strong: "AI Social Opportunities", small: "Encuentre conversaciones, redacte respuestas y publique con aprobación" },
    cms: "Publicación automática en su CMS",
    audits: "Auditorías SEO, metadatos y schema",
    visibility: "Seguimiento de la visibilidad en búsquedas con IA",
    backlinks: "Red de socios de backlinks",
    blog: { strong: "Artículo en el blog de RepGet (DR 60+)", small: "Espacio destacado en el blog de RepGet" },
    channels: { strong: "Presencia en las redes sociales de RepGet", small: "Promoción en los canales sociales de RepGet" },
    email: { strong: "Mención en nuestro correo", small: "Promoción ante los suscriptores de RepGet" },
    priorityProcessing: "Procesamiento prioritario",
    custom: "Solicitudes de funciones a medida",
    statusIncluded: "Incluido",
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
            q: "¿Qué ocurre después de la prueba gratuita?",
            a: "Después de su prueba gratuita, puede continuar con la suscripción de pago elegida al registrarse. La fecha de inicio exacta, los cargos y las condiciones de renovación se muestran al pagar. Los planes de pago activan el seguimiento de la visibilidad en IA y el acceso a la red de socios de backlinks.",
          },
          {
            q: "¿Qué incluye la prueba gratuita?",
            a: "Su prueba gratuita incluye 3 artículos investigados gratis, una revisión de su sitio web y 15 créditos al día durante los tres primeros días para las funciones de distribución en redes y creación de contenido. El seguimiento de la visibilidad en IA y la red de backlinks están disponibles con un plan de pago.",
          },
          {
            q: "¿Necesito experiencia en SEO para empezar?",
            a: "No. RepGet reúne la investigación de palabras clave, la creación de contenido, las revisiones técnicas de SEO y la publicación en un solo espacio de trabajo. Puede empezar con su sitio web y revisar las mejoras sugeridas sobre la marcha.",
          },
          {
            q: "¿Qué plan debería elegir?",
            a: "Launch se adapta a un volumen mensual de contenido más reducido, Grow ofrece más artículos y publicaciones sociales, y Scale añade volúmenes mensuales mayores y procesamiento prioritario. Compare arriba los límites de artículos, publicaciones e investigación para encontrar el más adecuado.",
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
            a: "El plan Grow incluye artículos SEO de marca con imágenes, junto con ayuda para títulos, metadatos y schema. Los resultados y las opciones de publicación disponibles dependen de la función y del plan.",
          },
          {
            q: "¿Puedo revisar el contenido antes de que se publique?",
            a: "Puede trabajar con el contenido generado en el espacio de trabajo de RepGet y configurar los flujos de publicación. Revise su contenido y los ajustes del sitio conectado antes de activar la publicación automática.",
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
            a: "RepGet investiga y agrupa términos de búsqueda para que pueda planificar contenido sobre temas relevantes. La investigación depende de su plan: Launch incluye 300 términos, Grow incluye 500 y Scale incluye 1.500.",
          },
          {
            q: "¿Qué plataformas de búsqueda con IA puedo seguir?",
            a: "Los planes de pago incluyen el seguimiento de la visibilidad en experiencias de búsqueda con IA como ChatGPT, Claude, Gemini y Perplexity.",
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
            a: "Sí. Grow incluye un artículo en el blog de RepGet (DR 60+), presencia en las redes sociales y una mención en nuestro correo. Scale incluye versiones prioritarias de estas ventajas. El calendario y el alcance de cada colocación se definen en las condiciones de promoción publicadas por RepGet.",
          },
          {
            q: "¿Qué significa la promoción prioritaria en Scale?",
            a: "Scale da prioridad a sus colocaciones promocionales frente a las colocaciones estándar de Grow, según disponibilidad y las condiciones de campaña acordadas. La prioridad no garantiza posiciones en buscadores, tráfico ni conversiones.",
          },
          {
            q: "¿Qué incluye Grow + Visibility?",
            a: "Grow + Visibility combina la suscripción estándar a Grow con las ventajas de promoción destacada mostradas arriba: un artículo en el blog de RepGet, promoción en redes sociales y una mención en nuestro correo. Grow y Scale también ofrecen estas funciones promocionales, con colocaciones prioritarias en Scale.",
          },
          {
            q: "¿Grow + Visibility incluye la prueba gratuita de 3 días?",
            a: "No. Grow + Visibility es una suscripción de compra directa. Su primer pago de {price} se cobra al pagar y la facturación mensual empieza cuando se suscribe. La prueba gratuita de 3 días no está incluida en este paquete promocional.",
          },
          {
            q: "¿Dónde podría aparecer mi negocio?",
            a: "La oferta destaca los canales sociales de RepGet, con una audiencia conjunta de más de 40K seguidores, un artículo editorial en el blog de RepGet y visibilidad en los correos a nuestros suscriptores.",
          },
          {
            q: "¿Las ventajas promocionales son ilimitadas cada mes?",
            a: "No. Las funciones promocionales son extras de la suscripción mensual a la plataforma Grow, no publicaciones ni correos ilimitados, ni resultados de posicionamiento garantizados. Su calendario de entrega y su alcance deben definirse en las condiciones de la oferta.",
          },
        ],
      },
    ],
  },
  trial: {
    eyebrow: "Pruébelo antes de su primer pago",
    titleLines: ["Empiece con pruebas.", "No con promesas."],
    body: "Su prueba gratuita incluye 3 artículos investigados gratis, una revisión de su sitio web y 15 créditos al día durante los tres primeros días para las funciones de distribución en redes y creación de contenido. La visibilidad en IA y la red de backlinks se activan con el plan de pago posterior.",
    points: ["3 artículos gratis", "Revisión del sitio web", "Sin cargo hoy"],
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
    sale: "ÉCONOMISEZ {pct} % SUR L'OFFRE COMPLÈTE",
    lede: "La formule Grow complète. Et une plus grande scène pour votre marque.",
    priceLabel: "Prix de l'offre Grow plus Visibility {regular} par mois, prix promotionnel {price} par mois",
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
      { strong: "articles de marque / mois", small: "2 par jour, avec images" },
      { strong: "publications sociales / mois", small: "Pour vos canaux" },
      { strong: "termes de recherche", small: "Étudiés et regroupés" },
    ],
    coreFeatures: [
      "Un site web connecté",
      "Publication automatique sur les principaux CMS",
      "Suivi sur ChatGPT, Claude, Gemini et Perplexity",
      "Audits du site, métadonnées et schema",
      "Accès au réseau de partenaires de backlinks",
      "Contenu axé SEO et ciblage de mots-clés",
      "**AI Growth Copilot** et conseils fondés sur vos données",
      "**AI Social Opportunities** et réponses suggérées",
    ],
    bonusEyebrow: "02 / AVANTAGES DE VISIBILITÉ MISE EN AVANT",
    bonusPill: "INCLUS DANS CETTE OFFRE",
    bonusIntro: "Une promotion supplémentaire au-delà de vos propres canaux",
    bonuses: [
      { strong: "Plus de 40K abonnés sur les réseaux", small: "Soyez mis en avant sur les réseaux sociaux de RepGet" },
      { strong: "Article sur un blog DR 60", small: "Présentez votre entreprise aux lecteurs de notre blog" },
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
        "**{articles} articles SEO** avec images",
        "**{posts} publications sociales** pour rester présent",
        "**{terms} termes de recherche** étudiés",
        "**1 site web** connecté",
        "Suivi de la visibilité dans la recherche par IA",
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
      includedLabel: "Tout Launch, avec plus de volume",
      features: [
        "**{articles} articles SEO** avec images",
        "**{posts} publications sociales** sur plusieurs plateformes",
        "**{terms} termes de recherche** étudiés",
        "**1 site web** connecté",
        "Suivi de la visibilité dans la recherche par IA",
        "Audit SEO, optimisation on-page et backlinks",
        "Publication automatique sur votre CMS",
        "**AI Growth Copilot** avec des analyses tirées des données de votre site",
        "**AI Social Opportunities** pour trouver des conversations et rédiger des réponses",
      ],
      perks: [
        { strong: "Article sur le blog RepGet (DR 60+)", small: "Présentez votre entreprise aux lecteurs du blog" },
        { strong: "Mise en avant sur les réseaux de RepGet", small: "Touchez l'audience sociale établie de RepGet" },
        { strong: "Mise en avant par e-mail", small: "Promotion auprès des abonnés de RepGet" },
      ],
    },
    scale: {
      tag: "Élan maximal",
      desc: "Pour les équipes ambitieuses qui produisent davantage sur chaque canal.",
      cta: "Commencer avec Scale",
      includedLabel: "Tout Grow, avec plus de capacité",
      features: [
        "**{articles} articles SEO** avec images",
        "**{posts} publications sociales** sur plusieurs plateformes",
        "**{terms} termes de recherche** étudiés",
        "**1 site web** connecté",
        "Suivi de la visibilité dans la recherche par IA",
        "Audit SEO, optimisation on-page et backlinks",
        "**Traitement prioritaire** et demandes de fonctionnalités sur mesure",
        "**AI Growth Copilot** avec des analyses tirées des données de votre site",
        "**AI Social Opportunities** pour trouver des conversations et rédiger des réponses",
      ],
      perks: [
        { strong: "Article prioritaire sur le blog RepGet (DR 60+)", small: "Une visibilité éditoriale mise en avant" },
        { strong: "Mise en avant prioritaire sur les réseaux de RepGet", small: "Promotion auprès de l'audience sociale de RepGet" },
        { strong: "Mise en avant prioritaire par e-mail", small: "Promotion auprès des abonnés de RepGet" },
      ],
    },
  },
  compare: {
    eyebrow: "Côte à côte",
    title: "Comparez vos options.",
    body: "Les trois formules incluent la même plateforme de croissance. Choisissez le volume et le niveau de traitement adaptés à votre entreprise.",
    included: "Inclus",
    articles: "Articles SEO de marque / mois",
    posts: "Publications sociales / mois",
    terms: "Termes de recherche étudiés",
    websites: "Sites web par abonnement",
    copilot: { strong: "AI Growth Copilot", small: "Analyses du site, recommandations et actions approuvées" },
    social: { strong: "AI Social Opportunities", small: "Trouvez des discussions, rédigez des réponses et publiez après validation" },
    cms: "Publication automatique sur votre CMS",
    audits: "Audits SEO, métadonnées et schema",
    visibility: "Suivi de la visibilité dans la recherche par IA",
    backlinks: "Réseau de partenaires de backlinks",
    blog: { strong: "Article sur le blog RepGet (DR 60+)", small: "Un emplacement mis en avant sur le blog de RepGet" },
    channels: { strong: "Mise en avant sur les réseaux de RepGet", small: "Promotion via les réseaux sociaux de RepGet" },
    email: { strong: "Mise en avant par e-mail", small: "Promotion auprès des abonnés de RepGet" },
    priorityProcessing: "Traitement prioritaire",
    custom: "Demandes de fonctionnalités sur mesure",
    statusIncluded: "Inclus",
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
            q: "Que se passe-t-il après l'essai gratuit ?",
            a: "Après votre essai gratuit, vous pouvez poursuivre avec l'abonnement payant choisi à l'inscription. La date de début exacte, les montants et les conditions de renouvellement sont indiqués lors du paiement. Les formules payantes activent le suivi de la visibilité dans l'IA et l'accès au réseau de partenaires de backlinks.",
          },
          {
            q: "Que comprend l'essai gratuit ?",
            a: "Votre essai gratuit comprend 3 articles documentés offerts, une vérification de votre site web et 15 crédits par jour pendant les trois premiers jours pour les fonctions de diffusion sur les réseaux et de création de contenu. Le suivi de la visibilité dans l'IA et le réseau de backlinks sont disponibles avec une formule payante.",
          },
          {
            q: "Faut-il une expérience du SEO pour commencer ?",
            a: "Non. RepGet réunit la recherche de mots-clés, la création de contenu, les vérifications SEO techniques et la publication dans un seul espace de travail. Vous pouvez commencer avec votre site web et examiner les améliorations suggérées au fur et à mesure.",
          },
          {
            q: "Quelle formule choisir ?",
            a: "Launch convient à un volume mensuel de contenu plus modeste, Grow offre davantage d'articles et de publications sociales, et Scale ajoute des volumes mensuels plus élevés et un traitement prioritaire. Comparez ci-dessus les limites d'articles, de publications et de recherche pour trouver la bonne formule.",
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
            a: "La formule Grow comprend des articles SEO de marque avec images, ainsi qu'une aide pour les titres, les métadonnées et le schema. Les contenus et options de publication disponibles dépendent de la fonction et de la formule.",
          },
          {
            q: "Puis-je relire le contenu avant sa mise en ligne ?",
            a: "Vous pouvez travailler sur le contenu généré dans l'espace de travail RepGet et configurer la publication. Relisez votre contenu et les paramètres du site connecté avant d'activer la publication automatique.",
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
            a: "RepGet étudie et regroupe les termes de recherche pour vous permettre de planifier du contenu autour de sujets pertinents. Le volume de recherche dépend de votre formule : Launch comprend 300 termes, Grow 500 et Scale 1 500.",
          },
          {
            q: "Quelles plateformes de recherche par IA puis-je suivre ?",
            a: "Les formules payantes comprennent le suivi de la visibilité dans les expériences de recherche par IA comme ChatGPT, Claude, Gemini et Perplexity.",
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
            a: "Oui. Grow comprend un article sur le blog RepGet (DR 60+), une présence sur les réseaux sociaux et une mise en avant par e-mail. Scale comprend des versions prioritaires de ces avantages. Le calendrier et la portée de chaque mise en avant sont définis par les conditions de promotion publiées par RepGet.",
          },
          {
            q: "Que signifie la promotion prioritaire dans Scale ?",
            a: "Scale donne à vos mises en avant la priorité sur celles de la formule Grow standard, selon les disponibilités et les conditions de campagne convenues. La priorité ne garantit ni positions dans les moteurs de recherche, ni trafic, ni conversions.",
          },
          {
            q: "Que comprend Grow + Visibility ?",
            a: "Grow + Visibility associe l'abonnement Grow standard aux avantages de promotion présentés ci-dessus : un article sur le blog RepGet, une promotion sur les réseaux sociaux et une mise en avant par e-mail. Grow et Scale proposent aussi ces fonctions promotionnelles, avec des mises en avant prioritaires pour Scale.",
          },
          {
            q: "Grow + Visibility comprend-elle l'essai gratuit de 3 jours ?",
            a: "Non. Grow + Visibility est un abonnement en achat direct. Votre premier paiement de {price} est encaissé lors du paiement, et la facturation mensuelle commence dès votre souscription. L'essai gratuit de 3 jours n'est pas inclus dans cette offre promotionnelle.",
          },
          {
            q: "Où mon entreprise pourrait-elle être mise en avant ?",
            a: "L'offre met en avant les réseaux sociaux de RepGet, avec une audience cumulée de plus de 40K abonnés, un article éditorial sur le blog RepGet et une visibilité dans les e-mails envoyés aux abonnés.",
          },
          {
            q: "Les avantages promotionnels sont-ils illimités chaque mois ?",
            a: "Non. Les fonctions promotionnelles sont des extras de l'abonnement mensuel à la plateforme Grow, et non des publications ou e-mails illimités ni des résultats de classement garantis. Leur calendrier et leur portée doivent être définis dans les conditions de l'offre.",
          },
        ],
      },
    ],
  },
  trial: {
    eyebrow: "Essayez avant votre premier paiement",
    titleLines: ["Des preuves.", "Pas des promesses."],
    body: "Votre essai gratuit comprend 3 articles documentés offerts, une vérification de votre site web et 15 crédits par jour pendant les trois premiers jours pour les fonctions de diffusion sur les réseaux et de création de contenu. La visibilité dans l'IA et le réseau de backlinks s'activent avec la formule payante qui suit.",
    points: ["3 articles offerts", "Vérification du site", "Aucun paiement aujourd'hui"],
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
    sale: "RISPARMI IL {pct}% SUL PACCHETTO COMPLETO",
    lede: "Il piano Grow completo. In più, un palcoscenico più grande per il suo marchio.",
    priceLabel: "Prezzo del pacchetto Grow più Visibility {regular} al mese, prezzo promozionale {price} al mese",
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
      { strong: "articoli brandizzati / mese", small: "2 al giorno, con immagini" },
      { strong: "post social / mese", small: "Per i suoi canali" },
      { strong: "termini di ricerca", small: "Analizzati e raggruppati" },
    ],
    coreFeatures: [
      "Un sito web collegato",
      "Pubblicazione automatica sui principali CMS",
      "Monitoraggio su ChatGPT, Claude, Gemini e Perplexity",
      "Audit del sito, metadati e schema",
      "Accesso alla rete di partner per i backlink",
      "Contenuti orientati alla SEO e alle parole chiave",
      "**AI Growth Copilot** e indicazioni basate sui dati",
      "**AI Social Opportunities** e risposte suggerite",
    ],
    bonusEyebrow: "02 / VANTAGGI DI VISIBILITÀ IN EVIDENZA",
    bonusPill: "INCLUSO IN QUESTO PACCHETTO",
    bonusIntro: "Promozione aggiuntiva oltre ai suoi canali",
    bonuses: [
      { strong: "Oltre 40K follower social", small: "Compaia sui canali social di RepGet" },
      { strong: "Articolo su un blog DR 60", small: "Presenti la sua attività ai lettori del nostro blog" },
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
        "**{articles} articoli SEO** con immagini",
        "**{posts} post social** per restare presente",
        "**{terms} termini di ricerca** analizzati",
        "**1 sito web** collegato",
        "Monitoraggio della visibilità nella ricerca con l'IA",
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
      includedLabel: "Tutto Launch, con più volume",
      features: [
        "**{articles} articoli SEO** con immagini",
        "**{posts} post social** su più piattaforme",
        "**{terms} termini di ricerca** analizzati",
        "**1 sito web** collegato",
        "Monitoraggio della visibilità nella ricerca con l'IA",
        "Audit SEO, ottimizzazione on-page e backlink",
        "Pubblicazione automatica sul CMS",
        "**AI Growth Copilot** con analisi basate sui dati del suo sito",
        "**AI Social Opportunities** per scoprire conversazioni e preparare risposte",
      ],
      perks: [
        { strong: "Articolo sul blog di RepGet (DR 60+)", small: "Presenti la sua attività ai lettori del blog" },
        { strong: "Presenza sui canali social di RepGet", small: "Raggiunga il pubblico social consolidato di RepGet" },
        { strong: "Spazio nella nostra email", small: "Promozione presso gli iscritti di RepGet" },
      ],
    },
    scale: {
      tag: "Massimo slancio",
      desc: "Per team ambiziosi che producono di più su ogni canale.",
      cta: "Inizia con Scale",
      includedLabel: "Tutto Grow, con più capacità",
      features: [
        "**{articles} articoli SEO** con immagini",
        "**{posts} post social** su più piattaforme",
        "**{terms} termini di ricerca** analizzati",
        "**1 sito web** collegato",
        "Monitoraggio della visibilità nella ricerca con l'IA",
        "Audit SEO, ottimizzazione on-page e backlink",
        "**Elaborazione prioritaria** e richieste di funzioni personalizzate",
        "**AI Growth Copilot** con analisi basate sui dati del suo sito",
        "**AI Social Opportunities** per scoprire conversazioni e preparare risposte",
      ],
      perks: [
        { strong: "Articolo prioritario sul blog di RepGet (DR 60+)", small: "Visibilità editoriale in evidenza" },
        { strong: "Presenza prioritaria sui canali social di RepGet", small: "Promozione presso il pubblico social di RepGet" },
        { strong: "Spazio prioritario nella nostra email", small: "Promozione presso gli iscritti di RepGet" },
      ],
    },
  },
  compare: {
    eyebrow: "Fianco a fianco",
    title: "Confronti le opzioni.",
    body: "Tutti e tre i piani includono la stessa piattaforma di crescita. Scelga il volume e il livello di elaborazione più adatti alla sua attività.",
    included: "Incluso",
    articles: "Articoli SEO brandizzati / mese",
    posts: "Post social / mese",
    terms: "Termini di ricerca analizzati",
    websites: "Siti web per abbonamento",
    copilot: { strong: "AI Growth Copilot", small: "Analisi del sito, consigli e azioni approvate" },
    social: { strong: "AI Social Opportunities", small: "Trovi discussioni, prepari risposte e pubblichi previa approvazione" },
    cms: "Pubblicazione automatica sul CMS",
    audits: "Audit SEO, metadati e schema",
    visibility: "Monitoraggio della visibilità nella ricerca con l'IA",
    backlinks: "Rete di partner per i backlink",
    blog: { strong: "Articolo sul blog di RepGet (DR 60+)", small: "Uno spazio in evidenza sul blog di RepGet" },
    channels: { strong: "Presenza sui canali social di RepGet", small: "Promozione attraverso i canali social di RepGet" },
    email: { strong: "Spazio nella nostra email", small: "Promozione presso gli iscritti di RepGet" },
    priorityProcessing: "Elaborazione prioritaria",
    custom: "Richieste di funzioni personalizzate",
    statusIncluded: "Incluso",
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
            q: "Che cosa succede dopo la prova gratuita?",
            a: "Dopo la prova gratuita può proseguire con l'abbonamento a pagamento scelto in fase di registrazione. La data di inizio esatta, gli addebiti e le condizioni di rinnovo sono indicati al pagamento. I piani a pagamento attivano il monitoraggio della visibilità nell'IA e l'accesso alla rete di partner per i backlink.",
          },
          {
            q: "Che cosa include la prova gratuita?",
            a: "La prova gratuita include 3 articoli con ricerca gratuiti, un controllo del suo sito web e 15 crediti al giorno nei primi tre giorni per le funzioni di distribuzione sui social e di creazione di contenuti. Il monitoraggio della visibilità nell'IA e la rete di backlink sono disponibili con un piano a pagamento.",
          },
          {
            q: "Serve esperienza di SEO per iniziare?",
            a: "No. RepGet riunisce ricerca delle parole chiave, creazione di contenuti, controlli SEO tecnici e pubblicazione in un unico spazio di lavoro. Può iniziare dal suo sito web e valutare i miglioramenti suggeriti strada facendo.",
          },
          {
            q: "Quale piano scegliere?",
            a: "Launch è adatto a un volume mensile di contenuti più contenuto, Grow offre più articoli e post social, e Scale aggiunge volumi mensili più alti ed elaborazione prioritaria. Confronti sopra i limiti di articoli, post e ricerca per trovare il piano giusto.",
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
            a: "Il piano Grow include articoli SEO brandizzati con immagini, insieme a un aiuto per titoli, metadati e schema. I contenuti e le opzioni di pubblicazione disponibili dipendono dalla funzione e dal piano.",
          },
          {
            q: "Posso rivedere i contenuti prima della pubblicazione?",
            a: "Può lavorare sui contenuti generati nello spazio di lavoro di RepGet e configurare la pubblicazione. Riveda i contenuti e le impostazioni del sito collegato prima di attivare la pubblicazione automatica.",
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
            a: "RepGet ricerca e raggruppa i termini di ricerca per aiutarla a pianificare contenuti su argomenti pertinenti. Il volume di ricerca dipende dal piano: Launch include 300 termini, Grow 500 e Scale 1.500.",
          },
          {
            q: "Quali piattaforme di ricerca con l'IA posso monitorare?",
            a: "I piani a pagamento includono il monitoraggio della visibilità nelle esperienze di ricerca basate sull'IA, come ChatGPT, Claude, Gemini e Perplexity.",
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
            a: "Sì. Grow include un articolo sul blog di RepGet (DR 60+), visibilità sui canali social e uno spazio nella nostra email. Scale include versioni prioritarie di questi vantaggi. Tempi e portata di ogni collocamento sono definiti dalle condizioni di promozione pubblicate da RepGet.",
          },
          {
            q: "Che cosa significa promozione prioritaria in Scale?",
            a: "Scale dà ai suoi collocamenti promozionali la priorità rispetto a quelli standard di Grow, secondo disponibilità e condizioni di campagna concordate. La priorità non garantisce posizioni nei risultati di ricerca, traffico o conversioni.",
          },
          {
            q: "Che cosa include Grow + Visibility?",
            a: "Grow + Visibility unisce l'abbonamento Grow standard ai vantaggi di promozione in evidenza illustrati sopra: un articolo sul blog di RepGet, promozione sui canali social e uno spazio nella nostra email. Anche Grow e Scale offrono queste funzioni promozionali, con collocamenti prioritari per Scale.",
          },
          {
            q: "Grow + Visibility include la prova gratuita di 3 giorni?",
            a: "No. Grow + Visibility è un abbonamento ad acquisto diretto. Il primo pagamento di {price} viene addebitato al momento del pagamento e la fatturazione mensile inizia con la sottoscrizione. La prova gratuita di 3 giorni non è inclusa in questo pacchetto promozionale.",
          },
          {
            q: "Dove potrebbe comparire la mia attività?",
            a: "L'offerta mette in evidenza i canali social di RepGet, con un pubblico complessivo di oltre 40K follower, un articolo editoriale sul blog di RepGet e visibilità nelle email inviate agli iscritti.",
          },
          {
            q: "I vantaggi promozionali sono illimitati ogni mese?",
            a: "No. Le funzioni promozionali sono extra in aggiunta all'abbonamento mensile alla piattaforma Grow, non post o email illimitati né risultati di posizionamento garantiti. Tempi di consegna e portata devono essere definiti nelle condizioni dell'offerta.",
          },
        ],
      },
    ],
  },
  trial: {
    eyebrow: "Provi prima del primo pagamento",
    titleLines: ["Inizi con i fatti.", "Non con le promesse."],
    body: "La prova gratuita include 3 articoli con ricerca gratuiti, un controllo del suo sito web e 15 crediti al giorno nei primi tre giorni per le funzioni di distribuzione sui social e di creazione di contenuti. La visibilità nell'IA e la rete di backlink si attivano con il successivo piano a pagamento.",
    points: ["3 articoli gratuiti", "Controllo del sito", "Nessun addebito oggi"],
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
    sale: "SPAREN SIE {pct} % AUF DAS GESAMTPAKET",
    lede: "Der komplette Grow-Tarif. Dazu eine größere Bühne für Ihre Marke.",
    priceLabel: "Preis des Pakets Grow plus Visibility {regular} pro Monat, Aktionspreis {price} pro Monat",
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
      { strong: "Markenartikel / Monat", small: "2 täglich, mit Bildern" },
      { strong: "Social-Media-Beiträge / Monat", small: "Für Ihre Kanäle" },
      { strong: "Suchbegriffe", small: "Recherchiert & gruppiert" },
    ],
    coreFeatures: [
      "Eine verbundene Website",
      "Automatisches Veröffentlichen in gängigen CMS",
      "Tracking in ChatGPT, Claude, Gemini & Perplexity",
      "Website-Audits, Metadaten & Schema",
      "Zugang zum Backlink-Partnernetzwerk",
      "SEO-orientierte Inhalte & Keyword-Targeting",
      "**AI Growth Copilot** & datenbasierte Empfehlungen",
      "**AI Social Opportunities** & Antwortvorschläge",
    ],
    bonusEyebrow: "02 / VORTEILE FÜR MEHR SICHTBARKEIT",
    bonusPill: "IN DIESEM PAKET ENTHALTEN",
    bonusIntro: "Zusätzliche Werbung über Ihre eigenen Kanäle hinaus",
    bonuses: [
      { strong: "Über 40K Social-Media-Follower", small: "Präsentiert auf den Social-Media-Kanälen von RepGet" },
      { strong: "Beitrag in einem DR-60-Blog", small: "Stellen Sie Ihr Unternehmen den Lesern unseres Blogs vor" },
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
        "**{articles} SEO-Artikel** mit Bildern",
        "**{posts} Social-Media-Beiträge**, um präsent zu bleiben",
        "**{terms} Suchbegriffe** recherchiert",
        "**1 Website** verbunden",
        "Überwachung der Sichtbarkeit in der KI-Suche",
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
      includedLabel: "Alles aus Launch, mit mehr Volumen",
      features: [
        "**{articles} SEO-Artikel** mit Bildern",
        "**{posts} Social-Media-Beiträge** auf mehreren Plattformen",
        "**{terms} Suchbegriffe** recherchiert",
        "**1 Website** verbunden",
        "Überwachung der Sichtbarkeit in der KI-Suche",
        "SEO-Audit, On-Page-Optimierung und Backlinks",
        "Automatisches Veröffentlichen im CMS",
        "**AI Growth Copilot** mit Erkenntnissen aus Ihren Website-Daten",
        "**AI Social Opportunities**, um Gespräche zu finden und Antworten zu entwerfen",
      ],
      perks: [
        { strong: "Beitrag im RepGet-Blog (DR 60+)", small: "Stellen Sie Ihr Unternehmen den Blog-Lesern vor" },
        { strong: "Präsentiert auf den Social-Media-Kanälen von RepGet", small: "Erreichen Sie die etablierte Social-Media-Zielgruppe von RepGet" },
        { strong: "E-Mail-Spotlight", small: "Werbung bei den Abonnenten von RepGet" },
      ],
    },
    scale: {
      tag: "Maximaler Schwung",
      desc: "Für ambitionierte Teams, die auf allen Kanälen mehr produzieren.",
      cta: "Mit Scale starten",
      includedLabel: "Alles aus Grow, mit mehr Kapazität",
      features: [
        "**{articles} SEO-Artikel** mit Bildern",
        "**{posts} Social-Media-Beiträge** auf mehreren Plattformen",
        "**{terms} Suchbegriffe** recherchiert",
        "**1 Website** verbunden",
        "Überwachung der Sichtbarkeit in der KI-Suche",
        "SEO-Audit, On-Page-Optimierung und Backlinks",
        "**Bevorzugte Bearbeitung** und individuelle Funktionswünsche",
        "**AI Growth Copilot** mit Erkenntnissen aus Ihren Website-Daten",
        "**AI Social Opportunities**, um Gespräche zu finden und Antworten zu entwerfen",
      ],
      perks: [
        { strong: "Bevorzugter Beitrag im RepGet-Blog (DR 60+)", small: "Hervorgehobene redaktionelle Sichtbarkeit" },
        { strong: "Bevorzugte Präsentation auf den RepGet-Kanälen", small: "Werbung bei der Social-Media-Zielgruppe von RepGet" },
        { strong: "Bevorzugtes E-Mail-Spotlight", small: "Werbung bei den Abonnenten von RepGet" },
      ],
    },
  },
  compare: {
    eyebrow: "Im direkten Vergleich",
    title: "Vergleichen Sie Ihre Optionen.",
    body: "Alle drei Tarife enthalten dieselbe Wachstumsplattform. Wählen Sie das Volumen und die Bearbeitungsstufe, die zu Ihrem Unternehmen passen.",
    included: "Enthalten",
    articles: "SEO-Markenartikel / Monat",
    posts: "Social-Media-Beiträge / Monat",
    terms: "Recherchierte Suchbegriffe",
    websites: "Websites pro Abonnement",
    copilot: { strong: "AI Growth Copilot", small: "Website-Erkenntnisse, Empfehlungen & freigegebene Aktionen" },
    social: { strong: "AI Social Opportunities", small: "Diskussionen finden, Antworten entwerfen & nach Freigabe veröffentlichen" },
    cms: "Automatisches Veröffentlichen im CMS",
    audits: "SEO-Audits, Metadaten & Schema",
    visibility: "Tracking der Sichtbarkeit in der KI-Suche",
    backlinks: "Backlink-Partnernetzwerk",
    blog: { strong: "Beitrag im RepGet-Blog (DR 60+)", small: "Hervorgehobene Platzierung im RepGet-Blog" },
    channels: { strong: "Präsentation auf den RepGet-Kanälen", small: "Werbung über die Social-Media-Kanäle von RepGet" },
    email: { strong: "E-Mail-Spotlight", small: "Werbung bei den Abonnenten von RepGet" },
    priorityProcessing: "Bevorzugte Bearbeitung",
    custom: "Individuelle Funktionswünsche",
    statusIncluded: "Enthalten",
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
            q: "Was passiert nach der kostenlosen Testphase?",
            a: "Nach Ihrer kostenlosen Testphase können Sie mit dem bei der Anmeldung gewählten kostenpflichtigen Abonnement fortfahren. Das genaue Startdatum, die Beträge und die Verlängerungsbedingungen werden beim Bezahlen angezeigt. Kostenpflichtige Tarife schalten das KI-Sichtbarkeits-Tracking und den Zugang zum Backlink-Partnernetzwerk frei.",
          },
          {
            q: "Was ist in der kostenlosen Testphase enthalten?",
            a: "Ihre kostenlose Testphase umfasst 3 kostenlose recherchierte Artikel, einen Website-Check und 15 Credits pro Tag während der ersten drei Tage für Funktionen zur Verbreitung in sozialen Netzwerken und zur Erstellung von Inhalten. KI-Sichtbarkeits-Tracking und das Backlink-Netzwerk stehen mit einem kostenpflichtigen Tarif zur Verfügung.",
          },
          {
            q: "Brauche ich SEO-Erfahrung, um zu starten?",
            a: "Nein. RepGet vereint Keyword-Recherche, Erstellung von Inhalten, technische SEO-Prüfungen und Veröffentlichung in einem Arbeitsbereich. Sie können mit Ihrer Website beginnen und die vorgeschlagenen Verbesserungen nach und nach prüfen.",
          },
          {
            q: "Welchen Tarif sollte ich wählen?",
            a: "Launch eignet sich für ein kleineres monatliches Content-Volumen, Grow bietet mehr Artikel und Social-Media-Beiträge, und Scale ergänzt höhere monatliche Volumen und bevorzugte Bearbeitung. Vergleichen Sie oben die Grenzen für Artikel, Beiträge und Recherche, um den passenden Tarif zu finden.",
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
            a: "Der Grow-Tarif umfasst SEO-Markenartikel mit Bildern sowie Unterstützung bei Titeln, Metadaten und Schema. Die verfügbaren Ergebnisse und Veröffentlichungsoptionen hängen von Funktion und Tarif ab.",
          },
          {
            q: "Kann ich Inhalte prüfen, bevor sie veröffentlicht werden?",
            a: "Sie können die erstellten Inhalte im RepGet-Arbeitsbereich bearbeiten und die Veröffentlichung einrichten. Prüfen Sie Ihre Inhalte und die Einstellungen der verbundenen Website, bevor Sie das automatische Veröffentlichen aktivieren.",
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
            a: "RepGet recherchiert und gruppiert Suchbegriffe, damit Sie Inhalte zu relevanten Themen planen können. Der Rechercheumfang hängt von Ihrem Tarif ab: Launch umfasst 300 Begriffe, Grow 500 und Scale 1.500.",
          },
          {
            q: "Welche KI-Suchplattformen kann ich verfolgen?",
            a: "Kostenpflichtige Tarife umfassen die Überwachung der Sichtbarkeit in KI-gestützten Suchangeboten wie ChatGPT, Claude, Gemini und Perplexity.",
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
            a: "Ja. Grow umfasst einen Beitrag im RepGet-Blog (DR 60+), Präsenz auf den Social-Media-Kanälen und ein E-Mail-Spotlight. Scale umfasst bevorzugte Versionen dieser Vorteile. Zeitpunkt und Umfang jeder Platzierung richten sich nach den veröffentlichten Werbebedingungen von RepGet.",
          },
          {
            q: "Was bedeutet bevorzugte Werbung bei Scale?",
            a: "Scale gibt Ihren Werbeplatzierungen Vorrang vor den Standardplatzierungen von Grow, je nach Verfügbarkeit und vereinbarten Kampagnenbedingungen. Priorität ist keine Garantie für Suchplatzierungen, Traffic oder Conversions.",
          },
          {
            q: "Was ist in Grow + Visibility enthalten?",
            a: "Grow + Visibility verbindet das Standard-Abonnement Grow mit den oben gezeigten Werbevorteilen: einem Beitrag im RepGet-Blog, Werbung auf den Social-Media-Kanälen und einem E-Mail-Spotlight. Auch Grow und Scale bieten diese Werbefunktionen, bei Scale mit bevorzugten Platzierungen.",
          },
          {
            q: "Enthält Grow + Visibility die 3-tägige kostenlose Testphase?",
            a: "Nein. Grow + Visibility ist ein Abonnement im Direktkauf. Ihre erste Zahlung von {price} wird beim Bezahlen eingezogen, und die monatliche Abrechnung beginnt mit Ihrem Abschluss. Die 3-tägige kostenlose Testphase ist in diesem Aktionspaket nicht enthalten.",
          },
          {
            q: "Wo könnte mein Unternehmen präsentiert werden?",
            a: "Das Angebot umfasst die Social-Media-Kanäle von RepGet mit insgesamt über 40K Followern, einen redaktionellen Beitrag im RepGet-Blog und Sichtbarkeit in E-Mails an unsere Abonnenten.",
          },
          {
            q: "Sind die Werbevorteile jeden Monat unbegrenzt?",
            a: "Nein. Die Werbefunktionen sind Extras zum monatlichen Abonnement der Grow-Plattform, keine unbegrenzten Beiträge oder E-Mails und keine garantierten Platzierungen. Zeitplan und Umfang sollten in den Angebotsbedingungen festgelegt werden.",
          },
        ],
      },
    ],
  },
  trial: {
    eyebrow: "Testen Sie vor Ihrer ersten Zahlung",
    titleLines: ["Beweise statt", "Versprechen."],
    body: "Ihre kostenlose Testphase umfasst 3 kostenlose recherchierte Artikel, einen Website-Check und 15 Credits pro Tag während der ersten drei Tage für Funktionen zur Verbreitung in sozialen Netzwerken und zur Erstellung von Inhalten. KI-Sichtbarkeit und das Backlink-Netzwerk werden mit dem anschließenden kostenpflichtigen Tarif aktiviert.",
    points: ["3 kostenlose Artikel", "Website-Check", "Heute keine Kosten"],
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
