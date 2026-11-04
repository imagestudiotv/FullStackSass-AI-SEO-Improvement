import type { Locale } from "@/lib/i18n/config";

/**
 * The header and footer words that the client's design (2026-11-03) added
 * on top of the menu copy in lib/i18n/home-redesign.ts: the drawings inside
 * the Features menu (each tool's mini card and "demo preview" window), the
 * Integrations menu's per-channel descriptions and mode chips, and the
 * footer's "Back to top".
 *
 * Picked out by lib/i18n/site-chrome.ts like the rest of the header's words,
 * so the client header never imports this file's siblings.
 *
 * Text shown in capitals in the design (kickers, chips, "Demo preview") is
 * written in sentence case here and capitalised in CSS, so each language
 * keeps its own casing rules.
 */
export type SiteMenuCopy = {
  /** The bar's nav landmark. */
  primaryNav: string;
  /** The menu button's name while the drawer is open. */
  closeMenu: string;
  /** Bottom-right line of the Features menu. */
  illustrations: string;
  /** Screen-reader name of each tool's list of steps. */
  workflowSteps: string;
  /** The tag in every preview window's title bar. */
  demoPreview: string;
  /** Screen-reader name of a preview window; {app} is its name. */
  windowLabel: string;
  /** The small drawing at the bottom of each tool card. */
  mini: {
    content: { kicker: string; title: string; chip: string; status: string };
    social: { kicker: string; chip: string };
    seo: { kicker: string; checks: [string, string]; bottom: string };
    backlinks: { kicker: string; bottom: string };
    ai: { kicker: string; bottom: string };
    growth: { kicker: string; bottom: string };
  };
  /** The "demo preview" product window beside each tool's description. */
  windows: {
    content: { app: string; next: string; title: string; tags: [string, string]; queue: string; rows: [string, string][] };
    social: { app: string; art: [string, string]; head: string; statuses: [string, string, string]; footer: string };
    seo: { app: string; ring: [string, string]; summary: [string, string]; head: string; rows: [string, string][]; footer: string };
    backlinks: { app: string; head: string; rows: [string, string][]; flowHead: string; flow: [string, string, string]; footer: string };
    ai: { app: string; head: string; quote: string; tags: [string, string]; channels: string; status: string };
    growth: { app: string; head: string; title: string; range: string; channels: string; rows: [string, string, string]; footer: string };
  };
  /** What hovering or focusing a channel says about it, in the Integrations menu's footer. */
  channels: Record<
    | "instagram"
    | "facebook"
    | "tiktok"
    | "linkedin"
    | "x"
    | "youtube"
    | "threads"
    | "pinterest"
    | "gbp"
    | "bluesky"
    | "reddit"
    | "quora"
    | "wordpress"
    | "shopify"
    | "webflow"
    | "wix"
    | "ghost"
    | "webhook"
    | "searchconsole"
    | "analytics",
    string
  >;
  /** The four chips beside the Integrations menu's footer text. */
  modes: [string, string, string, string];
  backToTop: string;
  /** Its screen-reader name. */
  backToTopLabel: string;
};

