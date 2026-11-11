import type { Locale } from "@/lib/i18n/config";

/**
 * The words of the RepGet Customer Showcase (client, 2026-11-11 round 2):
 * the directory, /discover (repget_growth_businesses_brand_colors.html), and
 * one business's page, /discover/<slug> (repget_customer_showcase_centered.html).
 * English is the designs' text; the others are translations, in the formal
 * register. Here rather than in messages.ts, which must never reach the
 * browser: the directory's list and the profile's buttons are client
 * components, and only the reader's language is passed to them.
 *
 * "{name}" is the business, "{n}" a number, "{url}" the profile's address.
 */

export type DiscoverDirectoryCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  /** The h1: the lead, then "RepGet" in the brand colour. */
  titleLead: string;
  titleBrand: string;
  subhead: string;
  filtersLabel: string;
  all: string;
  searchLabel: string;
  searchPlaceholder: string;
  countOne: string;
  countOther: string;
  sortBy: string;
  sortLabel: string;
  mostUpvoted: string;
  nameAZ: string;
  emptyTitle: string;
  emptyText: string;
  bottomTitle: string;
  bottomText: string;
  bottomLink: string;
  viewOn: string;
  viewListing: string;
  rowActions: string;
  views: string;
  viewsTitle: string;
  comments: string;
  commentsTitle: string;
  upvoteTitle: string;
  upvote: string;
  removeUpvote: string;
  visit: string;
  visitLabel: string;
  visitPending: string;
};

export type DiscoverProfileCopy = {
  metaTitle: string;
  breadcrumbLabel: string;
  businesses: string;
  categoriesLabel: string;
  featured: string;
  logoLabel: string;
  visitWebsite: string;
  websitePending: string;
  upvote: string;
  upvoteLabel: string;
  removeUpvote: string;
  copyLink: string;
  copyLabel: string;
  copied: string;
  copyFailed: string;
  photoLabel: string;
  statsLabel: string;
  upvotes: string;
  thisWeek: string;
  comments: string;
  discussions: string;
  impressions: string;
  about: string;
  audience: string;
  services: string;
  details: string;
  industry: string;
  basedIn: string;
  availableIn: string;
  website: string;
  growth: string;
  growthText: string;
  growthLink: string;
  commentsTitle: string;
  commentIntro: string;
  joinTitle: string;
  joinText: string;
  signIn: string;
  createAccount: string;
  noComments: string;
  featureText: string;
  featureLink: string;
};

export type DiscoverCopy = { directory: DiscoverDirectoryCopy; profile: DiscoverProfileCopy };

