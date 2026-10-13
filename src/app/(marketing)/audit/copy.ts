import type { Locale } from "@/lib/i18n/config";

/**
 * The free website check's words in five languages (client, 2026-10-13).
 *
 * Split by component: `progress` and `steps` are sent to the browser (their
 * components are client ones), so they take only the visitor's language.
 * Each finding's name, fix and detail come from the Website health page's
 * translations (messages.ts app.health), so the free check and the paid one
 * describe a problem the same way; English keeps its own wording below.
 *
 * Plurals are [one, other]; {placeholders} are filled in by the page.
 */

export type AuditProgressCopy = {
  assets: { label: string; lines: [string, string] }[];
  working: string;
  building: string;
  usually: string;
  progressAria: string;
};

export type AuditStepsCopy = {
  yourAssets: string;
  done: string;
  openAny: string;
  assetLabels: [string, string, string];
  pagesRead: [string, string];
  termPages: string;
  noteFive: string;
  platform: string;
  custom: string;
  platformDetected: string;
  platformNone: string;
  language: string;
  notSet: string;
  languageDeclared: string;
  languageNone: string;
  nothingWrong: [string, string];
  toFix: [string, string];
  /** {score}, {pages} */
  scoredOn: [string, string];
  nothingWrongBody: string;
  inOrder: string;
  pageCount: [string, string];
  moreWhenJoin: string;
  /** {allowed}, {total} */
  everyoneCanRead: string;
  assistantsBlocked: [string, string];
  robotsAllAllowed: string;
  robotsBlocks: string;
  profileNote: string;
  linkOutAlready: string;
};

export type AuditResultCopy = {
  outOf: string;
  critical: string;
  warnings: string;
  suggestions: string;
  nothingWrongShort: string;
  eyebrowAudit: string;
  notAssessedLabel: string;
  notAssessedOne: string;
  notAssessedMany: string;
  langNote: string;
  langMissing: string;
  platformNote: string;
  platformMissing: string;
  pagesNote: string;
  crawlersTitle: string;
  crawlersAll: string;
  issuesBefore: string;
  issuesAccent: string;
  noIssues: string;
  homepage: string;
  effort: { minutes: string; hour: string; longer: string };
  needsDev: string;
  linksOutTitle: string;
  linksOutBody: string;
  hidden: [string, string];
  hiddenBody: string;
  seeFull: string;
  joinEyebrow: string;
  joinTitle: string;
  /** The first body takes {count}. */
  joinItems: [{ title: string; body: string }, { title: string; body: string }, { title: string; body: string }];
  getStarted: string;
  seePricing: string;
  /** {price}; ends with a space, followed by freeArticles. */
  plansStart: string;
  freeArticles: [string, string];
  cached: string;
};

export type AuditCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  titleBefore: string;
  titleAccent: string;
  titleAfter: string;
  intro: string;
  /** {domain} */
  srTitle: string;
  progress: AuditProgressCopy;
  steps: AuditStepsCopy;
  result: AuditResultCopy;
};

