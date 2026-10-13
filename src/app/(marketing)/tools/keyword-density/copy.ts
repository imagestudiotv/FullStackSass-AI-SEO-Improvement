import type { Locale } from "@/lib/i18n/config";

/** The Keyword Density Checker's words in five languages. The title is the registry's. */
export type KeywordDensityCopy = {
  metaDescription: string;
  description: string;
  submit: string;
  fieldLabel: string;
  placeholder: string;
  couldNotAnalyse: string;
  words: string;
  distinct: string;
  mainHeading: string;
  set: string;
  missing: string;
  tooThin: string;
  topWords: string;
  topWordsNote: string;
  topPhrases: string;
  topPhrasesNote: string;
  noPhrase: string;
  intro: string;
  explainer: { heading: string; body: string }[];
  ctaHeadline: string;
  ctaBody: string;
};

export const KEYWORD_DENSITY_COPY: Record<Locale, KeywordDensityCopy> = {
  en: {
    metaDescription: "See what your page actually talks about - the words and phrases it uses most, and how often. Free, no signup.",
    description:
      "Reads your page and counts what it actually says - the words and two-word phrases it uses most. Useful for the gap between what a page is about and what it never quite says.",
    submit: "Analyse page",
    fieldLabel: "Page address",
    placeholder: "yourwebsite.com/page",
    couldNotAnalyse: "We could not analyse that page",
    words: "Words",
    distinct: "Distinct terms shown",
    mainHeading: "Main heading",
    set: "Set",
    missing: "Missing",
    tooThin:
      "There is not enough repeated text on this page to find a pattern. That is itself worth knowing - a page this thin rarely ranks for anything.",
    topWords: "Most used words",
    topWordsNote: "Common words like “the” and “and” are left out.",
    topPhrases: "Most used phrases",
    topPhrasesNote: "Two words together - usually closer to what people search for.",
    noPhrase: "No phrase appears more than once.",
    intro:
      "There is no target density worth chasing. This is for reading what a page emphasises, and noticing when the thing you sell is not on the list.",
    explainer: [
      {
        heading: "What this checks",
        body: "We fetch the page, strip scripts and styling, and count the visible words a reader would see. Words shorter than three letters and a short list of very common ones are excluded. Two-word phrases are counted from the original word order, so they are real phrases rather than words that happen to be frequent.",
      },
      {
        heading: "What density is not",
        body: 'It is not a target. Writing to hit a percentage produces the stilted copy search engines have penalised for a decade, and no modern ranking system rewards it. The useful signal is the opposite one: a page selling emergency plumbing that never once says "emergency plumber" has a real problem, and this is how you notice.',
      },
    ],
    ctaHeadline: "Knowing the gap is the easy part",
    ctaBody: "RepGet finds what your customers actually search for, then writes the pages that answer it.",
  },
  es: {
    metaDescription: "Vea de qué habla realmente su página: las palabras y frases que más usa, y con qué frecuencia. Gratis, sin registro.",
    description:
      "Lee su página y cuenta lo que dice de verdad: las palabras y las frases de dos palabras que más usa. Útil para ver la distancia entre aquello de lo que trata una página y lo que nunca llega a decir.",
    submit: "Analizar página",
    fieldLabel: "Dirección de la página",
    placeholder: "suweb.com/pagina",
    couldNotAnalyse: "No pudimos analizar esa página",
    words: "Palabras",
    distinct: "Términos distintos mostrados",
    mainHeading: "Encabezado principal",
    set: "Definido",
    missing: "Falta",
    tooThin:
      "No hay suficiente texto repetido en esta página para encontrar un patrón. Eso ya es un dato: una página tan escasa rara vez se posiciona por nada.",
    topWords: "Palabras más usadas",
    topWordsNote: "Se excluyen las palabras más comunes.",
    topPhrases: "Frases más usadas",
    topPhrasesNote: "Dos palabras juntas: suelen parecerse más a lo que la gente busca.",
    noPhrase: "Ninguna frase aparece más de una vez.",
    intro:
      "No hay ninguna densidad objetivo que merezca la pena perseguir. Sirve para leer lo que una página destaca y darse cuenta de cuándo lo que usted vende no está en la lista.",
    explainer: [
      {
        heading: "Qué comprueba",
        body: "Descargamos la página, quitamos los scripts y los estilos y contamos las palabras visibles que vería un lector. Se excluyen las palabras de menos de tres letras y una breve lista de palabras muy comunes. Las frases de dos palabras se cuentan según el orden original, así que son frases reales y no palabras que casualmente se repiten.",
      },
      {
        heading: "Lo que no es la densidad",
        body: "No es un objetivo. Escribir para alcanzar un porcentaje produce el texto forzado que los buscadores penalizan desde hace una década, y ningún sistema de posicionamiento moderno lo premia. La señal útil es la contraria: una página que vende fontanería urgente y nunca dice «fontanero urgente» tiene un problema real, y así es como se detecta.",
      },
    ],
    ctaHeadline: "Ver la diferencia es la parte fácil",
    ctaBody: "RepGet encuentra lo que sus clientes buscan de verdad y después escribe las páginas que lo responden.",
  },
  fr: {
    metaDescription: "Voyez ce dont parle vraiment votre page : les mots et expressions qu’elle utilise le plus, et à quelle fréquence. Gratuit, sans inscription.",
    description:
      "Lit votre page et compte ce qu’elle dit vraiment : les mots et les expressions de deux mots qu’elle utilise le plus. Utile pour repérer l’écart entre le sujet d’une page et ce qu’elle ne dit jamais vraiment.",
    submit: "Analyser la page",
    fieldLabel: "Adresse de la page",
    placeholder: "votresite.fr/page",
    couldNotAnalyse: "Nous n’avons pas pu analyser cette page",
    words: "Mots",
    distinct: "Termes distincts affichés",
    mainHeading: "Titre principal",
    set: "Défini",
    missing: "Absent",
    tooThin:
      "Il n’y a pas assez de texte répété sur cette page pour dégager une tendance. C’est en soi une information : une page aussi mince se positionne rarement sur quoi que ce soit.",
    topWords: "Mots les plus utilisés",
    topWordsNote: "Les mots très courants sont exclus.",
    topPhrases: "Expressions les plus utilisées",
    topPhrasesNote: "Deux mots qui se suivent : souvent plus proches de ce que les gens recherchent.",
    noPhrase: "Aucune expression n’apparaît plus d’une fois.",
    intro:
      "Il n’existe aucune densité cible qui vaille la peine d’être poursuivie. L’outil sert à lire ce qu’une page met en avant, et à remarquer quand ce que vous vendez n’y figure pas.",
    explainer: [
      {
        heading: "Ce que l’outil vérifie",
        body: "Nous récupérons la page, retirons les scripts et les styles, et comptons les mots visibles qu’un lecteur verrait. Les mots de moins de trois lettres et une courte liste de mots très courants sont exclus. Les expressions de deux mots sont comptées dans l’ordre d’origine des mots : ce sont de vraies expressions, pas des mots qui se trouvent être fréquents.",
      },
      {
        heading: "Ce que la densité n’est pas",
        body: "Ce n’est pas un objectif. Écrire pour atteindre un pourcentage produit le texte artificiel que les moteurs de recherche pénalisent depuis dix ans, et aucun système de classement moderne ne le récompense. Le signal utile est l’inverse : une page qui vend des dépannages de plomberie en urgence sans jamais dire « plombier d’urgence » a un vrai problème, et c’est ainsi qu’on le remarque.",
      },
    ],
    ctaHeadline: "Voir l’écart, c’est la partie facile",
    ctaBody: "RepGet trouve ce que vos clients recherchent vraiment, puis rédige les pages qui y répondent.",
  },
  it: {
    metaDescription: "Scopra di cosa parla davvero la sua pagina: le parole e le frasi che usa di più, e quanto spesso. Gratis, senza registrazione.",
    description:
      "Legge la sua pagina e conta ciò che dice davvero: le parole e le frasi di due parole che usa di più. Utile per notare la distanza tra l’argomento di una pagina e ciò che non dice mai davvero.",
    submit: "Analizza la pagina",
    fieldLabel: "Indirizzo della pagina",
    placeholder: "ilsuosito.it/pagina",
    couldNotAnalyse: "Non siamo riusciti ad analizzare quella pagina",
    words: "Parole",
    distinct: "Termini distinti mostrati",
    mainHeading: "Titolo principale",
    set: "Presente",
    missing: "Mancante",
    tooThin:
      "Su questa pagina non c’è abbastanza testo ripetuto per trovare uno schema. Già questo è un dato utile: una pagina così scarna raramente si posiziona per qualcosa.",
    topWords: "Parole più usate",
    topWordsNote: "Le parole molto comuni sono escluse.",
    topPhrases: "Frasi più usate",
    topPhrasesNote: "Due parole insieme: di solito più vicine a ciò che le persone cercano.",
    noPhrase: "Nessuna frase compare più di una volta.",
    intro:
      "Non esiste una densità obiettivo da inseguire. Serve per leggere ciò che una pagina mette in evidenza, e per accorgersi quando ciò che vende non è nell’elenco.",
    explainer: [
      {
        heading: "Cosa controlla",
        body: "Scarichiamo la pagina, togliamo script e stili e contiamo le parole visibili che vedrebbe un lettore. Sono escluse le parole di meno di tre lettere e un breve elenco di parole molto comuni. Le frasi di due parole sono contate nell’ordine originale, quindi sono frasi vere e non parole che per caso sono frequenti.",
      },
      {
        heading: "Cosa non è la densità",
        body: "Non è un obiettivo. Scrivere per raggiungere una percentuale produce i testi forzati che i motori di ricerca penalizzano da dieci anni, e nessun sistema di posizionamento moderno li premia. Il segnale utile è l’opposto: una pagina che vende interventi idraulici urgenti e non dice mai «idraulico urgente» ha un problema reale, ed è così che lo si nota.",
      },
    ],
    ctaHeadline: "Vedere la differenza è la parte facile",
    ctaBody: "RepGet trova ciò che i suoi clienti cercano davvero, poi scrive le pagine che rispondono.",
  },
  de: {
    metaDescription:
      "Sehen Sie, worüber Ihre Seite wirklich spricht: die Wörter und Wendungen, die sie am häufigsten verwendet, und wie oft. Kostenlos, ohne Anmeldung.",
    description:
      "Liest Ihre Seite und zählt, was sie wirklich sagt: die Wörter und Zwei-Wort-Wendungen, die sie am häufigsten verwendet. Nützlich, um die Lücke zu sehen zwischen dem, worum es auf einer Seite geht, und dem, was sie nie ganz ausspricht.",
    submit: "Seite analysieren",
    fieldLabel: "Adresse der Seite",
    placeholder: "ihrewebsite.de/seite",
    couldNotAnalyse: "Wir konnten diese Seite nicht analysieren",
    words: "Wörter",
    distinct: "Angezeigte unterschiedliche Begriffe",
    mainHeading: "Hauptüberschrift",
    set: "Vorhanden",
    missing: "Fehlt",
    tooThin:
      "Auf dieser Seite gibt es nicht genug wiederholten Text, um ein Muster zu erkennen. Das ist schon eine Erkenntnis: Eine so dünne Seite rankt selten für irgendetwas.",
    topWords: "Häufigste Wörter",
    topWordsNote: "Sehr häufige Wörter sind ausgenommen.",
    topPhrases: "Häufigste Wendungen",
    topPhrasesNote: "Zwei Wörter zusammen: meist näher an dem, wonach Menschen suchen.",
    noPhrase: "Keine Wendung kommt mehr als einmal vor.",
    intro:
      "Es gibt keine Zieldichte, der man nachjagen sollte. Das Werkzeug zeigt, was eine Seite betont, und macht sichtbar, wenn das, was Sie verkaufen, nicht auf der Liste steht.",
    explainer: [
      {
        heading: "Was geprüft wird",
        body: "Wir laden die Seite, entfernen Skripte und Styles und zählen die sichtbaren Wörter, die ein Leser sehen würde. Wörter mit weniger als drei Buchstaben und eine kurze Liste sehr häufiger Wörter werden ausgelassen. Zwei-Wort-Wendungen werden in der ursprünglichen Wortfolge gezählt, es sind also echte Wendungen und nicht nur Wörter, die zufällig häufig sind.",
      },
      {
        heading: "Was Keyword-Dichte nicht ist",
        body: "Sie ist kein Ziel. Wer auf einen Prozentsatz hin schreibt, produziert die gestelzten Texte, die Suchmaschinen seit zehn Jahren abstrafen, und kein modernes Ranking-System belohnt das. Das nützliche Signal ist das Gegenteil: Eine Seite, die einen Sanitär-Notdienst verkauft und nie „Sanitär-Notdienst“ sagt, hat ein echtes Problem, und so fällt es auf.",
      },
    ],
    ctaHeadline: "Die Lücke zu kennen, ist der leichte Teil",
    ctaBody: "RepGet findet, wonach Ihre Kunden wirklich suchen, und schreibt dann die Seiten, die es beantworten.",
  },
};
