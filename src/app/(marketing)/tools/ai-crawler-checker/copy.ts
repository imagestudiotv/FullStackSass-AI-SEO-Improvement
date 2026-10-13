import type { Locale } from "@/lib/i18n/config";

/** The AI Crawler Checker's words in five languages. The title is the registry's. */
export type AiCrawlersCopy = {
  metaDescription: string;
  description: string;
  submit: string;
  /** {domain} */
  readableAll: string;
  /** {domain}, {blocked}, {total} */
  blocksSome: string;
  /** "Read from <robots.txt address>." */
  readFrom: string;
  noRobots: string;
  allowedNamed: string;
  allowedNothing: string;
  blockedNamed: string;
  blockedAll: string;
  howTitle: string;
  /** {url} */
  howBody: string;
  weCheck: string;
  explainer: { heading: string; body: string }[];
  ctaHeadline: string;
  ctaBody: string;
};

export const AI_CRAWLERS_COPY: Record<Locale, AiCrawlersCopy> = {
  en: {
    metaDescription: "Check whether GPTBot, ClaudeBot, PerplexityBot and Google-Extended are allowed to read your site. Free, no signup.",
    description:
      "Checks whether the assistants people now ask for recommendations are allowed to read your site. Blocking them is almost always an accident - and nothing in your own dashboard will ever tell you it happened.",
    submit: "Check AI access",
    readableAll: "{domain} is readable by every major AI assistant.",
    blocksSome: "{domain} blocks {blocked} of {total} AI crawlers.",
    readFrom: "Read from",
    noRobots: "This site has no robots.txt, which means nothing is blocked.",
    allowedNamed: "Allowed by a rule naming it.",
    allowedNothing: "Allowed - nothing blocks it.",
    blockedNamed: "Blocked by a rule naming it directly.",
    blockedAll: "Blocked by a rule applying to all crawlers.",
    howTitle: "How to allow them",
    howBody: "Remove the blocking rules from {url}, or replace them with an explicit allow for each crawler:",
    weCheck: "We check these crawlers:",
    explainer: [
      {
        heading: "What this checks",
        body: "We fetch your robots.txt and read the rules for each AI crawler by name, respecting the precedence robots.txt actually uses - a rule naming GPTBot beats a wildcard rule blocking everything. No robots.txt at all means nothing is blocked, which is both correct and the common case.",
      },
      {
        heading: "Why this happens by accident",
        body: 'Security plugins and copied configs add blocks for these agents by default, and a lot of sites picked one up during the wave of "block AI scrapers" advice. The result is that a business cannot be cited by ChatGPT at all - while their website, their rankings and their analytics all look completely normal.',
      },
    ],
    ctaHeadline: "Being readable is the start. Being cited is the goal.",
    ctaBody: "RepGet tracks whether AI assistants actually recommend you, then writes the content that gets you named.",
  },
  es: {
    metaDescription: "Compruebe si GPTBot, ClaudeBot, PerplexityBot y Google-Extended pueden leer su web. Gratis, sin registro.",
    description:
      "Comprueba si los asistentes a los que la gente pide ahora recomendaciones pueden leer su web. Bloquearlos casi siempre es un accidente, y nada en su propio panel le avisará de que ha ocurrido.",
    submit: "Comprobar acceso de la IA",
    readableAll: "{domain} es legible para todos los grandes asistentes de IA.",
    blocksSome: "{domain} bloquea {blocked} de {total} rastreadores de IA.",
    readFrom: "Leído de",
    noRobots: "Esta web no tiene robots.txt, lo que significa que no hay nada bloqueado.",
    allowedNamed: "Permitido por una regla que lo nombra.",
    allowedNothing: "Permitido: nada lo bloquea.",
    blockedNamed: "Bloqueado por una regla que lo nombra directamente.",
    blockedAll: "Bloqueado por una regla que se aplica a todos los rastreadores.",
    howTitle: "Cómo permitirles el acceso",
    howBody: "Quite las reglas de bloqueo de {url}, o sustitúyalas por un permiso explícito para cada rastreador:",
    weCheck: "Comprobamos estos rastreadores:",
    explainer: [
      {
        heading: "Qué comprueba",
        body: "Descargamos su robots.txt y leemos las reglas de cada rastreador de IA por su nombre, respetando la prioridad que de verdad usa robots.txt: una regla que nombra a GPTBot tiene prioridad sobre una regla general que lo bloquea todo. Si no hay robots.txt, no hay nada bloqueado, lo cual es correcto y además es el caso más habitual.",
      },
      {
        heading: "Por qué pasa sin querer",
        body: "Los plugins de seguridad y las configuraciones copiadas añaden bloqueos para estos agentes por defecto, y muchas webs se quedaron con uno durante la ola de consejos de «bloquee a los rastreadores de IA». El resultado es que ChatGPT no puede citar a ese negocio en absoluto, mientras su web, sus posiciones y sus estadísticas parecen completamente normales.",
      },
    ],
    ctaHeadline: "Ser legible es el principio. Que le citen es el objetivo.",
    ctaBody: "RepGet sigue si los asistentes de IA le recomiendan de verdad y después escribe el contenido que hace que le nombren.",
  },
  fr: {
    metaDescription: "Vérifiez si GPTBot, ClaudeBot, PerplexityBot et Google-Extended sont autorisés à lire votre site. Gratuit, sans inscription.",
    description:
      "Vérifie si les assistants à qui l’on demande désormais des recommandations ont le droit de lire votre site. Les bloquer est presque toujours un accident, et rien dans votre propre tableau de bord ne vous le signalera.",
    submit: "Vérifier l’accès de l’IA",
    readableAll: "{domain} est lisible par tous les grands assistants d’IA.",
    blocksSome: "{domain} bloque {blocked} robots d’IA sur {total}.",
    readFrom: "Lu depuis",
    noRobots: "Ce site n’a pas de robots.txt : rien n’est donc bloqué.",
    allowedNamed: "Autorisé par une règle qui le nomme.",
    allowedNothing: "Autorisé : rien ne le bloque.",
    blockedNamed: "Bloqué par une règle qui le nomme directement.",
    blockedAll: "Bloqué par une règle qui s’applique à tous les robots.",
    howTitle: "Comment les autoriser",
    howBody: "Supprimez les règles de blocage de {url}, ou remplacez-les par une autorisation explicite pour chaque robot :",
    weCheck: "Nous vérifions ces robots :",
    explainer: [
      {
        heading: "Ce que l’outil vérifie",
        body: "Nous récupérons votre robots.txt et lisons les règles de chaque robot d’IA par son nom, en respectant la priorité qu’applique réellement le robots.txt : une règle qui nomme GPTBot l’emporte sur une règle générale qui bloque tout. L’absence de robots.txt signifie que rien n’est bloqué, ce qui est à la fois correct et le cas le plus courant.",
      },
      {
        heading: "Pourquoi cela arrive par accident",
        body: "Des extensions de sécurité et des configurations copiées ajoutent par défaut des blocages pour ces agents, et beaucoup de sites en ont récupéré un lors de la vague de conseils « bloquez les robots d’IA ». Résultat : ChatGPT ne peut pas du tout citer l’entreprise, alors que son site, ses positions et ses statistiques semblent parfaitement normaux.",
      },
    ],
    ctaHeadline: "Être lisible, c’est le début. Être cité, c’est l’objectif.",
    ctaBody: "RepGet suit si les assistants d’IA vous recommandent vraiment, puis rédige le contenu qui vous fait citer.",
  },
  it: {
    metaDescription: "Controlli se GPTBot, ClaudeBot, PerplexityBot e Google-Extended possono leggere il suo sito. Gratis, senza registrazione.",
    description:
      "Controlla se gli assistenti a cui oggi le persone chiedono consigli possono leggere il suo sito. Bloccarli è quasi sempre un incidente, e niente nella sua dashboard le dirà mai che è successo.",
    submit: "Controlla l’accesso dell’AI",
    readableAll: "{domain} è leggibile da tutti i principali assistenti AI.",
    blocksSome: "{domain} blocca {blocked} crawler AI su {total}.",
    readFrom: "Letto da",
    noRobots: "Questo sito non ha un robots.txt, quindi non è bloccato nulla.",
    allowedNamed: "Consentito da una regola che lo nomina.",
    allowedNothing: "Consentito: nulla lo blocca.",
    blockedNamed: "Bloccato da una regola che lo nomina direttamente.",
    blockedAll: "Bloccato da una regola valida per tutti i crawler.",
    howTitle: "Come consentire l’accesso",
    howBody: "Tolga le regole di blocco da {url}, oppure le sostituisca con un permesso esplicito per ogni crawler:",
    weCheck: "Controlliamo questi crawler:",
    explainer: [
      {
        heading: "Cosa controlla",
        body: "Scarichiamo il suo robots.txt e leggiamo le regole per ogni crawler AI per nome, rispettando la precedenza che il robots.txt usa davvero: una regola che nomina GPTBot prevale su una regola generale che blocca tutto. Nessun robots.txt significa che non è bloccato nulla, ed è sia corretto sia il caso più comune.",
      },
      {
        heading: "Perché succede per errore",
        body: "Plugin di sicurezza e configurazioni copiate aggiungono blocchi per questi agenti per impostazione predefinita, e molti siti ne hanno preso uno durante l’ondata di consigli «blocca i crawler AI». Il risultato è che ChatGPT non può citare affatto l’attività, mentre il sito, i posizionamenti e le statistiche sembrano del tutto normali.",
      },
    ],
    ctaHeadline: "Essere leggibili è l’inizio. Essere citati è l’obiettivo.",
    ctaBody: "RepGet controlla se gli assistenti AI la consigliano davvero, poi scrive i contenuti che la fanno nominare.",
  },
  de: {
    metaDescription: "Prüfen Sie, ob GPTBot, ClaudeBot, PerplexityBot und Google-Extended Ihre Website lesen dürfen. Kostenlos, ohne Anmeldung.",
    description:
      "Prüft, ob die Assistenten, die Menschen heute um Empfehlungen bitten, Ihre Website lesen dürfen. Sie zu blockieren ist fast immer ein Versehen, und nichts in Ihrem eigenen Dashboard wird Ihnen je sagen, dass es passiert ist.",
    submit: "KI-Zugriff prüfen",
    readableAll: "{domain} kann von allen großen KI-Assistenten gelesen werden.",
    blocksSome: "{domain} sperrt {blocked} von {total} KI-Crawlern.",
    readFrom: "Gelesen aus",
    noRobots: "Diese Website hat keine robots.txt, also ist nichts gesperrt.",
    allowedNamed: "Erlaubt durch eine Regel, die ihn nennt.",
    allowedNothing: "Erlaubt: Nichts sperrt ihn.",
    blockedNamed: "Gesperrt durch eine Regel, die ihn direkt nennt.",
    blockedAll: "Gesperrt durch eine Regel für alle Crawler.",
    howTitle: "So lassen Sie sie zu",
    howBody: "Entfernen Sie die sperrenden Regeln aus {url}, oder ersetzen Sie sie durch eine ausdrückliche Erlaubnis für jeden Crawler:",
    weCheck: "Wir prüfen diese Crawler:",
    explainer: [
      {
        heading: "Was geprüft wird",
        body: "Wir laden Ihre robots.txt und lesen die Regeln für jeden KI-Crawler beim Namen, mit der Rangfolge, die robots.txt tatsächlich verwendet: Eine Regel, die GPTBot nennt, geht einer allgemeinen Regel vor, die alles sperrt. Gar keine robots.txt bedeutet, dass nichts gesperrt ist. Das ist richtig und zugleich der häufigste Fall.",
      },
      {
        heading: "Warum das versehentlich passiert",
        body: "Sicherheits-Plugins und kopierte Konfigurationen sperren diese Agenten oft standardmäßig, und viele Websites haben sich während der Welle von „Sperren Sie KI-Scraper“-Ratschlägen eine solche Sperre eingefangen. Das Ergebnis: ChatGPT kann das Unternehmen überhaupt nicht zitieren, während Website, Rankings und Statistiken völlig normal aussehen.",
      },
    ],
    ctaHeadline: "Lesbar zu sein ist der Anfang. Zitiert zu werden ist das Ziel.",
    ctaBody: "RepGet verfolgt, ob KI-Assistenten Sie wirklich empfehlen, und schreibt dann die Inhalte, mit denen Sie genannt werden.",
  },
};