export const AUDIT_COPY: Record<Locale, AuditCopy> = {
  en: {
    metaTitle: "Free website check",
    metaDescription: "See what is holding your website back on Google and whether AI assistants can read your site. No account needed.",
    eyebrow: "Free website check",
    titleBefore: "Your free",
    titleAccent: "growth plan",
    titleAfter: "",
    intro:
      "Enter your website and we will read your pages, score them, and show you what is holding you back on Google - and whether AI assistants can read your site at all.",
    srTitle: "Your free growth plan for {domain}",
    progress: {
      assets: [
        { label: "AI SEO Audit", lines: ["Opening {domain} and mapping the site…", "Crawling pages & detecting the platform behind {domain}"] },
        { label: "Personalized Growth Plan", lines: ["Scoring titles, headings, images and links", "Ordering what to fix by what it is worth"] },
        { label: "Business Profile + Free Backlink", lines: ["Checking which AI crawlers are allowed in", "Matching you with a business in a related field"] },
      ],
      working: "Working on it",
      building: "Building your 3 free assets…",
      usually: "Usually under a minute.",
      progressAria: "Checking your website",
    },
    steps: {
      yourAssets: "Your 3 free assets",
      done: "Done. Here is what each one found.",
      openAny: "Open any of them to see the detail.",
      assetLabels: ["AI SEO Audit", "Personalized Growth Plan", "Business Profile + Free Backlink"],
      pagesRead: ["{count} page read", "{count} pages read"],
      termPages: "Pages read",
      noteFive: "Free checks read up to five.",
      platform: "Platform",
      custom: "Custom",
      platformDetected: "Detected from the markup.",
      platformNone: "No common platform recognised.",
      language: "Language",
      notSet: "Not set",
      languageDeclared: "What the page declares.",
      languageNone: "No lang attribute - engines have to guess.",
      nothingWrong: ["Nothing wrong on the page we read", "Nothing wrong on the pages we read"],
      toFix: ["{count} thing to fix", "{count} things to fix"],
      scoredOn: ["scored {score} of 100 on {pages} page", "scored {score} of 100 on {pages} pages"],
      nothingWrongBody: "We found nothing wrong on the pages we read, which is rarer than it sounds.",
      inOrder: "In the order worth doing them. The full list is below, each with what to change.",
      pageCount: ["{count} page", "{count} pages"],
      moreWhenJoin: "{count} more you get when you join.",
      everyoneCanRead: "Every AI assistant can read you · {allowed}/{total}",
      assistantsBlocked: ["{count} AI assistant is blocked", "{count} AI assistants are blocked"],
      robotsAllAllowed: "Your robots.txt lets every major AI crawler through, so you can be cited in their answers.",
      robotsBlocks: "Your robots.txt blocks {count} of them. They cannot cite a site they are not allowed to read.",
      profileNote:
        "Your profile and first backlink are set up when you join - we match you with a business in a related field and your article carries a link back to your site.",
      linkOutAlready: "Sites you already link out to",
    },
    result: {
      outOf: "of 100",
      critical: "critical",
      warnings: "warnings",
      suggestions: "suggestions",
      nothingWrongShort: "Nothing wrong on the pages we read.",
      eyebrowAudit: "AI SEO audit",
      notAssessedLabel: "Not assessed:",
      notAssessedOne: "these need more than one page, and only one was read",
      notAssessedMany: "these need more pages than this check reads",
      langNote: "What the page declares.",
      langMissing: "No lang attribute - search engines have to guess.",
      platformNote: "What your site is built on.",
      platformMissing: "We could not recognise a common platform.",
      pagesNote: "Free checks read up to five pages.",
      crawlersTitle: "Can AI assistants read your site?",
      crawlersAll: "Your robots.txt lets every major AI crawler through.",
      issuesBefore: "Issues we",
      issuesAccent: "found",
      noIssues:
        "We found nothing wrong on the pages we read. Sign up and we will check your whole site, then start finding the searches your customers use.",
      homepage: "homepage",
      effort: { minutes: "minutes", hour: "an hour", longer: "longer" },
      needsDev: ", may need your developer",
      linksOutTitle: "Sites you link out to",
      linksOutBody: "Read from your own pages. Useful for spotting links you did not mean to give away.",
      hidden: ["{count} more thing to fix", "{count} more things to fix"],
      hiddenBody: "Sign up free to see the full list, and we will start writing the pages that fix them.",
      seeFull: "See the full report",
      joinEyebrow: "What happens when you join",
      joinTitle: "We fix what we found, then keep going",
      joinItems: [
        { title: "Every finding, in order", body: "All {count} of them, with what to change and how long it takes." },
        { title: "Articles written for you", body: "Researched from what your customers search for, published to your own site." },
        { title: "Real backlinks, earned", body: "Host one article for a related business and earn a link back to yours." },
      ],
      getStarted: "Get Started",
      seePricing: "See pricing",
      plansStart: "Plans start at {price} a month. ",
      freeArticles: ["New accounts get their first article free.", "New accounts get their first {count} articles free."],
      cached: "Showing a check from the last 24 hours.",
    },
  },
  es: {
    metaTitle: "Revisión gratuita de su web",
    metaDescription: "Vea qué frena a su web en Google y si los asistentes de IA pueden leerla. Sin necesidad de cuenta.",
    eyebrow: "Revisión gratuita de su web",
    titleBefore: "Su",
    titleAccent: "plan de crecimiento",
    titleAfter: "gratuito",
    intro:
      "Introduzca su web y leeremos sus páginas, las puntuaremos y le mostraremos qué le frena en Google, y si los asistentes de IA pueden siquiera leer su web.",
    srTitle: "Su plan de crecimiento gratuito para {domain}",
    progress: {
      assets: [
        { label: "Auditoría SEO con IA", lines: ["Abriendo {domain} y trazando el mapa de la web…", "Rastreando páginas y detectando la plataforma de {domain}"] },
        { label: "Plan de crecimiento personalizado", lines: ["Puntuando títulos, encabezados, imágenes y enlaces", "Ordenando qué arreglar según lo que vale"] },
        {
          label: "Perfil de empresa + backlink gratuito",
          lines: ["Comprobando qué rastreadores de IA tienen acceso", "Buscando para usted un negocio de un sector relacionado"],
        },
      ],
      working: "Manos a la obra",
      building: "Preparando sus 3 recursos gratuitos…",
      usually: "Suele tardar menos de un minuto.",
      progressAria: "Comprobando su web",
    },
    steps: {
      yourAssets: "Sus 3 recursos gratuitos",
      done: "Listo. Esto es lo que ha encontrado cada uno.",
      openAny: "Abra cualquiera para ver el detalle.",
      assetLabels: ["Auditoría SEO con IA", "Plan de crecimiento personalizado", "Perfil de empresa + backlink gratuito"],
      pagesRead: ["{count} página leída", "{count} páginas leídas"],
      termPages: "Páginas leídas",
      noteFive: "Las revisiones gratuitas leen hasta cinco.",
      platform: "Plataforma",
      custom: "A medida",
      platformDetected: "Detectada a partir del código.",
      platformNone: "No se reconoce ninguna plataforma habitual.",
      language: "Idioma",
      notSet: "Sin definir",
      languageDeclared: "Lo que declara la página.",
      languageNone: "Sin atributo lang: los buscadores tienen que adivinarlo.",
      nothingWrong: ["Nada que corregir en la página que leímos", "Nada que corregir en las páginas que leímos"],
      toFix: ["{count} cosa que arreglar", "{count} cosas que arreglar"],
      scoredOn: ["puntuación de {score} sobre 100 en {pages} página", "puntuación de {score} sobre 100 en {pages} páginas"],
      nothingWrongBody: "No encontramos nada que corregir en las páginas que leímos, algo más raro de lo que parece.",
      inOrder: "En el orden en que conviene hacerlas. La lista completa está más abajo, cada una con lo que hay que cambiar.",
      pageCount: ["{count} página", "{count} páginas"],
      moreWhenJoin: "{count} más cuando se une.",
      everyoneCanRead: "Todos los asistentes de IA pueden leerle · {allowed}/{total}",
      assistantsBlocked: ["{count} asistente de IA está bloqueado", "{count} asistentes de IA están bloqueados"],
      robotsAllAllowed: "Su robots.txt deja pasar a todos los grandes rastreadores de IA, así que pueden citarle en sus respuestas.",
      robotsBlocks: "Su robots.txt bloquea a {count} de ellos. No pueden citar una web que no se les permite leer.",
      profileNote:
        "Su perfil y su primer backlink se preparan cuando se une: le emparejamos con un negocio de un sector relacionado y su artículo lleva un enlace a su web.",
      linkOutAlready: "Webs a las que ya enlaza",
    },
    result: {
      outOf: "de 100",
      critical: "críticos",
      warnings: "avisos",
      suggestions: "sugerencias",
      nothingWrongShort: "Nada que corregir en las páginas que leímos.",
      eyebrowAudit: "Auditoría SEO con IA",
      notAssessedLabel: "Sin evaluar:",
      notAssessedOne: "necesitan más de una página, y solo se leyó una",
      notAssessedMany: "necesitan más páginas de las que lee esta revisión",
      langNote: "Lo que declara la página.",
      langMissing: "Sin atributo lang: los buscadores tienen que adivinarlo.",
      platformNote: "Sobre qué está construida su web.",
      platformMissing: "No pudimos reconocer ninguna plataforma habitual.",
      pagesNote: "Las revisiones gratuitas leen hasta cinco páginas.",
      crawlersTitle: "¿Pueden los asistentes de IA leer su web?",
      crawlersAll: "Su robots.txt deja pasar a todos los grandes rastreadores de IA.",
      issuesBefore: "Problemas que hemos",
      issuesAccent: "encontrado",
      noIssues:
        "No encontramos nada que corregir en las páginas que leímos. Regístrese y revisaremos toda su web, y empezaremos a encontrar las búsquedas que usan sus clientes.",
      homepage: "página de inicio",
      effort: { minutes: "unos minutos", hour: "una hora", longer: "más tiempo" },
      needsDev: ", puede necesitar a su desarrollador",
      linksOutTitle: "Webs a las que enlaza",
      linksOutBody: "Leídas de sus propias páginas. Útil para detectar enlaces que no quería regalar.",
      hidden: ["{count} cosa más que arreglar", "{count} cosas más que arreglar"],
      hiddenBody: "Regístrese gratis para ver la lista completa, y empezaremos a escribir las páginas que lo arreglan.",
      seeFull: "Ver el informe completo",
      joinEyebrow: "Qué pasa cuando se une",
      joinTitle: "Arreglamos lo que encontramos y seguimos adelante",
      joinItems: [
        { title: "Cada hallazgo, en orden", body: "Los {count}, con lo que hay que cambiar y cuánto lleva." },
        { title: "Artículos escritos para usted", body: "Basados en lo que buscan sus clientes y publicados en su propia web." },
        { title: "Backlinks reales, ganados", body: "Aloje un artículo de un negocio relacionado y gane un enlace hacia el suyo." },
      ],
      getStarted: "Empezar",
      seePricing: "Ver precios",
      plansStart: "Planes desde {price} al mes. ",
      freeArticles: ["Las cuentas nuevas reciben gratis su primer artículo.", "Las cuentas nuevas reciben gratis sus primeros {count} artículos."],
      cached: "Mostrando una revisión de las últimas 24 horas.",
    },
  },
  fr: {
    metaTitle: "Vérification gratuite de votre site",
    metaDescription: "Découvrez ce qui freine votre site sur Google et si les assistants d’IA peuvent le lire. Sans compte.",
    eyebrow: "Vérification gratuite de votre site",
    titleBefore: "Votre",
    titleAccent: "plan de croissance",
    titleAfter: "gratuit",
    intro:
      "Saisissez votre site : nous lisons vos pages, leur attribuons un score et vous montrons ce qui vous freine sur Google, et si les assistants d’IA peuvent seulement lire votre site.",
    srTitle: "Votre plan de croissance gratuit pour {domain}",
    progress: {
      assets: [
        { label: "Audit SEO par IA", lines: ["Ouverture de {domain} et cartographie du site…", "Exploration des pages et détection de la plateforme de {domain}"] },
        {
          label: "Plan de croissance personnalisé",
          lines: ["Notation des titres, intertitres, images et liens", "Classement de ce qu’il faut corriger selon ce que cela rapporte"],
        },
        {
          label: "Profil d’entreprise + backlink gratuit",
          lines: ["Vérification des robots d’IA autorisés", "Recherche d’une entreprise d’un secteur proche pour vous"],
        },
      ],
      working: "C’est parti",
      building: "Préparation de vos 3 ressources gratuites…",
      usually: "En général moins d’une minute.",
      progressAria: "Vérification de votre site",
    },
    steps: {
      yourAssets: "Vos 3 ressources gratuites",
      done: "Terminé. Voici ce que chacune a trouvé.",
      openAny: "Ouvrez-en une pour voir le détail.",
      assetLabels: ["Audit SEO par IA", "Plan de croissance personnalisé", "Profil d’entreprise + backlink gratuit"],
      pagesRead: ["{count} page lue", "{count} pages lues"],
      termPages: "Pages lues",
      noteFive: "Les vérifications gratuites en lisent jusqu’à cinq.",
      platform: "Plateforme",
      custom: "Sur mesure",
      platformDetected: "Détectée à partir du code.",
      platformNone: "Aucune plateforme courante reconnue.",
      language: "Langue",
      notSet: "Non définie",
      languageDeclared: "Ce que déclare la page.",
      languageNone: "Pas d’attribut lang : les moteurs doivent deviner.",
      nothingWrong: ["Rien à corriger sur la page lue", "Rien à corriger sur les pages lues"],
      toFix: ["{count} point à corriger", "{count} points à corriger"],
      scoredOn: ["score de {score} sur 100 sur {pages} page", "score de {score} sur 100 sur {pages} pages"],
      nothingWrongBody: "Nous n’avons rien trouvé à corriger sur les pages lues, ce qui est plus rare qu’on ne le croit.",
      inOrder: "Dans l’ordre où il vaut la peine de les traiter. La liste complète est plus bas, chacun avec ce qu’il faut changer.",
      pageCount: ["{count} page", "{count} pages"],
      moreWhenJoin: "{count} de plus en vous inscrivant.",
      everyoneCanRead: "Tous les assistants d’IA peuvent vous lire · {allowed}/{total}",
      assistantsBlocked: ["{count} assistant d’IA est bloqué", "{count} assistants d’IA sont bloqués"],
      robotsAllAllowed: "Votre robots.txt laisse passer tous les grands robots d’IA : vous pouvez être cité dans leurs réponses.",
      robotsBlocks: "Votre robots.txt en bloque {count}. Ils ne peuvent pas citer un site qu’ils n’ont pas le droit de lire.",
      profileNote:
        "Votre profil et votre premier backlink sont mis en place à l’inscription : nous vous associons à une entreprise d’un secteur proche, et votre article contient un lien vers votre site.",
      linkOutAlready: "Sites vers lesquels vous faites déjà des liens",
    },
    result: {
      outOf: "sur 100",
      critical: "critiques",
      warnings: "avertissements",
      suggestions: "suggestions",
      nothingWrongShort: "Rien à corriger sur les pages lues.",
      eyebrowAudit: "Audit SEO par IA",
      notAssessedLabel: "Non évalué :",
      notAssessedOne: "ces vérifications demandent plus d’une page, et une seule a été lue",
      notAssessedMany: "ces vérifications demandent plus de pages que cette analyse n’en lit",
      langNote: "Ce que déclare la page.",
      langMissing: "Pas d’attribut lang : les moteurs de recherche doivent deviner.",
      platformNote: "Ce sur quoi votre site est construit.",
      platformMissing: "Nous n’avons reconnu aucune plateforme courante.",
      pagesNote: "Les vérifications gratuites lisent jusqu’à cinq pages.",
      crawlersTitle: "Les assistants d’IA peuvent-ils lire votre site ?",
      crawlersAll: "Votre robots.txt laisse passer tous les grands robots d’IA.",
      issuesBefore: "Problèmes",
      issuesAccent: "trouvés",
      noIssues:
        "Nous n’avons rien trouvé à corriger sur les pages lues. Inscrivez-vous : nous vérifierons tout votre site, puis commencerons à trouver les recherches que font vos clients.",
      homepage: "page d’accueil",
      effort: { minutes: "quelques minutes", hour: "une heure", longer: "plus longtemps" },
      needsDev: ", peut nécessiter votre développeur",
      linksOutTitle: "Sites vers lesquels vous faites des liens",
      linksOutBody: "Lus sur vos propres pages. Utile pour repérer des liens que vous ne vouliez pas offrir.",
      hidden: ["{count} autre point à corriger", "{count} autres points à corriger"],
      hiddenBody: "Inscrivez-vous gratuitement pour voir la liste complète, et nous commencerons à rédiger les pages qui les corrigent.",
      seeFull: "Voir le rapport complet",
      joinEyebrow: "Ce qui se passe quand vous nous rejoignez",
      joinTitle: "Nous corrigeons ce que nous avons trouvé, puis nous continuons",
      joinItems: [
        { title: "Chaque constat, dans l’ordre", body: "Les {count}, avec ce qu’il faut changer et le temps que cela prend." },
        { title: "Des articles rédigés pour vous", body: "Fondés sur ce que recherchent vos clients, publiés sur votre propre site." },
        { title: "De vrais backlinks, mérités", body: "Hébergez un article pour une entreprise d’un secteur proche et gagnez un lien vers le vôtre." },
      ],
      getStarted: "Commencer",
      seePricing: "Voir les tarifs",
      plansStart: "Formules à partir de {price} par mois. ",
      freeArticles: [
        "Les nouveaux comptes reçoivent leur premier article gratuitement.",
        "Les nouveaux comptes reçoivent leurs {count} premiers articles gratuitement.",
      ],
      cached: "Résultat d’une vérification des dernières 24 heures.",
    },
  },
  it: {
    metaTitle: "Controllo gratuito del sito",
    metaDescription: "Scopra cosa frena il suo sito su Google e se gli assistenti AI riescono a leggerlo. Senza account.",
    eyebrow: "Controllo gratuito del sito",
    titleBefore: "Il suo",
    titleAccent: "piano di crescita",
    titleAfter: "gratuito",
    intro:
      "Inserisca il suo sito: leggeremo le sue pagine, daremo loro un punteggio e le mostreremo cosa la frena su Google, e se gli assistenti AI riescono anche solo a leggere il suo sito.",
    srTitle: "Il suo piano di crescita gratuito per {domain}",
    progress: {
      assets: [
        { label: "Audit SEO con AI", lines: ["Apertura di {domain} e mappatura del sito…", "Scansione delle pagine e rilevamento della piattaforma di {domain}"] },
        { label: "Piano di crescita personalizzato", lines: ["Valutazione di titoli, intestazioni, immagini e link", "Ordinamento di cosa correggere in base a quanto vale"] },
        { label: "Profilo aziendale + backlink gratuito", lines: ["Verifica dei crawler AI ammessi", "Ricerca di un’azienda di un settore affine per lei"] },
      ],
      working: "Al lavoro",
      building: "Stiamo preparando le sue 3 risorse gratuite…",
      usually: "Di solito meno di un minuto.",
      progressAria: "Controllo del suo sito",
    },
    steps: {
      yourAssets: "Le sue 3 risorse gratuite",
      done: "Fatto. Ecco cosa ha trovato ciascuna.",
      openAny: "Ne apra una per vedere i dettagli.",
      assetLabels: ["Audit SEO con AI", "Piano di crescita personalizzato", "Profilo aziendale + backlink gratuito"],
      pagesRead: ["{count} pagina letta", "{count} pagine lette"],
      termPages: "Pagine lette",
      noteFive: "I controlli gratuiti ne leggono fino a cinque.",
      platform: "Piattaforma",
      custom: "Su misura",
      platformDetected: "Rilevata dal codice.",
      platformNone: "Nessuna piattaforma comune riconosciuta.",
      language: "Lingua",
      notSet: "Non impostata",
      languageDeclared: "Quella dichiarata dalla pagina.",
      languageNone: "Nessun attributo lang: i motori devono indovinare.",
      nothingWrong: ["Nulla da correggere nella pagina letta", "Nulla da correggere nelle pagine lette"],
      toFix: ["{count} cosa da correggere", "{count} cose da correggere"],
      scoredOn: ["punteggio {score} su 100 su {pages} pagina", "punteggio {score} su 100 su {pages} pagine"],
      nothingWrongBody: "Non abbiamo trovato nulla da correggere nelle pagine lette, ed è più raro di quanto sembri.",
      inOrder: "Nell’ordine in cui conviene affrontarle. L’elenco completo è qui sotto, ognuna con cosa cambiare.",
      pageCount: ["{count} pagina", "{count} pagine"],
      moreWhenJoin: "Altre {count} quando si iscrive.",
      everyoneCanRead: "Tutti gli assistenti AI possono leggerla · {allowed}/{total}",
      assistantsBlocked: ["{count} assistente AI è bloccato", "{count} assistenti AI sono bloccati"],
      robotsAllAllowed: "Il suo robots.txt lascia passare tutti i principali crawler AI, così può essere citato nelle loro risposte.",
      robotsBlocks: "Il suo robots.txt ne blocca {count}. Non possono citare un sito che non hanno il permesso di leggere.",
      profileNote:
        "Il suo profilo e il primo backlink vengono impostati quando si iscrive: la abbiniamo a un’azienda di un settore affine e il suo articolo contiene un link al suo sito.",
      linkOutAlready: "Siti a cui già rimanda con un link",
    },
    result: {
      outOf: "su 100",
      critical: "critici",
      warnings: "avvisi",
      suggestions: "suggerimenti",
      nothingWrongShort: "Nulla da correggere nelle pagine lette.",
      eyebrowAudit: "Audit SEO con AI",
      notAssessedLabel: "Non valutato:",
      notAssessedOne: "questi controlli richiedono più di una pagina, e ne è stata letta una sola",
      notAssessedMany: "questi controlli richiedono più pagine di quante ne legga questo controllo",
      langNote: "Quella dichiarata dalla pagina.",
      langMissing: "Nessun attributo lang: i motori di ricerca devono indovinare.",
      platformNote: "La base su cui è costruito il suo sito.",
      platformMissing: "Non abbiamo riconosciuto nessuna piattaforma comune.",
      pagesNote: "I controlli gratuiti leggono fino a cinque pagine.",
      crawlersTitle: "Gli assistenti AI possono leggere il suo sito?",
      crawlersAll: "Il suo robots.txt lascia passare tutti i principali crawler AI.",
      issuesBefore: "Problemi che abbiamo",
      issuesAccent: "trovato",
      noIssues:
        "Non abbiamo trovato nulla da correggere nelle pagine lette. Si iscriva e controlleremo tutto il suo sito, poi inizieremo a trovare le ricerche che fanno i suoi clienti.",
      homepage: "home page",
      effort: { minutes: "pochi minuti", hour: "un’ora", longer: "più tempo" },
      needsDev: ", potrebbe servire il suo sviluppatore",
      linksOutTitle: "Siti a cui rimanda con un link",
      linksOutBody: "Letti dalle sue pagine. Utile per individuare link che non intendeva regalare.",
      hidden: ["Ancora {count} cosa da correggere", "Ancora {count} cose da correggere"],
      hiddenBody: "Si iscriva gratis per vedere l’elenco completo, e inizieremo a scrivere le pagine che le correggono.",
      seeFull: "Vedi il report completo",
      joinEyebrow: "Cosa succede quando si iscrive",
      joinTitle: "Correggiamo ciò che abbiamo trovato, poi andiamo avanti",
      joinItems: [
        { title: "Ogni segnalazione, in ordine", body: "Tutte e {count}, con cosa cambiare e quanto tempo serve." },
        { title: "Articoli scritti per lei", body: "Basati su ciò che cercano i suoi clienti, pubblicati sul suo sito." },
        { title: "Backlink veri, guadagnati", body: "Ospiti un articolo per un’azienda affine e guadagni un link verso il suo sito." },
      ],
      getStarted: "Inizia",
      seePricing: "Vedi i prezzi",
      plansStart: "Piani a partire da {price} al mese. ",
      freeArticles: ["I nuovi account ricevono gratis il primo articolo.", "I nuovi account ricevono gratis i primi {count} articoli."],
      cached: "Risultato di un controllo delle ultime 24 ore.",
    },
  },
  de: {
    metaTitle: "Kostenlose Website-Prüfung",
    metaDescription: "Sehen Sie, was Ihre Website bei Google bremst und ob KI-Assistenten sie lesen können. Ohne Konto.",
    eyebrow: "Kostenlose Website-Prüfung",
    titleBefore: "Ihr kostenloser",
    titleAccent: "Wachstumsplan",
    titleAfter: "",
    intro:
      "Geben Sie Ihre Website ein: Wir lesen Ihre Seiten, bewerten sie und zeigen Ihnen, was Sie bei Google bremst und ob KI-Assistenten Ihre Website überhaupt lesen können.",
    srTitle: "Ihr kostenloser Wachstumsplan für {domain}",
    progress: {
      assets: [
        { label: "KI-SEO-Audit", lines: ["{domain} wird geöffnet und erfasst…", "Seiten werden gecrawlt und die Plattform hinter {domain} erkannt"] },
        { label: "Persönlicher Wachstumsplan", lines: ["Titel, Überschriften, Bilder und Links werden bewertet", "Was zu beheben ist, wird nach seinem Wert sortiert"] },
        {
          label: "Unternehmensprofil + kostenloser Backlink",
          lines: ["Es wird geprüft, welche KI-Crawler zugelassen sind", "Ein Unternehmen aus einer verwandten Branche wird für Sie gesucht"],
        },
      ],
      working: "In Arbeit",
      building: "Ihre 3 kostenlosen Ergebnisse werden erstellt…",
      usually: "Meist unter einer Minute.",
      progressAria: "Ihre Website wird geprüft",
    },
    steps: {
      yourAssets: "Ihre 3 kostenlosen Ergebnisse",
      done: "Fertig. Das hat jedes davon gefunden.",
      openAny: "Öffnen Sie eines, um die Details zu sehen.",
      assetLabels: ["KI-SEO-Audit", "Persönlicher Wachstumsplan", "Unternehmensprofil + kostenloser Backlink"],
      pagesRead: ["{count} Seite gelesen", "{count} Seiten gelesen"],
      termPages: "Gelesene Seiten",
      noteFive: "Kostenlose Prüfungen lesen bis zu fünf.",
      platform: "Plattform",
      custom: "Individuell",
      platformDetected: "Aus dem Code erkannt.",
      platformNone: "Keine gängige Plattform erkannt.",
      language: "Sprache",
      notSet: "Nicht gesetzt",
      languageDeclared: "Was die Seite angibt.",
      languageNone: "Kein lang-Attribut: Suchmaschinen müssen raten.",
      nothingWrong: ["Nichts zu beheben auf der gelesenen Seite", "Nichts zu beheben auf den gelesenen Seiten"],
      toFix: ["{count} Punkt zu beheben", "{count} Punkte zu beheben"],
      scoredOn: ["Score {score} von 100 auf {pages} Seite", "Score {score} von 100 auf {pages} Seiten"],
      nothingWrongBody: "Wir haben auf den gelesenen Seiten nichts zu beheben gefunden, und das ist seltener, als es klingt.",
      inOrder: "In der Reihenfolge, in der es sich lohnt. Die ganze Liste steht weiter unten, jeweils mit dem, was zu ändern ist.",
      pageCount: ["{count} Seite", "{count} Seiten"],
      moreWhenJoin: "{count} weitere, wenn Sie beitreten.",
      everyoneCanRead: "Alle KI-Assistenten können Sie lesen · {allowed}/{total}",
      assistantsBlocked: ["{count} KI-Assistent ist gesperrt", "{count} KI-Assistenten sind gesperrt"],
      robotsAllAllowed: "Ihre robots.txt lässt alle großen KI-Crawler durch, sodass Sie in ihren Antworten zitiert werden können.",
      robotsBlocks: "Ihre robots.txt sperrt {count} davon. Sie können keine Website zitieren, die sie nicht lesen dürfen.",
      profileNote:
        "Ihr Profil und Ihr erster Backlink werden eingerichtet, wenn Sie beitreten: Wir bringen Sie mit einem Unternehmen aus einer verwandten Branche zusammen, und Ihr Artikel enthält einen Link zurück zu Ihrer Website.",
      linkOutAlready: "Websites, auf die Sie bereits verlinken",
    },
    result: {
      outOf: "von 100",
      critical: "kritisch",
      warnings: "Warnungen",
      suggestions: "Vorschläge",
      nothingWrongShort: "Nichts zu beheben auf den gelesenen Seiten.",
      eyebrowAudit: "KI-SEO-Audit",
      notAssessedLabel: "Nicht bewertet:",
      notAssessedOne: "diese Prüfungen brauchen mehr als eine Seite, und nur eine wurde gelesen",
      notAssessedMany: "diese Prüfungen brauchen mehr Seiten, als diese Prüfung liest",
      langNote: "Was die Seite angibt.",
      langMissing: "Kein lang-Attribut: Suchmaschinen müssen raten.",
      platformNote: "Worauf Ihre Website aufgebaut ist.",
      platformMissing: "Wir konnten keine gängige Plattform erkennen.",
      pagesNote: "Kostenlose Prüfungen lesen bis zu fünf Seiten.",
      crawlersTitle: "Können KI-Assistenten Ihre Website lesen?",
      crawlersAll: "Ihre robots.txt lässt alle großen KI-Crawler durch.",
      issuesBefore: "Probleme, die wir",
      issuesAccent: "gefunden haben",
      noIssues:
        "Wir haben auf den gelesenen Seiten nichts zu beheben gefunden. Melden Sie sich an, dann prüfen wir Ihre ganze Website und finden die Suchanfragen, die Ihre Kunden verwenden.",
      homepage: "Startseite",
      effort: { minutes: "ein paar Minuten", hour: "eine Stunde", longer: "länger" },
      needsDev: ", braucht evtl. Ihren Webentwickler",
      linksOutTitle: "Websites, auf die Sie verlinken",
      linksOutBody: "Aus Ihren eigenen Seiten gelesen. Nützlich, um Links zu entdecken, die Sie nicht verschenken wollten.",
      hidden: ["{count} weiterer Punkt zu beheben", "{count} weitere Punkte zu beheben"],
      hiddenBody: "Melden Sie sich kostenlos an, um die ganze Liste zu sehen, und wir beginnen, die Seiten zu schreiben, die sie beheben.",
      seeFull: "Vollständigen Bericht ansehen",
      joinEyebrow: "Was passiert, wenn Sie beitreten",
      joinTitle: "Wir beheben, was wir gefunden haben, und machen dann weiter",
      joinItems: [
        { title: "Jeder Befund, der Reihe nach", body: "Alle {count}, mit dem, was zu ändern ist, und wie lange es dauert." },
        { title: "Für Sie geschriebene Artikel", body: "Recherchiert nach dem, wonach Ihre Kunden suchen, und auf Ihrer eigenen Website veröffentlicht." },
        { title: "Echte, verdiente Backlinks", body: "Hosten Sie einen Artikel für ein verwandtes Unternehmen und verdienen Sie einen Link zu Ihrem." },
      ],
      getStarted: "Jetzt starten",
      seePricing: "Preise ansehen",
      plansStart: "Tarife ab {price} im Monat. ",
      freeArticles: ["Neue Konten erhalten ihren ersten Artikel kostenlos.", "Neue Konten erhalten ihre ersten {count} Artikel kostenlos."],
      cached: "Ergebnis einer Prüfung aus den letzten 24 Stunden.",
    },
  },
};

