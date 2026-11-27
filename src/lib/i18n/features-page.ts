import type { Locale } from "@/lib/i18n/config";
import type { FeatureClipKey, ProductTool } from "@/lib/marketing/product-tools";

/**
 * The words of /features and of the homepage's "Top features" (client,
 * 2026-11-27: "a top features page like heycatch.ai/features, also on the
 * homepage right after Meet RepGet"), in every language. Formal address
 * throughout: usted, vous, Lei, Sie.
 *
 * EVERY SENTENCE IS WHAT THE RECORDING NEXT TO IT SHOWS, and nothing more:
 *  - AI Visibility asks ChatGPT, Gemini and Claude, weekly with web search,
 *    the customer's tracked questions (lib/geo/engines.ts ASKABLE_ENGINE_IDS,
 *    PR #182). Perplexity and Copilot Search are never asked, so never named.
 *  - Replies and posts in Opportunities are posted by the customer, in one
 *    click, after editing (the recording's "Post", "Copy text").
 *  - The Partner Network's links are placed by the RepGet team and counted
 *    only once verified live (the Backlinks recording's "What this does").
 *  - Social Content brings 20 ideas a day (lib/video/formats.ts IDEAS_PER_DAY).
 *  - The audit reads up to 25 pages (the Website Health recording).
 * Product names (RepGet, Growth Copilot, Partner Network, Search Console,
 * Google Analytics) stay in English in every language.
 */

type Feature = { title: string; body: string };
type Tool = { name: string; tagline: string; intro: string; link: string };

export type FeaturesPageCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  /** The h1. */
  title: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  /** "Top features": the index of the five tools. */
  indexTitle: string;
  /** Over each tool's section: {n} its number, {count} how many. */
  toolNumber: string;
  tools: Record<ProductTool, Tool>;
  copilot: Tool & { badge: string };
  features: Record<FeatureClipKey, Feature>;
  /** What a screen reader hears for a recording: {feature} its title. */
  clipLabel: string;
  comingSoonTitle: string;
  comingSoonIntro: string;
  comingSoon: string[];
  closingTitle: string;
  closingBody: string;
  /** The homepage's compact block. */
  home: { eyebrow: string; title: string; sub: string; seeAll: string };
};

