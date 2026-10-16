import type { Locale } from "@/lib/i18n/config";

/**
 * The first case study: Image Studio (client, 2026-10-15: "Create one case
 * study ... featuring the imagestudio website"; "Replace this with a credible,
 * professional case-study structure using Image Studio as our first
 * documented example").
 *
 * A LIVE case study, not a results page: RepGet started on imagestudio.com on
 * 1 October 2026, two weeks before this was written, which is too early to
 * credit any change in Google to it. So the page records the real starting
 * point and what RepGet did, and adds the results on the 1st of every month.
 *
 * The rules it keeps, agreed with the client on 2026-10-15:
 * - Only what a RepGet plan does. The site-speed and technical work done by
 *   hand on imagestudio.com is left out: a customer could not buy it.
 * - It says that Image Studio and RepGet have the same owner. Without that the
 *   page reads as an independent customer's story, which advertising rules
 *   treat as misleading; with it, it reads as what it is.
 * - Real numbers only, each with its source (the chart is drawn from them,
 *   never generated). The figures come from Image Studio's own Google Search
 *   Console as RepGet imports it, and from RepGet's records for the site.
 *
 * MONTHLY UPDATE: change IMAGE_STUDIO (updated, nextUpdate, dataTo, weeks,
 * writtenArticles, liveArticles, aiChecks, aiMentions...) and, in every
 * language, the sentences written for this month: resultsBody and next, and
 * the ones the guard tests in case-study.render.test.ts name when a count
 * they depend on changes - "in two weeks" (figures.written), "no mentions
 * yet" (figures.ai, aiStart), "the two that are live" (faq). dayOne, the
 * audit and the baseline are the starting point and do not change.
 */

export const CASE_STUDY_PATH = "/success-stories/image-studio";

/** The homepage testimonial (Admin -> Testimonials) whose card links here, by its name. */
export const CASE_STUDY_TESTIMONIAL = "Image Studio";

export type CaseStudyWeek = {
  /** Monday the week starts on. */
  start: string;
  clicks: number;
  impressions: number;
  position: number;
};

export const IMAGE_STUDIO = {
  site: "https://imagestudio.com",
  owner: "Dimitri Kuliuk",
  /** RepGet's first day on the site. */
  started: "2026-10-01",
  /** When this page was first published (structured data's datePublished). */
  published: "2026-10-15",
  /** When these numbers were read (the page's last update). */
  updated: "2026-10-15",
  nextUpdate: "2026-11-01",
  /** The last day of Search Console data imported. */
  dataTo: "2026-10-12",
  /** The first day of Search Console data imported. */
  dataFrom: "2026-07-30",
  /** The starting point: the eight full weeks before RepGet. */
  baselineFrom: "2026-08-03",
  baselineTo: "2026-09-27",
  baseline: { clicks: 71, impressions: 4500, position: 15 },
  /** The first day's work, quoted by the owner: fixed. */
  dayOne: { keywords: 291, plannedArticles: 35 },
  /** The content plan now. */
  plannedArticles: 35,
  writtenArticles: 16,
  writtenTo: "2026-10-14",
  /** The written articles' average length, rounded: 1,392 words on 15 October. */
  averageWords: 1400,
  /** RepGet's audit on the first day (the starting point; it does not change). */
  audit: { score: 94, pagesRead: 25, noindex: 2, longTitles: 7, thinPages: 1, minor: 20 },
  aiQuestions: 20,
  aiChecks: 59,
  /** Checks that named Image Studio. */
  aiMentions: 0,
  aiTo: "2026-10-12",
  /** Weekly Search Console figures, Monday to Sunday. */
  weeks: [
    { start: "2026-08-03", clicks: 41, impressions: 3076, position: 14.2 },
    { start: "2026-08-10", clicks: 59, impressions: 4377, position: 16.1 },
    { start: "2026-08-17", clicks: 105, impressions: 4827, position: 17.6 },
    { start: "2026-08-24", clicks: 65, impressions: 3495, position: 17.3 },
    { start: "2026-08-31", clicks: 75, impressions: 4370, position: 16.5 },
    { start: "2026-09-07", clicks: 61, impressions: 6100, position: 16.1 },
    { start: "2026-09-14", clicks: 89, impressions: 5202, position: 13.3 },
    { start: "2026-09-21", clicks: 70, impressions: 4671, position: 11.9 },
    { start: "2026-09-28", clicks: 87, impressions: 5607, position: 13.5 },
    { start: "2026-10-05", clicks: 146, impressions: 6303, position: 13.5 },
  ] satisfies CaseStudyWeek[],
  /** The articles live so far. Their titles are in English, as on the site. */
  liveArticles: [
    {
      title: "Wedding Video Cards vs Paper Invites",
      url: "https://imagestudio.com/editorial/post/wedding-video-cards-vs-paper-invites-which-to-choose/",
      live: "2026-10-06",
    },
    {
      title: "Renting a Photo Studio in NY",
      url: "https://imagestudio.com/renting-a-photo-studio-in-ny-costs-and-top-picks/",
      live: "2026-10-01",
    },
  ],
};

