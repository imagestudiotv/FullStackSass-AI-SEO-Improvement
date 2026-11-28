import type { Locale } from "@/lib/i18n/config";

/**
 * The words of /ai-blog-writer, the AI Blog Writer product page (client
 * ticket, 2026-11-27: a long-form page in the structure of a competitor's
 * "AI blog writer" page, in RepGet's own design and words), in every language.
 *
 * EVERY CLAIM IS ONE THE PRODUCT BACKS (the outside review of 2026-11-17
 * found promises the product did not keep). What each line rests on:
 *  - the three steps: the website profile (lib/websites/extract.ts: services,
 *    audience, market, language, competitors, all editable), keyword research
 *    and the content plan (lib/keywords), research from the pages Google shows
 *    for the search (lib/articles/research.ts), the writer's rules
 *    (lib/articles/generate.ts: the question answered first, no invented
 *    figures, sources named in plain text, brand voice, only the services
 *    listed), the link checks (internal-links.ts, outside-links.ts) and the
 *    publishing integrations (lib/publishing/docs.ts);
 *  - tables and an FAQ are website settings, so they are "where switched on";
 *  - FAQ markup is not added by RepGet's own delivery, so the sample's
 *    checklist says the questions are ready for an SEO plugin to mark up;
 *  - cancelling, editing before publishing, "SEO takes time": the homepage's
 *    own answers (lib/i18n/home/faq.ts).
 *
 * Left out on purpose: logos, ratings, testimonials, salaries, prices and
 * results. Prices and article counts are never written here: the page reads
 * them from the plan rows (planDisplayPrice, as /pricing does). No AI engine
 * is named. Two answers have holes the page fills from data: {languages}
 * (lib/websites/languages.ts) and {free} / {paid} (the plans).
 */

export const AI_BLOG_WRITER_PATH = "/ai-blog-writer";

type Item = { title: string; body: string };
type Question = { question: string; answer: string };

export type AiBlogWriterCopy = {
  metaTitle: string;
  metaDescription: string;
  hero: { eyebrow: string; title: string; accent: string; intro: string; primaryCta: string; secondaryCta: string; note: string };
  values: { title: string; items: (Item & { kicker: string })[] };
  compare: { title: string; sub: string; yourself: { label: string; points: string[] }; repget: { label: string; points: string[] } };
  steps: { eyebrow: string; title: string; sub: string; items: (Item & { tags: string[] })[] };
  quality: { eyebrow: string; title: string; sub: string; items: Item[] };
  brand: { eyebrow: string; title: string; body: string; points: string[]; storyLink: string };
  sample: {
    eyebrow: string;
    title: string;
    sub: string;
    badge: string;
    disclaimer: string;
    /** Said on the other languages' pages: the sample is in English. */
    englishNote: string | null;
    tldr: string;
    contents: string;
    checklistTitle: string;
    /** In order: answer first, FAQ, alt text, internal links. */
    checklist: Item[];
    statsTitle: string;
    stats: { words: string; sections: string; subheadings: string; questions: string; picturesWithAlt: string; outsideLinks: string };
  };
  platform: {
    eyebrow: string;
    title: string;
    sub: string;
    copilot: Item;
    /** In order: Backlinks, AI Visibility, Social, Website Health. */
    tools: (Item & { link: string })[];
  };
  midCta: { title: string; body: string; cta: string };
  pricing: {
    eyebrow: string;
    title: string;
    sub: string;
    perMonth: string;
    /** "{n} articles a month" */
    articles: string;
    launchPrice: string;
    freeNote: string;
    cta: string;
    seeAll: string;
    unavailable: string;
  };
  agency: { eyebrow: string; title: string; body: string; cta: string };
  faq: {
    title: string;
    /**
     * Ten questions. One answer holds {languages}; one holds {free} and
     * {paid}, which is `paid` with {list} of `paidItem`s, or nothing
     * without plans to read.
     */
    items: Question[];
    paid: string;
    /** "{n} on {name}" */
    paidItem: string;
  };
  closing: { title: string; body: string };
};

const en: AiBlogWriterCopy = {
  metaTitle: "AI Blog Writer for SEO articles in your language",
  metaDescription:
    "RepGet plans topics from keyword research, writes SEO articles in your language and brand voice, checks them and publishes them to your website.",
  hero: {
    eyebrow: "AI Blog Writer",
    title: "An AI blog writer that researches, writes",
    accent: "and publishes your articles.",
    intro:
      "RepGet finds what your customers search for, writes each article in your language and your brand voice, checks it, and publishes it to your website. The answer comes first and sources are named, so readers, search engines and AI assistants find what they came for.",
    primaryCta: "Start free",
    secondaryCta: "Try the free blog writer",
    note: "Free plan · No credit card",
  },
  values: {
    title: "A blog that keeps going without you writing it",
    items: [
      {
        kicker: "What you get",
        title: "Articles your customers search for",
        body: "A content plan from keyword research on your market, and articles written from it, each one planned for a real search.",
      },
      {
        kicker: "How it stays yours",
        title: "Your business, your voice, your articles",
        body: "Every article starts from your website's profile and your brand voice. You own what RepGet writes, and anything published stays on your site if you cancel.",
      },
      {
        kicker: "What you do",
        title: "Check, edit, decide",
        body: "Correct the profile once, read articles when you want to and choose what goes live. Research, writing, checks and publishing are done for you.",
      },
    ],
  },
  compare: {
    title: "Writing the blog yourself, and with RepGet",
    sub: "The same work either way. The difference is who does it each week.",
    yourself: {
      label: "On your own",
      points: [
        "Guessing topics, or learning a keyword tool first",
        "Reading what already ranks before every article",
        "Writing, editing and formatting each post by hand",
        "Checking every fact and every link yourself",
        "Copying each article into your website to publish it",
        "Starting again from a blank page next week",
      ],
    },
    repget: {
      label: "With RepGet",
      points: [
        "Topics from keyword research on your own market",
        "Each article researched from the pages Google shows for its search",
        "Written in your language and voice, with headings, lists and, if you want them, tables and an FAQ",
        "Sources named in plain text, links only to your pages that exist",
        "Published to your website once it is connected, or kept as a draft",
        "A plan that carries on every month, within your plan's articles",
      ],
    },
  },
  steps: {
    eyebrow: "How it works",
    title: "From your website to published articles in three steps",
    sub: "Every step can be checked and corrected, because every article is built on the one before.",
    items: [
      {
        title: "We read your website",
        body: "RepGet reads your site and drafts its profile: what you offer, who you offer it to, your market, your language and your competitors. You can correct every field.",
        tags: ["Services", "Audience", "Market", "Language", "Competitors"],
      },
      {
        title: "We research keywords and plan your content",
        body: "Keyword research for your market finds the searches your customers make. Relevant, realistic searches come before very competitive ones, and they become your content plan.",
        tags: ["Keyword research", "Search intent", "Content plan"],
      },
      {
        title: "We write, check and publish",
        body: "Each article is researched from the pages Google shows for its search, written in your language, checked against its research and for its links, then published to your website or kept as a draft.",
        tags: ["Research", "Writing", "Checks", "Publishing"],
      },
    ],
  },
  quality: {
    eyebrow: "Quality criteria",
    title: "What every article is held to",
    sub: "Rules the writer follows and checks the article passes before it is ready.",
    items: [
      {
        title: "Matches the search",
        body: "Planned for the intent behind the search, whether the reader wants to learn, compare or buy, and for the kind of page Google already shows for it.",
      },
      {
        title: "Answer first",
        body: "The question is answered at the start, before any background. No filler opening and no closing summary that repeats the article.",
      },
      {
        title: "Sources named in plain text",
        body: "A researched fact names its source next to the claim. Statistics, prices, dates and quotes are never invented.",
      },
      {
        title: "Your voice and your facts",
        body: "Written in your brand voice and from your profile. It never says you offer something your services do not include.",
      },
      {
        title: "Built to be scanned",
        body: "Headings and sub-headings a reader looks for, short paragraphs, lists where they help and, when switched on for your site, comparison tables and an FAQ.",
      },
      {
        title: "Links that go somewhere real",
        body: "Internal links only to pages checked to exist on your site. Links to other websites are taken out, apart from a Partner Network link and your own social profiles.",
      },
    ],
  },
  brand: {
    eyebrow: "Brand alignment",
    title: "Written as your business, not as a generic AI",
    body: "Each article is written from what RepGet knows about your business, and that is what you see and can change: your profile, your brand voice and the facts you confirm. It will not promise a service you do not list.",
    points: [
      "Your services, audience and market, from your own website",
      "A brand voice you set and can change at any time",
      "Facts you confirm, used as you wrote them",
      "Every article editable before anything is published",
    ],
    storyLink: "See how Image Studio uses RepGet",
  },
  sample: {
    eyebrow: "Writing sample",
    title: "What an article looks like",
    sub: "A full excerpt in the shape RepGet writes: the answer, a contents list, headings, a picture with alt text and a short FAQ.",
    badge: "Writing sample",
    disclaimer: "Written to show the format for a wedding photographer. It is not a published article and shows no results.",
    englishNote: null,
    tldr: "In short",
    contents: "Contents",
    checklistTitle: "Ready for search",
    checklist: [
      { title: "Answer first", body: "The short answer and the opening paragraph answer the question before any background." },
      { title: "FAQ ready for markup", body: "Questions in the reader's words, each with a short answer an SEO plugin can mark up as FAQ data." },
      { title: "Image alt text", body: "Every picture has alt text that says what it shows." },
      { title: "Internal links", body: "Added only to pages checked to exist on your site. This sample has none, because it is not on a site." },
    ],
    statsTitle: "Measured from this sample",
    stats: {
      words: "Words",
      sections: "Sections (H2)",
      subheadings: "Sub-headings (H3)",
      questions: "FAQ questions",
      picturesWithAlt: "Pictures with alt text",
      outsideLinks: "Links to other websites",
    },
  },
  platform: {
    eyebrow: "The platform",
    title: "Articles are one of five tools",
    sub: "RepGet has five tools: Articles, Backlinks, AI Visibility, Social and Website Health. Growth Copilot is the assistant that runs them with you.",
    copilot: {
      title: "Growth Copilot",
      body: "Ask for ideas, a plan or your next steps across the five tools in one conversation, then decide what to approve.",
    },
    tools: [
      { title: "Backlinks", body: "Links to your site placed inside new articles on related businesses' websites, each one checked on the live page.", link: "About backlinks" },
      { title: "AI Visibility", body: "See whether AI assistants name your business when people ask the questions your customers ask.", link: "About AI visibility" },
      { title: "Social", body: "Turn an article or an idea into posts for your social channels, and review each one before it is published.", link: "See the features" },
      { title: "Website Health", body: "Find the technical problems on your pages and see what to fix first, in plain language.", link: "Run the free check" },
    ],
  },
  midCta: {
    title: "See your own content plan",
    body: "Add your website and RepGet drafts its profile and a plan of articles to write.",
    cta: "Start free",
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Start free, upgrade when you want more articles",
    sub: "The same plans and prices as on the pricing page.",
    perMonth: "/ month",
    articles: "{n} articles a month",
    launchPrice: "Launch price",
    freeNote: "No credit card",
    cta: "Start free",
    seeAll: "Compare every plan",
    unavailable: "The plans are on the pricing page.",
  },
  agency: {
    eyebrow: "Several websites",
    title: "Running more than one website, or your clients' sites?",
    body: "Add each website to one account. Each has its own profile, brand voice, language and content plan, so one site's articles never borrow another's voice.",
    cta: "Talk to us",
  },
  faq: {
    title: "Questions about the AI Blog Writer",
    items: [
      {
        question: "Does Google penalise AI-written articles?",
        answer:
          "Google says it rewards helpful content however it is made, and acts against content made mainly to manipulate rankings. RepGet writes each article to answer a real search from research, and you can read it before it goes live. Nobody can guarantee a ranking.",
      },
      {
        question: "Do I keep my articles if I cancel?",
        answer: "Yes. You own the articles RepGet writes for you, and anything already published on your website stays there after you cancel.",
      },
      {
        question: "Which languages can it write in?",
        answer: "{languages}. Each website has its own language, and its articles are written in it rather than translated from English.",
      },
      {
        question: "Which website platforms can it publish to?",
        answer:
          "WordPress, with the RepGet plugin or an application password, Shopify, Webflow, Wix and Ghost. Any other system can receive finished articles through a webhook. Each one has a setup guide.",
      },
      {
        question: "How many articles do I get each month?",
        answer: "The Free plan includes {free} articles a month.{paid} The pricing page lists everything each plan includes.",
      },
      {
        question: "Can I edit an article before it is published?",
        answer:
          "Yes. Articles only go on your website if you connect it and choose to publish. Otherwise they stay drafts you can edit, for wording, tone and facts, and publish yourself.",
      },
      {
        question: "Where do the facts come from, and does it link to other websites?",
        answer:
          "From pages RepGet reads for that search, with the source named in plain text next to the claim. Articles do not link to other websites, apart from a Partner Network link and your own social profiles, and internal links go only to pages checked to exist on your site.",
      },
      {
        question: "Will the articles sound like my business?",
        answer:
          "They are written from your website's profile and your brand voice, which you can change at any time. Read them before they are published all the same: you know your business best.",
      },
      {
        question: "Do I need to know anything about SEO?",
        answer: "No. RepGet researches what your customers search for, plans the articles and writes them. You decide what is published.",
      },
      {
        question: "How long before articles bring visitors?",
        answer:
          "SEO takes time. New pages commonly need two to four months to start attracting visitors, and competitive markets can take longer. RepGet tracks progress instead of promising rankings.",
      },
    ],
    paid: " On paid plans: {list}.",
    paidItem: "{n} on {name}",
  },
  closing: {
    title: "Give your blog a writer that never misses a week",
    body: "Start on the Free plan, see your first content plan and articles, and upgrade when you want more.",
  },
};