const en: FeaturesPageCopy = {
  metaTitle: "Features: everything RepGet does",
  metaDescription:
    "Five tools in one place: SEO articles, backlinks, AI visibility, social posts and videos, and website health, with Growth Copilot to run them.",
  eyebrow: "Features",
  title: "Everything RepGet does",
  intro:
    "Five tools that grow your website, and one assistant that runs them. Every clip on this page is a recording of the real RepGet dashboard.",
  primaryCta: "Start free",
  secondaryCta: "See pricing",
  indexTitle: "Top features",
  toolNumber: "Tool {n} of {count}",
  tools: {
    articles: {
      name: "Articles",
      tagline: "Your SEO content plan, written and published",
      intro: "RepGet researches what your customers search for, plans the articles and writes them in your voice, then publishes them to your site.",
      link: "See it on a real website",
    },
    backlinks: {
      name: "Backlinks",
      tagline: "Links from real business websites",
      intro: "The Partner Network places relevant links to your pages inside other members' articles, and counts each one only once it is live.",
      link: "How backlinks work",
    },
    aiVisibility: {
      name: "AI Visibility",
      tagline: "Find out whether AI assistants recommend you",
      intro: "Every week RepGet asks ChatGPT, Gemini and Claude, with web search, the questions your customers ask and shows whether your business is named, and who is named instead.",
      link: "How to get named by AI",
    },
    social: {
      name: "Social",
      tagline: "Posts, videos and replies",
      intro: "Short videos and carousels made from your website, plus conversations worth joining, ready for you to review and publish.",
      link: "Try the free post generator",
    },
    websiteHealth: {
      name: "Website Health",
      tagline: "The audit and Losing Traffic",
      intro: "A technical check of your pages, the pages losing Google traffic, and your Search Console and Analytics figures in one place.",
      link: "Run a free website check",
    },
  },
  copilot: {
    name: "Growth Copilot",
    badge: "Runs all five",
    tagline: "The assistant that runs them all",
    intro: "Growth Copilot is not a sixth tool: it is the assistant across all five. Ask it anything about your website and it answers from your own data.",
    link: "Ask Growth Copilot for free",
  },
  features: {
    plannedArticles: {
      title: "A content plan on a calendar",
      body: "Every topic has a day. Write one now, change it or remove it, and RepGet writes the rest on schedule and sends them to your site.",
    },
    keywordResearch: {
      title: "Keywords you can realistically win",
      body: "Search terms ranked by opportunity, with monthly searches, competition and the topic each one belongs to. Add your own and the plan follows.",
    },
    articleSettings: {
      title: "Articles in your style",
      body: "Choose the writing style, use photos from your own website or new pictures, set your brand voice and add a table of contents, comparison tables and FAQs.",
    },
    backlinks: {
      title: "The Partner Network",
      body: "Set the minimum authority of the sites that link to you and the pages you want links to. You earn credits for links you host and spend them on links you receive.",
    },
    aiVisibility: {
      title: "Tracked questions and answers",
      body: "Your visibility score, the questions that name you and the businesses named instead of you, with the evidence behind every answer.",
    },
    socialContent: {
      title: "New video ideas every day",
      body: "20 ideas a day from your website: short videos, Stories and photo carousels with captions and music. Approve the ones you like and publish or download them.",
    },
    opportunities: {
      title: "Conversations worth joining",
      body: "Posts and discussions on platforms like Reddit, X, Threads and Bluesky, with a suggested text. Make it yours and post it in one click.",
    },
    websiteHealth: {
      title: "A health score with clear fixes",
      body: "RepGet reads up to 25 of your pages and lists what holds them back in search, most serious first, including whether AI crawlers may read your site.",
    },
    losingTraffic: {
      title: "Pages losing traffic",
      body: "The pages getting fewer clicks from Google or showing up less than a month ago, from your Search Console data, so you know what to refresh.",
    },
    googleSearch: {
      title: "Google Search and Analytics",
      body: "Clicks, impressions, position and visits from your own Search Console and Google Analytics, with your top searches and pages.",
    },
    growthCopilot: {
      title: "Ask anything about your website",
      body: "Why did my traffic drop? What should I fix first? Growth Copilot answers from your data and can act for you once you confirm.",
    },
    tasks: {
      title: "Everything waiting, in one list",
      body: "Website errors to fix, declining pages, drafts to review, and today's posts and video ideas, in the order that matters.",
    },
    homeDashboard: {
      title: "Your growth at a glance",
      body: "Today's article, your backlinks, this week's wins and the articles that bring the most clicks, on one home page.",
    },
  },
  clipLabel: "Recording of the RepGet dashboard: {feature}",
  comingSoonTitle: "Coming soon",
  comingSoonIntro: "What we are working on now. It is not in the product yet.",
  comingSoon: ["AI Visibility checks with more AI assistants", "RepGet in Romanian"],
  closingTitle: "Start with your website",
  closingBody: "Try every tool free, then choose the plan that fits your business.",
  home: {
    eyebrow: "Top features",
    title: "Five tools. One Growth Copilot.",
    sub: "Each one, recorded in the real RepGet dashboard.",
    seeAll: "See all features",
  },
};