const en: SiteMenuCopy = {
  primaryNav: "Primary navigation",
  closeMenu: "Close menu",
  illustrations: "Product interface illustrations, not live account data",
  workflowSteps: "Workflow steps",
  demoPreview: "Demo preview",
  windowLabel: "Illustrative {app} user interface",
  mini: {
    content: { kicker: "Article planner", title: "New blog article", chip: "In review", status: "Draft ready" },
    social: { kicker: "Content queue", chip: "Scheduled" },
    seo: { kicker: "Site audit", checks: ["On-page", "Technical"], bottom: "Issues prioritized" },
    backlinks: { kicker: "Link opportunities", bottom: "Relevant placements" },
    ai: { kicker: "AI discovery", bottom: "Visibility insights" },
    growth: { kicker: "Growth insights", bottom: "Connected reporting" },
  },
  windows: {
    content: {
      app: "Content Studio",
      next: "Next article",
      title: "A guide your customers will actually find",
      tags: ["SEO brief ready", "Needs approval"],
      queue: "Publishing queue",
      rows: [["Research", "Done"], ["Writing", "Done"], ["Review", "Next"]],
    },
    social: {
      app: "Social Content",
      art: ["Build your", "brand presence."],
      head: "Distribution",
      statuses: ["Queued", "Queued", "Ready"],
      footer: "Create once. Adapt everywhere.",
    },
    seo: {
      app: "SEO Audit",
      ring: ["SEO", "Audit"],
      summary: ["Your website, reviewed", "Actionable priorities"],
      head: "Checklist",
      rows: [["Page titles", "Checked"], ["Indexing", "Checked"], ["Content gaps", "Review"]],
      footer: "Prioritized next steps",
    },
    backlinks: {
      app: "Backlink Builder",
      head: "Relevant placements",
      rows: [["Industry publication", "Qualified"], ["Partner website", "In review"], ["Local business guide", "Suggested"]],
      flowHead: "Workflow",
      flow: ["Discover", "Review", "Publish"],
      footer: "Relevant authority, built over time",
    },
    ai: {
      app: "AI Search",
      head: "Example search question",
      quote: "“Which businesses can help with my project?”",
      tags: ["Brand mentions", "Source analysis"],
      channels: "Tracked channels",
      status: "Monitor",
    },
    growth: {
      app: "Growth Reports",
      head: "Performance overview",
      title: "Visibility over time",
      range: "Last 30 days",
      channels: "Connected channels",
      rows: ["Search", "AI discovery", "Social"],
      footer: "One clear overview",
    },
  },
  channels: {
    instagram: "Prepare visual posts, Reels and carousels tailored for Instagram.",
    facebook: "Repurpose campaigns for Facebook feeds, pages and stories.",
    tiktok: "Turn content ideas into short-form, mobile-first creative.",
    linkedin: "Adapt articles and insights into professional, business-focused posts.",
    x: "Shape concise, timely posts and useful discussion threads.",
    youtube: "Plan Shorts and community content from your existing topics.",
    threads: "Create conversational micro-content made for Threads.",
    pinterest: "Develop searchable visual pins and evergreen discovery content.",
    gbp: "Give local discovery a dedicated place in your growth workflow.",
    bluesky: "Adapt social conversations for emerging communities.",
    reddit: "Prepare authentic, useful community discussions and relevant answers.",
    quora: "Turn expertise into helpful answers to questions from potential customers.",
    wordpress: "Connect WordPress and publish articles to your website.",
    shopify: "Bring search content into your Shopify storefront.",
    webflow: "Connect a Webflow website to the RepGet publishing workflow.",
    wix: "Manage content visibility for websites built with Wix.",
    ghost: "Publish optimized editorial content through Ghost.",
    webhook: "Connect custom publishing workflows through a webhook.",
    searchconsole: "Track search performance with Google Search Console data.",
    analytics: "Understand website traffic and performance alongside content.",
  },
  modes: ["Content", "SEO", "Backlinks", "AI visibility"],
  backToTop: "Back to top",
  backToTopLabel: "Back to top of page",
};