const es: AiBlogWriterCopy = {
  metaTitle: "Redactor de blog con IA para artículos SEO",
  metaDescription:
    "RepGet planifica temas con investigación de palabras clave, escribe artículos SEO en su idioma y con su voz de marca, los revisa y los publica en su web.",
  hero: {
    eyebrow: "Redactor de blog con IA",
    title: "Un redactor de blog con IA que investiga, escribe",
    accent: "y publica sus artículos.",
    intro:
      "RepGet descubre qué buscan sus clientes, escribe cada artículo en su idioma y con su voz de marca, lo revisa y lo publica en su sitio web. La respuesta va primero y las fuentes se nombran, para que lectores, buscadores y asistentes de IA encuentren lo que buscan.",
    primaryCta: "Empezar gratis",
    secondaryCta: "Probar el redactor gratuito",
    note: "Plan Free · Sin tarjeta de crédito",
  },
  values: {
    title: "Un blog que avanza sin que usted lo escriba",
    items: [
      {
        kicker: "Qué obtiene",
        title: "Artículos sobre lo que buscan sus clientes",
        body: "Un plan de contenidos basado en la investigación de palabras clave de su mercado y artículos escritos a partir de él, cada uno pensado para una búsqueda real.",
      },
      {
        kicker: "Por qué sigue siendo suyo",
        title: "Su negocio, su voz, sus artículos",
        body: "Cada artículo parte del perfil de su sitio web y de su voz de marca. Lo que RepGet escribe es suyo, y lo publicado permanece en su sitio si cancela.",
      },
      {
        kicker: "Qué hace usted",
        title: "Revisar, editar, decidir",
        body: "Corrija el perfil una vez, lea los artículos cuando quiera y elija qué se publica. La investigación, la redacción, las revisiones y la publicación se hacen por usted.",
      },
    ],
  },
  compare: {
    title: "Escribir el blog usted mismo, y con RepGet",
    sub: "El trabajo es el mismo. La diferencia es quién lo hace cada semana.",
    yourself: {
      label: "Por su cuenta",
      points: [
        "Adivinar temas, o aprender antes una herramienta de palabras clave",
        "Leer lo que ya posiciona antes de cada artículo",
        "Escribir, editar y dar formato a cada entrada a mano",
        "Comprobar usted mismo cada dato y cada enlace",
        "Copiar cada artículo en su sitio web para publicarlo",
        "Volver a empezar desde una página en blanco la semana siguiente",
      ],
    },
    repget: {
      label: "Con RepGet",
      points: [
        "Temas a partir de la investigación de palabras clave de su propio mercado",
        "Cada artículo investigado a partir de las páginas que Google muestra para esa búsqueda",
        "Escrito en su idioma y con su voz, con títulos, listas y, si los quiere, tablas y preguntas frecuentes",
        "Fuentes citadas en texto, enlaces solo a páginas suyas que existen",
        "Publicado en su sitio web una vez conectado, o guardado como borrador",
        "Un plan que continúa cada mes, dentro de los artículos de su plan",
      ],
    },
  },
  steps: {
    eyebrow: "Cómo funciona",
    title: "De su sitio web a artículos publicados en tres pasos",
    sub: "Cada paso se puede revisar y corregir, porque cada artículo se apoya en el anterior.",
    items: [
      {
        title: "Leemos su sitio web",
        body: "RepGet lee su sitio y prepara su perfil: qué ofrece, a quién, su mercado, su idioma y sus competidores. Puede corregir cada campo.",
        tags: ["Servicios", "Público", "Mercado", "Idioma", "Competidores"],
      },
      {
        title: "Investigamos palabras clave y planificamos su contenido",
        body: "La investigación de palabras clave de su mercado encuentra las búsquedas de sus clientes. Las búsquedas relevantes y realistas van antes que las muy competidas, y forman su plan de contenidos.",
        tags: ["Palabras clave", "Intención de búsqueda", "Plan de contenidos"],
      },
      {
        title: "Escribimos, revisamos y publicamos",
        body: "Cada artículo se investiga a partir de las páginas que Google muestra para su búsqueda, se escribe en su idioma, se contrasta con su investigación y se revisan sus enlaces; después se publica en su sitio web o se guarda como borrador.",
        tags: ["Investigación", "Redacción", "Revisiones", "Publicación"],
      },
    ],
  },
  quality: {
    eyebrow: "Criterios de calidad",
    title: "Lo que se exige a cada artículo",
    sub: "Reglas que sigue la redacción y revisiones que el artículo supera antes de estar listo.",
    items: [
      {
        title: "Responde a la búsqueda",
        body: "Pensado para la intención de la búsqueda, ya sea aprender, comparar o comprar, y para el tipo de página que Google ya muestra para ella.",
      },
      {
        title: "La respuesta primero",
        body: "La pregunta se responde al principio, antes de cualquier contexto. Sin introducciones de relleno ni un resumen final que repita el artículo.",
      },
      {
        title: "Fuentes citadas en texto",
        body: "Un dato investigado nombra su fuente junto a la afirmación. Nunca se inventan estadísticas, precios, fechas ni citas.",
      },
      {
        title: "Su voz y sus datos",
        body: "Escrito con su voz de marca y a partir de su perfil. Nunca dice que ofrece algo que sus servicios no incluyen.",
      },
      {
        title: "Fácil de recorrer",
        body: "Títulos y subtítulos que el lector busca, párrafos breves, listas donde ayudan y, si están activadas en su sitio, tablas comparativas y preguntas frecuentes.",
      },
      {
        title: "Enlaces que llevan a algo real",
        body: "Enlaces internos solo a páginas comprobadas en su sitio. Los enlaces a otros sitios se eliminan, salvo un enlace de la red de partners y sus propios perfiles sociales.",
      },
    ],
  },
  brand: {
    eyebrow: "Alineación con su marca",
    title: "Escrito como su negocio, no como una IA genérica",
    body: "Cada artículo se escribe con lo que RepGet sabe de su negocio, y eso es lo que usted ve y puede cambiar: su perfil, su voz de marca y los datos que confirma. Nunca prometerá un servicio que no tenga en su lista.",
    points: [
      "Sus servicios, público y mercado, desde su propio sitio web",
      "Una voz de marca que usted define y puede cambiar cuando quiera",
      "Datos que confirma, usados tal como los escribió",
      "Cada artículo se puede editar antes de publicar nada",
    ],
    storyLink: "Vea cómo Image Studio usa RepGet",
  },
  sample: {
    eyebrow: "Muestra de redacción",
    title: "Así es un artículo",
    sub: "Un extracto completo con la forma en que escribe RepGet: la respuesta, un índice, títulos, una imagen con texto alternativo y unas preguntas frecuentes.",
    badge: "Muestra de redacción",
    disclaimer: "Escrito para mostrar el formato para un fotógrafo de bodas. No es un artículo publicado y no muestra resultados.",
    englishNote: "La muestra está en inglés; RepGet escribe en el idioma de su sitio.",
    tldr: "En resumen",
    contents: "Índice",
    checklistTitle: "Listo para la búsqueda",
    checklist: [
      { title: "La respuesta primero", body: "El resumen y el primer párrafo responden a la pregunta antes de cualquier contexto." },
      { title: "Preguntas listas para marcado", body: "Preguntas con las palabras del lector, cada una con una respuesta breve que un plugin SEO puede marcar como datos FAQ." },
      { title: "Texto alternativo", body: "Cada imagen tiene un texto alternativo que dice qué muestra." },
      { title: "Enlaces internos", body: "Solo a páginas comprobadas en su sitio. Esta muestra no tiene ninguno, porque no está en un sitio." },
    ],
    statsTitle: "Medido en esta muestra",
    stats: {
      words: "Palabras",
      sections: "Secciones (H2)",
      subheadings: "Subtítulos (H3)",
      questions: "Preguntas frecuentes",
      picturesWithAlt: "Imágenes con texto alternativo",
      outsideLinks: "Enlaces a otros sitios",
    },
  },
  platform: {
    eyebrow: "La plataforma",
    title: "Los artículos son una de cinco herramientas",
    sub: "RepGet tiene cinco herramientas: Artículos, Backlinks, Visibilidad en IA, Redes sociales y Salud del sitio web. Growth Copilot es el asistente que las maneja con usted.",
    copilot: {
      title: "Growth Copilot",
      body: "Pida ideas, un plan o los próximos pasos de las cinco herramientas en una sola conversación, y decida después qué aprobar.",
    },
    tools: [
      { title: "Backlinks", body: "Enlaces a su sitio dentro de artículos nuevos en webs de negocios afines, cada uno comprobado en la página publicada.", link: "Sobre los backlinks" },
      { title: "Visibilidad en IA", body: "Vea si los asistentes de IA nombran su negocio cuando se les hacen las preguntas de sus clientes.", link: "Sobre la visibilidad en IA" },
      { title: "Redes sociales", body: "Convierta un artículo o una idea en publicaciones para sus redes, y revise cada una antes de publicarla.", link: "Ver las funciones" },
      { title: "Salud del sitio web", body: "Encuentre los problemas técnicos de sus páginas y vea qué arreglar primero, en lenguaje claro.", link: "Hacer el análisis gratuito" },
    ],
  },
  midCta: {
    title: "Vea su propio plan de contenidos",
    body: "Añada su sitio web y RepGet preparará su perfil y un plan de artículos para escribir.",
    cta: "Empezar gratis",
  },
  pricing: {
    eyebrow: "Precios",
    title: "Empiece gratis y mejore su plan cuando quiera más artículos",
    sub: "Los mismos planes y precios que en la página de precios.",
    perMonth: "/ mes",
    articles: "{n} artículos al mes",
    launchPrice: "Precio de lanzamiento",
    freeNote: "Sin tarjeta de crédito",
    cta: "Empezar gratis",
    seeAll: "Comparar todos los planes",
    unavailable: "Los planes están en la página de precios.",
  },
  agency: {
    eyebrow: "Varios sitios web",
    title: "¿Gestiona más de un sitio web, o los de sus clientes?",
    body: "Añada cada sitio web a una sola cuenta. Cada uno tiene su propio perfil, voz de marca, idioma y plan de contenidos, para que los artículos de un sitio nunca tomen prestada la voz de otro.",
    cta: "Hable con nosotros",
  },
  faq: {
    title: "Preguntas sobre el redactor de blog con IA",
    items: [
      {
        question: "¿Penaliza Google los artículos escritos con IA?",
        answer:
          "Google dice que premia el contenido útil, se haga como se haga, y actúa contra el contenido hecho sobre todo para manipular el posicionamiento. RepGet escribe cada artículo para responder a una búsqueda real a partir de una investigación, y usted puede leerlo antes de publicarlo. Nadie puede garantizar una posición.",
      },
      {
        question: "¿Conservo mis artículos si cancelo?",
        answer: "Sí. Los artículos que RepGet escribe para usted son suyos, y lo que ya esté publicado en su sitio web permanece allí después de cancelar.",
      },
      {
        question: "¿En qué idiomas puede escribir?",
        answer: "{languages}. Cada sitio web tiene su propio idioma, y sus artículos se escriben en él en lugar de traducirse del inglés.",
      },
      {
        question: "¿En qué plataformas web puede publicar?",
        answer:
          "WordPress, con el plugin de RepGet o con una contraseña de aplicación, Shopify, Webflow, Wix y Ghost. Cualquier otro sistema puede recibir los artículos terminados mediante un webhook. Cada una tiene su guía de configuración.",
      },
      {
        question: "¿Cuántos artículos recibo cada mes?",
        answer: "El plan Free incluye {free} artículos al mes.{paid} La página de precios detalla todo lo que incluye cada plan.",
      },
      {
        question: "¿Puedo editar un artículo antes de publicarlo?",
        answer:
          "Sí. Los artículos solo llegan a su sitio web si lo conecta y decide publicar. Si no, quedan como borradores que puede editar, en redacción, tono y datos, y publicar usted mismo.",
      },
      {
        question: "¿De dónde salen los datos, y enlaza a otros sitios web?",
        answer:
          "De las páginas que RepGet lee para esa búsqueda, con la fuente citada en texto junto a la afirmación. Los artículos no enlazan a otros sitios, salvo un enlace de la red de partners y sus propios perfiles sociales, y los enlaces internos van solo a páginas comprobadas en su sitio.",
      },
      {
        question: "¿Sonarán los artículos como mi negocio?",
        answer:
          "Se escriben a partir del perfil de su sitio web y de su voz de marca, que puede cambiar cuando quiera. Aun así, léalos antes de publicarlos: nadie conoce su negocio mejor que usted.",
      },
      {
        question: "¿Necesito saber algo de SEO?",
        answer: "No. RepGet investiga lo que buscan sus clientes, planifica los artículos y los escribe. Usted decide qué se publica.",
      },
      {
        question: "¿Cuánto tardan los artículos en traer visitas?",
        answer:
          "El SEO lleva tiempo. Las páginas nuevas suelen necesitar de dos a cuatro meses para empezar a atraer visitas, y en mercados competidos puede tardar más. RepGet mide el progreso en lugar de prometer posiciones.",
      },
    ],
    paid: " En los planes de pago: {list}.",
    paidItem: "{n} en {name}",
  },
  closing: {
    title: "Dé a su blog un redactor que no falla ninguna semana",
    body: "Empiece con el plan Free, vea su primer plan de contenidos y sus artículos, y mejore su plan cuando quiera más.",
  },
};