const es: FeaturesPageCopy = {
  metaTitle: "Funciones: todo lo que hace RepGet",
  metaDescription:
    "Cinco herramientas en un lugar: artículos SEO, backlinks, visibilidad en IA, posts y vídeos para redes y salud del sitio, con Growth Copilot al mando.",
  eyebrow: "Funciones",
  title: "Todo lo que hace RepGet",
  intro:
    "Cinco herramientas que hacen crecer su sitio web y un asistente que las dirige. Cada clip de esta página es una grabación del panel real de RepGet.",
  primaryCta: "Empezar gratis",
  secondaryCta: "Ver precios",
  indexTitle: "Funciones principales",
  toolNumber: "Herramienta {n} de {count}",
  tools: {
    articles: {
      name: "Artículos",
      tagline: "Su plan de contenido SEO, escrito y publicado",
      intro: "RepGet investiga lo que buscan sus clientes, planifica los artículos, los escribe con su estilo y los publica en su sitio.",
      link: "Véalo en un sitio real",
    },
    backlinks: {
      name: "Backlinks",
      tagline: "Enlaces desde sitios web de empresas reales",
      intro: "La Partner Network coloca enlaces relevantes a sus páginas dentro de artículos de otros miembros, y solo cuenta cada uno cuando está publicado.",
      link: "Cómo funcionan los backlinks",
    },
    aiVisibility: {
      name: "Visibilidad en IA",
      tagline: "Sepa si los asistentes de IA le recomiendan",
      intro: "Cada semana RepGet hace a ChatGPT, Gemini y Claude, con búsqueda web, las preguntas de sus clientes y le muestra si nombran su negocio, y a quién nombran en su lugar.",
      link: "Cómo aparecer en la IA",
    },
    social: {
      name: "Redes",
      tagline: "Posts, vídeos y respuestas",
      intro: "Vídeos cortos y carruseles creados a partir de su sitio, y conversaciones en las que vale la pena participar, listos para revisar y publicar.",
      link: "Pruebe el generador de posts gratuito",
    },
    websiteHealth: {
      name: "Salud del sitio",
      tagline: "La auditoría y el tráfico en caída",
      intro: "Una revisión técnica de sus páginas, las páginas que pierden tráfico de Google y sus datos de Search Console y Analytics en un solo lugar.",
      link: "Analice su sitio gratis",
    },
  },
  copilot: {
    name: "Growth Copilot",
    badge: "Dirige las cinco",
    tagline: "El asistente que las dirige todas",
    intro: "Growth Copilot no es una sexta herramienta: es el asistente de las cinco. Pregúntele lo que quiera sobre su sitio y le responde con sus propios datos.",
    link: "Pregunte gratis a Growth Copilot",
  },
  features: {
    plannedArticles: {
      title: "Un plan de contenido en un calendario",
      body: "Cada tema tiene su día. Escriba uno ahora, cámbielo o elimínelo, y RepGet escribe el resto a su hora y los envía a su sitio.",
    },
    keywordResearch: {
      title: "Palabras clave que puede ganar",
      body: "Términos de búsqueda ordenados por oportunidad, con búsquedas mensuales, competencia y el tema al que pertenecen. Añada los suyos y el plan se adapta.",
    },
    articleSettings: {
      title: "Artículos con su estilo",
      body: "Elija el estilo de redacción, use fotos de su propio sitio o imágenes nuevas, defina la voz de su marca y añada índice, tablas comparativas y preguntas frecuentes.",
    },
    backlinks: {
      title: "La Partner Network",
      body: "Fije la autoridad mínima de los sitios que le enlazan y las páginas que deben recibir enlaces. Gana créditos por los enlaces que aloja y los gasta en los que recibe.",
    },
    aiVisibility: {
      title: "Preguntas y respuestas vigiladas",
      body: "Su puntuación de visibilidad, las preguntas en las que le nombran y los negocios nombrados en su lugar, con la prueba detrás de cada respuesta.",
    },
    socialContent: {
      title: "Ideas de vídeo nuevas cada día",
      body: "20 ideas al día a partir de su sitio: vídeos cortos, Stories y carruseles de fotos con subtítulos y música. Apruebe las que le gusten y publíquelas o descárguelas.",
    },
    opportunities: {
      title: "Conversaciones en las que participar",
      body: "Posts y debates en plataformas como Reddit, X, Threads y Bluesky, con un texto sugerido. Hágalo suyo y publíquelo con un clic.",
    },
    websiteHealth: {
      title: "Una puntuación de salud con soluciones claras",
      body: "RepGet lee hasta 25 páginas de su sitio y enumera lo que las frena en las búsquedas, empezando por lo más grave, incluido si los rastreadores de IA pueden leerlo.",
    },
    losingTraffic: {
      title: "Páginas que pierden tráfico",
      body: "Las páginas que reciben menos clics de Google o aparecen menos que hace un mes, según sus datos de Search Console, para saber qué actualizar.",
    },
    googleSearch: {
      title: "Google Search y Analytics",
      body: "Clics, impresiones, posición y visitas de su propio Search Console y Google Analytics, con sus búsquedas y páginas principales.",
    },
    growthCopilot: {
      title: "Pregunte lo que quiera sobre su sitio",
      body: "¿Por qué ha bajado mi tráfico? ¿Qué debo arreglar primero? Growth Copilot responde con sus datos y puede actuar por usted cuando lo confirma.",
    },
    tasks: {
      title: "Todo lo pendiente, en una lista",
      body: "Errores del sitio por corregir, páginas en descenso, borradores por revisar y los posts e ideas de vídeo del día, por orden de importancia.",
    },
    homeDashboard: {
      title: "Su crecimiento de un vistazo",
      body: "El artículo del día, sus backlinks, los logros de la semana y los artículos que más clics traen, en una sola página de inicio.",
    },
  },
  clipLabel: "Grabación del panel de RepGet: {feature}",
  comingSoonTitle: "Próximamente",
  comingSoonIntro: "En lo que trabajamos ahora. Todavía no está en el producto.",
  comingSoon: ["Comprobaciones de visibilidad con más asistentes de IA", "RepGet en rumano"],
  closingTitle: "Empiece con su sitio web",
  closingBody: "Pruebe todas las herramientas gratis y elija después el plan que encaja con su negocio.",
  home: {
    eyebrow: "Funciones principales",
    title: "Cinco herramientas. Un Growth Copilot.",
    sub: "Cada una, grabada en el panel real de RepGet.",
    seeAll: "Ver todas las funciones",
  },
};

