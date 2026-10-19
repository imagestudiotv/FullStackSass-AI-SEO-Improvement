import type { Locale } from "@/lib/i18n/config";
import type { SitemapFinding } from "@/lib/tools/sitemap";

/** The Sitemap Checker's words in five languages. The title is the registry's. */
export type SitemapCopy = {
  metaDescription: string;
  description: string;
  submit: string;
  statFound: string;
  statPages: string;
  statRobots: string;
  yes: string;
  no: string;
  notListedTitle: string;
  /** "{before} <code>Sitemap: …</code> {middle} {robots.txt address} {after}" */
  notListedBefore: string;
  notListedMiddle: string;
  notListedAfter: string;
  noneTitle: string;
  noneBody: string;
  sources: Record<SitemapFinding["source"], string>;
  indexBadge: string;
  /** [one, other], with {count}. */
  listedPages: [string, string];
  listedSitemaps: [string, string];
  /** When an index lists more sitemaps than were read; {read} and {total}. */
  partialRead: string;
  intro: string;
  explainer: { heading: string; body: string }[];
  ctaHeadline: string;
  ctaBody: string;
};

export const SITEMAP_COPY: Record<Locale, SitemapCopy> = {
  en: {
    metaDescription: "Find your XML sitemap the way a search engine does, and check it actually works. Free, no signup.",
    description:
      "Finds your sitemap the way a search engine does - robots.txt first, then the usual locations - then checks it actually parses and counts what is in it. Index files are followed, so you get a real page count rather than a zero.",
    submit: "Check sitemap",
    statFound: "Sitemaps found",
    statPages: "Pages listed",
    statRobots: "In robots.txt",
    yes: "Yes",
    no: "No",
    notListedTitle: "Your sitemap is not listed in robots.txt",
    notListedBefore: "Add a line reading",
    notListedMiddle: "to",
    notListedAfter: "so crawlers find it without guessing.",
    noneTitle: "We could not find a sitemap",
    noneBody:
      "We checked robots.txt and the six usual locations. Without one, search engines have to find every page by following links - which usually means the newest pages are found last.",
    sources: { "robots.txt": "robots.txt", "common location": "common location", "sitemap index": "sitemap index" },
    indexBadge: "index",
    listedPages: ["{count} page listed.", "{count} pages listed."],
    listedSitemaps: ["{count} sitemap listed.", "{count} sitemaps listed."],
    partialRead: "We read {read} of the {total} sitemaps your index lists, so “Pages listed” counts the pages in those only.",
    intro:
      "A sitemap is a list of your pages written for machines. It does not make you rank, but it does make sure everything gets found - especially pages nothing links to yet.",
    explainer: [
      {
        heading: "What this checks",
        body: "We read robots.txt for a declared sitemap, then try the six locations crawlers guess at. Each file is fetched and parsed: we report whether it loads, whether it is valid XML, whether it is an index pointing at other sitemaps, and how many URLs it lists. Index files are followed one level down so the page count is real.",
      },
      {
        heading: "Why a broken sitemap is invisible",
        body: "Nothing on your website tells you the sitemap 404s, lists staging URLs, or was never declared in robots.txt. The site looks fine. Search engines just quietly fall back to following links, and the pages nothing links to - new products, recent posts - are the ones that never get indexed.",
      },
    ],
    ctaHeadline: "A sitemap gets you found. Content gets you chosen.",
    ctaBody: "RepGet checks this automatically, then writes the pages that answer what your customers actually search for.",
  },
  es: {
    metaDescription: "Encuentre su sitemap XML como lo hace un buscador y compruebe que funciona de verdad. Gratis, sin registro.",
    description:
      "Encuentra su sitemap como lo hace un buscador (primero robots.txt, luego las ubicaciones habituales) y comprueba que se puede leer y cuenta lo que contiene. Se siguen los archivos índice, así que obtiene un recuento real de páginas en lugar de un cero.",
    submit: "Comprobar sitemap",
    statFound: "Sitemaps encontrados",
    statPages: "Páginas listadas",
    partialRead: "Leímos {read} de los {total} sitemaps que enumera su índice, así que «Páginas listadas» solo cuenta las páginas de esos.",
    statRobots: "En robots.txt",
    yes: "Sí",
    no: "No",
    notListedTitle: "Su sitemap no aparece en robots.txt",
    notListedBefore: "Añada la línea",
    notListedMiddle: "a",
    notListedAfter: "para que los rastreadores lo encuentren sin tener que adivinar.",
    noneTitle: "No pudimos encontrar ningún sitemap",
    noneBody:
      "Revisamos robots.txt y las seis ubicaciones habituales. Sin sitemap, los buscadores tienen que encontrar cada página siguiendo enlaces, lo que suele significar que las páginas más nuevas se encuentran las últimas.",
    sources: { "robots.txt": "robots.txt", "common location": "ubicación habitual", "sitemap index": "índice de sitemaps" },
    indexBadge: "índice",
    listedPages: ["{count} página listada.", "{count} páginas listadas."],
    listedSitemaps: ["{count} sitemap listado.", "{count} sitemaps listados."],
    intro:
      "Un sitemap es una lista de sus páginas escrita para máquinas. No le hace posicionarse, pero sí garantiza que todo se encuentre, sobre todo las páginas a las que todavía no enlaza nada.",
    explainer: [
      {
        heading: "Qué comprueba",
        body: "Buscamos en robots.txt un sitemap declarado y después probamos las seis ubicaciones en las que buscan los rastreadores. Descargamos y analizamos cada archivo: le decimos si carga, si es un XML válido, si es un índice que apunta a otros sitemaps y cuántas URL contiene. Seguimos los archivos índice un nivel hacia abajo para que el recuento de páginas sea real.",
      },
      {
        heading: "Por qué un sitemap roto es invisible",
        body: "Nada en su web le avisa de que el sitemap da 404, contiene URL de pruebas o nunca se declaró en robots.txt. La web se ve bien. Los buscadores, sin decir nada, vuelven a seguir enlaces, y las páginas a las que no enlaza nada (productos nuevos, entradas recientes) son las que nunca se indexan.",
      },
    ],
    ctaHeadline: "Un sitemap hace que le encuentren. El contenido hace que le elijan.",
    ctaBody: "RepGet lo comprueba automáticamente y después escribe las páginas que responden a lo que sus clientes buscan de verdad.",
  },
  fr: {
    metaDescription: "Trouvez votre sitemap XML comme le fait un moteur de recherche, et vérifiez qu’il fonctionne vraiment. Gratuit, sans inscription.",
    description:
      "Trouve votre sitemap comme le fait un moteur de recherche (d’abord le robots.txt, puis les emplacements habituels), vérifie qu’il se lit correctement et compte ce qu’il contient. Les fichiers d’index sont suivis : vous obtenez un vrai nombre de pages plutôt qu’un zéro.",
    submit: "Vérifier le sitemap",
    statFound: "Sitemaps trouvés",
    statPages: "Pages listées",
    partialRead: "Nous avons lu {read} des {total} sitemaps listés dans votre index : « Pages listées » ne compte donc que les pages de ceux-ci.",
    statRobots: "Dans le robots.txt",
    yes: "Oui",
    no: "Non",
    notListedTitle: "Votre sitemap n’est pas indiqué dans le robots.txt",
    notListedBefore: "Ajoutez la ligne",
    notListedMiddle: "à",
    notListedAfter: "pour que les robots le trouvent sans deviner.",
    noneTitle: "Nous n’avons trouvé aucun sitemap",
    noneBody:
      "Nous avons vérifié le robots.txt et les six emplacements habituels. Sans sitemap, les moteurs de recherche doivent trouver chaque page en suivant des liens, et les pages les plus récentes sont alors souvent trouvées en dernier.",
    sources: { "robots.txt": "robots.txt", "common location": "emplacement habituel", "sitemap index": "index de sitemaps" },
    indexBadge: "index",
    listedPages: ["{count} page listée.", "{count} pages listées."],
    listedSitemaps: ["{count} sitemap listé.", "{count} sitemaps listés."],
    intro:
      "Un sitemap est une liste de vos pages écrite pour les machines. Il ne vous fait pas mieux classer, mais il garantit que tout est trouvé, surtout les pages vers lesquelles aucun lien ne pointe encore.",
    explainer: [
      {
        heading: "Ce que l’outil vérifie",
        body: "Nous cherchons un sitemap déclaré dans le robots.txt, puis essayons les six emplacements que les robots devinent. Chaque fichier est récupéré et analysé : nous indiquons s’il se charge, s’il s’agit d’un XML valide, s’il est un index pointant vers d’autres sitemaps et combien d’URL il contient. Les fichiers d’index sont suivis sur un niveau pour que le nombre de pages soit réel.",
      },
      {
        heading: "Pourquoi un sitemap cassé passe inaperçu",
        body: "Rien sur votre site ne vous dit que le sitemap renvoie une erreur 404, liste des URL de test ou n’a jamais été déclaré dans le robots.txt. Le site a l’air normal. Les moteurs de recherche se rabattent discrètement sur les liens, et les pages vers lesquelles aucun lien ne pointe (nouveaux produits, articles récents) sont celles qui ne sont jamais indexées.",
      },
    ],
    ctaHeadline: "Un sitemap vous fait trouver. Le contenu vous fait choisir.",
    ctaBody: "RepGet vérifie cela automatiquement, puis rédige les pages qui répondent à ce que vos clients recherchent vraiment.",
  },
  it: {
    metaDescription: "Trovi la sua sitemap XML come fa un motore di ricerca e verifichi che funzioni davvero. Gratis, senza registrazione.",
    description:
      "Trova la sua sitemap come fa un motore di ricerca (prima il robots.txt, poi le posizioni abituali), verifica che sia leggibile e conta ciò che contiene. I file indice vengono seguiti, così ottiene un numero reale di pagine invece di uno zero.",
    submit: "Controlla la sitemap",
    statFound: "Sitemap trovate",
    statPages: "Pagine elencate",
    partialRead: "Abbiamo letto {read} delle {total} sitemap elencate nel suo indice, quindi «Pagine elencate» conta solo le pagine di quelle.",
    statRobots: "Nel robots.txt",
    yes: "Sì",
    no: "No",
    notListedTitle: "La sua sitemap non è indicata nel robots.txt",
    notListedBefore: "Aggiunga la riga",
    notListedMiddle: "a",
    notListedAfter: "così i crawler la trovano senza doverla indovinare.",
    noneTitle: "Non abbiamo trovato nessuna sitemap",
    noneBody:
      "Abbiamo controllato il robots.txt e le sei posizioni abituali. Senza sitemap, i motori di ricerca devono trovare ogni pagina seguendo i link, e di solito le pagine più nuove vengono trovate per ultime.",
    sources: { "robots.txt": "robots.txt", "common location": "posizione abituale", "sitemap index": "indice di sitemap" },
    indexBadge: "indice",
    listedPages: ["{count} pagina elencata.", "{count} pagine elencate."],
    listedSitemaps: ["{count} sitemap elencata.", "{count} sitemap elencate."],
    intro:
      "Una sitemap è un elenco delle sue pagine scritto per le macchine. Non la fa posizionare meglio, ma fa sì che tutto venga trovato, soprattutto le pagine a cui ancora nessun link porta.",
    explainer: [
      {
        heading: "Cosa controlla",
        body: "Cerchiamo nel robots.txt una sitemap dichiarata, poi proviamo le sei posizioni in cui i crawler tirano a indovinare. Ogni file viene scaricato e analizzato: le diciamo se si carica, se è un XML valido, se è un indice che rimanda ad altre sitemap e quanti URL elenca. I file indice vengono seguiti di un livello, così il numero di pagine è reale.",
      },
      {
        heading: "Perché una sitemap rotta non si vede",
        body: "Niente sul suo sito le dice che la sitemap dà 404, elenca URL di prova o non è mai stata dichiarata nel robots.txt. Il sito sembra a posto. I motori di ricerca tornano in silenzio a seguire i link, e le pagine a cui nessun link porta (prodotti nuovi, articoli recenti) sono quelle che non vengono mai indicizzate.",
      },
    ],
    ctaHeadline: "Una sitemap la fa trovare. I contenuti la fanno scegliere.",
    ctaBody: "RepGet lo controlla automaticamente, poi scrive le pagine che rispondono a ciò che i suoi clienti cercano davvero.",
  },
  de: {
    metaDescription: "Finden Sie Ihre XML-Sitemap so, wie eine Suchmaschine es tut, und prüfen Sie, ob sie wirklich funktioniert. Kostenlos, ohne Anmeldung.",
    description:
      "Findet Ihre Sitemap so, wie eine Suchmaschine es tut (zuerst über die robots.txt, dann an den üblichen Orten), prüft, ob sie sich einlesen lässt, und zählt, was darin steht. Index-Dateien werden verfolgt, sodass Sie eine echte Seitenzahl statt einer Null bekommen.",
    submit: "Sitemap prüfen",
    statFound: "Gefundene Sitemaps",
    statPages: "Aufgeführte Seiten",
    partialRead: "Wir haben {read} der {total} Sitemaps aus Ihrem Index gelesen, „Aufgeführte Seiten“ zählt also nur deren Seiten.",
    statRobots: "In der robots.txt",
    yes: "Ja",
    no: "Nein",
    notListedTitle: "Ihre Sitemap ist nicht in der robots.txt angegeben",
    notListedBefore: "Fügen Sie die Zeile",
    notListedMiddle: "in",
    notListedAfter: "ein, damit Crawler sie finden, ohne raten zu müssen.",
    noneTitle: "Wir konnten keine Sitemap finden",
    noneBody:
      "Wir haben die robots.txt und die sechs üblichen Orte geprüft. Ohne Sitemap müssen Suchmaschinen jede Seite über Links finden, und dann werden meist die neuesten Seiten zuletzt gefunden.",
    sources: { "robots.txt": "robots.txt", "common location": "üblicher Ort", "sitemap index": "Sitemap-Index" },
    indexBadge: "Index",
    listedPages: ["{count} Seite aufgeführt.", "{count} Seiten aufgeführt."],
    listedSitemaps: ["{count} Sitemap aufgeführt.", "{count} Sitemaps aufgeführt."],
    intro:
      "Eine Sitemap ist eine Liste Ihrer Seiten, geschrieben für Maschinen. Sie verbessert nicht Ihr Ranking, sorgt aber dafür, dass alles gefunden wird, besonders Seiten, auf die noch nichts verlinkt.",
    explainer: [
      {
        heading: "Was geprüft wird",
        body: "Wir suchen in der robots.txt nach einer angegebenen Sitemap und versuchen dann die sechs Orte, an denen Crawler raten. Jede Datei wird geladen und ausgewertet: Wir zeigen, ob sie lädt, ob sie gültiges XML ist, ob sie ein Index ist, der auf andere Sitemaps verweist, und wie viele URLs sie enthält. Index-Dateien verfolgen wir eine Ebene tiefer, damit die Seitenzahl stimmt.",
      },
      {
        heading: "Warum eine kaputte Sitemap unsichtbar ist",
        body: "Nichts auf Ihrer Website sagt Ihnen, dass die Sitemap einen 404-Fehler liefert, Test-URLs enthält oder nie in der robots.txt angegeben wurde. Die Website sieht gut aus. Suchmaschinen folgen dann stillschweigend Links, und die Seiten, auf die nichts verlinkt (neue Produkte, aktuelle Beiträge), werden nie indexiert.",
      },
    ],
    ctaHeadline: "Eine Sitemap sorgt dafür, dass man Sie findet. Inhalte sorgen dafür, dass man Sie wählt.",
    ctaBody: "RepGet prüft das automatisch und schreibt dann die Seiten, die beantworten, wonach Ihre Kunden wirklich suchen.",
  },
};