const fr: AiBlogWriterCopy = {
  metaTitle: "Rédacteur de blog IA pour articles SEO",
  metaDescription:
    "RepGet planifie vos sujets par la recherche de mots-clés, rédige des articles SEO dans votre langue et votre ton, les vérifie et les publie sur votre site.",
  hero: {
    eyebrow: "Rédacteur de blog IA",
    title: "Un rédacteur de blog IA qui recherche, rédige",
    accent: "et publie vos articles.",
    intro:
      "RepGet trouve ce que recherchent vos clients, rédige chaque article dans votre langue et avec le ton de votre marque, le vérifie et le publie sur votre site. La réponse vient d’abord et les sources sont nommées, pour que lecteurs, moteurs de recherche et assistants IA trouvent ce qu’ils cherchent.",
    primaryCta: "Commencer gratuitement",
    secondaryCta: "Essayer le rédacteur gratuit",
    note: "Offre Free · Sans carte bancaire",
  },
  values: {
    title: "Un blog qui avance sans que vous l’écriviez",
    items: [
      {
        kicker: "Ce que vous obtenez",
        title: "Des articles sur ce que vos clients recherchent",
        body: "Un plan de contenu issu de la recherche de mots-clés sur votre marché, et des articles rédigés à partir de ce plan, chacun pensé pour une vraie recherche.",
      },
      {
        kicker: "Pourquoi il reste le vôtre",
        title: "Votre entreprise, votre ton, vos articles",
        body: "Chaque article part du profil de votre site et du ton de votre marque. Ce que RepGet rédige vous appartient, et ce qui est publié reste sur votre site si vous résiliez.",
      },
      {
        kicker: "Ce que vous faites",
        title: "Relire, modifier, décider",
        body: "Corrigez le profil une fois, lisez les articles quand vous le souhaitez et choisissez ce qui est publié. La recherche, la rédaction, les vérifications et la publication sont faites pour vous.",
      },
    ],
  },
  compare: {
    title: "Écrire le blog vous-même, et avec RepGet",
    sub: "Le même travail dans les deux cas. La différence, c’est qui le fait chaque semaine.",
    yourself: {
      label: "Seul",
      points: [
        "Deviner les sujets, ou apprendre d’abord un outil de mots-clés",
        "Lire ce qui est déjà bien classé avant chaque article",
        "Rédiger, corriger et mettre en forme chaque article à la main",
        "Vérifier vous-même chaque fait et chaque lien",
        "Copier chaque article dans votre site pour le publier",
        "Repartir d’une page blanche la semaine suivante",
      ],
    },
    repget: {
      label: "Avec RepGet",
      points: [
        "Des sujets issus de la recherche de mots-clés sur votre propre marché",
        "Chaque article documenté à partir des pages que Google affiche pour sa recherche",
        "Rédigé dans votre langue et votre ton, avec des intertitres, des listes et, si vous le souhaitez, des tableaux et une FAQ",
        "Sources nommées en toutes lettres, liens uniquement vers vos pages existantes",
        "Publié sur votre site une fois connecté, ou gardé en brouillon",
        "Un plan qui continue chaque mois, dans la limite des articles de votre offre",
      ],
    },
  },
  steps: {
    eyebrow: "Comment ça marche",
    title: "De votre site à des articles publiés en trois étapes",
    sub: "Chaque étape peut être vérifiée et corrigée, car chaque article s’appuie sur la précédente.",
    items: [
      {
        title: "Nous lisons votre site",
        body: "RepGet lit votre site et prépare son profil : ce que vous proposez, à qui, votre marché, votre langue et vos concurrents. Vous pouvez corriger chaque champ.",
        tags: ["Services", "Public", "Marché", "Langue", "Concurrents"],
      },
      {
        title: "Nous recherchons les mots-clés et planifions votre contenu",
        body: "La recherche de mots-clés sur votre marché trouve les recherches de vos clients. Les recherches pertinentes et réalistes passent avant les plus disputées, et forment votre plan de contenu.",
        tags: ["Mots-clés", "Intention de recherche", "Plan de contenu"],
      },
      {
        title: "Nous rédigeons, vérifions et publions",
        body: "Chaque article est documenté à partir des pages que Google affiche pour sa recherche, rédigé dans votre langue, vérifié par rapport à ses sources et pour ses liens, puis publié sur votre site ou gardé en brouillon.",
        tags: ["Recherche", "Rédaction", "Vérifications", "Publication"],
      },
    ],
  },
  quality: {
    eyebrow: "Critères de qualité",
    title: "Les exigences de chaque article",
    sub: "Les règles que suit la rédaction et les vérifications que l’article passe avant d’être prêt.",
    items: [
      {
        title: "Répond à la recherche",
        body: "Pensé pour l’intention derrière la recherche, qu’il s’agisse d’apprendre, de comparer ou d’acheter, et pour le type de page que Google affiche déjà.",
      },
      {
        title: "La réponse d’abord",
        body: "La question trouve sa réponse dès le début, avant tout contexte. Pas d’introduction de remplissage ni de conclusion qui répète l’article.",
      },
      {
        title: "Sources nommées en toutes lettres",
        body: "Un fait documenté nomme sa source à côté de l’affirmation. Statistiques, prix, dates et citations ne sont jamais inventés.",
      },
      {
        title: "Votre ton et vos faits",
        body: "Rédigé avec le ton de votre marque et à partir de votre profil. Il ne prétend jamais que vous proposez ce que vos services n’incluent pas.",
      },
      {
        title: "Facile à parcourir",
        body: "Les intertitres que le lecteur cherche, des paragraphes courts, des listes quand elles aident et, si elles sont activées pour votre site, des tableaux comparatifs et une FAQ.",
      },
      {
        title: "Des liens qui mènent quelque part",
        body: "Des liens internes uniquement vers des pages vérifiées sur votre site. Les liens vers d’autres sites sont retirés, sauf un lien du réseau de partenaires et vos propres profils sociaux.",
      },
    ],
  },
  brand: {
    eyebrow: "Alignement avec votre marque",
    title: "Écrit comme votre entreprise, pas comme une IA générique",
    body: "Chaque article est rédigé à partir de ce que RepGet sait de votre entreprise, et c’est ce que vous voyez et pouvez modifier : votre profil, le ton de votre marque et les faits que vous confirmez. Il ne promettra jamais un service que vous ne proposez pas.",
    points: [
      "Vos services, votre public et votre marché, tirés de votre propre site",
      "Un ton de marque que vous définissez et pouvez changer à tout moment",
      "Les faits que vous confirmez, repris tels que vous les avez écrits",
      "Chaque article modifiable avant toute publication",
    ],
    storyLink: "Voir comment Image Studio utilise RepGet",
  },
  sample: {
    eyebrow: "Exemple de rédaction",
    title: "À quoi ressemble un article",
    sub: "Un extrait complet dans la forme qu’écrit RepGet : la réponse, un sommaire, des intertitres, une image avec texte alternatif et une courte FAQ.",
    badge: "Exemple de rédaction",
    disclaimer: "Rédigé pour montrer le format, pour un photographe de mariage. Ce n’est pas un article publié et il ne montre aucun résultat.",
    englishNote: "L’exemple est en anglais ; RepGet rédige dans la langue de votre site.",
    tldr: "En bref",
    contents: "Sommaire",
    checklistTitle: "Prêt pour la recherche",
    checklist: [
      { title: "La réponse d’abord", body: "Le résumé et le premier paragraphe répondent à la question avant tout contexte." },
      { title: "FAQ prête pour le balisage", body: "Des questions dans les mots du lecteur, chacune avec une réponse courte qu’une extension SEO peut baliser en données FAQ." },
      { title: "Texte alternatif", body: "Chaque image a un texte alternatif qui dit ce qu’elle montre." },
      { title: "Liens internes", body: "Uniquement vers des pages vérifiées sur votre site. Cet exemple n’en a aucun, car il n’est sur aucun site." },
    ],
    statsTitle: "Mesuré sur cet exemple",
    stats: {
      words: "Mots",
      sections: "Sections (H2)",
      subheadings: "Sous-titres (H3)",
      questions: "Questions de la FAQ",
      picturesWithAlt: "Images avec texte alternatif",
      outsideLinks: "Liens vers d’autres sites",
    },
  },
  platform: {
    eyebrow: "La plateforme",
    title: "Les articles sont l’un de cinq outils",
    sub: "RepGet a cinq outils : Articles, Backlinks, Visibilité IA, Réseaux sociaux et Santé du site. Growth Copilot est l’assistant qui les fait tourner avec vous.",
    copilot: {
      title: "Growth Copilot",
      body: "Demandez des idées, un plan ou vos prochaines étapes sur les cinq outils dans une seule conversation, puis décidez ce que vous approuvez.",
    },
    tools: [
      { title: "Backlinks", body: "Des liens vers votre site placés dans de nouveaux articles sur les sites d’entreprises proches de votre domaine, chacun vérifié sur la page en ligne.", link: "À propos des backlinks" },
      { title: "Visibilité IA", body: "Voyez si les assistants IA citent votre entreprise quand on leur pose les questions de vos clients.", link: "À propos de la visibilité IA" },
      { title: "Réseaux sociaux", body: "Transformez un article ou une idée en publications pour vos réseaux, et relisez chacune avant sa publication.", link: "Voir les fonctionnalités" },
      { title: "Santé du site", body: "Repérez les problèmes techniques de vos pages et voyez quoi corriger d’abord, en termes simples.", link: "Lancer l’analyse gratuite" },
    ],
  },
  midCta: {
    title: "Découvrez votre propre plan de contenu",
    body: "Ajoutez votre site et RepGet prépare son profil et un plan d’articles à rédiger.",
    cta: "Commencer gratuitement",
  },
  pricing: {
    eyebrow: "Tarifs",
    title: "Commencez gratuitement, passez à plus d’articles quand vous voulez",
    sub: "Les mêmes offres et les mêmes prix que sur la page des tarifs.",
    perMonth: "/ mois",
    articles: "{n} articles par mois",
    launchPrice: "Prix de lancement",
    freeNote: "Sans carte bancaire",
    cta: "Commencer gratuitement",
    seeAll: "Comparer toutes les offres",
    unavailable: "Les offres sont sur la page des tarifs.",
  },
  agency: {
    eyebrow: "Plusieurs sites",
    title: "Vous gérez plusieurs sites, ou ceux de vos clients ?",
    body: "Ajoutez chaque site à un seul compte. Chacun a son propre profil, son ton de marque, sa langue et son plan de contenu, pour que les articles d’un site n’empruntent jamais la voix d’un autre.",
    cta: "Parlons-en",
  },
  faq: {
    title: "Questions sur le rédacteur de blog IA",
    items: [
      {
        question: "Google pénalise-t-il les articles rédigés par IA ?",
        answer:
          "Google dit récompenser le contenu utile, quelle que soit la façon dont il est produit, et sanctionner le contenu créé surtout pour manipuler le classement. RepGet rédige chaque article pour répondre à une vraie recherche, à partir de sources, et vous pouvez le lire avant sa publication. Personne ne peut garantir un classement.",
      },
      {
        question: "Est-ce que je garde mes articles si je résilie ?",
        answer: "Oui. Les articles que RepGet rédige pour vous vous appartiennent, et ce qui est déjà publié sur votre site y reste après la résiliation.",
      },
      {
        question: "Dans quelles langues peut-il écrire ?",
        answer: "{languages}. Chaque site a sa propre langue, et ses articles sont rédigés dans cette langue plutôt que traduits de l’anglais.",
      },
      {
        question: "Sur quelles plateformes peut-il publier ?",
        answer:
          "WordPress, avec l’extension RepGet ou un mot de passe d’application, Shopify, Webflow, Wix et Ghost. Tout autre système peut recevoir les articles terminés par un webhook. Chacune a son guide de configuration.",
      },
      {
        question: "Combien d’articles ai-je chaque mois ?",
        answer: "L’offre Free comprend {free} articles par mois.{paid} La page des tarifs détaille tout ce que comprend chaque offre.",
      },
      {
        question: "Puis-je modifier un article avant sa publication ?",
        answer:
          "Oui. Les articles ne vont sur votre site que si vous le connectez et choisissez de publier. Sinon, ils restent des brouillons que vous pouvez modifier, pour la formulation, le ton et les faits, puis publier vous-même.",
      },
      {
        question: "D’où viennent les faits, et fait-il des liens vers d’autres sites ?",
        answer:
          "Des pages que RepGet lit pour cette recherche, avec la source nommée en toutes lettres à côté de l’affirmation. Les articles ne renvoient pas vers d’autres sites, sauf un lien du réseau de partenaires et vos propres profils sociaux, et les liens internes vont uniquement vers des pages vérifiées sur votre site.",
      },
      {
        question: "Les articles ressembleront-ils à mon entreprise ?",
        answer:
          "Ils sont rédigés à partir du profil de votre site et du ton de votre marque, que vous pouvez changer à tout moment. Relisez-les quand même avant leur publication : personne ne connaît votre entreprise mieux que vous.",
      },
      {
        question: "Dois-je m’y connaître en SEO ?",
        answer: "Non. RepGet recherche ce que vos clients cherchent, planifie les articles et les rédige. Vous décidez de ce qui est publié.",
      },
      {
        question: "Combien de temps avant que les articles apportent des visiteurs ?",
        answer:
          "Le SEO prend du temps. Les nouvelles pages ont souvent besoin de deux à quatre mois pour commencer à attirer des visiteurs, et plus sur les marchés concurrentiels. RepGet suit les progrès au lieu de promettre des classements.",
      },
    ],
    paid: " Avec les offres payantes : {list}.",
    paidItem: "{n} avec {name}",
  },
  closing: {
    title: "Donnez à votre blog un rédacteur qui ne manque aucune semaine",
    body: "Commencez avec l’offre Free, découvrez votre premier plan de contenu et vos articles, et passez à une offre supérieure quand vous voulez.",
  },
};