const fr: FeaturesPageCopy = {
  metaTitle: "Fonctionnalités : tout ce que fait RepGet",
  metaDescription:
    "Cinq outils réunis : articles SEO, backlinks, visibilité dans l’IA, posts et vidéos sociales et santé du site, pilotés par Growth Copilot.",
  eyebrow: "Fonctionnalités",
  title: "Tout ce que fait RepGet",
  intro:
    "Cinq outils qui font grandir votre site, et un assistant qui les pilote. Chaque extrait de cette page est un enregistrement du vrai tableau de bord RepGet.",
  primaryCta: "Commencer gratuitement",
  secondaryCta: "Voir les tarifs",
  indexTitle: "Fonctionnalités clés",
  toolNumber: "Outil {n} sur {count}",
  tools: {
    articles: {
      name: "Articles",
      tagline: "Votre plan de contenu SEO, rédigé et publié",
      intro: "RepGet étudie ce que recherchent vos clients, planifie les articles, les rédige dans votre style puis les publie sur votre site.",
      link: "Le voir sur un vrai site",
    },
    backlinks: {
      name: "Backlinks",
      tagline: "Des liens depuis de vrais sites d’entreprises",
      intro: "Le Partner Network place des liens pertinents vers vos pages dans les articles d’autres membres, et ne compte chacun qu’une fois en ligne.",
      link: "Comment fonctionnent les backlinks",
    },
    aiVisibility: {
      name: "Visibilité IA",
      tagline: "Sachez si les assistants d’IA vous recommandent",
      intro: "Chaque semaine, RepGet pose à ChatGPT, Gemini et Claude, avec la recherche web, les questions de vos clients et vous montre si votre entreprise est citée, et qui l’est à sa place.",
      link: "Comment être cité par l’IA",
    },
    social: {
      name: "Réseaux",
      tagline: "Posts, vidéos et réponses",
      intro: "Des vidéos courtes et des carrousels créés à partir de votre site, et des conversations à rejoindre, prêts à relire et à publier.",
      link: "Essayer le générateur de posts gratuit",
    },
    websiteHealth: {
      name: "Santé du site",
      tagline: "L’audit et la perte de trafic",
      intro: "Un contrôle technique de vos pages, les pages qui perdent du trafic Google et vos chiffres Search Console et Analytics au même endroit.",
      link: "Analyser votre site gratuitement",
    },
  },
  copilot: {
    name: "Growth Copilot",
    badge: "Pilote les cinq",
    tagline: "L’assistant qui les pilote tous",
    intro: "Growth Copilot n’est pas un sixième outil : c’est l’assistant des cinq. Posez-lui toute question sur votre site, il répond à partir de vos propres données.",
    link: "Interroger Growth Copilot gratuitement",
  },
  features: {
    plannedArticles: {
      title: "Un plan de contenu sur un calendrier",
      body: "Chaque sujet a son jour. Rédigez-en un maintenant, modifiez-le ou supprimez-le, et RepGet rédige les autres à l’heure et les envoie sur votre site.",
    },
    keywordResearch: {
      title: "Des mots-clés à votre portée",
      body: "Des termes de recherche classés par opportunité, avec les recherches mensuelles, la concurrence et le sujet de chacun. Ajoutez les vôtres, le plan suit.",
    },
    articleSettings: {
      title: "Des articles à votre style",
      body: "Choisissez le style d’écriture, utilisez les photos de votre site ou de nouvelles images, définissez la voix de votre marque et ajoutez sommaire, tableaux comparatifs et FAQ.",
    },
    backlinks: {
      title: "Le Partner Network",
      body: "Fixez l’autorité minimale des sites qui vous citent et les pages qui doivent recevoir des liens. Vous gagnez des crédits pour les liens hébergés et les dépensez pour ceux reçus.",
    },
    aiVisibility: {
      title: "Questions et réponses suivies",
      body: "Votre score de visibilité, les questions où vous êtes cité et les entreprises citées à votre place, avec la preuve derrière chaque réponse.",
    },
    socialContent: {
      title: "De nouvelles idées de vidéos chaque jour",
      body: "20 idées par jour tirées de votre site : vidéos courtes, Stories et carrousels photo avec sous-titres et musique. Approuvez celles qui vous plaisent, publiez-les ou téléchargez-les.",
    },
    opportunities: {
      title: "Des conversations à rejoindre",
      body: "Posts et discussions sur des plateformes comme Reddit, X, Threads et Bluesky, avec un texte suggéré. Adaptez-le et publiez-le en un clic.",
    },
    websiteHealth: {
      title: "Un score de santé et des corrections claires",
      body: "RepGet lit jusqu’à 25 pages de votre site et liste ce qui les freine dans la recherche, du plus grave au moins grave, y compris l’accès des robots d’IA.",
    },
    losingTraffic: {
      title: "Les pages qui perdent du trafic",
      body: "Les pages qui reçoivent moins de clics Google ou apparaissent moins qu’il y a un mois, d’après vos données Search Console, pour savoir quoi actualiser.",
    },
    googleSearch: {
      title: "Google Search et Analytics",
      body: "Clics, impressions, position et visites issus de votre propre Search Console et de Google Analytics, avec vos principales recherches et pages.",
    },
    growthCopilot: {
      title: "Toutes vos questions sur votre site",
      body: "Pourquoi mon trafic a-t-il baissé ? Que corriger d’abord ? Growth Copilot répond à partir de vos données et peut agir pour vous une fois que vous confirmez.",
    },
    tasks: {
      title: "Tout ce qui attend, dans une liste",
      body: "Erreurs du site à corriger, pages en baisse, brouillons à relire, posts et idées de vidéos du jour, par ordre d’importance.",
    },
    homeDashboard: {
      title: "Votre croissance en un coup d’œil",
      body: "L’article du jour, vos backlinks, les réussites de la semaine et les articles qui rapportent le plus de clics, sur une seule page d’accueil.",
    },
  },
  clipLabel: "Enregistrement du tableau de bord RepGet : {feature}",
  comingSoonTitle: "Bientôt",
  comingSoonIntro: "Ce sur quoi nous travaillons. Ce n’est pas encore dans le produit.",
  comingSoon: ["Des contrôles de visibilité avec davantage d’assistants d’IA", "RepGet en roumain"],
  closingTitle: "Commencez avec votre site",
  closingBody: "Essayez chaque outil gratuitement, puis choisissez la formule adaptée à votre entreprise.",
  home: {
    eyebrow: "Fonctionnalités clés",
    title: "Cinq outils. Un Growth Copilot.",
    sub: "Chacun, filmé dans le vrai tableau de bord RepGet.",
    seeAll: "Voir toutes les fonctionnalités",
  },
};