export type CaseStudyCopy = {
  metaTitle: string;
  metaDescription: string;
  /** {date}: the first day. */
  eyebrow: string;
  title: string;
  lede: string;
  /** Image Studio and RepGet have the same owner - always shown, near the top. */
  disclosure: string;
  /** {date}, {next} */
  updated: string;
  figures: {
    keywords: string;
    planned: string;
    /** {live}, {scheduled} */
    written: string;
    ai: string;
    clicks: string;
    position: string;
  };
  clientTitle: string;
  client: string[];
  servicesLabel: string;
  services: string;
  buyersLabel: string;
  buyers: string;
  startTitle: string;
  /** {from}, {to} */
  startIntro: string;
  baseline: { clicks: string; impressions: string; position: string };
  /** {date}, {score}, {pages} */
  auditIntro: string;
  /** {noindex}, {titles}, {thin}, {minor} - worded for the first-day counts (2, 7, 1, 20), which do not change. */
  auditFindings: string[];
  /** {questions}, {checks}, {from}, {to} */
  aiStart: string;
  doneTitle: string;
  steps: {
    /** when: {date}; body: {keywords}, {planned} */
    plan: { when: string; title: string; body: string };
    /** when: {from}, {to}; title: {written}; body: {words}, {live}; rest: {scheduled} */
    articles: { when: string; title: string; body: string; rest: string };
    /** when: {date}; body: {questions} */
    ai: { when: string; title: string; body: string };
  };
  resultsTitle: string;
  chartTitle: string;
  /** For screen readers: {from}, {to}, {min}, {max}, {last}, {lastWeek} */
  chartLabel: string;
  /** {date} */
  startMarker: string;
  /** {date} */
  chartCaption: string;
  showNumbers: string;
  columns: { week: string; clicks: string; impressions: string; position: string };
  /** The month's reading: {week}, {clicks}, {position}, {before}, {first}, {second}, {next} */
  resultsBody: string;
  quoteLabel: string;
  /** {keywords}, {planned} */
  quote: string;
  /** {name} */
  quoteBy: string;
  nextTitle: string;
  /** {scheduled}, {next} */
  next: string[];
  ctaTitle: string;
  ctaBody: string;
  ctaPrimary: string;
  ctaSecondary: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
  sourcesTitle: string;
  /** {from}, {to}, {date} */
  sources: string[];
  /** The case study's card on /success-stories. meta: {start}, {updated} */
  card: { label: string; summary: string; cta: string; meta: string };
};

