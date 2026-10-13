import type { Locale } from "@/lib/i18n/config";

/** The LLM HTML Visibility Checker's words in five languages. The title is the registry's. */
export type LlmHtmlCopy = {
  metaDescription: string;
  description: string;
  submit: string;
  fieldLabel: string;
  placeholder: string;
  couldNotCheck: string;
  emptyTitle: string;
  okTitle: string;
  /** {count} */
  emptyBody: string;
  /** {count} */
  okBody: string;
  words: string;
  ratio: string;
  weight: string;
  understand: string;
  pageTitle: string;
  mainHeading: string;
  headings: string;
  paragraphs: string;
  structured: string;
  images: string;
  notSet: string;
  /** {count} */
  found: string;
  /** [one, other], with {count}. */
  jsonLd: [string, string];
  noJsonLd: string;
  /** {described}, {total} */
  imagesDescribed: string;
  intro: string;
  explainer: { heading: string; body: string }[];
  ctaHeadline: string;
  ctaBody: string;
};

export const LLM_HTML_COPY: Record<Locale, LlmHtmlCopy> = {
  en: {
    metaDescription: "See how much of your page an AI assistant can actually read - the text that survives without JavaScript. Free, no signup.",
    description:
      "AI assistants read the HTML your server sends, not the page a browser builds afterwards. This shows how much of your content survives that - and flags the pages that come back effectively empty.",
    submit: "Check readability",
    fieldLabel: "Page address",
    placeholder: "yourwebsite.com/page",
    couldNotCheck: "We could not check that page",
    emptyTitle: "This page is nearly empty without JavaScript.",
    okTitle: "AI assistants can read this page.",
    emptyBody:
      "We found only {count} words in the HTML your server sent. An assistant reading this page would see almost none of your content, however complete it looks in a browser.",
    okBody: "We found {count} words in the HTML your server sent, before any JavaScript runs.",
    words: "Readable words",
    ratio: "Text vs. code",
    weight: "Page weight",
    understand: "What an assistant can understand",
    pageTitle: "Page title",
    mainHeading: "Main heading",
    headings: "Headings",
    paragraphs: "Paragraphs",
    structured: "Structured data",
    images: "Image descriptions",
    notSet: "Not set",
    found: "{count} found",
    jsonLd: ["{count} JSON-LD block", "{count} JSON-LD blocks"],
    noJsonLd: "None - assistants have to infer the facts",
    imagesDescribed: "{described} of {total} images described",
    intro: "A page built entirely in the browser can look perfect to you and be blank to an assistant. This is the check that tells the two apart.",
    explainer: [
      {
        heading: "What this checks",
        body: "We request your page exactly as an assistant would and never run any JavaScript. Then we strip the scripts and styling and measure what is left: how many words, how much of the document is text rather than code, and whether the structural signals - headings, paragraphs, JSON-LD, image descriptions - are actually there.",
      },
      {
        heading: "Why this differs from Google",
        body: "Google renders JavaScript, eventually, on a second pass. AI assistants generally do not - they read the HTML that comes back and move on. A single-page app can therefore rank respectably on Google and be completely invisible to ChatGPT, which is a gap most site owners have no way to see.",
      },
    ],
    ctaHeadline: "Readable is not the same as recommended",
    ctaBody: "RepGet checks whether assistants actually name your business, and writes the content that gets you cited.",
  },
  es: {
    metaDescription: "Vea cuánto de su página puede leer de verdad un asistente de IA: el texto que queda sin JavaScript. Gratis, sin registro.",
    description:
      "Los asistentes de IA leen el HTML que envía su servidor, no la página que el navegador construye después. Esto muestra cuánto de su contenido sobrevive a eso, y señala las páginas que llegan prácticamente vacías.",
    submit: "Comprobar legibilidad",
    fieldLabel: "Dirección de la página",
    placeholder: "suweb.com/pagina",
    couldNotCheck: "No pudimos comprobar esa página",
    emptyTitle: "Esta página está casi vacía sin JavaScript.",
    okTitle: "Los asistentes de IA pueden leer esta página.",
    emptyBody:
      "Solo encontramos {count} palabras en el HTML que envió su servidor. Un asistente que leyera esta página no vería casi nada de su contenido, por completa que parezca en un navegador.",
    okBody: "Encontramos {count} palabras en el HTML que envió su servidor, antes de que se ejecute ningún JavaScript.",
    words: "Palabras legibles",
    ratio: "Texto frente a código",
    weight: "Peso de la página",
    understand: "Lo que un asistente puede entender",
    pageTitle: "Título de la página",
    mainHeading: "Encabezado principal",
    headings: "Encabezados",
    paragraphs: "Párrafos",
    structured: "Datos estructurados",
    images: "Descripciones de imágenes",
    notSet: "Sin definir",
    found: "{count} encontrados",
    jsonLd: ["{count} bloque JSON-LD", "{count} bloques JSON-LD"],
    noJsonLd: "Ninguno: los asistentes tienen que deducir los datos",
    imagesDescribed: "{described} de {total} imágenes con descripción",
    intro:
      "Una página construida por completo en el navegador puede verse perfecta para usted y estar en blanco para un asistente. Esta es la comprobación que distingue una cosa de la otra.",
    explainer: [
      {
        heading: "Qué comprueba",
        body: "Pedimos su página exactamente como lo haría un asistente y nunca ejecutamos JavaScript. Después quitamos los scripts y los estilos y medimos lo que queda: cuántas palabras, qué parte del documento es texto y no código, y si las señales de estructura (encabezados, párrafos, JSON-LD, descripciones de imágenes) están realmente ahí.",
      },
      {
        heading: "Por qué es distinto de Google",
        body: "Google ejecuta JavaScript, tarde o temprano, en una segunda pasada. Los asistentes de IA, por lo general, no: leen el HTML que reciben y siguen adelante. Por eso una aplicación de una sola página puede posicionarse bien en Google y ser totalmente invisible para ChatGPT, una diferencia que la mayoría de los propietarios de webs no tienen forma de ver.",
      },
    ],
    ctaHeadline: "Ser legible no es lo mismo que ser recomendado",
    ctaBody: "RepGet comprueba si los asistentes nombran de verdad a su negocio y escribe el contenido que hace que le citen.",
  },
  fr: {
    metaDescription: "Voyez quelle part de votre page un assistant d’IA peut vraiment lire : le texte qui reste sans JavaScript. Gratuit, sans inscription.",
    description:
      "Les assistants d’IA lisent le HTML envoyé par votre serveur, pas la page que le navigateur construit ensuite. Cet outil montre quelle part de votre contenu y résiste, et signale les pages qui arrivent pratiquement vides.",
    submit: "Vérifier la lisibilité",
    fieldLabel: "Adresse de la page",
    placeholder: "votresite.fr/page",
    couldNotCheck: "Nous n’avons pas pu vérifier cette page",
    emptyTitle: "Cette page est presque vide sans JavaScript.",
    okTitle: "Les assistants d’IA peuvent lire cette page.",
    emptyBody:
      "Nous n’avons trouvé que {count} mots dans le HTML envoyé par votre serveur. Un assistant qui lit cette page ne verrait presque rien de votre contenu, aussi complète qu’elle paraisse dans un navigateur.",
    okBody: "Nous avons trouvé {count} mots dans le HTML envoyé par votre serveur, avant l’exécution de tout JavaScript.",
    words: "Mots lisibles",
    ratio: "Texte / code",
    weight: "Poids de la page",
    understand: "Ce qu’un assistant peut comprendre",
    pageTitle: "Titre de la page",
    mainHeading: "Titre principal",
    headings: "Intertitres",
    paragraphs: "Paragraphes",
    structured: "Données structurées",
    images: "Descriptions des images",
    notSet: "Non défini",
    found: "{count} trouvés",
    jsonLd: ["{count} bloc JSON-LD", "{count} blocs JSON-LD"],
    noJsonLd: "Aucune : les assistants doivent déduire les informations",
    imagesDescribed: "{described} images décrites sur {total}",
    intro:
      "Une page entièrement construite dans le navigateur peut vous paraître parfaite et être vide pour un assistant. C’est cette vérification qui fait la différence entre les deux.",
    explainer: [
      {
        heading: "Ce que l’outil vérifie",
        body: "Nous demandons votre page exactement comme le ferait un assistant, sans jamais exécuter de JavaScript. Puis nous retirons les scripts et les styles et mesurons ce qui reste : combien de mots, quelle part du document est du texte plutôt que du code, et si les signaux de structure (intertitres, paragraphes, JSON-LD, descriptions des images) sont bien présents.",
      },
      {
        heading: "Pourquoi c’est différent de Google",
        body: "Google exécute le JavaScript, tôt ou tard, lors d’un second passage. Les assistants d’IA, en général, non : ils lisent le HTML reçu et passent à la suite. Une application monopage peut donc se positionner correctement sur Google et être totalement invisible pour ChatGPT, un écart que la plupart des propriétaires de sites n’ont aucun moyen de voir.",
      },
    ],
    ctaHeadline: "Être lisible n’est pas être recommandé",
    ctaBody: "RepGet vérifie si les assistants citent vraiment votre entreprise, et rédige le contenu qui vous fait citer.",
  },
  it: {
    metaDescription: "Scopra quanta parte della sua pagina un assistente AI riesce davvero a leggere: il testo che resta senza JavaScript. Gratis, senza registrazione.",
    description:
      "Gli assistenti AI leggono l’HTML inviato dal suo server, non la pagina che il browser costruisce dopo. Questo strumento mostra quanto del suo contenuto sopravvive e segnala le pagine che arrivano praticamente vuote.",
    submit: "Controlla la leggibilità",
    fieldLabel: "Indirizzo della pagina",
    placeholder: "ilsuosito.it/pagina",
    couldNotCheck: "Non siamo riusciti a controllare quella pagina",
    emptyTitle: "Questa pagina è quasi vuota senza JavaScript.",
    okTitle: "Gli assistenti AI possono leggere questa pagina.",
    emptyBody:
      "Abbiamo trovato solo {count} parole nell’HTML inviato dal suo server. Un assistente che legge questa pagina non vedrebbe quasi nulla del suo contenuto, per quanto completa sembri in un browser.",
    okBody: "Abbiamo trovato {count} parole nell’HTML inviato dal suo server, prima che venga eseguito qualsiasi JavaScript.",
    words: "Parole leggibili",
    ratio: "Testo rispetto al codice",
    weight: "Peso della pagina",
    understand: "Cosa può capire un assistente",
    pageTitle: "Titolo della pagina",
    mainHeading: "Titolo principale",
    headings: "Titoli",
    paragraphs: "Paragrafi",
    structured: "Dati strutturati",
    images: "Descrizioni delle immagini",
    notSet: "Non impostato",
    found: "{count} trovati",
    jsonLd: ["{count} blocco JSON-LD", "{count} blocchi JSON-LD"],
    noJsonLd: "Nessuno: gli assistenti devono dedurre le informazioni",
    imagesDescribed: "{described} immagini descritte su {total}",
    intro:
      "Una pagina costruita interamente nel browser può sembrarle perfetta ed essere vuota per un assistente. Questo è il controllo che distingue le due cose.",
    explainer: [
      {
        heading: "Cosa controlla",
        body: "Richiediamo la sua pagina esattamente come farebbe un assistente, senza mai eseguire JavaScript. Poi togliamo script e stili e misuriamo ciò che resta: quante parole, quanta parte del documento è testo e non codice, e se i segnali di struttura (titoli, paragrafi, JSON-LD, descrizioni delle immagini) ci sono davvero.",
      },
      {
        heading: "Perché è diverso da Google",
        body: "Google esegue il JavaScript, prima o poi, in un secondo passaggio. Gli assistenti AI in genere no: leggono l’HTML che ricevono e vanno avanti. Una single-page app può quindi posizionarsi bene su Google ed essere del tutto invisibile per ChatGPT, una differenza che la maggior parte dei proprietari di siti non ha modo di vedere.",
      },
    ],
    ctaHeadline: "Essere leggibili non vuol dire essere consigliati",
    ctaBody: "RepGet controlla se gli assistenti nominano davvero la sua attività e scrive i contenuti che la fanno citare.",
  },
  de: {
    metaDescription: "Sehen Sie, wie viel Ihrer Seite ein KI-Assistent wirklich lesen kann: den Text, der ohne JavaScript übrig bleibt. Kostenlos, ohne Anmeldung.",
    description:
      "KI-Assistenten lesen das HTML, das Ihr Server sendet, nicht die Seite, die ein Browser danach aufbaut. Das Werkzeug zeigt, wie viel Ihres Inhalts das übersteht, und markiert Seiten, die praktisch leer ankommen.",
    submit: "Lesbarkeit prüfen",
    fieldLabel: "Adresse der Seite",
    placeholder: "ihrewebsite.de/seite",
    couldNotCheck: "Wir konnten diese Seite nicht prüfen",
    emptyTitle: "Diese Seite ist ohne JavaScript fast leer.",
    okTitle: "KI-Assistenten können diese Seite lesen.",
    emptyBody:
      "Wir haben im HTML, das Ihr Server gesendet hat, nur {count} Wörter gefunden. Ein Assistent, der diese Seite liest, sähe fast nichts von Ihrem Inhalt, so vollständig sie im Browser auch aussieht.",
    okBody: "Wir haben im HTML, das Ihr Server gesendet hat, {count} Wörter gefunden, bevor irgendein JavaScript läuft.",
    words: "Lesbare Wörter",
    ratio: "Text im Verhältnis zu Code",
    weight: "Seitengewicht",
    understand: "Was ein Assistent verstehen kann",
    pageTitle: "Seitentitel",
    mainHeading: "Hauptüberschrift",
    headings: "Überschriften",
    paragraphs: "Absätze",
    structured: "Strukturierte Daten",
    images: "Bildbeschreibungen",
    notSet: "Nicht gesetzt",
    found: "{count} gefunden",
    jsonLd: ["{count} JSON-LD-Block", "{count} JSON-LD-Blöcke"],
    noJsonLd: "Keine: Assistenten müssen die Fakten selbst erschließen",
    imagesDescribed: "{described} von {total} Bildern beschrieben",
    intro: "Eine Seite, die vollständig im Browser aufgebaut wird, kann für Sie perfekt aussehen und für einen Assistenten leer sein. Diese Prüfung unterscheidet beides.",
    explainer: [
      {
        heading: "Was geprüft wird",
        body: "Wir rufen Ihre Seite genau so ab, wie ein Assistent es tun würde, und führen nie JavaScript aus. Dann entfernen wir Skripte und Styles und messen, was übrig bleibt: wie viele Wörter, wie viel des Dokuments Text statt Code ist und ob die Struktursignale (Überschriften, Absätze, JSON-LD, Bildbeschreibungen) tatsächlich vorhanden sind.",
      },
      {
        heading: "Warum das anders ist als bei Google",
        body: "Google führt JavaScript aus, irgendwann, in einem zweiten Durchgang. KI-Assistenten tun das meist nicht: Sie lesen das zurückgelieferte HTML und machen weiter. Eine Single-Page-App kann deshalb bei Google ordentlich ranken und für ChatGPT völlig unsichtbar sein, eine Lücke, die die meisten Website-Betreiber nicht sehen können.",
      },
    ],
    ctaHeadline: "Lesbar heißt nicht empfohlen",
    ctaBody: "RepGet prüft, ob Assistenten Ihr Unternehmen wirklich nennen, und schreibt die Inhalte, mit denen Sie zitiert werden.",
  },
};