const it: FeaturesPageCopy = {
  metaTitle: "Funzioni: tutto ciò che fa RepGet",
  metaDescription:
    "Cinque strumenti in un unico posto: articoli SEO, backlink, visibilità nell’IA, post e video social e salute del sito, guidati da Growth Copilot.",
  eyebrow: "Funzioni",
  title: "Tutto ciò che fa RepGet",
  intro:
    "Cinque strumenti che fanno crescere il Suo sito e un assistente che li guida. Ogni clip di questa pagina è una registrazione della vera dashboard di RepGet.",
  primaryCta: "Inizi gratis",
  secondaryCta: "Vedi i prezzi",
  indexTitle: "Funzioni principali",
  toolNumber: "Strumento {n} di {count}",
  tools: {
    articles: {
      name: "Articoli",
      tagline: "Il Suo piano di contenuti SEO, scritto e pubblicato",
      intro: "RepGet studia ciò che cercano i Suoi clienti, pianifica gli articoli, li scrive con il Suo stile e li pubblica sul Suo sito.",
      link: "Lo veda su un sito reale",
    },
    backlinks: {
      name: "Backlink",
      tagline: "Link da siti di aziende reali",
      intro: "La Partner Network inserisce link pertinenti alle Sue pagine negli articoli di altri membri, e conta ciascuno solo quando è online.",
      link: "Come funzionano i backlink",
    },
    aiVisibility: {
      name: "Visibilità IA",
      tagline: "Scopra se gli assistenti IA La consigliano",
      intro: "Ogni settimana RepGet pone a ChatGPT, Gemini e Claude, con la ricerca web, le domande dei Suoi clienti e Le mostra se nominano la Sua attività, e chi nominano al Suo posto.",
      link: "Come farsi nominare dall’IA",
    },
    social: {
      name: "Social",
      tagline: "Post, video e risposte",
      intro: "Video brevi e caroselli creati dal Suo sito, più conversazioni a cui vale la pena partecipare, pronti da rivedere e pubblicare.",
      link: "Provi il generatore di post gratuito",
    },
    websiteHealth: {
      name: "Salute del sito",
      tagline: "L’audit e il traffico in calo",
      intro: "Un controllo tecnico delle Sue pagine, le pagine che perdono traffico da Google e i dati di Search Console e Analytics in un unico posto.",
      link: "Controlli il Suo sito gratis",
    },
  },
  copilot: {
    name: "Growth Copilot",
    badge: "Guida tutti e cinque",
    tagline: "L’assistente che li guida tutti",
    intro: "Growth Copilot non è un sesto strumento: è l’assistente di tutti e cinque. Gli chieda qualsiasi cosa sul Suo sito e risponde con i Suoi dati.",
    link: "Chieda gratis a Growth Copilot",
  },
  features: {
    plannedArticles: {
      title: "Un piano di contenuti in calendario",
      body: "Ogni tema ha il suo giorno. Ne scriva uno subito, lo modifichi o lo rimuova, e RepGet scrive gli altri nei tempi previsti e li invia al Suo sito.",
    },
    keywordResearch: {
      title: "Parole chiave alla Sua portata",
      body: "Termini di ricerca ordinati per opportunità, con ricerche mensili, concorrenza e il tema a cui appartengono. Aggiunga i Suoi e il piano si adegua.",
    },
    articleSettings: {
      title: "Articoli con il Suo stile",
      body: "Scelga lo stile di scrittura, usi le foto del Suo sito o immagini nuove, definisca la voce del Suo marchio e aggiunga indice, tabelle comparative e FAQ.",
    },
    backlinks: {
      title: "La Partner Network",
      body: "Imposti l’autorevolezza minima dei siti che La collegano e le pagine che devono ricevere link. Guadagna crediti per i link che ospita e li spende per quelli che riceve.",
    },
    aiVisibility: {
      title: "Domande e risposte monitorate",
      body: "Il Suo punteggio di visibilità, le domande in cui viene nominato e le attività nominate al Suo posto, con la prova dietro ogni risposta.",
    },
    socialContent: {
      title: "Nuove idee video ogni giorno",
      body: "20 idee al giorno dal Suo sito: video brevi, Stories e caroselli di foto con sottotitoli e musica. Approvi quelle che Le piacciono e le pubblichi o scarichi.",
    },
    opportunities: {
      title: "Conversazioni a cui partecipare",
      body: "Post e discussioni su piattaforme come Reddit, X, Threads e Bluesky, con un testo suggerito. Lo personalizzi e lo pubblichi con un clic.",
    },
    websiteHealth: {
      title: "Un punteggio di salute con correzioni chiare",
      body: "RepGet legge fino a 25 pagine del Suo sito ed elenca ciò che le frena nella ricerca, dal problema più grave, incluso se i crawler IA possono leggerle.",
    },
    losingTraffic: {
      title: "Pagine che perdono traffico",
      body: "Le pagine che ricevono meno clic da Google o compaiono meno di un mese fa, dai dati di Search Console, così sa cosa aggiornare.",
    },
    googleSearch: {
      title: "Google Search e Analytics",
      body: "Clic, impressioni, posizione e visite dal Suo Search Console e da Google Analytics, con le ricerche e le pagine principali.",
    },
    growthCopilot: {
      title: "Chieda qualsiasi cosa sul Suo sito",
      body: "Perché è calato il mio traffico? Cosa devo sistemare prima? Growth Copilot risponde con i Suoi dati e può agire per Lei quando conferma.",
    },
    tasks: {
      title: "Tutto ciò che aspetta, in un elenco",
      body: "Errori del sito da correggere, pagine in calo, bozze da rivedere e i post e le idee video del giorno, in ordine di importanza.",
    },
    homeDashboard: {
      title: "La Sua crescita a colpo d’occhio",
      body: "L’articolo del giorno, i Suoi backlink, i risultati della settimana e gli articoli che portano più clic, in un’unica pagina iniziale.",
    },
  },
  clipLabel: "Registrazione della dashboard di RepGet: {feature}",
  comingSoonTitle: "In arrivo",
  comingSoonIntro: "Ciò su cui stiamo lavorando. Non è ancora nel prodotto.",
  comingSoon: ["Controlli di visibilità con più assistenti IA", "RepGet in rumeno"],
  closingTitle: "Inizi dal Suo sito",
  closingBody: "Provi ogni strumento gratis, poi scelga il piano adatto alla Sua attività.",
  home: {
    eyebrow: "Funzioni principali",
    title: "Cinque strumenti. Un Growth Copilot.",
    sub: "Ognuno, registrato nella vera dashboard di RepGet.",
    seeAll: "Vedi tutte le funzioni",
  },
};