const es: SiteMenuCopy = {
  primaryNav: "Navegación principal",
  closeMenu: "Cerrar menú",
  illustrations: "Ilustraciones de la interfaz, no datos reales de una cuenta",
  workflowSteps: "Pasos del proceso",
  demoPreview: "Vista de demostración",
  windowLabel: "Interfaz ilustrativa de {app}",
  mini: {
    content: { kicker: "Planificador de artículos", title: "Nuevo artículo del blog", chip: "En revisión", status: "Borrador listo" },
    social: { kicker: "Cola de contenido", chip: "Programado" },
    seo: { kicker: "Auditoría del sitio", checks: ["On-page", "Técnico"], bottom: "Problemas priorizados" },
    backlinks: { kicker: "Oportunidades de enlaces", bottom: "Colocaciones relevantes" },
    ai: { kicker: "Descubrimiento en IA", bottom: "Datos de visibilidad" },
    growth: { kicker: "Datos de crecimiento", bottom: "Informes conectados" },
  },
  windows: {
    content: {
      app: "Content Studio",
      next: "Próximo artículo",
      title: "Una guía que sus clientes de verdad encontrarán",
      tags: ["Brief SEO listo", "Pendiente de aprobación"],
      queue: "Cola de publicación",
      rows: [["Investigación", "Hecho"], ["Redacción", "Hecho"], ["Revisión", "Siguiente"]],
    },
    social: {
      app: "Contenido social",
      art: ["Construya la", "presencia de su marca."],
      head: "Distribución",
      statuses: ["En cola", "En cola", "Listo"],
      footer: "Cree una vez. Adapte en todas partes.",
    },
    seo: {
      app: "Auditoría SEO",
      ring: ["SEO", "Auditoría"],
      summary: ["Su sitio, revisado", "Prioridades concretas"],
      head: "Lista de control",
      rows: [["Títulos de página", "Revisado"], ["Indexación", "Revisado"], ["Huecos de contenido", "Revisar"]],
      footer: "Próximos pasos priorizados",
    },
    backlinks: {
      app: "Backlink Builder",
      head: "Colocaciones relevantes",
      rows: [["Publicación del sector", "Validado"], ["Sitio de un socio", "En revisión"], ["Guía de negocios local", "Sugerido"]],
      flowHead: "Proceso",
      flow: ["Descubrir", "Revisar", "Publicar"],
      footer: "Autoridad relevante, construida con el tiempo",
    },
    ai: {
      app: "Búsqueda con IA",
      head: "Ejemplo de pregunta",
      quote: "“¿Qué empresas pueden ayudarme con mi proyecto?”",
      tags: ["Menciones de marca", "Análisis de fuentes"],
      channels: "Canales seguidos",
      status: "Vigilar",
    },
    growth: {
      app: "Informes de crecimiento",
      head: "Resumen de rendimiento",
      title: "Visibilidad en el tiempo",
      range: "Últimos 30 días",
      channels: "Canales conectados",
      rows: ["Búsqueda", "Descubrimiento en IA", "Redes"],
      footer: "Una visión clara",
    },
  },
  channels: {
    instagram: "Prepare publicaciones visuales, Reels y carruseles pensados para Instagram.",
    facebook: "Reutilice sus campañas en el feed, las páginas y las historias de Facebook.",
    tiktok: "Convierta ideas de contenido en piezas cortas pensadas para el móvil.",
    linkedin: "Adapte artículos e ideas a publicaciones profesionales orientadas a negocio.",
    x: "Dé forma a publicaciones breves y oportunas y a hilos de conversación útiles.",
    youtube: "Planifique Shorts y contenido para la comunidad a partir de sus temas.",
    threads: "Cree microcontenido conversacional pensado para Threads.",
    pinterest: "Cree pines visuales fáciles de buscar y contenido de descubrimiento duradero.",
    gbp: "Dé a la búsqueda local su propio lugar en su proceso de crecimiento.",
    bluesky: "Adapte sus conversaciones sociales a comunidades emergentes.",
    reddit: "Prepare conversaciones auténticas y útiles y respuestas relevantes.",
    quora: "Convierta su experiencia en respuestas útiles para posibles clientes.",
    wordpress: "Conecte WordPress y publique artículos en su sitio web.",
    shopify: "Lleve contenido pensado para la búsqueda a su tienda Shopify.",
    webflow: "Conecte un sitio de Webflow al proceso de publicación de RepGet.",
    wix: "Gestione la visibilidad del contenido de sitios creados con Wix.",
    ghost: "Publique contenido editorial optimizado a través de Ghost.",
    webhook: "Conecte procesos de publicación propios mediante un webhook.",
    searchconsole: "Siga el rendimiento en búsquedas con datos de Google Search Console.",
    analytics: "Entienda el tráfico y el rendimiento de su sitio junto a su contenido.",
  },
  modes: ["Contenido", "SEO", "Backlinks", "Visibilidad en IA"],
  backToTop: "Volver arriba",
  backToTopLabel: "Volver al principio de la página",
};