export const DISCOVER_COPY: Record<Locale, DiscoverCopy> = {
  en: {
    directory: {
      metaTitle: "Growing with RepGet | Customer Directory",
      metaDescription: "Explore businesses growing with RepGet. Discover customer websites across creative, business, travel and music.",
      eyebrow: "Success Stories / Customer directory",
      titleLead: "Growing with ",
      titleBrand: "RepGet",
      subhead: "Discover the businesses building their online presence with RepGet.",
      filtersLabel: "Filter by industry",
      all: "All",
      searchLabel: "Search businesses",
      searchPlaceholder: "Search businesses",
      countOne: "{n} business",
      countOther: "{n} businesses",
      sortBy: "Sort by",
      sortLabel: "Sort businesses",
      mostUpvoted: "Most upvoted",
      nameAZ: "Name A–Z",
      emptyTitle: "No businesses found",
      emptyText: "Try another search or category.",
      bottomTitle: "Growing with RepGet?",
      bottomText: "Let more people discover your business.",
      bottomLink: "Get featured ↗",
      viewOn: "View {name} on RepGet",
      viewListing: "View {name} listing",
      rowActions: "Engagement and actions for {name}",
      views: "{n} views",
      viewsTitle: "Views",
      comments: "View {n} comments for {name}",
      commentsTitle: "Comments",
      upvoteTitle: "Upvote {name}",
      upvote: "Upvote {name}",
      removeUpvote: "Remove upvote from {name}",
      visit: "Visit",
      visitLabel: "Visit {name} website",
      visitPending: "Website address not provided",
    },
    profile: {
      metaTitle: "{name} | Discover on RepGet",
      breadcrumbLabel: "Breadcrumb",
      businesses: "Businesses",
      categoriesLabel: "Business categories",
      featured: "Featured business",
      logoLabel: "{name} logo",
      visitWebsite: "Visit website",
      websitePending: "Website address pending",
      upvote: "Upvote",
      upvoteLabel: "Upvote {name}",
      removeUpvote: "Remove upvote for {name}",
      copyLink: "Copy link",
      copyLabel: "Copy link to this profile",
      copied: "Profile link copied",
      copyFailed: "Profile URL: {url}",
      photoLabel: "{name} portfolio photo",
      statsLabel: "Business engagement",
      upvotes: "Upvotes",
      thisWeek: "this week",
      comments: "Comments",
      discussions: "discussions",
      impressions: "Impressions",
      about: "About",
      audience: "Who it's for",
      services: "Main services",
      details: "Business details",
      industry: "Industry",
      basedIn: "Based in",
      availableIn: "Available in",
      website: "Website",
      growth: "Growing with RepGet",
      growthText: "Follow {name}'s public case study, documenting the website's starting point, content activity and ongoing search visibility progress.",
      growthLink: "Read the growth case study",
      commentsTitle: "Comments",
      commentIntro: "Share your thoughts, ask a question or start a conversation with this business.",
      joinTitle: "Join the discussion",
      joinText: "Sign in with your RepGet account to leave a comment.",
      signIn: "Sign in to comment",
      createAccount: "Create an account",
      noComments: "No comments yet. Be the first to leave one.",
      featureText: "Have a business you want more people to discover?",
      featureLink: "Get featured on RepGet ↗",
    },
  },
  es: {
    directory: {
      metaTitle: "Creciendo con RepGet | Directorio de clientes",
      metaDescription: "Explore las empresas que crecen con RepGet. Descubra sitios web de clientes de los sectores creativo, empresarial, de viajes y de música.",
      eyebrow: "Casos de éxito / Directorio de clientes",
      titleLead: "Creciendo con ",
      titleBrand: "RepGet",
      subhead: "Descubra las empresas que construyen su presencia en internet con RepGet.",
      filtersLabel: "Filtrar por sector",
      all: "Todas",
      searchLabel: "Buscar empresas",
      searchPlaceholder: "Buscar empresas",
      countOne: "{n} empresa",
      countOther: "{n} empresas",
      sortBy: "Ordenar por",
      sortLabel: "Ordenar empresas",
      mostUpvoted: "Más votadas",
      nameAZ: "Nombre A–Z",
      emptyTitle: "No se han encontrado empresas",
      emptyText: "Pruebe con otra búsqueda o categoría.",
      bottomTitle: "¿Crece con RepGet?",
      bottomText: "Permita que más personas descubran su empresa.",
      bottomLink: "Destaque su empresa ↗",
      viewOn: "Ver {name} en RepGet",
      viewListing: "Ver la ficha de {name}",
      rowActions: "Interacción y acciones de {name}",
      views: "{n} visitas",
      viewsTitle: "Visitas",
      comments: "Ver los {n} comentarios sobre {name}",
      commentsTitle: "Comentarios",
      upvoteTitle: "Votar por {name}",
      upvote: "Votar por {name}",
      removeUpvote: "Retirar el voto a {name}",
      visit: "Visitar",
      visitLabel: "Visitar el sitio web de {name}",
      visitPending: "Dirección web no indicada",
    },
    profile: {
      metaTitle: "{name} | Descubra en RepGet",
      breadcrumbLabel: "Ruta de navegación",
      businesses: "Empresas",
      categoriesLabel: "Categorías de la empresa",
      featured: "Empresa destacada",
      logoLabel: "Logotipo de {name}",
      visitWebsite: "Visitar el sitio web",
      websitePending: "Dirección web pendiente",
      upvote: "Votar",
      upvoteLabel: "Votar por {name}",
      removeUpvote: "Retirar el voto a {name}",
      copyLink: "Copiar enlace",
      copyLabel: "Copiar el enlace a este perfil",
      copied: "Enlace del perfil copiado",
      copyFailed: "URL del perfil: {url}",
      photoLabel: "Fotografía del portafolio de {name}",
      statsLabel: "Interacción con la empresa",
      upvotes: "Votos",
      thisWeek: "esta semana",
      comments: "Comentarios",
      discussions: "conversaciones",
      impressions: "Impresiones",
      about: "Acerca de",
      audience: "A quién se dirige",
      services: "Servicios principales",
      details: "Datos de la empresa",
      industry: "Sector",
      basedIn: "Con sede en",
      availableIn: "Disponible en",
      website: "Sitio web",
      growth: "Creciendo con RepGet",
      growthText: "Siga el caso de estudio público de {name}, que documenta el punto de partida del sitio web, su actividad de contenidos y la evolución de su visibilidad en buscadores.",
      growthLink: "Leer el caso de crecimiento",
      commentsTitle: "Comentarios",
      commentIntro: "Comparta su opinión, haga una pregunta o inicie una conversación con esta empresa.",
      joinTitle: "Únase a la conversación",
      joinText: "Inicie sesión con su cuenta de RepGet para dejar un comentario.",
      signIn: "Iniciar sesión para comentar",
      createAccount: "Crear una cuenta",
      noComments: "Todavía no hay comentarios. Sea el primero en escribir uno.",
      featureText: "¿Tiene una empresa que quiere que más personas descubran?",
      featureLink: "Destaque su empresa en RepGet ↗",
    },
  },
  fr: {
    directory: {
      metaTitle: "Grandir avec RepGet | Annuaire des clients",
      metaDescription: "Découvrez les entreprises qui se développent avec RepGet : des sites web de clients dans la création, les affaires, le voyage et la musique.",
      eyebrow: "Réussites clients / Annuaire des clients",
      titleLead: "Grandir avec ",
      titleBrand: "RepGet",
      subhead: "Découvrez les entreprises qui développent leur présence en ligne avec RepGet.",
      filtersLabel: "Filtrer par secteur",
      all: "Toutes",
      searchLabel: "Rechercher une entreprise",
      searchPlaceholder: "Rechercher une entreprise",
      countOne: "{n} entreprise",
      countOther: "{n} entreprises",
      sortBy: "Trier par",
      sortLabel: "Trier les entreprises",
      mostUpvoted: "Les plus soutenues",
      nameAZ: "Nom A–Z",
      emptyTitle: "Aucune entreprise trouvée",
      emptyText: "Essayez une autre recherche ou une autre catégorie.",
      bottomTitle: "Vous grandissez avec RepGet ?",
      bottomText: "Faites découvrir votre entreprise à davantage de personnes.",
      bottomLink: "Être mis en avant ↗",
      viewOn: "Voir {name} sur RepGet",
      viewListing: "Voir la fiche de {name}",
      rowActions: "Interactions et actions pour {name}",
      views: "{n} vues",
      viewsTitle: "Vues",
      comments: "Voir les {n} commentaires sur {name}",
      commentsTitle: "Commentaires",
      upvoteTitle: "Soutenir {name}",
      upvote: "Soutenir {name}",
      removeUpvote: "Retirer votre soutien à {name}",
      visit: "Visiter",
      visitLabel: "Visiter le site web de {name}",
      visitPending: "Adresse du site non indiquée",
    },
    profile: {
      metaTitle: "{name} | À découvrir sur RepGet",
      breadcrumbLabel: "Fil d’Ariane",
      businesses: "Entreprises",
      categoriesLabel: "Catégories de l’entreprise",
      featured: "Entreprise à la une",
      logoLabel: "Logo de {name}",
      visitWebsite: "Visiter le site web",
      websitePending: "Adresse du site à venir",
      upvote: "Soutenir",
      upvoteLabel: "Soutenir {name}",
      removeUpvote: "Retirer votre soutien à {name}",
      copyLink: "Copier le lien",
      copyLabel: "Copier le lien de ce profil",
      copied: "Lien du profil copié",
      copyFailed: "Adresse du profil : {url}",
      photoLabel: "Photo du portfolio de {name}",
      statsLabel: "Interactions avec l’entreprise",
      upvotes: "Soutiens",
      thisWeek: "cette semaine",
      comments: "Commentaires",
      discussions: "discussions",
      impressions: "Impressions",
      about: "À propos",
      audience: "Pour qui",
      services: "Principaux services",
      details: "Informations sur l’entreprise",
      industry: "Secteur",
      basedIn: "Basée à",
      availableIn: "Disponible en",
      website: "Site web",
      growth: "Grandir avec RepGet",
      growthText: "Suivez l’étude de cas publique de {name}, qui retrace le point de départ du site, son activité éditoriale et l’évolution de sa visibilité dans les moteurs de recherche.",
      growthLink: "Lire l’étude de cas",
      commentsTitle: "Commentaires",
      commentIntro: "Donnez votre avis, posez une question ou engagez la conversation avec cette entreprise.",
      joinTitle: "Rejoignez la discussion",
      joinText: "Connectez-vous avec votre compte RepGet pour laisser un commentaire.",
      signIn: "Se connecter pour commenter",
      createAccount: "Créer un compte",
      noComments: "Aucun commentaire pour le moment. Soyez le premier à en laisser un.",
      featureText: "Vous avez une entreprise que vous souhaitez faire découvrir à davantage de personnes ?",
      featureLink: "Être mis en avant sur RepGet ↗",
    },
  },
  it: {
    directory: {
      metaTitle: "Crescere con RepGet | Directory dei clienti",
      metaDescription: "Esplori le aziende che crescono con RepGet. Scopra i siti web dei clienti nei settori creativo, business, viaggi e musica.",
      eyebrow: "Storie di successo / Directory dei clienti",
      titleLead: "Crescere con ",
      titleBrand: "RepGet",
      subhead: "Scopra le aziende che costruiscono la loro presenza online con RepGet.",
      filtersLabel: "Filtra per settore",
      all: "Tutte",
      searchLabel: "Cerca aziende",
      searchPlaceholder: "Cerca aziende",
      countOne: "{n} azienda",
      countOther: "{n} aziende",
      sortBy: "Ordina per",
      sortLabel: "Ordina le aziende",
      mostUpvoted: "Più votate",
      nameAZ: "Nome A–Z",
      emptyTitle: "Nessuna azienda trovata",
      emptyText: "Provi con un’altra ricerca o categoria.",
      bottomTitle: "Cresce con RepGet?",
      bottomText: "Faccia scoprire la sua azienda a più persone.",
      bottomLink: "Ottenga visibilità ↗",
      viewOn: "Vedi {name} su RepGet",
      viewListing: "Vedi la scheda di {name}",
      rowActions: "Interazioni e azioni per {name}",
      views: "{n} visualizzazioni",
      viewsTitle: "Visualizzazioni",
      comments: "Vedi i {n} commenti su {name}",
      commentsTitle: "Commenti",
      upvoteTitle: "Vota {name}",
      upvote: "Vota {name}",
      removeUpvote: "Rimuovi il voto a {name}",
      visit: "Visita",
      visitLabel: "Visita il sito web di {name}",
      visitPending: "Indirizzo del sito non indicato",
    },
    profile: {
      metaTitle: "{name} | Scopri su RepGet",
      breadcrumbLabel: "Percorso di navigazione",
      businesses: "Aziende",
      categoriesLabel: "Categorie dell’azienda",
      featured: "Azienda in evidenza",
      logoLabel: "Logo di {name}",
      visitWebsite: "Visita il sito web",
      websitePending: "Indirizzo del sito in arrivo",
      upvote: "Vota",
      upvoteLabel: "Vota {name}",
      removeUpvote: "Rimuovi il voto a {name}",
      copyLink: "Copia link",
      copyLabel: "Copia il link a questo profilo",
      copied: "Link del profilo copiato",
      copyFailed: "Indirizzo del profilo: {url}",
      photoLabel: "Foto del portfolio di {name}",
      statsLabel: "Interazioni con l’azienda",
      upvotes: "Voti",
      thisWeek: "questa settimana",
      comments: "Commenti",
      discussions: "discussioni",
      impressions: "Impressioni",
      about: "Informazioni",
      audience: "A chi si rivolge",
      services: "Servizi principali",
      details: "Dati dell’azienda",
      industry: "Settore",
      basedIn: "Sede",
      availableIn: "Disponibile in",
      website: "Sito web",
      growth: "Crescere con RepGet",
      growthText: "Segua il caso di studio pubblico di {name}, che documenta il punto di partenza del sito, l’attività sui contenuti e l’andamento della visibilità nei motori di ricerca.",
      growthLink: "Legga il caso di crescita",
      commentsTitle: "Commenti",
      commentIntro: "Condivida la sua opinione, faccia una domanda o avvii una conversazione con questa azienda.",
      joinTitle: "Partecipi alla discussione",
      joinText: "Acceda con il suo account RepGet per lasciare un commento.",
      signIn: "Acceda per commentare",
      createAccount: "Crei un account",
      noComments: "Ancora nessun commento. Sia il primo a lasciarne uno.",
      featureText: "Ha un’azienda che vorrebbe far scoprire a più persone?",
      featureLink: "Ottenga visibilità su RepGet ↗",
    },
  },
  de: {
    directory: {
      metaTitle: "Wachsen mit RepGet | Kundenverzeichnis",
      metaDescription: "Entdecken Sie Unternehmen, die mit RepGet wachsen – Kundenwebsites aus den Bereichen Kreativ, Business, Reisen und Musik.",
      eyebrow: "Erfolgsgeschichten / Kundenverzeichnis",
      titleLead: "Wachsen mit ",
      titleBrand: "RepGet",
      subhead: "Entdecken Sie die Unternehmen, die mit RepGet ihre Online-Präsenz aufbauen.",
      filtersLabel: "Nach Branche filtern",
      all: "Alle",
      searchLabel: "Unternehmen suchen",
      searchPlaceholder: "Unternehmen suchen",
      countOne: "{n} Unternehmen",
      countOther: "{n} Unternehmen",
      sortBy: "Sortieren nach",
      sortLabel: "Unternehmen sortieren",
      mostUpvoted: "Meiste Stimmen",
      nameAZ: "Name A–Z",
      emptyTitle: "Keine Unternehmen gefunden",
      emptyText: "Versuchen Sie es mit einer anderen Suche oder Kategorie.",
      bottomTitle: "Wachsen Sie mit RepGet?",
      bottomText: "Lassen Sie mehr Menschen Ihr Unternehmen entdecken.",
      bottomLink: "Vorgestellt werden ↗",
      viewOn: "{name} auf RepGet ansehen",
      viewListing: "Eintrag von {name} ansehen",
      rowActions: "Interaktionen und Aktionen für {name}",
      views: "{n} Aufrufe",
      viewsTitle: "Aufrufe",
      comments: "{n} Kommentare zu {name} ansehen",
      commentsTitle: "Kommentare",
      upvoteTitle: "Für {name} stimmen",
      upvote: "Für {name} stimmen",
      removeUpvote: "Stimme für {name} zurücknehmen",
      visit: "Besuchen",
      visitLabel: "Website von {name} besuchen",
      visitPending: "Keine Website-Adresse angegeben",
    },
    profile: {
      metaTitle: "{name} | Entdecken auf RepGet",
      breadcrumbLabel: "Brotkrümelnavigation",
      businesses: "Unternehmen",
      categoriesLabel: "Kategorien des Unternehmens",
      featured: "Vorgestelltes Unternehmen",
      logoLabel: "Logo von {name}",
      visitWebsite: "Website besuchen",
      websitePending: "Website-Adresse folgt",
      upvote: "Stimme geben",
      upvoteLabel: "Für {name} stimmen",
      removeUpvote: "Stimme für {name} zurücknehmen",
      copyLink: "Link kopieren",
      copyLabel: "Link zu diesem Profil kopieren",
      copied: "Profil-Link kopiert",
      copyFailed: "Profil-Adresse: {url}",
      photoLabel: "Portfolio-Foto von {name}",
      statsLabel: "Interaktionen mit dem Unternehmen",
      upvotes: "Stimmen",
      thisWeek: "diese Woche",
      comments: "Kommentare",
      discussions: "Diskussionen",
      impressions: "Impressionen",
      about: "Über das Unternehmen",
      audience: "Für wen",
      services: "Wichtigste Leistungen",
      details: "Unternehmensdaten",
      industry: "Branche",
      basedIn: "Sitz",
      availableIn: "Verfügbar in",
      website: "Website",
      growth: "Wachsen mit RepGet",
      growthText: "Verfolgen Sie die öffentliche Fallstudie von {name}: der Ausgangspunkt der Website, die Inhaltsaktivität und die laufende Entwicklung der Sichtbarkeit in Suchmaschinen.",
      growthLink: "Wachstums-Fallstudie lesen",
      commentsTitle: "Kommentare",
      commentIntro: "Teilen Sie Ihre Gedanken, stellen Sie eine Frage oder beginnen Sie ein Gespräch mit diesem Unternehmen.",
      joinTitle: "Beteiligen Sie sich an der Diskussion",
      joinText: "Melden Sie sich mit Ihrem RepGet-Konto an, um einen Kommentar zu hinterlassen.",
      signIn: "Zum Kommentieren anmelden",
      createAccount: "Konto erstellen",
      noComments: "Noch keine Kommentare. Schreiben Sie den ersten.",
      featureText: "Haben Sie ein Unternehmen, das mehr Menschen entdecken sollen?",
      featureLink: "Auf RepGet vorgestellt werden ↗",
    },
  },
};

/** "{n} business" / "{n} businesses". */
export function businessCount(copy: DiscoverDirectoryCopy, n: number): string {
  return (n === 1 ? copy.countOne : copy.countOther).replace("{n}", String(n));
}

/** Fills "{name}", "{n}" and "{url}". */
export function fillDiscover(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