const it: AiBlogWriterCopy = {
  metaTitle: "Redattore di blog con IA per articoli SEO",
  metaDescription:
    "RepGet pianifica i temi con la ricerca di parole chiave, scrive articoli SEO nella sua lingua e con il tono del suo brand, li verifica e li pubblica sul sito.",
  hero: {
    eyebrow: "Redattore di blog con IA",
    title: "Un redattore di blog con IA che ricerca, scrive",
    accent: "e pubblica i suoi articoli.",
    intro:
      "RepGet scopre che cosa cercano i suoi clienti, scrive ogni articolo nella sua lingua e con il tono del suo brand, lo verifica e lo pubblica sul suo sito. La risposta viene prima e le fonti sono citate, così lettori, motori di ricerca e assistenti IA trovano quello che cercano.",
    primaryCta: "Inizi gratis",
    secondaryCta: "Provi il redattore gratuito",
    note: "Piano Free · Senza carta di credito",
  },
  values: {
    title: "Un blog che va avanti senza che sia lei a scriverlo",
    items: [
      {
        kicker: "Che cosa ottiene",
        title: "Articoli su ciò che cercano i suoi clienti",
        body: "Un piano editoriale dalla ricerca di parole chiave sul suo mercato e articoli scritti a partire da esso, ognuno pensato per una ricerca reale.",
      },
      {
        kicker: "Perché resta suo",
        title: "La sua attività, il suo tono, i suoi articoli",
        body: "Ogni articolo parte dal profilo del suo sito e dal tono del suo brand. Ciò che RepGet scrive è suo, e ciò che è pubblicato resta sul suo sito se disdice.",
      },
      {
        kicker: "Che cosa fa lei",
        title: "Controllare, modificare, decidere",
        body: "Corregga il profilo una volta, legga gli articoli quando vuole e scelga che cosa pubblicare. Ricerca, scrittura, controlli e pubblicazione li facciamo noi.",
      },
    ],
  },
  compare: {
    title: "Scrivere il blog in autonomia, e con RepGet",
    sub: "Il lavoro è lo stesso. La differenza è chi lo fa ogni settimana.",
    yourself: {
      label: "In autonomia",
      points: [
        "Indovinare i temi, o imparare prima uno strumento per le parole chiave",
        "Leggere ciò che è già posizionato prima di ogni articolo",
        "Scrivere, correggere e impaginare ogni articolo a mano",
        "Verificare personalmente ogni dato e ogni link",
        "Copiare ogni articolo nel sito per pubblicarlo",
        "Ripartire da una pagina bianca la settimana dopo",
      ],
    },
    repget: {
      label: "Con RepGet",
      points: [
        "Temi dalla ricerca di parole chiave sul suo mercato",
        "Ogni articolo documentato dalle pagine che Google mostra per quella ricerca",
        "Scritto nella sua lingua e con il suo tono, con titoli, elenchi e, se li vuole, tabelle e FAQ",
        "Fonti citate per esteso, link solo alle sue pagine che esistono",
        "Pubblicato sul suo sito una volta collegato, o tenuto come bozza",
        "Un piano che continua ogni mese, entro gli articoli del suo piano",
      ],
    },
  },
  steps: {
    eyebrow: "Come funziona",
    title: "Dal suo sito agli articoli pubblicati in tre passaggi",
    sub: "Ogni passaggio si può controllare e correggere, perché ogni articolo poggia sul precedente.",
    items: [
      {
        title: "Leggiamo il suo sito",
        body: "RepGet legge il suo sito e prepara il profilo: che cosa offre, a chi, il suo mercato, la sua lingua e i suoi concorrenti. Può correggere ogni campo.",
        tags: ["Servizi", "Pubblico", "Mercato", "Lingua", "Concorrenti"],
      },
      {
        title: "Ricerchiamo le parole chiave e pianifichiamo i contenuti",
        body: "La ricerca di parole chiave sul suo mercato trova le ricerche dei suoi clienti. Quelle pertinenti e realistiche vengono prima di quelle molto contese, e diventano il suo piano editoriale.",
        tags: ["Parole chiave", "Intento di ricerca", "Piano editoriale"],
      },
      {
        title: "Scriviamo, verifichiamo e pubblichiamo",
        body: "Ogni articolo è documentato dalle pagine che Google mostra per la sua ricerca, scritto nella sua lingua, verificato rispetto alle fonti e nei link, poi pubblicato sul suo sito o tenuto come bozza.",
        tags: ["Ricerca", "Scrittura", "Controlli", "Pubblicazione"],
      },
    ],
  },
  quality: {
    eyebrow: "Criteri di qualità",
    title: "Che cosa si chiede a ogni articolo",
    sub: "Le regole che segue la scrittura e i controlli che l’articolo supera prima di essere pronto.",
    items: [
      {
        title: "Risponde alla ricerca",
        body: "Pensato per l’intento della ricerca, che il lettore voglia capire, confrontare o comprare, e per il tipo di pagina che Google mostra già.",
      },
      {
        title: "Prima la risposta",
        body: "La domanda trova risposta all’inizio, prima di ogni contesto. Niente introduzioni di riempimento né riassunti finali che ripetono l’articolo.",
      },
      {
        title: "Fonti citate per esteso",
        body: "Un dato ricercato cita la sua fonte accanto all’affermazione. Statistiche, prezzi, date e citazioni non vengono mai inventati.",
      },
      {
        title: "Il suo tono e i suoi fatti",
        body: "Scritto con il tono del suo brand e a partire dal suo profilo. Non dice mai che offre qualcosa che i suoi servizi non includono.",
      },
      {
        title: "Facile da scorrere",
        body: "Titoli e sottotitoli che il lettore cerca, paragrafi brevi, elenchi dove aiutano e, se attivate per il suo sito, tabelle di confronto e FAQ.",
      },
      {
        title: "Link che portano a qualcosa di reale",
        body: "Link interni solo a pagine verificate sul suo sito. I link ad altri siti vengono tolti, tranne un link della rete partner e i suoi profili social.",
      },
    ],
  },
  brand: {
    eyebrow: "Coerenza con il brand",
    title: "Scritto come la sua attività, non come un’IA generica",
    body: "Ogni articolo è scritto con ciò che RepGet sa della sua attività, ed è ciò che lei vede e può cambiare: il profilo, il tono del brand e i fatti che conferma. Non prometterà mai un servizio che non ha in elenco.",
    points: [
      "Servizi, pubblico e mercato, presi dal suo sito",
      "Un tono di brand che decide lei e può cambiare quando vuole",
      "I fatti che conferma, usati come li ha scritti",
      "Ogni articolo modificabile prima di qualsiasi pubblicazione",
    ],
    storyLink: "Veda come Image Studio usa RepGet",
  },
  sample: {
    eyebrow: "Esempio di scrittura",
    title: "Com’è fatto un articolo",
    sub: "Un estratto completo nella forma in cui scrive RepGet: la risposta, un indice, titoli, un’immagine con testo alternativo e una breve FAQ.",
    badge: "Esempio di scrittura",
    disclaimer: "Scritto per mostrare il formato, per un fotografo di matrimoni. Non è un articolo pubblicato e non mostra risultati.",
    englishNote: "L’esempio è in inglese; RepGet scrive nella lingua del suo sito.",
    tldr: "In breve",
    contents: "Indice",
    checklistTitle: "Pronto per la ricerca",
    checklist: [
      { title: "Prima la risposta", body: "Il riassunto e il primo paragrafo rispondono alla domanda prima di ogni contesto." },
      { title: "FAQ pronte per il markup", body: "Domande con le parole del lettore, ognuna con una risposta breve che un plugin SEO può marcare come dati FAQ." },
      { title: "Testo alternativo", body: "Ogni immagine ha un testo alternativo che dice che cosa mostra." },
      { title: "Link interni", body: "Solo a pagine verificate sul suo sito. Questo esempio non ne ha, perché non è su un sito." },
    ],
    statsTitle: "Misurato su questo esempio",
    stats: {
      words: "Parole",
      sections: "Sezioni (H2)",
      subheadings: "Sottotitoli (H3)",
      questions: "Domande della FAQ",
      picturesWithAlt: "Immagini con testo alternativo",
      outsideLinks: "Link ad altri siti",
    },
  },
  platform: {
    eyebrow: "La piattaforma",
    title: "Gli articoli sono uno di cinque strumenti",
    sub: "RepGet ha cinque strumenti: Articoli, Backlink, Visibilità IA, Social e Salute del sito. Growth Copilot è l’assistente che li gestisce con lei.",
    copilot: {
      title: "Growth Copilot",
      body: "Chieda idee, un piano o i prossimi passi sui cinque strumenti in un’unica conversazione, poi decida che cosa approvare.",
    },
    tools: [
      { title: "Backlink", body: "Link al suo sito inseriti in nuovi articoli sui siti di attività affini, ognuno verificato sulla pagina pubblicata.", link: "Scopra i backlink" },
      { title: "Visibilità IA", body: "Veda se gli assistenti IA nominano la sua attività quando ricevono le domande dei suoi clienti.", link: "Scopra la visibilità IA" },
      { title: "Social", body: "Trasformi un articolo o un’idea in post per i suoi canali social, e controlli ognuno prima della pubblicazione.", link: "Veda le funzioni" },
      { title: "Salute del sito", body: "Trovi i problemi tecnici delle sue pagine e veda che cosa correggere prima, con parole semplici.", link: "Faccia il controllo gratuito" },
    ],
  },
  midCta: {
    title: "Veda il suo piano editoriale",
    body: "Aggiunga il suo sito e RepGet prepara il profilo e un piano di articoli da scrivere.",
    cta: "Inizi gratis",
  },
  pricing: {
    eyebrow: "Prezzi",
    title: "Inizi gratis, passi a un piano superiore quando vuole più articoli",
    sub: "Gli stessi piani e gli stessi prezzi della pagina dei prezzi.",
    perMonth: "/ mese",
    articles: "{n} articoli al mese",
    launchPrice: "Prezzo di lancio",
    freeNote: "Senza carta di credito",
    cta: "Inizi gratis",
    seeAll: "Confronti tutti i piani",
    unavailable: "I piani sono nella pagina dei prezzi.",
  },
  agency: {
    eyebrow: "Più siti",
    title: "Gestisce più di un sito, o quelli dei suoi clienti?",
    body: "Aggiunga ogni sito a un unico account. Ognuno ha il suo profilo, il suo tono di brand, la sua lingua e il suo piano editoriale, così gli articoli di un sito non prendono mai in prestito la voce di un altro.",
    cta: "Ne parliamo",
  },
  faq: {
    title: "Domande sul redattore di blog con IA",
    items: [
      {
        question: "Google penalizza gli articoli scritti con l’IA?",
        answer:
          "Google afferma di premiare i contenuti utili, comunque siano prodotti, e di intervenire sui contenuti creati soprattutto per manipolare il posizionamento. RepGet scrive ogni articolo per rispondere a una ricerca reale, partendo dalle fonti, e lei può leggerlo prima della pubblicazione. Nessuno può garantire un posizionamento.",
      },
      {
        question: "Conservo i miei articoli se disdico?",
        answer: "Sì. Gli articoli che RepGet scrive per lei sono suoi, e ciò che è già pubblicato sul suo sito resta lì dopo la disdetta.",
      },
      {
        question: "In quali lingue può scrivere?",
        answer: "{languages}. Ogni sito ha la sua lingua, e i suoi articoli vengono scritti in quella lingua invece di essere tradotti dall’inglese.",
      },
      {
        question: "Su quali piattaforme può pubblicare?",
        answer:
          "WordPress, con il plugin RepGet o con una password per le applicazioni, Shopify, Webflow, Wix e Ghost. Qualsiasi altro sistema può ricevere gli articoli finiti tramite webhook. Ognuna ha la sua guida di configurazione.",
      },
      {
        question: "Quanti articoli ricevo ogni mese?",
        answer: "Il piano Free include {free} articoli al mese.{paid} La pagina dei prezzi elenca tutto ciò che include ogni piano.",
      },
      {
        question: "Posso modificare un articolo prima della pubblicazione?",
        answer:
          "Sì. Gli articoli vanno sul suo sito solo se lo collega e sceglie di pubblicare. Altrimenti restano bozze che può modificare, nella forma, nel tono e nei fatti, e pubblicare personalmente.",
      },
      {
        question: "Da dove vengono i fatti, e inserisce link ad altri siti?",
        answer:
          "Dalle pagine che RepGet legge per quella ricerca, con la fonte citata per esteso accanto all’affermazione. Gli articoli non hanno link ad altri siti, tranne un link della rete partner e i suoi profili social, e i link interni vanno solo a pagine verificate sul suo sito.",
      },
      {
        question: "Gli articoli suoneranno come la mia attività?",
        answer:
          "Sono scritti a partire dal profilo del suo sito e dal tono del suo brand, che può cambiare quando vuole. Li legga comunque prima della pubblicazione: nessuno conosce la sua attività meglio di lei.",
      },
      {
        question: "Devo sapere qualcosa di SEO?",
        answer: "No. RepGet ricerca ciò che cercano i suoi clienti, pianifica gli articoli e li scrive. Lei decide che cosa pubblicare.",
      },
      {
        question: "Quanto tempo prima che gli articoli portino visitatori?",
        answer:
          "La SEO richiede tempo. Le nuove pagine di solito hanno bisogno di due-quattro mesi per iniziare ad attirare visitatori, e nei mercati competitivi può volerci di più. RepGet misura i progressi invece di promettere posizionamenti.",
      },
    ],
    paid: " Con i piani a pagamento: {list}.",
    paidItem: "{n} con {name}",
  },
  closing: {
    title: "Dia al suo blog un redattore che non salta una settimana",
    body: "Inizi con il piano Free, veda il suo primo piano editoriale e i suoi articoli, e passi a un piano superiore quando vuole di più.",
  },
};

