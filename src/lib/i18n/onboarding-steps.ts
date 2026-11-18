import type { Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import type { WizardStepId } from "@/lib/onboarding/wizard";

/**
 * The words of the setup wizard that messages.ts does not hold: the progress
 * labels, the /onboarding checklist, and the lines that were still written
 * into each step's component in English.
 *
 * Before 2026-11-18 a visitor who signed up in Italian read Italian headings
 * on every step with English labels, buttons and toasts around them. Five
 * languages, formal address (Lei, Sie, usted, vous). A page hands each step
 * only its own section, so a client bundle carries one language's words.
 *
 * Terms follow the rest of the app: a subscription plan is "piano", "Tarif",
 * "plan", "forfait" (as the rest of the app, messages.ts); the trial is "prova", "Testphase", "prueba", "essai".
 *
 * "one|many" strings go through plural(); {placeholders} through format().
 * The English halves of a "one|many" pair are identical on purpose: the
 * English screens said "1 briefs" before and still say exactly what they did.
 */

/** The four steps of the /onboarding checklist (lib/onboarding/steps.ts). */
export type ChecklistStepId = "website" | "plan" | "visibility" | "content";

type StepText = { title: string; description: string };

export type OnboardingStepsCopy = {
  /** The progress bar across the top of every step (components/wizard-progress.tsx). */
  wizard: {
    labels: Record<WizardStepId, string>;
    /** Accessible name of a finished step's link. {step} is its label. */
    backTo: string;
  };
  /** /onboarding, the checklist shown once setup is finished. */
  checklist: {
    allSet: string;
    getStarted: string;
    allSetBody: string;
    getStartedBody: string;
    /** {done} of {total} steps. */
    countOf: string;
    steps: Record<Exclude<ChecklistStepId, "plan">, StepText> & {
      /** {days} is TRIAL_DAYS. */
      plan: StepText & { descriptionAgency: string };
    };
  };
  website: {
    /** "STEP 01 / 02", capitals as drawn. */
    step: string;
    /** {platform} is the detected platform's name. */
    platformDetected: string;
    wordpressNote: string;
    otherPlatformNote: string;
    yourBusiness: string;
    domainPlaceholder: string;
    /** {error} is the preview's own message. */
    previewFailed: string;
  };
  google: {
    /** "Step 03 / 06"; shown in capitals by CSS. */
    step: string;
    analyticsDetail: string;
    searchConsoleDetail: string;
    skip: string;
  };
  content: {
    /** {brand} is the website's name. */
    intro: string;
    buildingToast: string;
    readyTitle: string;
    buildingTitle: string;
    idleTitle: string;
    leavingBody: string;
    readyBody: string;
    buildingBody: string;
    idleBody: string;
    searchBody: string;
    clustersBody: string;
    /** one|many; {count} briefs a month. */
    calendarBodyCount: string;
    calendarBody: string;
    /** Named as the /setup checklist names them. */
    nextUp: [string, string, string];
    back: string;
    continuing: string;
    next: string;
  };
  visibility: {
    /** one|many; {count} is the plan's allowance. */
    limitReached: string;
    noNewQuestions: string;
    globalMarket: string;
    defaultLanguage: string;
    /** one|many. */
    promptsIncluded: string;
    edit: string;
    /** one|many; {count} further assistants. */
    moreEngines: string;
    /** {n} / {total}. */
    selected: string;
    /** {prompt} is the question's text. */
    remove: string;
    /** one|many. */
    atLimit: string;
    back: string;
    saving: string;
    /** {n} questions. */
    startTracking: string;
  };
  checkoutPending: {
    received: string;
    receivedSettingUp: string;
  };
};

export const ONBOARDING_STEPS_COPY: Record<Locale, OnboardingStepsCopy> = {
  en: {
    wizard: {
      labels: {
        website: "Website",
        setup: "Setup",
        plan: "Plan",
        google: "Connect Google",
        visibility: "AI visibility",
        content: "Content & backlinks",
        done: "Ready to grow",
      },
      backTo: "Back to {step}",
    },
    checklist: {
      allSet: "You are all set",
      getStarted: "Get started",
      allSetBody: "Everything is set up. This page stays here if you want to check.",
      getStartedBody: "A few steps, and we do most of the work.",
      countOf: "{done} of {total}",
      steps: {
        website: {
          title: "Add your website",
          description: "We read it and work out what your business does.",
        },
        plan: {
          title: "Choose a plan",
          description: "Each website has its own plan. New accounts get a {days}-day free trial.",
          descriptionAgency: "This workspace is set up by us - no plan needed.",
        },
        visibility: {
          title: "Add AI visibility questions",
          description: "The questions your customers would ask an assistant. We check whether you get named.",
        },
        content: {
          title: "Write your first article",
          description: "We research the terms worth going after and write the page that answers them.",
        },
      },
    },
    website: {
      step: "STEP",
      platformDetected: "{platform} detected",
      wordpressNote: "Our plugin connects your blog in about three clicks.",
      otherPlatformNote: "We can publish straight to it once you are set up.",
      yourBusiness: "Your business",
      domainPlaceholder: "your-website.com",
      previewFailed: "{error}. You can still continue.",
    },
    google: {
      step: "Step",
      analyticsDetail: "Track AI-driven traffic and measure content performance.",
      searchConsoleDetail: "Monitor organic search clicks and impressions.",
      skip: "Skip for now",
    },
    content: {
      intro: "We'll turn what we learned about {brand} into a plan you can publish from.",
      buildingToast: "We are building your plan. You can carry on - it lands in a few minutes.",
      readyTitle: "Your content plan is ready",
      buildingTitle: "Building your content plan…",
      idleTitle: "Your content engine is ready",
      leavingBody: "Taking you to the last step…",
      readyBody: "Your search terms and publishing calendar are ready. You can review them on your website page any time.",
      buildingBody: "This usually takes a few minutes. The page updates on its own and moves you on when it is finished.",
      idleBody: "We research what your customers search for, group it into subjects, and write a brief for every article you publish.",
      searchBody: "Find real search demand and the terms worth targeting.",
      clustersBody: "Group related searches so one article covers a subject properly.",
      calendarBodyCount:
        "A calendar of {count} briefs a month, each with a title, term and intent.|A calendar of {count} briefs a month, each with a title, term and intent.",
      calendarBody: "A calendar of briefs, each with a title, target term and intent.",
      nextUp: ["Connect your site", "Activate the backlink exchange", "Linking configuration"],
      back: "Back",
      continuing: "Continuing…",
      next: "Next",
    },
    visibility: {
      limitReached: "Your plan tracks up to {count} questions.|Your plan tracks up to {count} questions.",
      noNewQuestions: "No new questions this time - try adding one of your own.",
      globalMarket: "Global",
      defaultLanguage: "English",
      promptsIncluded: "{count} prompts included|{count} prompts included",
      edit: "Edit",
      moreEngines: "+ {count} more checked on every run|+ {count} more checked on every run",
      selected: "{n} / {total} selected",
      remove: "Remove \"{prompt}\"",
      atLimit:
        "You have filled your plan's {count} questions. Remove one to add another.|You have filled your plan's {count} questions. Remove one to add another.",
      back: "Back",
      saving: "Saving…",
      startTracking: "Start tracking {n}",
    },
    checkoutPending: {
      received: "Payment received",
      receivedSettingUp: "Payment received - setting up",
    },
  },
  it: {
    wizard: {
      labels: {
        website: "Sito web",
        setup: "Configurazione",
        plan: "Piano",
        google: "Collega Google",
        visibility: "Visibilità IA",
        content: "Contenuti e link",
        done: "Pronto a crescere",
      },
      backTo: "Torna a {step}",
    },
    checklist: {
      allSet: "È tutto pronto",
      getStarted: "Inizia",
      allSetBody: "È tutto configurato. Questa pagina resta qui se vuole controllare.",
      getStartedBody: "Pochi passaggi, e la maggior parte del lavoro la facciamo noi.",
      countOf: "{done} di {total}",
      steps: {
        website: {
          title: "Aggiunga il suo sito",
          description: "Lo leggiamo e capiamo di cosa si occupa la sua attività.",
        },
        plan: {
          title: "Scelga un piano",
          description: "Ogni sito web ha il proprio piano. I nuovi account hanno una prova gratuita di {days} giorni.",
          descriptionAgency: "Questo spazio di lavoro è configurato da noi - nessun piano necessario.",
        },
        visibility: {
          title: "Aggiunga le domande di visibilità IA",
          description: "Le domande che i suoi clienti farebbero a un assistente. Controlliamo se lei viene citato.",
        },
        content: {
          title: "Scriva il suo primo articolo",
          description: "Studiamo i termini su cui vale la pena puntare e scriviamo la pagina che risponde.",
        },
      },
    },
    website: {
      step: "PASSO",
      platformDetected: "{platform} rilevato",
      wordpressNote: "Il nostro plugin collega il suo blog in circa tre clic.",
      otherPlatformNote: "Potremo pubblicarvi direttamente una volta completata la configurazione.",
      yourBusiness: "La sua attività",
      domainPlaceholder: "il-suo-sito.com",
      previewFailed: "{error}. Può comunque continuare.",
    },
    google: {
      step: "Passo",
      analyticsDetail: "Monitori il traffico generato dall’IA e misuri il rendimento dei contenuti.",
      searchConsoleDetail: "Monitori clic e impressioni della ricerca organica.",
      skip: "Salta per ora",
    },
    content: {
      intro: "Trasformeremo ciò che abbiamo imparato su {brand} in un piano da cui può pubblicare.",
      buildingToast: "Stiamo preparando il suo piano. Può proseguire - sarà pronto tra pochi minuti.",
      readyTitle: "Il suo piano dei contenuti è pronto",
      buildingTitle: "Stiamo creando il suo piano dei contenuti…",
      idleTitle: "Il suo motore di contenuti è pronto",
      leavingBody: "La portiamo all’ultimo passaggio…",
      readyBody: "I suoi termini di ricerca e il calendario di pubblicazione sono pronti. Può rivederli in qualsiasi momento nella pagina del suo sito.",
      buildingBody: "Di solito ci vogliono alcuni minuti. La pagina si aggiorna da sola e la porta avanti quando ha finito.",
      idleBody: "Studiamo ciò che cercano i suoi clienti, lo raggruppiamo per argomenti e scriviamo un brief per ogni articolo che pubblica.",
      searchBody: "Trovare la domanda di ricerca reale e i termini su cui puntare.",
      clustersBody: "Raggruppare le ricerche correlate perché un articolo tratti a fondo un argomento.",
      calendarBodyCount:
        "Un calendario di {count} brief al mese, con titolo, termine e intento.|Un calendario di {count} brief al mese, ciascuno con titolo, termine e intento.",
      calendarBody: "Un calendario di brief, ciascuno con titolo, termine di riferimento e intento.",
      nextUp: ["Colleghi il suo sito", "Attivi lo scambio di backlink", "Configurazione dei link"],
      back: "Indietro",
      continuing: "Si prosegue…",
      next: "Avanti",
    },
    visibility: {
      limitReached: "Il suo piano monitora fino a {count} domanda.|Il suo piano monitora fino a {count} domande.",
      noNewQuestions: "Nessuna nuova domanda questa volta - provi ad aggiungerne una sua.",
      globalMarket: "Globale",
      defaultLanguage: "Inglese",
      promptsIncluded: "{count} domanda inclusa|{count} domande incluse",
      edit: "Modifica",
      moreEngines: "+ {count} altro controllato a ogni verifica|+ {count} altri controllati a ogni verifica",
      selected: "{n} / {total} selezionate",
      remove: "Rimuovi “{prompt}”",
      atLimit:
        "Ha raggiunto il limite di {count} domanda del suo piano. La rimuova per aggiungerne un’altra.|Ha raggiunto il limite di {count} domande del suo piano. Ne rimuova una per aggiungerne un’altra.",
      back: "Indietro",
      saving: "Salvataggio…",
      startTracking: "Avvia il monitoraggio ({n})",
    },
    checkoutPending: {
      received: "Pagamento ricevuto",
      receivedSettingUp: "Pagamento ricevuto - configurazione in corso",
    },
  },
  de: {
    wizard: {
      labels: {
        website: "Website",
        setup: "Einrichtung",
        plan: "Tarif",
        google: "Google verbinden",
        visibility: "KI-Sichtbarkeit",
        content: "Inhalte und Backlinks",
        done: "Bereit zum Wachsen",
      },
      backTo: "Zurück zu {step}",
    },
    checklist: {
      allSet: "Sie sind startklar",
      getStarted: "Loslegen",
      allSetBody: "Alles ist eingerichtet. Diese Seite bleibt hier, falls Sie etwas prüfen möchten.",
      getStartedBody: "Ein paar Schritte, und den Großteil der Arbeit übernehmen wir.",
      countOf: "{done} von {total}",
      steps: {
        website: {
          title: "Fügen Sie Ihre Website hinzu",
          description: "Wir lesen sie und ermitteln, was Ihr Unternehmen tut.",
        },
        plan: {
          title: "Wählen Sie einen Tarif",
          description: "Jede Website hat ihren eigenen Tarif. Neue Konten erhalten eine {days}-tägige kostenlose Testphase.",
          descriptionAgency: "Dieser Arbeitsbereich wird von uns eingerichtet - kein Tarif nötig.",
        },
        visibility: {
          title: "Fügen Sie Fragen zur KI-Sichtbarkeit hinzu",
          description: "Die Fragen, die Ihre Kunden einem Assistenten stellen würden. Wir prüfen, ob Sie genannt werden.",
        },
        content: {
          title: "Schreiben Sie Ihren ersten Artikel",
          description: "Wir recherchieren die Suchbegriffe, die sich lohnen, und schreiben die Seite, die sie beantwortet.",
        },
      },
    },
    website: {
      step: "SCHRITT",
      platformDetected: "{platform} erkannt",
      wordpressNote: "Unser Plugin verbindet Ihren Blog mit etwa drei Klicks.",
      otherPlatformNote: "Sobald alles eingerichtet ist, können wir direkt dort veröffentlichen.",
      yourBusiness: "Ihr Unternehmen",
      domainPlaceholder: "ihre-website.de",
      previewFailed: "{error}. Sie können trotzdem fortfahren.",
    },
    google: {
      step: "Schritt",
      analyticsDetail: "Verfolgen Sie KI-getriebenen Traffic und messen Sie die Leistung Ihrer Inhalte.",
      searchConsoleDetail: "Behalten Sie Klicks und Impressionen der organischen Suche im Blick.",
      skip: "Vorerst überspringen",
    },
    content: {
      intro: "Wir machen aus dem, was wir über {brand} erfahren haben, einen Plan, nach dem Sie veröffentlichen können.",
      buildingToast: "Wir erstellen Ihren Contentplan. Sie können weitermachen - er ist in wenigen Minuten fertig.",
      readyTitle: "Ihr Contentplan ist fertig",
      buildingTitle: "Ihr Contentplan wird erstellt…",
      idleTitle: "Ihre Content-Engine ist bereit",
      leavingBody: "Wir bringen Sie zum letzten Schritt…",
      readyBody: "Ihre Suchbegriffe und Ihr Veröffentlichungskalender sind fertig. Sie können sie jederzeit auf der Seite Ihrer Website ansehen.",
      buildingBody: "Das dauert meist einige Minuten. Die Seite aktualisiert sich selbst und leitet Sie weiter, sobald sie fertig ist.",
      idleBody: "Wir recherchieren, wonach Ihre Kunden suchen, ordnen es nach Themen und schreiben ein Briefing für jeden Artikel, den Sie veröffentlichen.",
      searchBody: "Echte Suchnachfrage und die lohnenden Suchbegriffe finden.",
      clustersBody: "Verwandte Suchanfragen bündeln, damit ein Artikel ein Thema richtig abdeckt.",
      calendarBodyCount:
        "Ein Kalender mit {count} Briefing pro Monat, mit Titel, Suchbegriff und Suchintention.|Ein Kalender mit {count} Briefings pro Monat, jeweils mit Titel, Suchbegriff und Suchintention.",
      calendarBody: "Ein Kalender mit Briefings, jeweils mit Titel, Ziel-Suchbegriff und Suchintention.",
      nextUp: ["Verbinden Sie Ihre Website", "Aktivieren Sie den Backlink-Austausch", "Link-Konfiguration"],
      back: "Zurück",
      continuing: "Weiter…",
      next: "Weiter",
    },
    visibility: {
      limitReached: "Ihr Tarif verfolgt bis zu {count} Frage.|Ihr Tarif verfolgt bis zu {count} Fragen.",
      noNewQuestions: "Diesmal keine neuen Fragen - fügen Sie doch eine eigene hinzu.",
      globalMarket: "Global",
      defaultLanguage: "Englisch",
      promptsIncluded: "{count} Frage enthalten|{count} Fragen enthalten",
      edit: "Bearbeiten",
      moreEngines: "+ {count} weiterer bei jeder Prüfung abgefragt|+ {count} weitere bei jeder Prüfung abgefragt",
      selected: "{n} / {total} ausgewählt",
      remove: "„{prompt}“ entfernen",
      atLimit:
        "Sie haben die {count} Frage Ihres Tarifs belegt. Entfernen Sie sie, um eine andere hinzuzufügen.|Sie haben alle {count} Fragen Ihres Tarifs belegt. Entfernen Sie eine, um eine weitere hinzuzufügen.",
      back: "Zurück",
      saving: "Wird gespeichert…",
      startTracking: "Verfolgung starten ({n})",
    },
    checkoutPending: {
      received: "Zahlung eingegangen",
      receivedSettingUp: "Zahlung eingegangen - wird eingerichtet",
    },
  },
  es: {
    wizard: {
      labels: {
        website: "Sitio web",
        setup: "Configuración",
        plan: "Plan",
        google: "Conectar Google",
        visibility: "Visibilidad en IA",
        content: "Contenidos y enlaces",
        done: "Listo para crecer",
      },
      backTo: "Volver a {step}",
    },
    checklist: {
      allSet: "Todo está listo",
      getStarted: "Empezar",
      allSetBody: "Todo está configurado. Esta página sigue aquí por si quiere comprobarlo.",
      getStartedBody: "Unos pocos pasos, y nosotros hacemos la mayor parte del trabajo.",
      countOf: "{done} de {total}",
      steps: {
        website: {
          title: "Añada su sitio web",
          description: "Lo leemos y averiguamos a qué se dedica su negocio.",
        },
        plan: {
          title: "Elija un plan",
          description: "Cada sitio web tiene su propio plan. Las cuentas nuevas tienen una prueba gratuita de {days} días.",
          descriptionAgency: "Este espacio de trabajo lo configuramos nosotros: no necesita ningún plan.",
        },
        visibility: {
          title: "Añada preguntas de visibilidad en IA",
          description: "Las preguntas que sus clientes harían a un asistente. Comprobamos si usted aparece mencionado.",
        },
        content: {
          title: "Escriba su primer artículo",
          description: "Investigamos los términos por los que merece la pena ir y escribimos la página que les da respuesta.",
        },
      },
    },
    website: {
      step: "PASO",
      platformDetected: "{platform} detectado",
      wordpressNote: "Nuestro plugin conecta su blog en unos tres clics.",
      otherPlatformNote: "Podremos publicar directamente en él cuando esté todo configurado.",
      yourBusiness: "Su negocio",
      domainPlaceholder: "su-sitio-web.com",
      previewFailed: "{error}. Aun así puede continuar.",
    },
    google: {
      step: "Paso",
      analyticsDetail: "Siga el tráfico procedente de la IA y mida el rendimiento del contenido.",
      searchConsoleDetail: "Supervise los clics e impresiones de la búsqueda orgánica.",
      skip: "Omitir por ahora",
    },
    content: {
      intro: "Convertiremos lo que hemos aprendido sobre {brand} en un plan desde el que puede publicar.",
      buildingToast: "Estamos creando su plan. Puede continuar: estará listo en unos minutos.",
      readyTitle: "Su plan de contenidos está listo",
      buildingTitle: "Creando su plan de contenidos…",
      idleTitle: "Su motor de contenidos está listo",
      leavingBody: "Le llevamos al último paso…",
      readyBody: "Sus términos de búsqueda y su calendario de publicación están listos. Puede revisarlos en cualquier momento en la página de su sitio web.",
      buildingBody: "Esto suele tardar unos minutos. La página se actualiza sola y le lleva al siguiente paso cuando termina.",
      idleBody: "Investigamos lo que buscan sus clientes, lo agrupamos por temas y redactamos un brief para cada artículo que publique.",
      searchBody: "Encontrar la demanda de búsqueda real y los términos a los que merece la pena apuntar.",
      clustersBody: "Agrupar búsquedas relacionadas para que un artículo cubra bien un tema.",
      calendarBodyCount:
        "Un calendario de {count} brief al mes, con título, término e intención.|Un calendario de {count} briefs al mes, cada uno con título, término e intención.",
      calendarBody: "Un calendario de briefs, cada uno con título, término objetivo e intención.",
      nextUp: ["Conecte su sitio web", "Active el intercambio de backlinks", "Configuración de enlaces"],
      back: "Atrás",
      continuing: "Continuando…",
      next: "Siguiente",
    },
    visibility: {
      limitReached: "Su plan sigue hasta {count} pregunta.|Su plan sigue hasta {count} preguntas.",
      noNewQuestions: "Esta vez no hay preguntas nuevas: pruebe a añadir una propia.",
      globalMarket: "Global",
      defaultLanguage: "Inglés",
      promptsIncluded: "{count} pregunta incluida|{count} preguntas incluidas",
      edit: "Editar",
      moreEngines: "+ {count} más consultado en cada comprobación|+ {count} más consultados en cada comprobación",
      selected: "{n} / {total} seleccionadas",
      remove: "Quitar “{prompt}”",
      atLimit:
        "Ha completado la {count} pregunta de su plan. Quítela para añadir otra.|Ha completado las {count} preguntas de su plan. Quite una para añadir otra.",
      back: "Atrás",
      saving: "Guardando…",
      startTracking: "Iniciar seguimiento ({n})",
    },
    checkoutPending: {
      received: "Pago recibido",
      receivedSettingUp: "Pago recibido - configurando",
    },
  },
  fr: {
    wizard: {
      labels: {
        website: "Site web",
        setup: "Configuration",
        plan: "Forfait",
        google: "Connecter Google",
        visibility: "Visibilité IA",
        content: "Contenu et liens",
        done: "Prêt à grandir",
      },
      backTo: "Retour à {step}",
    },
    checklist: {
      allSet: "Tout est prêt",
      getStarted: "Commencer",
      allSetBody: "Tout est configuré. Cette page reste ici si vous souhaitez vérifier.",
      getStartedBody: "Quelques étapes, et nous faisons l’essentiel du travail.",
      countOf: "{done} sur {total}",
      steps: {
        website: {
          title: "Ajoutez votre site",
          description: "Nous le lisons et déterminons ce que fait votre entreprise.",
        },
        plan: {
          title: "Choisissez un forfait",
          description: "Chaque site a son propre forfait. Les nouveaux comptes bénéficient d’un essai gratuit de {days} jours.",
          descriptionAgency: "Cet espace de travail est configuré par nos soins - aucun forfait nécessaire.",
        },
        visibility: {
          title: "Ajoutez des questions de visibilité IA",
          description: "Les questions que vos clients poseraient à un assistant. Nous vérifions si vous êtes cité.",
        },
        content: {
          title: "Rédigez votre premier article",
          description: "Nous recherchons les termes qui valent la peine d’être visés et rédigeons la page qui y répond.",
        },
      },
    },
    website: {
      step: "ÉTAPE",
      platformDetected: "{platform} détecté",
      wordpressNote: "Notre plugin connecte votre blog en trois clics environ.",
      otherPlatformNote: "Nous pourrons y publier directement une fois la configuration terminée.",
      yourBusiness: "Votre entreprise",
      domainPlaceholder: "votre-site.com",
      previewFailed: "{error}. Vous pouvez quand même continuer.",
    },
    google: {
      step: "Étape",
      analyticsDetail: "Suivez le trafic issu de l’IA et mesurez la performance du contenu.",
      searchConsoleDetail: "Surveillez les clics et impressions de la recherche organique.",
      skip: "Passer pour l’instant",
    },
    content: {
      intro: "Nous transformerons ce que nous avons appris sur {brand} en un plan à partir duquel vous pourrez publier.",
      buildingToast: "Nous construisons votre plan. Vous pouvez continuer - il sera prêt dans quelques minutes.",
      readyTitle: "Votre plan de contenu est prêt",
      buildingTitle: "Création de votre plan de contenu…",
      idleTitle: "Votre moteur de contenu est prêt",
      leavingBody: "Nous vous emmenons à la dernière étape…",
      readyBody: "Vos termes de recherche et votre calendrier de publication sont prêts. Vous pouvez les consulter à tout moment sur la page de votre site.",
      buildingBody: "Cela prend généralement quelques minutes. La page se met à jour d’elle-même et vous fait avancer une fois terminé.",
      idleBody: "Nous recherchons ce que vos clients cherchent, le regroupons par sujets et rédigeons un brief pour chaque article que vous publiez.",
      searchBody: "Trouver la demande de recherche réelle et les termes à cibler.",
      clustersBody: "Regrouper les recherches liées pour qu’un article couvre vraiment un sujet.",
      calendarBodyCount:
        "Un calendrier de {count} brief par mois, avec un titre, un terme et une intention.|Un calendrier de {count} briefs par mois, chacun avec un titre, un terme et une intention.",
      calendarBody: "Un calendrier de briefs, chacun avec un titre, un terme cible et une intention.",
      nextUp: ["Connectez votre site", "Activez l’échange de backlinks", "Configuration des liens"],
      back: "Retour",
      continuing: "Un instant…",
      next: "Suivant",
    },
    visibility: {
      limitReached: "Votre forfait suit jusqu’à {count} question.|Votre forfait suit jusqu’à {count} questions.",
      noNewQuestions: "Pas de nouvelles questions cette fois - essayez d’en ajouter une vous-même.",
      globalMarket: "Mondial",
      defaultLanguage: "Anglais",
      promptsIncluded: "{count} question incluse|{count} questions incluses",
      edit: "Modifier",
      moreEngines: "+ {count} autre interrogé à chaque vérification|+ {count} autres interrogés à chaque vérification",
      selected: "{n} / {total} sélectionnées",
      remove: "Retirer « {prompt} »",
      atLimit:
        "Vous avez atteint la {count} question de votre forfait. Retirez-la pour en ajouter une autre.|Vous avez atteint les {count} questions de votre forfait. Retirez-en une pour en ajouter une autre.",
      back: "Retour",
      saving: "Enregistrement…",
      startTracking: "Lancer le suivi ({n})",
    },
    checkoutPending: {
      received: "Paiement reçu",
      receivedSettingUp: "Paiement reçu - configuration en cours",
    },
  },
};

/**
 * One checklist row's words. The plan row has two descriptions: an agency
 * workspace is ours and needs no plan.
 */
export function checklistStepText(
  locale: Locale,
  id: ChecklistStepId,
  options: { agency: boolean; trialDays: number },
): StepText {
  const steps = ONBOARDING_STEPS_COPY[locale].checklist.steps;
  if (id !== "plan") return steps[id];
  return {
    title: steps.plan.title,
    description: options.agency
      ? steps.plan.descriptionAgency
      : format(steps.plan.description, { days: options.trialDays }),
  };
}