const fr: SiteMenuCopy = {
  primaryNav: "Navigation principale",
  closeMenu: "Fermer le menu",
  illustrations: "Illustrations de l’interface, pas de données réelles",
  workflowSteps: "Étapes du processus",
  demoPreview: "Aperçu de démo",
  windowLabel: "Interface illustrative de {app}",
  mini: {
    content: { kicker: "Planificateur d’articles", title: "Nouvel article de blog", chip: "En relecture", status: "Brouillon prêt" },
    social: { kicker: "File de contenu", chip: "Programmé" },
    seo: { kicker: "Audit du site", checks: ["On-page", "Technique"], bottom: "Problèmes priorisés" },
    backlinks: { kicker: "Opportunités de liens", bottom: "Placements pertinents" },
    ai: { kicker: "Découverte par l’IA", bottom: "Indicateurs de visibilité" },
    growth: { kicker: "Indicateurs de croissance", bottom: "Rapports connectés" },
  },
  windows: {
    content: {
      app: "Content Studio",
      next: "Prochain article",
      title: "Un guide que vos clients trouveront vraiment",
      tags: ["Brief SEO prêt", "À valider"],
      queue: "File de publication",
      rows: [["Recherche", "Fait"], ["Rédaction", "Fait"], ["Relecture", "Suivant"]],
    },
    social: {
      app: "Contenu social",
      art: ["Développez la", "présence de votre marque."],
      head: "Diffusion",
      statuses: ["En file", "En file", "Prêt"],
      footer: "Créez une fois. Adaptez partout.",
    },
    seo: {
      app: "Audit SEO",
      ring: ["SEO", "Audit"],
      summary: ["Votre site, passé en revue", "Des priorités concrètes"],
      head: "Liste de contrôle",
      rows: [["Titres de page", "Vérifié"], ["Indexation", "Vérifié"], ["Manques de contenu", "À revoir"]],
      footer: "Prochaines étapes priorisées",
    },
    backlinks: {
      app: "Backlink Builder",
      head: "Placements pertinents",
      rows: [["Publication du secteur", "Qualifié"], ["Site partenaire", "En relecture"], ["Guide local des entreprises", "Suggéré"]],
      flowHead: "Processus",
      flow: ["Découvrir", "Relire", "Publier"],
      footer: "Une autorité pertinente, construite dans la durée",
    },
    ai: {
      app: "Recherche IA",
      head: "Exemple de question",
      quote: "« Quelles entreprises peuvent m’aider pour mon projet ? »",
      tags: ["Mentions de marque", "Analyse des sources"],
      channels: "Canaux suivis",
      status: "Suivi",
    },
    growth: {
      app: "Rapports de croissance",
      head: "Vue d’ensemble",
      title: "Visibilité dans le temps",
      range: "30 derniers jours",
      channels: "Canaux connectés",
      rows: ["Recherche", "Découverte par l’IA", "Réseaux"],
      footer: "Une vue d’ensemble claire",
    },
  },
  channels: {
    instagram: "Préparez des visuels, des Reels et des carrousels pensés pour Instagram.",
    facebook: "Réutilisez vos campagnes dans le fil, les pages et les stories Facebook.",
    tiktok: "Transformez vos idées en contenus courts, pensés pour le mobile.",
    linkedin: "Adaptez articles et analyses en publications professionnelles.",
    x: "Rédigez des publications concises et opportunes et des fils de discussion utiles.",
    youtube: "Planifiez des Shorts et du contenu communautaire à partir de vos sujets.",
    threads: "Créez du micro-contenu conversationnel pensé pour Threads.",
    pinterest: "Créez des épingles visuelles faciles à trouver et du contenu durable.",
    gbp: "Donnez à la recherche locale une vraie place dans votre croissance.",
    bluesky: "Adaptez vos échanges sociaux aux communautés émergentes.",
    reddit: "Préparez des discussions authentiques et utiles et des réponses pertinentes.",
    quora: "Transformez votre expertise en réponses utiles pour de futurs clients.",
    wordpress: "Connectez WordPress et publiez des articles sur votre site.",
    shopify: "Apportez du contenu pensé pour la recherche à votre boutique Shopify.",
    webflow: "Connectez un site Webflow au processus de publication de RepGet.",
    wix: "Gérez la visibilité du contenu des sites créés avec Wix.",
    ghost: "Publiez du contenu éditorial optimisé via Ghost.",
    webhook: "Connectez vos propres processus de publication par webhook.",
    searchconsole: "Suivez vos performances de recherche avec les données de Google Search Console.",
    analytics: "Comprenez le trafic et les performances de votre site, à côté de vos contenus.",
  },
  modes: ["Contenu", "SEO", "Backlinks", "Visibilité IA"],
  backToTop: "Haut de page",
  backToTopLabel: "Revenir en haut de la page",
};