const de: AiBlogWriterCopy = {
  metaTitle: "KI-Blogautor für SEO-Artikel in Ihrer Sprache",
  metaDescription:
    "RepGet plant Themen per Keyword-Recherche, schreibt SEO-Artikel in Ihrer Sprache und Markenstimme, prüft sie und veröffentlicht sie auf Ihrer Website.",
  hero: {
    eyebrow: "KI-Blogautor",
    title: "Ein KI-Blogautor, der recherchiert, schreibt",
    accent: "und Ihre Artikel veröffentlicht.",
    intro:
      "RepGet findet heraus, wonach Ihre Kunden suchen, schreibt jeden Artikel in Ihrer Sprache und Markenstimme, prüft ihn und veröffentlicht ihn auf Ihrer Website. Die Antwort steht am Anfang und Quellen werden genannt, damit Leser, Suchmaschinen und KI-Assistenten finden, was sie suchen.",
    primaryCta: "Kostenlos starten",
    secondaryCta: "Den kostenlosen Blog-Writer testen",
    note: "Free-Plan · Keine Kreditkarte",
  },
  values: {
    title: "Ein Blog, der weiterläuft, ohne dass Sie ihn schreiben",
    items: [
      {
        kicker: "Was Sie bekommen",
        title: "Artikel zu dem, wonach Ihre Kunden suchen",
        body: "Ein Content-Plan aus der Keyword-Recherche für Ihren Markt und daraus geschriebene Artikel, jeder für eine echte Suche geplant.",
      },
      {
        kicker: "Warum er Ihrer bleibt",
        title: "Ihr Unternehmen, Ihre Stimme, Ihre Artikel",
        body: "Jeder Artikel beginnt beim Profil Ihrer Website und Ihrer Markenstimme. Was RepGet schreibt, gehört Ihnen, und Veröffentlichtes bleibt auf Ihrer Website, wenn Sie kündigen.",
      },
      {
        kicker: "Was Sie tun",
        title: "Prüfen, bearbeiten, entscheiden",
        body: "Korrigieren Sie das Profil einmal, lesen Sie Artikel, wann Sie möchten, und entscheiden Sie, was online geht. Recherche, Schreiben, Prüfung und Veröffentlichung übernehmen wir.",
      },
    ],
  },
  compare: {
    title: "Den Blog selbst schreiben, und mit RepGet",
    sub: "Die Arbeit ist dieselbe. Der Unterschied ist, wer sie jede Woche macht.",
    yourself: {
      label: "Auf eigene Faust",
      points: [
        "Themen raten oder erst ein Keyword-Tool lernen",
        "Vor jedem Artikel lesen, was schon gut rankt",
        "Jeden Beitrag von Hand schreiben, überarbeiten und formatieren",
        "Jede Angabe und jeden Link selbst prüfen",
        "Jeden Artikel zum Veröffentlichen in die Website kopieren",
        "Nächste Woche wieder vor einer leeren Seite sitzen",
      ],
    },
    repget: {
      label: "Mit RepGet",
      points: [
        "Themen aus der Keyword-Recherche für Ihren eigenen Markt",
        "Jeder Artikel recherchiert aus den Seiten, die Google für seine Suche zeigt",
        "In Ihrer Sprache und Stimme geschrieben, mit Zwischenüberschriften, Listen und auf Wunsch Tabellen und FAQ",
        "Quellen im Text genannt, Links nur zu Ihren Seiten, die es gibt",
        "Auf Ihrer Website veröffentlicht, sobald sie verbunden ist, oder als Entwurf gespeichert",
        "Ein Plan, der jeden Monat weitergeht, im Rahmen der Artikel Ihres Plans",
      ],
    },
  },
  steps: {
    eyebrow: "So funktioniert es",
    title: "Von Ihrer Website zu veröffentlichten Artikeln in drei Schritten",
    sub: "Jeder Schritt lässt sich prüfen und korrigieren, denn jeder Artikel baut auf dem vorherigen auf.",
    items: [
      {
        title: "Wir lesen Ihre Website",
        body: "RepGet liest Ihre Website und erstellt ihr Profil: was Sie anbieten, für wen, Ihren Markt, Ihre Sprache und Ihre Wettbewerber. Jedes Feld können Sie korrigieren.",
        tags: ["Leistungen", "Zielgruppe", "Markt", "Sprache", "Wettbewerber"],
      },
      {
        title: "Wir recherchieren Keywords und planen Ihre Inhalte",
        body: "Die Keyword-Recherche für Ihren Markt findet die Suchen Ihrer Kunden. Relevante, realistische Suchen kommen vor sehr umkämpften und werden zu Ihrem Content-Plan.",
        tags: ["Keyword-Recherche", "Suchintention", "Content-Plan"],
      },
      {
        title: "Wir schreiben, prüfen und veröffentlichen",
        body: "Jeder Artikel wird aus den Seiten recherchiert, die Google für seine Suche zeigt, in Ihrer Sprache geschrieben, mit seiner Recherche abgeglichen und auf seine Links geprüft und dann auf Ihrer Website veröffentlicht oder als Entwurf gespeichert.",
        tags: ["Recherche", "Schreiben", "Prüfung", "Veröffentlichung"],
      },
    ],
  },
  quality: {
    eyebrow: "Qualitätskriterien",
    title: "Woran sich jeder Artikel messen lässt",
    sub: "Regeln, denen das Schreiben folgt, und Prüfungen, die der Artikel besteht, bevor er fertig ist.",
    items: [
      {
        title: "Passt zur Suche",
        body: "Geplant für die Absicht hinter der Suche, ob der Leser etwas lernen, vergleichen oder kaufen will, und für die Art Seite, die Google dafür bereits zeigt.",
      },
      {
        title: "Die Antwort zuerst",
        body: "Die Frage wird gleich zu Beginn beantwortet, vor jedem Hintergrund. Keine Füllsätze zum Einstieg und keine Zusammenfassung, die den Artikel wiederholt.",
      },
      {
        title: "Quellen im Text genannt",
        body: "Eine recherchierte Angabe nennt ihre Quelle direkt neben der Aussage. Statistiken, Preise, Daten und Zitate werden nie erfunden.",
      },
      {
        title: "Ihre Stimme und Ihre Fakten",
        body: "In Ihrer Markenstimme und aus Ihrem Profil geschrieben. Er behauptet nie, dass Sie etwas anbieten, das Ihre Leistungen nicht umfassen.",
      },
      {
        title: "Gut zu überfliegen",
        body: "Zwischenüberschriften, nach denen Leser suchen, kurze Absätze, Listen, wo sie helfen, und, wenn für Ihre Website aktiviert, Vergleichstabellen und FAQ.",
      },
      {
        title: "Links, die wirklich irgendwohin führen",
        body: "Interne Links nur zu Seiten, deren Existenz auf Ihrer Website geprüft ist. Links zu anderen Websites werden entfernt, außer einem Link aus dem Partnernetzwerk und Ihren eigenen Social-Media-Profilen.",
      },
    ],
  },
  brand: {
    eyebrow: "Markentreue",
    title: "Geschrieben wie Ihr Unternehmen, nicht wie eine beliebige KI",
    body: "Jeder Artikel entsteht aus dem, was RepGet über Ihr Unternehmen weiß, und genau das sehen und ändern Sie: Ihr Profil, Ihre Markenstimme und die Fakten, die Sie bestätigen. Er verspricht nie eine Leistung, die Sie nicht aufführen.",
    points: [
      "Ihre Leistungen, Zielgruppe und Ihr Markt, von Ihrer eigenen Website",
      "Eine Markenstimme, die Sie festlegen und jederzeit ändern können",
      "Bestätigte Fakten, so verwendet, wie Sie sie geschrieben haben",
      "Jeder Artikel bearbeitbar, bevor etwas veröffentlicht wird",
    ],
    storyLink: "So nutzt Image Studio RepGet",
  },
  sample: {
    eyebrow: "Schreibprobe",
    title: "So sieht ein Artikel aus",
    sub: "Ein vollständiger Auszug in der Form, in der RepGet schreibt: die Antwort, ein Inhaltsverzeichnis, Zwischenüberschriften, ein Bild mit Alternativtext und eine kurze FAQ.",
    badge: "Schreibprobe",
    disclaimer: "Geschrieben, um das Format zu zeigen, für einen Hochzeitsfotografen. Kein veröffentlichter Artikel, und er zeigt keine Ergebnisse.",
    englishNote: "Die Probe ist auf Englisch; RepGet schreibt in der Sprache Ihrer Website.",
    tldr: "Kurz gesagt",
    contents: "Inhalt",
    checklistTitle: "Bereit für die Suche",
    checklist: [
      { title: "Die Antwort zuerst", body: "Die Kurzfassung und der erste Absatz beantworten die Frage vor jedem Hintergrund." },
      { title: "FAQ bereit für Markup", body: "Fragen in den Worten der Leser, jede mit einer kurzen Antwort, die ein SEO-Plugin als FAQ-Daten auszeichnen kann." },
      { title: "Alternativtext", body: "Jedes Bild hat einen Alternativtext, der sagt, was es zeigt." },
      { title: "Interne Links", body: "Nur zu Seiten, deren Existenz auf Ihrer Website geprüft ist. Diese Probe hat keine, weil sie auf keiner Website steht." },
    ],
    statsTitle: "Gemessen an dieser Probe",
    stats: {
      words: "Wörter",
      sections: "Abschnitte (H2)",
      subheadings: "Unterüberschriften (H3)",
      questions: "FAQ-Fragen",
      picturesWithAlt: "Bilder mit Alternativtext",
      outsideLinks: "Links zu anderen Websites",
    },
  },
  platform: {
    eyebrow: "Die Plattform",
    title: "Artikel sind eines von fünf Tools",
    sub: "RepGet hat fünf Tools: Artikel, Backlinks, KI-Sichtbarkeit, Social Media und Website-Zustand. Growth Copilot ist der Assistent, der sie mit Ihnen steuert.",
    copilot: {
      title: "Growth Copilot",
      body: "Fragen Sie in einem einzigen Gespräch nach Ideen, einem Plan oder den nächsten Schritten für alle fünf Tools, und entscheiden Sie dann, was Sie freigeben.",
    },
    tools: [
      { title: "Backlinks", body: "Links zu Ihrer Website in neuen Artikeln auf Websites verwandter Unternehmen, jeder auf der Live-Seite geprüft.", link: "Mehr zu Backlinks" },
      { title: "KI-Sichtbarkeit", body: "Sehen Sie, ob KI-Assistenten Ihr Unternehmen nennen, wenn man ihnen die Fragen Ihrer Kunden stellt.", link: "Mehr zur KI-Sichtbarkeit" },
      { title: "Social Media", body: "Machen Sie aus einem Artikel oder einer Idee Beiträge für Ihre Kanäle, und prüfen Sie jeden, bevor er erscheint.", link: "Die Funktionen ansehen" },
      { title: "Website-Zustand", body: "Finden Sie die technischen Probleme Ihrer Seiten und sehen Sie in einfachen Worten, was zuerst zu beheben ist.", link: "Kostenlosen Check starten" },
    ],
  },
  midCta: {
    title: "Sehen Sie Ihren eigenen Content-Plan",
    body: "Fügen Sie Ihre Website hinzu, und RepGet erstellt ihr Profil und einen Plan der zu schreibenden Artikel.",
    cta: "Kostenlos starten",
  },
  pricing: {
    eyebrow: "Preise",
    title: "Kostenlos starten, upgraden, wenn Sie mehr Artikel möchten",
    sub: "Dieselben Pläne und Preise wie auf der Preisseite.",
    perMonth: "/ Monat",
    articles: "{n} Artikel pro Monat",
    launchPrice: "Einführungspreis",
    freeNote: "Keine Kreditkarte",
    cta: "Kostenlos starten",
    seeAll: "Alle Pläne vergleichen",
    unavailable: "Die Pläne finden Sie auf der Preisseite.",
  },
  agency: {
    eyebrow: "Mehrere Websites",
    title: "Sie betreuen mehr als eine Website, oder die Ihrer Kunden?",
    body: "Fügen Sie jede Website einem einzigen Konto hinzu. Jede hat ihr eigenes Profil, ihre Markenstimme, ihre Sprache und ihren Content-Plan, damit die Artikel einer Website nie die Stimme einer anderen leihen.",
    cta: "Sprechen Sie mit uns",
  },
  faq: {
    title: "Fragen zum KI-Blogautor",
    items: [
      {
        question: "Bestraft Google Artikel, die mit KI geschrieben wurden?",
        answer:
          "Google sagt, es belohne hilfreiche Inhalte, egal wie sie entstehen, und gehe gegen Inhalte vor, die vor allem das Ranking manipulieren sollen. RepGet schreibt jeden Artikel aus einer Recherche heraus, um eine echte Suche zu beantworten, und Sie können ihn lesen, bevor er online geht. Ein Ranking kann niemand garantieren.",
      },
      {
        question: "Behalte ich meine Artikel, wenn ich kündige?",
        answer: "Ja. Die Artikel, die RepGet für Sie schreibt, gehören Ihnen, und was bereits auf Ihrer Website veröffentlicht ist, bleibt dort auch nach der Kündigung.",
      },
      {
        question: "In welchen Sprachen kann er schreiben?",
        answer: "{languages}. Jede Website hat ihre eigene Sprache, und ihre Artikel werden in dieser Sprache geschrieben, nicht aus dem Englischen übersetzt.",
      },
      {
        question: "Auf welchen Plattformen kann er veröffentlichen?",
        answer:
          "WordPress, mit dem RepGet-Plugin oder einem Anwendungspasswort, Shopify, Webflow, Wix und Ghost. Jedes andere System kann fertige Artikel über einen Webhook empfangen. Für jede gibt es eine Einrichtungsanleitung.",
      },
      {
        question: "Wie viele Artikel bekomme ich pro Monat?",
        answer: "Der Free-Plan enthält {free} Artikel pro Monat.{paid} Die Preisseite zeigt alles, was jeder Plan enthält.",
      },
      {
        question: "Kann ich einen Artikel vor der Veröffentlichung bearbeiten?",
        answer:
          "Ja. Artikel kommen nur auf Ihre Website, wenn Sie sie verbinden und veröffentlichen möchten. Sonst bleiben sie Entwürfe, die Sie in Wortwahl, Ton und Fakten bearbeiten und selbst veröffentlichen können.",
      },
      {
        question: "Woher kommen die Fakten, und verlinkt er auf andere Websites?",
        answer:
          "Aus Seiten, die RepGet für diese Suche liest, mit der Quelle im Text direkt neben der Aussage. Artikel verlinken nicht auf andere Websites, außer mit einem Link aus dem Partnernetzwerk und zu Ihren eigenen Social-Media-Profilen, und interne Links führen nur zu Seiten, deren Existenz auf Ihrer Website geprüft ist.",
      },
      {
        question: "Klingen die Artikel nach meinem Unternehmen?",
        answer:
          "Sie entstehen aus dem Profil Ihrer Website und Ihrer Markenstimme, die Sie jederzeit ändern können. Lesen Sie sie trotzdem vor der Veröffentlichung: Niemand kennt Ihr Unternehmen besser als Sie.",
      },
      {
        question: "Muss ich mich mit SEO auskennen?",
        answer: "Nein. RepGet recherchiert, wonach Ihre Kunden suchen, plant die Artikel und schreibt sie. Sie entscheiden, was veröffentlicht wird.",
      },
      {
        question: "Wie lange dauert es, bis Artikel Besucher bringen?",
        answer:
          "SEO braucht Zeit. Neue Seiten brauchen häufig zwei bis vier Monate, bis sie Besucher anziehen, in umkämpften Märkten auch länger. RepGet verfolgt den Fortschritt, statt Rankings zu versprechen.",
      },
    ],
    paid: " In den bezahlten Plänen: {list}.",
    paidItem: "{n} mit {name}",
  },
  closing: {
    title: "Geben Sie Ihrem Blog einen Autor, der keine Woche auslässt",
    body: "Starten Sie mit dem Free-Plan, sehen Sie Ihren ersten Content-Plan und Ihre Artikel, und upgraden Sie, wenn Sie mehr möchten.",
  },
};

const COPY: Record<Locale, AiBlogWriterCopy> = { en, es, fr, it, de };

export function aiBlogWriterCopy(locale: Locale): AiBlogWriterCopy {
  return COPY[locale];
}

/**
 * The page's name in the footer, in each language: the only words of this
 * file the header and footer need, so site-chrome.ts passes these and never
 * the rest (the footer is a client component).
 */
export const AI_BLOG_WRITER_LINK_LABEL: Record<Locale, string> = {
  en: "AI Blog Writer",
  es: "Redactor de blog con IA",
  fr: "Rédacteur de blog IA",
  it: "Redattore di blog con IA",
  de: "KI-Blogautor",
};