const de: FeaturesPageCopy = {
  metaTitle: "Funktionen: alles, was RepGet kann",
  metaDescription:
    "Fünf Werkzeuge an einem Ort: SEO-Artikel, Backlinks, KI-Sichtbarkeit, Social-Media-Posts und Videos sowie Website-Zustand, gesteuert von Growth Copilot.",
  eyebrow: "Funktionen",
  title: "Alles, was RepGet kann",
  intro:
    "Fünf Werkzeuge, die Ihre Website wachsen lassen, und ein Assistent, der sie steuert. Jeder Clip auf dieser Seite ist eine Aufnahme des echten RepGet-Dashboards.",
  primaryCta: "Kostenlos starten",
  secondaryCta: "Preise ansehen",
  indexTitle: "Top-Funktionen",
  toolNumber: "Werkzeug {n} von {count}",
  tools: {
    articles: {
      name: "Artikel",
      tagline: "Ihr SEO-Inhaltsplan, geschrieben und veröffentlicht",
      intro: "RepGet recherchiert, wonach Ihre Kunden suchen, plant die Artikel, schreibt sie in Ihrem Stil und veröffentlicht sie auf Ihrer Website.",
      link: "Auf einer echten Website ansehen",
    },
    backlinks: {
      name: "Backlinks",
      tagline: "Links von echten Unternehmenswebsites",
      intro: "Das Partner Network setzt relevante Links zu Ihren Seiten in Artikel anderer Mitglieder und zählt jeden erst, wenn er online ist.",
      link: "So funktionieren Backlinks",
    },
    aiVisibility: {
      name: "KI-Sichtbarkeit",
      tagline: "Erfahren Sie, ob KI-Assistenten Sie empfehlen",
      intro: "RepGet stellt ChatGPT, Gemini und Claude jede Woche mit Websuche die Fragen Ihrer Kunden und zeigt, ob Ihr Unternehmen genannt wird und wer stattdessen genannt wird.",
      link: "So nennt Sie die KI",
    },
    social: {
      name: "Social Media",
      tagline: "Posts, Videos und Antworten",
      intro: "Kurze Videos und Karussells aus Ihrer Website sowie Unterhaltungen, bei denen sich das Mitreden lohnt, bereit zum Prüfen und Veröffentlichen.",
      link: "Kostenlosen Post-Generator testen",
    },
    websiteHealth: {
      name: "Website-Zustand",
      tagline: "Die Prüfung und Traffic-Verlust",
      intro: "Eine technische Prüfung Ihrer Seiten, die Seiten, die Google-Traffic verlieren, und Ihre Zahlen aus Search Console und Analytics an einem Ort.",
      link: "Website kostenlos prüfen",
    },
  },
  copilot: {
    name: "Growth Copilot",
    badge: "Steuert alle fünf",
    tagline: "Der Assistent, der alle steuert",
    intro: "Growth Copilot ist kein sechstes Werkzeug, sondern der Assistent für alle fünf. Fragen Sie ihn alles zu Ihrer Website, er antwortet mit Ihren eigenen Daten.",
    link: "Growth Copilot kostenlos fragen",
  },
  features: {
    plannedArticles: {
      title: "Ein Inhaltsplan im Kalender",
      body: "Jedes Thema hat seinen Tag. Schreiben Sie eines sofort, ändern oder entfernen Sie es, und RepGet schreibt den Rest pünktlich und schickt ihn an Ihre Website.",
    },
    keywordResearch: {
      title: "Keywords, die Sie gewinnen können",
      body: "Suchbegriffe nach Chance sortiert, mit monatlichen Suchen, Wettbewerb und dem Thema, zu dem sie gehören. Fügen Sie eigene hinzu, der Plan zieht mit.",
    },
    articleSettings: {
      title: "Artikel in Ihrem Stil",
      body: "Wählen Sie den Schreibstil, nutzen Sie Fotos Ihrer Website oder neue Bilder, legen Sie Ihre Markenstimme fest und ergänzen Sie Inhaltsverzeichnis, Vergleichstabellen und FAQ.",
    },
    backlinks: {
      title: "Das Partner Network",
      body: "Legen Sie die Mindestautorität verlinkender Websites und Ihre Zielseiten fest. Für Links, die Sie aufnehmen, erhalten Sie Credits und setzen sie für Links ein, die Sie bekommen.",
    },
    aiVisibility: {
      title: "Beobachtete Fragen und Antworten",
      body: "Ihr Sichtbarkeitswert, die Fragen, bei denen Sie genannt werden, und die Unternehmen, die stattdessen genannt werden, mit dem Beleg zu jeder Antwort.",
    },
    socialContent: {
      title: "Jeden Tag neue Videoideen",
      body: "20 Ideen pro Tag aus Ihrer Website: kurze Videos, Stories und Fotokarussells mit Untertiteln und Musik. Geben Sie die passenden frei und veröffentlichen oder laden Sie sie herunter.",
    },
    opportunities: {
      title: "Unterhaltungen, die sich lohnen",
      body: "Beiträge und Diskussionen auf Plattformen wie Reddit, X, Threads und Bluesky, mit einem Textvorschlag. Passen Sie ihn an und posten Sie mit einem Klick.",
    },
    websiteHealth: {
      title: "Ein Zustandswert mit klaren Lösungen",
      body: "RepGet liest bis zu 25 Seiten Ihrer Website und listet auf, was sie in der Suche bremst, das Wichtigste zuerst, auch ob KI-Crawler sie lesen dürfen.",
    },
    losingTraffic: {
      title: "Seiten mit Traffic-Verlust",
      body: "Die Seiten, die weniger Klicks von Google bekommen oder seltener erscheinen als vor einem Monat, aus Ihren Search-Console-Daten, damit Sie wissen, was zu aktualisieren ist.",
    },
    googleSearch: {
      title: "Google Search und Analytics",
      body: "Klicks, Impressionen, Position und Besuche aus Ihrer eigenen Search Console und Google Analytics, mit Ihren wichtigsten Suchen und Seiten.",
    },
    growthCopilot: {
      title: "Fragen Sie alles zu Ihrer Website",
      body: "Warum ist mein Traffic gesunken? Was soll ich zuerst beheben? Growth Copilot antwortet mit Ihren Daten und kann für Sie handeln, sobald Sie bestätigen.",
    },
    tasks: {
      title: "Alles Offene in einer Liste",
      body: "Website-Fehler, sinkende Seiten, Entwürfe zur Prüfung sowie die Posts und Videoideen des Tages, nach Wichtigkeit geordnet.",
    },
    homeDashboard: {
      title: "Ihr Wachstum auf einen Blick",
      body: "Der Artikel des Tages, Ihre Backlinks, die Erfolge der Woche und die Artikel mit den meisten Klicks, auf einer Startseite.",
    },
  },
  clipLabel: "Aufnahme des RepGet-Dashboards: {feature}",
  comingSoonTitle: "Demnächst",
  comingSoonIntro: "Woran wir gerade arbeiten. Es ist noch nicht im Produkt.",
  comingSoon: ["Sichtbarkeitsprüfungen mit weiteren KI-Assistenten", "RepGet auf Rumänisch"],
  closingTitle: "Starten Sie mit Ihrer Website",
  closingBody: "Testen Sie jedes Werkzeug kostenlos und wählen Sie dann den passenden Tarif für Ihr Unternehmen.",
  home: {
    eyebrow: "Top-Funktionen",
    title: "Fünf Werkzeuge. Ein Growth Copilot.",
    sub: "Jedes davon im echten RepGet-Dashboard aufgenommen.",
    seeAll: "Alle Funktionen ansehen",
  },
};

const COPY: Record<Locale, FeaturesPageCopy> = { en, es, fr, it, de };

export function featuresPageCopy(locale: Locale): FeaturesPageCopy {
  return COPY[locale];
}