const it: SiteMenuCopy = {
  primaryNav: "Navigazione principale",
  closeMenu: "Chiudi il menu",
  illustrations: "Illustrazioni dell’interfaccia, non dati reali di un account",
  workflowSteps: "Passaggi del processo",
  demoPreview: "Anteprima demo",
  windowLabel: "Interfaccia illustrativa di {app}",
  mini: {
    content: { kicker: "Pianificatore di articoli", title: "Nuovo articolo del blog", chip: "In revisione", status: "Bozza pronta" },
    social: { kicker: "Coda dei contenuti", chip: "Programmato" },
    seo: { kicker: "Analisi del sito", checks: ["On-page", "Tecnico"], bottom: "Problemi in ordine di priorità" },
    backlinks: { kicker: "Opportunità di link", bottom: "Inserimenti pertinenti" },
    ai: { kicker: "Scoperta nell’IA", bottom: "Dati sulla visibilità" },
    growth: { kicker: "Dati sulla crescita", bottom: "Report collegati" },
  },
  windows: {
    content: {
      app: "Content Studio",
      next: "Prossimo articolo",
      title: "Una guida che i Suoi clienti troveranno davvero",
      tags: ["Brief SEO pronto", "Da approvare"],
      queue: "Coda di pubblicazione",
      rows: [["Ricerca", "Fatto"], ["Scrittura", "Fatto"], ["Revisione", "Prossimo"]],
    },
    social: {
      app: "Contenuti social",
      art: ["Costruisca la", "presenza del Suo marchio."],
      head: "Distribuzione",
      statuses: ["In coda", "In coda", "Pronto"],
      footer: "Crei una volta. Adatti ovunque.",
    },
    seo: {
      app: "Analisi SEO",
      ring: ["SEO", "Analisi"],
      summary: ["Il Suo sito, esaminato", "Priorità concrete"],
      head: "Lista di controllo",
      rows: [["Titoli di pagina", "Verificato"], ["Indicizzazione", "Verificato"], ["Lacune di contenuto", "Da rivedere"]],
      footer: "Prossimi passi per priorità",
    },
    backlinks: {
      app: "Backlink Builder",
      head: "Inserimenti pertinenti",
      rows: [["Pubblicazione di settore", "Valutato"], ["Sito partner", "In revisione"], ["Guida locale alle attività", "Suggerito"]],
      flowHead: "Processo",
      flow: ["Scoprire", "Rivedere", "Pubblicare"],
      footer: "Autorevolezza pertinente, costruita nel tempo",
    },
    ai: {
      app: "Ricerca IA",
      head: "Esempio di domanda",
      quote: "“Quali aziende possono aiutarmi con il mio progetto?”",
      tags: ["Menzioni del marchio", "Analisi delle fonti"],
      channels: "Canali monitorati",
      status: "Monitorare",
    },
    growth: {
      app: "Report di crescita",
      head: "Panoramica dei risultati",
      title: "Visibilità nel tempo",
      range: "Ultimi 30 giorni",
      channels: "Canali collegati",
      rows: ["Ricerca", "Scoperta nell’IA", "Social"],
      footer: "Una panoramica chiara",
    },
  },
  channels: {
    instagram: "Prepari post visivi, Reel e caroselli pensati per Instagram.",
    facebook: "Riutilizzi le campagne per il feed, le pagine e le storie di Facebook.",
    tiktok: "Trasformi le idee in contenuti brevi pensati per lo smartphone.",
    linkedin: "Adatti articoli e analisi in post professionali orientati al business.",
    x: "Crei post concisi e tempestivi e thread di discussione utili.",
    youtube: "Pianifichi Shorts e contenuti per la community a partire dai Suoi temi.",
    threads: "Crei micro-contenuti colloquiali pensati per Threads.",
    pinterest: "Sviluppi pin visivi facili da cercare e contenuti di scoperta duraturi.",
    gbp: "Dia alla ricerca locale uno spazio dedicato nel Suo processo di crescita.",
    bluesky: "Adatti le conversazioni social alle community emergenti.",
    reddit: "Prepari discussioni autentiche e utili e risposte pertinenti.",
    quora: "Trasformi la Sua esperienza in risposte utili per potenziali clienti.",
    wordpress: "Colleghi WordPress e pubblichi articoli sul Suo sito.",
    shopify: "Porti contenuti pensati per la ricerca nel Suo negozio Shopify.",
    webflow: "Colleghi un sito Webflow al processo di pubblicazione di RepGet.",
    wix: "Gestisca la visibilità dei contenuti dei siti creati con Wix.",
    ghost: "Pubblichi contenuti editoriali ottimizzati tramite Ghost.",
    webhook: "Colleghi processi di pubblicazione personalizzati tramite un webhook.",
    searchconsole: "Segua i risultati nella ricerca con i dati di Google Search Console.",
    analytics: "Capisca il traffico e i risultati del sito accanto ai contenuti.",
  },
  modes: ["Contenuti", "SEO", "Backlink", "Visibilità IA"],
  backToTop: "Torna su",
  backToTopLabel: "Torna all’inizio della pagina",
};