export const CASE_STUDY_COPY: Record<Locale, CaseStudyCopy> = {
  en: {
    metaTitle: "Image Studio case study",
    metaDescription:
      "A Rome and Milan film studio on RepGet, tracked in public: the starting point, what RepGet did and the results, updated on the 1st of every month.",
    eyebrow: "Case study · started {date}",
    title: "Image Studio: a Rome and Milan film studio on RepGet, tracked in public from day one",
    lede: "We are documenting RepGet's work on imagestudio.com as it happens: where the site started, what RepGet did, and what changed. This page is updated on the 1st of every month, good news or not.",
    disclosure:
      "Image Studio and RepGet have the same owner. That is why it was the first site on RepGet, and why we can show its numbers in full.",
    updated: "Updated {date} · next update {next}",
    figures: {
      keywords: "keywords researched on day one",
      planned: "articles in the content plan",
      written: "articles written in two weeks ({live} live, {scheduled} scheduled)",
      ai: "AI questions tracked (no mentions yet)",
      clicks: "clicks a week from Google at the start",
      position: "average position in Google at the start",
    },
    clientTitle: "The client",
    client: [
      "Image Studio is a creative production company for cinematic photography and film: destination weddings, commercial campaigns, editorial work and music videos. The studio is based in Rome and Milan and works across Italy and abroad.",
      "Its website, imagestudio.com, runs on WordPress in English and Italian, with a portfolio, an editorial blog and an online academy.",
    ],
    servicesLabel: "Services",
    services:
      "Destination weddings, commercial and branded content, social media production, music videos, editorial photography, drone cinematography, documentaries",
    buyersLabel: "Buyers",
    buyers: "Couples planning a wedding in Italy, international brands, luxury hotels, restaurants, architects and musicians",
    startTitle: "Where the site started",
    startIntro: "Google Search Console, {from} to {to}, the eight full weeks before RepGet:",
    baseline: {
      clicks: "clicks from Google a week",
      impressions: "appearances in Google results a week",
      position: "average position in results",
    },
    auditIntro: "RepGet's audit on {date} scored the site {score} out of 100 on the {pages} pages it read. It found:",
    auditFindings: [
      "{noindex} pages kept out of Google by a noindex tag.",
      "{titles} page titles too long for Google's results, and {thin} page with too little text.",
      "{minor} smaller items, such as meta descriptions that run too long and pages without a canonical tag.",
    ],
    aiStart:
      "It also confirmed that the crawlers of ChatGPT, Claude, Perplexity and Gemini can read the site. Asked {questions} questions a buyer might put to an AI assistant, Claude mentioned Image Studio in none of {checks} checks ({from} to {to}).",
    doneTitle: "What RepGet did",
    steps: {
      plan: {
        when: "{date}",
        title: "Audit, keywords and a plan",
        body: "RepGet audited the site, researched {keywords} keywords and planned {planned} articles around what Image Studio's buyers search for.",
      },
      articles: {
        when: "{from} – {to}",
        title: "{written} articles written",
        body: "About {words} words each. {live} are live:",
        rest: "The other {scheduled} go live on the publishing schedule.",
      },
      ai: {
        when: "From {date}",
        title: "AI visibility tracked",
        body: "The same {questions} questions are put to an AI assistant regularly, so the first mention will show up in the next check after it happens.",
      },
    },
    resultsTitle: "Results so far",
    chartTitle: "Clicks from Google, by week",
    chartLabel:
      "Weekly clicks from Google, {from} to {to}: between {min} and {max} a week before RepGet, {last} in the week of {lastWeek}.",
    startMarker: "RepGet starts, {date}",
    chartCaption: "Weeks start on Monday. Source: Image Studio's Google Search Console, imported by RepGet; data to {date}.",
    showNumbers: "Show the numbers",
    columns: { week: "Week of", clicks: "Clicks", impressions: "Appearances", position: "Avg position" },
    resultsBody:
      "The week of {week} brought {clicks} clicks, the most of any week shown, and the average position held at {position} against about {before} before. It is too early to credit that to the new articles: the first two went live on {first} and {second}, and Google takes weeks to rank new pages. The first full month will be reported here on {next}.",
    quoteLabel: "From the owner",
    quote:
      "Image Studio is my own studio, so it was the first site we put RepGet on: we wanted to see it work on a real business before asking anyone else to trust it. On day one we had an audit, {keywords} keywords and a plan for {planned} articles. From here, the numbers go on this page every month, whatever they show.",
    quoteBy: "{name}, owner of Image Studio and RepGet",
    nextTitle: "What comes next",
    next: [
      "The {scheduled} written articles go live on the regular publishing schedule.",
      "Each new article is sent to Google for indexing as it goes live.",
      "The first backlinks from related sites.",
      "On {next}, the first full month: clicks, positions, indexed articles and AI mentions, set against the starting point above.",
    ],
    ctaTitle: "See where your site starts",
    ctaBody: "The free audit is a shorter version of the audit Image Studio started with. It takes about a minute and needs no account.",
    ctaPrimary: "Run the free audit",
    ctaSecondary: "See plans",
    faqTitle: "Questions",
    faq: [
      {
        q: "Are these numbers real?",
        a: "Yes. Clicks, appearances and positions come from Image Studio's own Google Search Console. The audit, keyword, plan and article counts are RepGet's records. The chart is drawn from those numbers; it is not an illustration.",
      },
      {
        q: "Why is Image Studio the first case study?",
        a: "Image Studio and RepGet have the same owner, so it was the first site on RepGet and the one whose numbers we can show in full, including the weak ones.",
      },
      {
        q: "Why publish a case study after two weeks?",
        a: "So the starting point is on record before any results come in. Each month adds what changed, including what did not.",
      },
      {
        q: "Can I read the articles?",
        a: "Yes, the two that are live are linked above. The rest are added to this page as they are published.",
      },
    ],
    sourcesTitle: "Where the numbers come from",
    sources: [
      "Google Search Console for imagestudio.com, imported daily by RepGet, {from} to {to}.",
      "RepGet's records for imagestudio.com (audit, keywords, content plan, articles, AI checks), read on {date}.",
    ],
    card: {
      label: "Live case study",
      summary:
        "A Rome and Milan film studio, tracked from its first day on RepGet: the real starting point, the work, and the results month by month.",
      cta: "Read the case study",
      meta: "Started {start} · updated {updated}",
    },
  },

  es: {
    metaTitle: "Caso de estudio: Image Studio",
    metaDescription:
      "Un estudio de cine de Roma y Milán en RepGet, seguido en público: el punto de partida, lo que hizo RepGet y los resultados, actualizados cada mes.",
    eyebrow: "Caso de estudio · desde el {date}",
    title: "Image Studio: un estudio de cine de Roma y Milán en RepGet, seguido en público desde el primer día",
    lede: "Documentamos el trabajo de RepGet en imagestudio.com a medida que ocurre: de dónde partía el sitio, qué hizo RepGet y qué cambió. Esta página se actualiza el día 1 de cada mes, con buenas noticias o sin ellas.",
    disclosure:
      "Image Studio y RepGet tienen el mismo propietario. Por eso fue el primer sitio en RepGet y por eso podemos mostrar sus cifras completas.",
    updated: "Actualizado el {date} · próxima actualización: {next}",
    figures: {
      keywords: "palabras clave investigadas el primer día",
      planned: "artículos en el plan de contenidos",
      written: "artículos escritos en dos semanas ({live} publicados, {scheduled} programados)",
      ai: "preguntas a la IA en seguimiento (aún sin menciones)",
      clicks: "clics semanales desde Google al inicio",
      position: "posición media en Google al inicio",
    },
    clientTitle: "El cliente",
    client: [
      "Image Studio es una productora creativa de fotografía y cine: bodas de destino, campañas comerciales, trabajos editoriales y videoclips. El estudio tiene sede en Roma y Milán y trabaja en toda Italia y en el extranjero.",
      "Su sitio web, imagestudio.com, funciona con WordPress en inglés e italiano, con un portafolio, un blog editorial y una academia en línea.",
    ],
    servicesLabel: "Servicios",
    services:
      "Bodas de destino, contenido comercial y de marca, producción para redes sociales, videoclips, fotografía editorial, cinematografía con dron, documentales",
    buyersLabel: "Clientes",
    buyers: "Parejas que planean su boda en Italia, marcas internacionales, hoteles de lujo, restaurantes, arquitectos y músicos",
    startTitle: "De dónde partía el sitio",
    startIntro: "Google Search Console, del {from} al {to}, las ocho semanas completas antes de RepGet:",
    baseline: {
      clicks: "clics desde Google por semana",
      impressions: "apariciones en los resultados de Google por semana",
      position: "posición media en los resultados",
    },
    auditIntro: "La auditoría de RepGet del {date} dio al sitio {score} sobre 100 en las {pages} páginas que leyó. Encontró:",
    auditFindings: [
      "{noindex} páginas excluidas de Google por una etiqueta noindex.",
      "{titles} títulos de página demasiado largos para los resultados de Google y {thin} página con muy poco texto.",
      "{minor} detalles menores, como meta descripciones demasiado largas y páginas sin etiqueta canonical.",
    ],
    aiStart:
      "También confirmó que los rastreadores de ChatGPT, Claude, Perplexity y Gemini pueden leer el sitio. Ante {questions} preguntas que un cliente podría hacer a un asistente de IA, Claude no mencionó a Image Studio en ninguna de las {checks} comprobaciones (del {from} al {to}).",
    doneTitle: "Qué hizo RepGet",
    steps: {
      plan: {
        when: "{date}",
        title: "Auditoría, palabras clave y un plan",
        body: "RepGet auditó el sitio, investigó {keywords} palabras clave y planificó {planned} artículos en torno a lo que buscan los clientes de Image Studio.",
      },
      articles: {
        when: "{from} – {to}",
        title: "{written} artículos escritos",
        body: "Unas {words} palabras cada uno. {live} ya están publicados:",
        rest: "Los otros {scheduled} se publicarán según el calendario.",
      },
      ai: {
        when: "Desde el {date}",
        title: "Seguimiento de la visibilidad en IA",
        body: "Las mismas {questions} preguntas se plantean con regularidad a un asistente de IA, para que la primera mención aparezca en la siguiente comprobación después de producirse.",
      },
    },
    resultsTitle: "Resultados hasta ahora",
    chartTitle: "Clics desde Google, por semana",
    chartLabel:
      "Clics semanales desde Google, del {from} al {to}: entre {min} y {max} por semana antes de RepGet, {last} en la semana del {lastWeek}.",
    startMarker: "RepGet empieza, {date}",
    chartCaption:
      "Las semanas empiezan el lunes. Fuente: Google Search Console de Image Studio, importado por RepGet; datos hasta el {date}.",
    showNumbers: "Ver las cifras",
    columns: { week: "Semana del", clicks: "Clics", impressions: "Apariciones", position: "Posición media" },
    resultsBody:
      "La semana del {week} trajo {clicks} clics, la mejor de todas las mostradas, y la posición media se mantuvo en {position} frente a unos {before} antes. Es pronto para atribuirlo a los nuevos artículos: los dos primeros se publicaron el {first} y el {second}, y Google tarda semanas en posicionar páginas nuevas. El primer mes completo se publicará aquí el {next}.",
    quoteLabel: "Del propietario",
    quote:
      "Image Studio es mi propio estudio, así que fue el primer sitio en el que pusimos RepGet: queríamos verlo funcionar en un negocio real antes de pedir a nadie más que confiara en él. El primer día ya teníamos una auditoría, {keywords} palabras clave y un plan de {planned} artículos. A partir de ahora, las cifras se publican en esta página cada mes, sean las que sean.",
    quoteBy: "{name}, propietario de Image Studio y de RepGet",
    nextTitle: "Lo que viene",
    next: [
      "Los {scheduled} artículos ya escritos se publicarán según el calendario habitual.",
      "Cada artículo nuevo se enviará a Google para su indexación al publicarse.",
      "Los primeros backlinks desde sitios relacionados.",
      "El {next}, el primer mes completo: clics, posiciones, artículos indexados y menciones en IA, comparados con el punto de partida.",
    ],
    ctaTitle: "Vea de dónde parte su sitio",
    ctaBody: "La auditoría gratuita es una versión reducida de la auditoría con la que empezó Image Studio. Tarda un minuto y no necesita cuenta.",
    ctaPrimary: "Hacer la auditoría gratuita",
    ctaSecondary: "Ver planes",
    faqTitle: "Preguntas",
    faq: [
      {
        q: "¿Son reales estas cifras?",
        a: "Sí. Los clics, las apariciones y las posiciones proceden del propio Google Search Console de Image Studio. Las cifras de la auditoría, las palabras clave, el plan y los artículos son registros de RepGet. El gráfico se dibuja con esas cifras; no es una ilustración.",
      },
      {
        q: "¿Por qué Image Studio es el primer caso de estudio?",
        a: "Image Studio y RepGet tienen el mismo propietario, así que fue el primer sitio en RepGet y aquel cuyas cifras podemos mostrar completas, también las flojas.",
      },
      {
        q: "¿Por qué publicar un caso de estudio a las dos semanas?",
        a: "Para que el punto de partida quede registrado antes de que lleguen los resultados. Cada mes se añade lo que cambió, y también lo que no.",
      },
      {
        q: "¿Puedo leer los artículos?",
        a: "Sí, los dos publicados están enlazados arriba. Los demás se añadirán a esta página a medida que se publiquen.",
      },
    ],
    sourcesTitle: "De dónde salen las cifras",
    sources: [
      "Google Search Console de imagestudio.com, importado a diario por RepGet, del {from} al {to}.",
      "Registros de RepGet para imagestudio.com (auditoría, palabras clave, plan de contenidos, artículos, comprobaciones de IA), consultados el {date}.",
    ],
    card: {
      label: "Caso de estudio en curso",
      summary:
        "Un estudio de cine de Roma y Milán, seguido desde su primer día en RepGet: el punto de partida real, el trabajo y los resultados mes a mes.",
      cta: "Leer el caso de estudio",
      meta: "Desde el {start} · actualizado el {updated}",
    },
  },

  fr: {
    metaTitle: "Étude de cas : Image Studio",
    metaDescription:
      "Un studio de cinéma de Rome et de Milan sur RepGet, suivi en public : le point de départ, le travail de RepGet et les résultats, chaque mois.",
    eyebrow: "Étude de cas · depuis le {date}",
    title: "Image Studio : un studio de cinéma de Rome et de Milan sur RepGet, suivi en public dès le premier jour",
    lede: "Nous documentons le travail de RepGet sur imagestudio.com au fil de l'eau : le point de départ du site, ce que RepGet a fait et ce qui a changé. Cette page est mise à jour le 1er de chaque mois, que les nouvelles soient bonnes ou non.",
    disclosure:
      "Image Studio et RepGet ont le même propriétaire. C'est pourquoi il a été le premier site sur RepGet, et pourquoi nous pouvons en montrer tous les chiffres.",
    updated: "Mis à jour le {date} · prochaine mise à jour : {next}",
    figures: {
      keywords: "mots-clés étudiés le premier jour",
      planned: "articles dans le plan de contenu",
      written: "articles rédigés en deux semaines ({live} publiés, {scheduled} programmés)",
      ai: "questions IA suivies (aucune mention pour l'instant)",
      clicks: "clics par semaine depuis Google au départ",
      position: "position moyenne dans Google au départ",
    },
    clientTitle: "Le client",
    client: [
      "Image Studio est une société de production créative en photographie et cinéma : mariages à destination, campagnes commerciales, travaux éditoriaux et clips musicaux. Le studio est basé à Rome et à Milan et travaille dans toute l'Italie et à l'étranger.",
      "Son site, imagestudio.com, fonctionne sous WordPress en anglais et en italien, avec un portfolio, un blog éditorial et une académie en ligne.",
    ],
    servicesLabel: "Services",
    services:
      "Mariages à destination, contenus commerciaux et de marque, production pour les réseaux sociaux, clips musicaux, photographie éditoriale, prises de vue par drone, documentaires",
    buyersLabel: "Clients",
    buyers: "Couples qui préparent leur mariage en Italie, marques internationales, hôtels de luxe, restaurants, architectes et musiciens",
    startTitle: "Le point de départ du site",
    startIntro: "Google Search Console, du {from} au {to}, les huit semaines complètes avant RepGet :",
    baseline: {
      clicks: "clics depuis Google par semaine",
      impressions: "apparitions dans les résultats Google par semaine",
      position: "position moyenne dans les résultats",
    },
    auditIntro: "L'audit de RepGet du {date} a attribué au site {score} sur 100 sur les {pages} pages lues. Il a relevé :",
    auditFindings: [
      "{noindex} pages exclues de Google par une balise noindex.",
      "{titles} titres de page trop longs pour les résultats de Google, et {thin} page avec trop peu de texte.",
      "{minor} points mineurs, comme des méta-descriptions trop longues et des pages sans balise canonique.",
    ],
    aiStart:
      "Il a aussi confirmé que les robots de ChatGPT, Claude, Perplexity et Gemini peuvent lire le site. Sur {questions} questions qu'un client pourrait poser à un assistant IA, Claude n'a mentionné Image Studio dans aucune des {checks} vérifications (du {from} au {to}).",
    doneTitle: "Ce que RepGet a fait",
    steps: {
      plan: {
        when: "{date}",
        title: "Audit, mots-clés et plan",
        body: "RepGet a audité le site, étudié {keywords} mots-clés et planifié {planned} articles autour de ce que recherchent les clients d'Image Studio.",
      },
      articles: {
        when: "{from} – {to}",
        title: "{written} articles rédigés",
        body: "Environ {words} mots chacun. {live} sont en ligne :",
        rest: "Les {scheduled} autres seront publiés selon le calendrier.",
      },
      ai: {
        when: "Depuis le {date}",
        title: "Visibilité IA suivie",
        body: "Les mêmes {questions} questions sont posées régulièrement à un assistant IA, pour que la première mention apparaisse à la vérification suivante.",
      },
    },
    resultsTitle: "Résultats à ce jour",
    chartTitle: "Clics depuis Google, par semaine",
    chartLabel:
      "Clics hebdomadaires depuis Google, du {from} au {to} : entre {min} et {max} par semaine avant RepGet, {last} la semaine du {lastWeek}.",
    startMarker: "Début de RepGet, {date}",
    chartCaption:
      "Les semaines commencent le lundi. Source : Google Search Console d'Image Studio, importé par RepGet ; données jusqu'au {date}.",
    showNumbers: "Afficher les chiffres",
    columns: { week: "Semaine du", clicks: "Clics", impressions: "Apparitions", position: "Position moy." },
    resultsBody:
      "La semaine du {week} a apporté {clicks} clics, la meilleure de toutes celles affichées, et la position moyenne s'est maintenue à {position} contre environ {before} auparavant. Il est trop tôt pour l'attribuer aux nouveaux articles : les deux premiers ont été publiés le {first} et le {second}, et Google met des semaines à classer de nouvelles pages. Le premier mois complet sera publié ici le {next}.",
    quoteLabel: "Le mot du propriétaire",
    quote:
      "Image Studio est mon propre studio, c'est donc le premier site sur lequel nous avons mis RepGet : nous voulions le voir fonctionner sur une vraie entreprise avant de demander à qui que ce soit de lui faire confiance. Dès le premier jour, nous avions un audit, {keywords} mots-clés et un plan de {planned} articles. Désormais, les chiffres sont publiés ici chaque mois, quels qu'ils soient.",
    quoteBy: "{name}, propriétaire d'Image Studio et de RepGet",
    nextTitle: "La suite",
    next: [
      "Les {scheduled} articles déjà rédigés seront publiés selon le calendrier habituel.",
      "Chaque nouvel article sera envoyé à Google pour indexation dès sa publication.",
      "Les premiers backlinks depuis des sites du même secteur.",
      "Le {next}, le premier mois complet : clics, positions, articles indexés et mentions par l'IA, comparés au point de départ.",
    ],
    ctaTitle: "Voyez d'où part votre site",
    ctaBody: "L'audit gratuit est une version courte de l'audit par lequel Image Studio a commencé. Il prend environ une minute et ne demande aucun compte.",
    ctaPrimary: "Lancer l'audit gratuit",
    ctaSecondary: "Voir les offres",
    faqTitle: "Questions",
    faq: [
      {
        q: "Ces chiffres sont-ils réels ?",
        a: "Oui. Les clics, apparitions et positions proviennent du Google Search Console d'Image Studio. Les chiffres de l'audit, des mots-clés, du plan et des articles sont les données de RepGet. Le graphique est tracé à partir de ces chiffres ; ce n'est pas une illustration.",
      },
      {
        q: "Pourquoi Image Studio est-il la première étude de cas ?",
        a: "Image Studio et RepGet ont le même propriétaire : c'est donc le premier site sur RepGet, et celui dont nous pouvons montrer tous les chiffres, y compris les moins bons.",
      },
      {
        q: "Pourquoi publier une étude de cas au bout de deux semaines ?",
        a: "Pour que le point de départ soit consigné avant l'arrivée des résultats. Chaque mois ajoute ce qui a changé, et aussi ce qui n'a pas changé.",
      },
      {
        q: "Puis-je lire les articles ?",
        a: "Oui, les deux articles en ligne sont liés ci-dessus. Les autres seront ajoutés à cette page au fil de leur publication.",
      },
    ],
    sourcesTitle: "D'où viennent les chiffres",
    sources: [
      "Google Search Console d'imagestudio.com, importé chaque jour par RepGet, du {from} au {to}.",
      "Données de RepGet pour imagestudio.com (audit, mots-clés, plan de contenu, articles, vérifications IA), consultées le {date}.",
    ],
    card: {
      label: "Étude de cas en cours",
      summary:
        "Un studio de cinéma de Rome et de Milan, suivi depuis son premier jour sur RepGet : le vrai point de départ, le travail et les résultats, mois après mois.",
      cta: "Lire l'étude de cas",
      meta: "Depuis le {start} · mis à jour le {updated}",
    },
  },

  it: {
    metaTitle: "Caso di studio: Image Studio",
    metaDescription:
      "Uno studio di cinema di Roma e Milano su RepGet, seguito in pubblico: il punto di partenza, il lavoro di RepGet e i risultati, aggiornati ogni mese.",
    eyebrow: "Caso di studio · dal {date}",
    title: "Image Studio: uno studio di cinema di Roma e Milano su RepGet, seguito in pubblico dal primo giorno",
    lede: "Documentiamo il lavoro di RepGet su imagestudio.com man mano che avviene: da dove partiva il sito, cosa ha fatto RepGet e cosa è cambiato. Questa pagina viene aggiornata il 1° di ogni mese, che le notizie siano buone o no.",
    disclosure:
      "Image Studio e RepGet hanno lo stesso proprietario. Per questo è stato il primo sito su RepGet, e per questo possiamo mostrarne i numeri per intero.",
    updated: "Aggiornato il {date} · prossimo aggiornamento: {next}",
    figures: {
      keywords: "parole chiave analizzate il primo giorno",
      planned: "articoli nel piano editoriale",
      written: "articoli scritti in due settimane ({live} pubblicati, {scheduled} in programma)",
      ai: "domande all'IA monitorate (ancora nessuna menzione)",
      clicks: "clic a settimana da Google all'inizio",
      position: "posizione media su Google all'inizio",
    },
    clientTitle: "Il cliente",
    client: [
      "Image Studio è una casa di produzione creativa di fotografia e cinema: matrimoni destination, campagne pubblicitarie, lavori editoriali e videoclip. Lo studio ha sede a Roma e Milano e lavora in tutta Italia e all'estero.",
      "Il suo sito, imagestudio.com, funziona su WordPress in inglese e in italiano, con un portfolio, un blog editoriale e un'accademia online.",
    ],
    servicesLabel: "Servizi",
    services:
      "Matrimoni destination, contenuti commerciali e di marca, produzione per i social, videoclip, fotografia editoriale, riprese con drone, documentari",
    buyersLabel: "Clienti",
    buyers: "Coppie che organizzano il matrimonio in Italia, brand internazionali, hotel di lusso, ristoranti, architetti e musicisti",
    startTitle: "Da dove partiva il sito",
    startIntro: "Google Search Console, dal {from} al {to}, le otto settimane complete prima di RepGet:",
    baseline: {
      clicks: "clic da Google a settimana",
      impressions: "apparizioni nei risultati di Google a settimana",
      position: "posizione media nei risultati",
    },
    auditIntro: "L'audit di RepGet del {date} ha dato al sito {score} su 100 sulle {pages} pagine lette. Ha trovato:",
    auditFindings: [
      "{noindex} pagine escluse da Google tramite un tag noindex.",
      "{titles} titoli di pagina troppo lunghi per i risultati di Google e {thin} pagina con troppo poco testo.",
      "{minor} dettagli minori, come meta description troppo lunghe e pagine senza tag canonical.",
    ],
    aiStart:
      "Ha anche confermato che i crawler di ChatGPT, Claude, Perplexity e Gemini possono leggere il sito. Su {questions} domande che un cliente potrebbe fare a un assistente IA, Claude non ha nominato Image Studio in nessuno dei {checks} controlli (dal {from} al {to}).",
    doneTitle: "Cosa ha fatto RepGet",
    steps: {
      plan: {
        when: "{date}",
        title: "Audit, parole chiave e un piano",
        body: "RepGet ha analizzato il sito, studiato {keywords} parole chiave e pianificato {planned} articoli su ciò che cercano i clienti di Image Studio.",
      },
      articles: {
        when: "{from} – {to}",
        title: "{written} articoli scritti",
        body: "Circa {words} parole ciascuno. {live} sono online:",
        rest: "Gli altri {scheduled} usciranno secondo il calendario di pubblicazione.",
      },
      ai: {
        when: "Dal {date}",
        title: "Visibilità nell'IA monitorata",
        body: "Le stesse {questions} domande vengono poste regolarmente a un assistente IA, così la prima menzione comparirà al controllo successivo.",
      },
    },
    resultsTitle: "I risultati finora",
    chartTitle: "Clic da Google, per settimana",
    chartLabel:
      "Clic settimanali da Google, dal {from} al {to}: tra {min} e {max} a settimana prima di RepGet, {last} nella settimana del {lastWeek}.",
    startMarker: "Inizio di RepGet, {date}",
    chartCaption:
      "Le settimane iniziano il lunedì. Fonte: Google Search Console di Image Studio, importato da RepGet; dati fino al {date}.",
    showNumbers: "Mostra i numeri",
    columns: { week: "Settimana del", clicks: "Clic", impressions: "Apparizioni", position: "Posizione media" },
    resultsBody:
      "La settimana del {week} ha portato {clicks} clic, la migliore tra quelle mostrate, e la posizione media è rimasta a {position} contro circa {before} prima. È presto per attribuirlo ai nuovi articoli: i primi due sono usciti il {first} e il {second}, e Google impiega settimane a posizionare le pagine nuove. Il primo mese completo sarà pubblicato qui il {next}.",
    quoteLabel: "Dal proprietario",
    quote:
      "Image Studio è il mio studio, quindi è stato il primo sito su cui abbiamo messo RepGet: volevamo vederlo funzionare su un'attività reale prima di chiedere a chiunque altro di fidarsi. Il primo giorno avevamo già un audit, {keywords} parole chiave e un piano di {planned} articoli. Da qui in avanti, i numeri finiscono su questa pagina ogni mese, qualunque essi siano.",
    quoteBy: "{name}, proprietario di Image Studio e di RepGet",
    nextTitle: "I prossimi passi",
    next: [
      "I {scheduled} articoli già scritti usciranno secondo il normale calendario di pubblicazione.",
      "Ogni nuovo articolo verrà inviato a Google per l'indicizzazione appena pubblicato.",
      "I primi backlink da siti affini.",
      "Il {next}, il primo mese completo: clic, posizioni, articoli indicizzati e menzioni nell'IA, a confronto con il punto di partenza.",
    ],
    ctaTitle: "Scopra da dove parte il suo sito",
    ctaBody: "L'audit gratuito è una versione ridotta dell'audit con cui è partito Image Studio. Richiede circa un minuto e nessun account.",
    ctaPrimary: "Controlla il mio sito",
    ctaSecondary: "Vedi i piani",
    faqTitle: "Domande",
    faq: [
      {
        q: "Questi numeri sono reali?",
        a: "Sì. Clic, apparizioni e posizioni provengono dal Google Search Console di Image Studio. I numeri di audit, parole chiave, piano e articoli sono dati di RepGet. Il grafico è disegnato su questi numeri; non è un'illustrazione.",
      },
      {
        q: "Perché Image Studio è il primo caso di studio?",
        a: "Image Studio e RepGet hanno lo stesso proprietario: è stato quindi il primo sito su RepGet, e quello di cui possiamo mostrare tutti i numeri, anche quelli deboli.",
      },
      {
        q: "Perché pubblicare un caso di studio dopo due settimane?",
        a: "Perché il punto di partenza resti registrato prima che arrivino i risultati. Ogni mese si aggiunge cosa è cambiato, e anche cosa no.",
      },
      {
        q: "Posso leggere gli articoli?",
        a: "Sì, i due già online sono collegati qui sopra. Gli altri verranno aggiunti a questa pagina man mano che escono.",
      },
    ],
    sourcesTitle: "Da dove vengono i numeri",
    sources: [
      "Google Search Console di imagestudio.com, importato ogni giorno da RepGet, dal {from} al {to}.",
      "Dati di RepGet per imagestudio.com (audit, parole chiave, piano editoriale, articoli, controlli IA), letti il {date}.",
    ],
    card: {
      label: "Caso di studio in corso",
      summary:
        "Uno studio di cinema di Roma e Milano, seguito dal primo giorno su RepGet: il vero punto di partenza, il lavoro e i risultati, mese per mese.",
      cta: "Leggi il caso di studio",
      meta: "Dal {start} · aggiornato il {updated}",
    },
  },

  de: {
    metaTitle: "Fallstudie: Image Studio",
    metaDescription:
      "Ein Filmstudio aus Rom und Mailand auf RepGet, öffentlich verfolgt: der Ausgangspunkt, die Arbeit von RepGet und die Ergebnisse, monatlich aktualisiert.",
    eyebrow: "Fallstudie · seit {date}",
    title: "Image Studio: ein Filmstudio aus Rom und Mailand auf RepGet, öffentlich verfolgt ab dem ersten Tag",
    lede: "Wir dokumentieren die Arbeit von RepGet an imagestudio.com, während sie geschieht: wo die Website stand, was RepGet getan hat und was sich verändert hat. Diese Seite wird am 1. jedes Monats aktualisiert, ob die Nachrichten gut sind oder nicht.",
    disclosure:
      "Image Studio und RepGet haben denselben Inhaber. Deshalb war es die erste Website auf RepGet, und deshalb können wir ihre Zahlen vollständig zeigen.",
    updated: "Aktualisiert am {date} · nächstes Update: {next}",
    figures: {
      keywords: "Keywords am ersten Tag recherchiert",
      planned: "Artikel im Content-Plan",
      written: "Artikel in zwei Wochen geschrieben ({live} online, {scheduled} geplant)",
      ai: "beobachtete KI-Fragen (noch keine Erwähnung)",
      clicks: "Klicks pro Woche aus Google zu Beginn",
      position: "durchschnittliche Position in Google zu Beginn",
    },
    clientTitle: "Der Kunde",
    client: [
      "Image Studio ist eine kreative Produktionsfirma für filmische Fotografie und Film: Destination Weddings, Werbekampagnen, redaktionelle Arbeiten und Musikvideos. Das Studio sitzt in Rom und Mailand und arbeitet in ganz Italien und im Ausland.",
      "Die Website imagestudio.com läuft mit WordPress auf Englisch und Italienisch, mit Portfolio, redaktionellem Blog und Online-Akademie.",
    ],
    servicesLabel: "Leistungen",
    services:
      "Destination Weddings, Werbe- und Markeninhalte, Social-Media-Produktion, Musikvideos, Editorial-Fotografie, Drohnenaufnahmen, Dokumentarfilme",
    buyersLabel: "Kunden",
    buyers: "Paare, die in Italien heiraten, internationale Marken, Luxushotels, Restaurants, Architekten und Musiker",
    startTitle: "Wo die Website stand",
    startIntro: "Google Search Console, {from} bis {to}, die acht vollen Wochen vor RepGet:",
    baseline: {
      clicks: "Klicks aus Google pro Woche",
      impressions: "Einblendungen in den Google-Ergebnissen pro Woche",
      position: "durchschnittliche Position in den Ergebnissen",
    },
    auditIntro: "Das Audit von RepGet vom {date} bewertete die Website mit {score} von 100 Punkten auf den {pages} gelesenen Seiten. Es fand:",
    auditFindings: [
      "{noindex} Seiten, die ein noindex-Tag aus Google heraushält.",
      "{titles} Seitentitel, die für die Google-Ergebnisse zu lang sind, und {thin} Seite mit zu wenig Text.",
      "{minor} kleinere Punkte, etwa zu lange Meta-Beschreibungen und Seiten ohne Canonical-Tag.",
    ],
    aiStart:
      "Außerdem bestätigte es, dass die Crawler von ChatGPT, Claude, Perplexity und Gemini die Website lesen können. Bei {questions} Fragen, die ein Kunde einem KI-Assistenten stellen könnte, nannte Claude Image Studio in keinem von {checks} Tests ({from} bis {to}).",
    doneTitle: "Was RepGet getan hat",
    steps: {
      plan: {
        when: "{date}",
        title: "Audit, Keywords und ein Plan",
        body: "RepGet hat die Website geprüft, {keywords} Keywords recherchiert und {planned} Artikel rund um das geplant, wonach die Kunden von Image Studio suchen.",
      },
      articles: {
        when: "{from} – {to}",
        title: "{written} Artikel geschrieben",
        body: "Jeweils rund {words} Wörter. {live} sind online:",
        rest: "Die übrigen {scheduled} erscheinen nach dem Veröffentlichungsplan.",
      },
      ai: {
        when: "Seit {date}",
        title: "KI-Sichtbarkeit beobachtet",
        body: "Dieselben {questions} Fragen werden regelmäßig einem KI-Assistenten gestellt, damit die erste Erwähnung beim nächsten Test sichtbar wird.",
      },
    },
    resultsTitle: "Bisherige Ergebnisse",
    chartTitle: "Klicks aus Google, pro Woche",
    chartLabel:
      "Wöchentliche Klicks aus Google, {from} bis {to}: zwischen {min} und {max} pro Woche vor RepGet, {last} in der Woche ab {lastWeek}.",
    startMarker: "Start von RepGet, {date}",
    chartCaption: "Wochen beginnen am Montag. Quelle: Google Search Console von Image Studio, von RepGet importiert; Daten bis {date}.",
    showNumbers: "Zahlen anzeigen",
    columns: { week: "Woche ab", clicks: "Klicks", impressions: "Einblendungen", position: "Ø Position" },
    resultsBody:
      "Die Woche ab {week} brachte {clicks} Klicks, die meisten aller gezeigten Wochen, und die durchschnittliche Position hielt sich bei {position} gegenüber etwa {before} davor. Es ist zu früh, das den neuen Artikeln zuzuschreiben: Die ersten beiden gingen am {first} und am {second} online, und Google braucht Wochen, um neue Seiten zu ranken. Der erste volle Monat erscheint hier am {next}.",
    quoteLabel: "Vom Inhaber",
    quote:
      "Image Studio ist mein eigenes Studio, deshalb war es die erste Website, auf der wir RepGet eingesetzt haben: Wir wollten es an einem echten Unternehmen arbeiten sehen, bevor wir irgendjemanden bitten, ihm zu vertrauen. Am ersten Tag hatten wir ein Audit, {keywords} Keywords und einen Plan für {planned} Artikel. Ab jetzt kommen die Zahlen jeden Monat auf diese Seite, egal wie sie ausfallen.",
    quoteBy: "{name}, Inhaber von Image Studio und RepGet",
    nextTitle: "Wie es weitergeht",
    next: [
      "Die {scheduled} geschriebenen Artikel erscheinen nach dem üblichen Veröffentlichungsplan.",
      "Jeder neue Artikel wird bei Veröffentlichung zur Indexierung an Google gesendet.",
      "Die ersten Backlinks von themenverwandten Websites.",
      "Am {next} der erste volle Monat: Klicks, Positionen, indexierte Artikel und KI-Erwähnungen, verglichen mit dem Ausgangspunkt.",
    ],
    ctaTitle: "Sehen Sie, wo Ihre Website steht",
    ctaBody: "Das kostenlose Audit ist eine kürzere Fassung des Audits, mit dem Image Studio begonnen hat. Es dauert etwa eine Minute und braucht kein Konto.",
    ctaPrimary: "Kostenloses Audit starten",
    ctaSecondary: "Pläne ansehen",
    faqTitle: "Fragen",
    faq: [
      {
        q: "Sind diese Zahlen echt?",
        a: "Ja. Klicks, Einblendungen und Positionen stammen aus der Google Search Console von Image Studio. Die Zahlen zu Audit, Keywords, Plan und Artikeln sind Aufzeichnungen von RepGet. Das Diagramm ist aus diesen Zahlen gezeichnet; es ist keine Illustration.",
      },
      {
        q: "Warum ist Image Studio die erste Fallstudie?",
        a: "Image Studio und RepGet haben denselben Inhaber. Darum war es die erste Website auf RepGet und die, deren Zahlen wir vollständig zeigen können, auch die schwachen.",
      },
      {
        q: "Warum eine Fallstudie nach zwei Wochen veröffentlichen?",
        a: "Damit der Ausgangspunkt festgehalten ist, bevor Ergebnisse kommen. Jeden Monat kommt hinzu, was sich verändert hat, und auch, was nicht.",
      },
      {
        q: "Kann ich die Artikel lesen?",
        a: "Ja, die beiden veröffentlichten sind oben verlinkt. Die übrigen werden dieser Seite hinzugefügt, sobald sie erscheinen.",
      },
    ],
    sourcesTitle: "Woher die Zahlen kommen",
    sources: [
      "Google Search Console für imagestudio.com, täglich von RepGet importiert, {from} bis {to}.",
      "Aufzeichnungen von RepGet für imagestudio.com (Audit, Keywords, Content-Plan, Artikel, KI-Tests), abgerufen am {date}.",
    ],
    card: {
      label: "Laufende Fallstudie",
      summary:
        "Ein Filmstudio aus Rom und Mailand, verfolgt ab dem ersten Tag auf RepGet: der echte Ausgangspunkt, die Arbeit und die Ergebnisse, Monat für Monat.",
      cta: "Fallstudie lesen",
      meta: "Seit {start} · aktualisiert am {updated}",
    },
  },
};