const de: SiteMenuCopy = {
  primaryNav: "Hauptnavigation",
  closeMenu: "Menü schließen",
  illustrations: "Illustrationen der Oberfläche, keine echten Kontodaten",
  workflowSteps: "Arbeitsschritte",
  demoPreview: "Demo-Vorschau",
  windowLabel: "Illustrative Oberfläche von {app}",
  mini: {
    content: { kicker: "Artikelplaner", title: "Neuer Blogartikel", chip: "In Prüfung", status: "Entwurf fertig" },
    social: { kicker: "Inhalts-Warteschlange", chip: "Geplant" },
    seo: { kicker: "Website-Check", checks: ["On-Page", "Technik"], bottom: "Probleme priorisiert" },
    backlinks: { kicker: "Link-Chancen", bottom: "Relevante Platzierungen" },
    ai: { kicker: "KI-Sichtbarkeit", bottom: "Sichtbarkeitsdaten" },
    growth: { kicker: "Wachstumsdaten", bottom: "Vernetzte Berichte" },
  },
  windows: {
    content: {
      app: "Content Studio",
      next: "Nächster Artikel",
      title: "Ein Ratgeber, den Ihre Kunden wirklich finden",
      tags: ["SEO-Briefing fertig", "Freigabe nötig"],
      queue: "Veröffentlichung",
      rows: [["Recherche", "Fertig"], ["Schreiben", "Fertig"], ["Prüfung", "Als Nächstes"]],
    },
    social: {
      app: "Social-Media-Inhalte",
      art: ["Stärken Sie Ihre", "Markenpräsenz."],
      head: "Verteilung",
      statuses: ["Geplant", "Geplant", "Bereit"],
      footer: "Einmal erstellen. Überall anpassen.",
    },
    seo: {
      app: "SEO-Check",
      ring: ["SEO", "Check"],
      summary: ["Ihre Website, geprüft", "Klare Prioritäten"],
      head: "Checkliste",
      rows: [["Seitentitel", "Geprüft"], ["Indexierung", "Geprüft"], ["Inhaltslücken", "Prüfen"]],
      footer: "Priorisierte nächste Schritte",
    },
    backlinks: {
      app: "Backlink Builder",
      head: "Relevante Platzierungen",
      rows: [["Branchenmagazin", "Bewertet"], ["Partner-Website", "In Prüfung"], ["Lokales Branchenverzeichnis", "Vorgeschlagen"]],
      flowHead: "Ablauf",
      flow: ["Entdecken", "Prüfen", "Veröffentlichen"],
      footer: "Relevante Autorität, langfristig aufgebaut",
    },
    ai: {
      app: "KI-Suche",
      head: "Beispiel einer Suchanfrage",
      quote: "„Welche Unternehmen können mir bei meinem Projekt helfen?“",
      tags: ["Markenerwähnungen", "Quellenanalyse"],
      channels: "Beobachtete Kanäle",
      status: "Beobachten",
    },
    growth: {
      app: "Wachstumsberichte",
      head: "Leistungsübersicht",
      title: "Sichtbarkeit im Zeitverlauf",
      range: "Letzte 30 Tage",
      channels: "Verbundene Kanäle",
      rows: ["Suche", "KI-Sichtbarkeit", "Social Media"],
      footer: "Ein klarer Überblick",
    },
  },
  channels: {
    instagram: "Bereiten Sie Bildbeiträge, Reels und Karussells passend für Instagram vor.",
    facebook: "Nutzen Sie Kampagnen für Facebook-Feed, Seiten und Storys weiter.",
    tiktok: "Machen Sie aus Ideen kurze Inhalte, gedacht fürs Smartphone.",
    linkedin: "Verwandeln Sie Artikel und Erkenntnisse in professionelle Business-Beiträge.",
    x: "Formulieren Sie knappe, aktuelle Beiträge und nützliche Diskussions-Threads.",
    youtube: "Planen Sie Shorts und Community-Inhalte aus Ihren bestehenden Themen.",
    threads: "Erstellen Sie gesprächige Kurzinhalte speziell für Threads.",
    pinterest: "Entwickeln Sie auffindbare Bild-Pins und dauerhaft relevante Inhalte.",
    gbp: "Geben Sie der lokalen Suche einen festen Platz in Ihrem Wachstum.",
    bluesky: "Passen Sie Ihre Social-Media-Gespräche an neue Communitys an.",
    reddit: "Bereiten Sie authentische, nützliche Diskussionen und passende Antworten vor.",
    quora: "Machen Sie aus Ihrem Fachwissen hilfreiche Antworten für künftige Kunden.",
    wordpress: "Verbinden Sie WordPress und veröffentlichen Sie Artikel auf Ihrer Website.",
    shopify: "Bringen Sie suchstarke Inhalte in Ihren Shopify-Shop.",
    webflow: "Verbinden Sie eine Webflow-Website mit dem Veröffentlichungsablauf von RepGet.",
    wix: "Steuern Sie die Sichtbarkeit von Inhalten auf Wix-Websites.",
    ghost: "Veröffentlichen Sie optimierte redaktionelle Inhalte über Ghost.",
    webhook: "Verbinden Sie eigene Veröffentlichungsabläufe über einen Webhook.",
    searchconsole: "Verfolgen Sie Ihre Suchleistung mit Daten aus der Google Search Console.",
    analytics: "Verstehen Sie Besucherzahlen und Leistung Ihrer Website neben Ihren Inhalten.",
  },
  modes: ["Inhalte", "SEO", "Backlinks", "KI-Sichtbarkeit"],
  backToTop: "Nach oben",
  backToTopLabel: "Zum Seitenanfang",
};

const COPY: Record<Locale, SiteMenuCopy> = { en, es, fr, it, de };

export function siteMenuCopy(locale: Locale): SiteMenuCopy {
  return COPY[locale];
}
