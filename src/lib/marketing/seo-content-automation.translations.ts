import type { Locale } from "@/lib/i18n/config";

import type { LaunchFacts, SeoContentAutomationCopy } from "./seo-content-automation";

/**
 * /it|de|es|fr/seo-content-automation: the English page's words
 * (seo-content-automation.ts) in the four other site languages, for the
 * Italian, German, Spanish and French Google Ads candidates
 * (review-reports/2026-11-18/google-ads/multilingual-preparation).
 *
 * THE SAME FACTS AS THE ENGLISH PAGE, NOT NEW ONES. Every sentence translates
 * one of its claims - which seo-content-automation.ts checks against the code -
 * and says no more: the first article is published live at once, new websites
 * publish automatically, images are not promised, no schema, one website per
 * subscription, the trial once per new account with a card or PayPal approval,
 * the price after the trial, cancellation from Billing and the separate
 * first-payment refund. seo-content-automation-page.render.test.ts holds every
 * language to the same figures and the same absences.
 *
 * The formal register of the site's other translated pages: Lei, Sie, usted,
 * vous. Plan names stay in English (they are what the invoice says), and so do
 * the names platforms give their own settings (Admin API, Site ID).
 *
 * The refund policy and the terms of service exist in English only, so each
 * language says so next to their links rather than linking to them as if they
 * were translated.
 */

type Translated = Exclude<Locale, "en">;

/** Thousands in the reader's own notation: 1.000, 1 000. */
function count(value: number, locale: Translated): string {
  return value.toLocaleString(locale);
}

const it = (launch: LaunchFacts | null): SeoContentAutomationCopy => ({
  metaTitle: "Automazione dei contenuti SEO per siti aziendali",
  metaDescription:
    "Pianifichi argomenti SEO, crei articoli con l'AI e li pubblichi su WordPress, Shopify, Ghost, Webflow, Wix o tramite webhook. Il piano Launch inizia con una prova di 3 giorni.",
  eyebrow: "Automazione dei contenuti SEO",
  title: "Automazione dei contenuti SEO per il sito della sua azienda",
  intro:
    "RepGet riunisce in un unico flusso di lavoro la pianificazione degli argomenti, la scrittura degli articoli con l'AI e la pubblicazione sul suo sito. Colleghi il sito, scelga come pubblicare gli articoli e RepGet li scrive e li consegna secondo un calendario.",
  primaryCta: "Inizi la prova del piano Launch",
  secondaryCta: "Confronti tutti i piani",
  stepsTitle: "Dalla ricerca all'articolo pubblicato",
  steps: [
    {
      title: "Ricerca",
      body: `Aggiunga il suo sito. RepGet lo analizza, ricerca le parole chiave per la sua attività e le raggruppa in argomenti. ${
        launch ? `Il piano Launch include ${count(launch.terms, "it")} parole chiave ricercate.` : ""
      }`.trim(),
    },
    {
      title: "Pianificazione",
      body: "Gli argomenti diventano un calendario editoriale con le date. Può modificare, spostare o eliminare qualsiasi articolo pianificato.",
    },
    {
      title: "Scrittura",
      body: "Ogni articolo è scritto dall'AI nella lingua del suo sito, con titolo, meta description e link interni a pagine che esistono sul sito. Un'immagine di copertina viene aggiunta quando la generazione delle immagini è disponibile; in caso contrario l'articolo viene scritto comunque.",
    },
    {
      title: "Pubblicazione",
      body: "Gli articoli arrivano sul sito collegato nel giorno previsto: pubblicati online, inviati come bozze al suo CMS oppure tenuti in RepGet finché non li approva. Più sotto trova come inizia la pubblicazione.",
    },
  ],
  publishing: {
    title: "La pubblicazione è automatica, a meno che non la cambi",
    points: [
      "Un nuovo sito parte in modalità automatica: ogni articolo viene pubblicato online nel giorno previsto.",
      "Il primo articolo del sito viene pubblicato online non appena è scritto e il sito è collegato, in qualunque modalità, così vede subito un articolo reale sul suo sito.",
      "In seguito, dalle impostazioni di pubblicazione del sito, può inviare gli articoli al CMS come bozze oppure tenerli in RepGet finché non li approva. La revisione non è l'impostazione predefinita.",
      "Per impostazione predefinita gli articoli includono un piccolo link “powered by RepGet” e il sito entra nella Partner Network di RepGet, quindi nei suoi articoli possono essere inseriti link ai siti di altri membri. Può disattivare entrambe le opzioni.",
    ],
  },
  connectionsTitle: "Dove RepGet può pubblicare",
  connectionsIntro: "Ogni collegamento richiede una breve configurazione da parte sua. Queste sono tutte le piattaforme su cui RepGet pubblica direttamente:",
  connections: [
    {
      name: "Plugin WordPress",
      setup:
        "Installi il plugin RepGet Connector come amministratore di WordPress. Il plugin controlla i nuovi articoli circa una volta all'ora con lo scheduler di WordPress, che si attiva quando il sito riceve visite: i tempi possono quindi variare.",
    },
    {
      name: "WordPress (password per le applicazioni)",
      setup: "Un sito WordPress self-hosted e un account Editore o Amministratore per creare una password per le applicazioni.",
    },
    { name: "Shopify", setup: "Un token di accesso Admin API di un'app personalizzata del suo negozio, per pubblicare sul blog del negozio." },
    { name: "Ghost", setup: "Una Admin API key di un'integrazione personalizzata nell'amministrazione di Ghost, self-hosted o Ghost(Pro)." },
    { name: "Webflow", setup: "Un sito Webflow con piano a pagamento, un Site API token e una collection CMS per il blog." },
    { name: "Wix", setup: "L'app Wix Blog, una API key con i permessi del blog e il Site ID. Il testo dell'articolo arriva come un unico blocco HTML." },
    {
      name: "Webhook personalizzato",
      setup: "Un endpoint HTTPS realizzato da lei che riceve l'articolo finito in formato JSON, per le piattaforme non elencate qui.",
    },
  ],
  connectionsNote: "Le altre piattaforme non sono collegate direttamente.",
  connectionsLink: "Legga le guide di configurazione",
  planTitle: "Il piano Launch",
  planIntro: launch
    ? `${launch.price} al mese, fatturati in euro, dopo una prova gratuita di 3 giorni per i nuovi account. Un abbonamento copre un sito.`
    : "Un abbonamento copre un sito. Il prezzo attuale è indicato nella pagina dei prezzi e al checkout.",
  planPoints: [
    ...(launch
      ? [`${launch.articles} articoli SEO al mese`, `${count(launch.terms, "it")} parole chiave ricercate e raggruppate in argomenti`]
      : []),
    "Pubblicazione su un sito collegato",
    "Articoli in inglese, spagnolo, francese, italiano, tedesco, portoghese, olandese, polacco e rumeno",
    "Inclusi anche: post per i social, un audit del sito, il Growth Copilot e gli altri strumenti indicati nella pagina dei prezzi",
  ],
  limitsTitle: "Cosa RepGet non fa",
  limits: [
    "Correggere al posto suo la SEO tecnica del sito. L'audit del sito elenca i problemi che trova e come risolverli.",
    "Aggiungere markup schema (dati strutturati) agli articoli.",
    "Pubblicare su una piattaforma senza uno dei collegamenti indicati sopra.",
    "Garantire posizionamenti, traffico o clienti. Nessuno può farlo.",
  ],
  termsTitle: "Prova, pagamento e disdetta",
  terms: [
    "La prova gratuita di 3 giorni è riservata a un nuovo account che non ha mai avuto un abbonamento. Se ne ha già avuto uno, il piano inizia, e viene addebitato, al momento dell'abbonamento.",
    "Per iniziare la prova imposta un metodo di pagamento al checkout: una carta oppure un'autorizzazione PayPal. Durante la prova non viene addebitato nulla.",
    launch
      ? `Durante la prova riceve il piano al suo ritmo giornaliero: fino a ${launch.trialArticles} articoli nei tre giorni.`
      : "Durante la prova riceve il piano al suo ritmo giornaliero.",
    launch
      ? `Alla fine della prova vengono addebitati ${launch.price}, poi ogni mese fino alla disdetta, a meno che non disdica prima della fine della prova. Il checkout mostra importi e date prima della conferma.`
      : "Alla fine della prova viene addebitato il prezzo del piano, poi ogni mese fino alla disdetta, a meno che non disdica prima della fine della prova. Il checkout mostra importi e date prima della conferma.",
    "Può disdire in qualsiasi momento dalla pagina di fatturazione del suo account. L'accesso resta attivo fino alla fine del periodo già pagato.",
    "Indipendentemente dalla prova: se non è soddisfatto, ci scriva entro 3 giorni dal primo pagamento e lo rimborsiamo per intero.",
  ],
  termsLinks: {
    refunds: "Politica di rimborso",
    terms: "Termini di servizio",
    pricing: "Tutti i piani e i prezzi",
    englishOnly: "La politica di rimborso e i termini di servizio sono disponibili solo in inglese.",
  },
  faqTitle: "Domande",
  faq: [
    {
      question: "Posso leggere gli articoli prima che vengano pubblicati?",
      answer:
        "Dal secondo articolo in poi sì, se imposta il sito in modalità bozza o revisione. Il primo articolo viene sempre pubblicato online non appena è scritto, e i nuovi siti partono in modalità automatica.",
    },
    {
      question: "RepGet corregge la SEO del mio sito?",
      answer:
        "Scrive e pubblica nuovi articoli. Per le pagine esistenti, l'audit del sito segnala problemi come titoli o descrizioni mancanti e spiega come risolverli; la modifica spetta a lei o al suo sviluppatore.",
    },
    {
      question: "Serve esperienza di SEO?",
      answer: "No. Aggiunge il suo sito e alcune informazioni sulla sua attività; ricerca, pianificazione, scrittura e pubblicazione partono da lì. Può modificare tutto.",
    },
    {
      question: "Posso usarlo per più di un sito?",
      answer: "Ogni abbonamento copre un sito. Un secondo sito richiede un proprio abbonamento.",
    },
  ],
  closingTitle: "Dia al suo blog un calendario",
  closingBody: "Inizi con la prova del piano Launch, oppure confronti prima tutti i piani.",
});

const de = (launch: LaunchFacts | null): SeoContentAutomationCopy => ({
  metaTitle: "SEO-Content-Automatisierung für Unternehmenswebsites",
  metaDescription:
    "SEO-Themen planen, KI-Artikel erstellen und auf WordPress, Shopify, Ghost, Webflow, Wix oder per Webhook veröffentlichen. Der Launch-Tarif beginnt mit einer 3-tägigen Testphase.",
  eyebrow: "SEO-Content-Automatisierung",
  title: "SEO-Content-Automatisierung für Ihre Unternehmenswebsite",
  intro:
    "RepGet bündelt Themenplanung, KI-Artikelerstellung und die Veröffentlichung auf Ihrer Website in einem Ablauf. Verbinden Sie Ihre Website, legen Sie fest, wie Artikel veröffentlicht werden, und RepGet schreibt und liefert sie nach Zeitplan.",
  primaryCta: "Launch-Testphase starten",
  secondaryCta: "Alle Tarife vergleichen",
  stepsTitle: "Von der Recherche zum veröffentlichten Artikel",
  steps: [
    {
      title: "Recherche",
      body: `Fügen Sie Ihre Website hinzu. RepGet liest sie, recherchiert Suchbegriffe für Ihr Unternehmen und gruppiert sie zu Themen. ${
        launch ? `Launch umfasst ${count(launch.terms, "de")} recherchierte Suchbegriffe.` : ""
      }`.trim(),
    },
    {
      title: "Planung",
      body: "Aus diesen Themen wird ein Redaktionskalender mit Terminen. Jeden geplanten Artikel können Sie bearbeiten, verschieben oder entfernen.",
    },
    {
      title: "Schreiben",
      body: "Jeder Artikel wird per KI in der Sprache Ihrer Website geschrieben, mit Titel, Meta-Description und internen Links auf Seiten, die es auf Ihrer Website gibt. Ein Titelbild wird hinzugefügt, wenn die Bildgenerierung verfügbar ist; andernfalls wird der Artikel trotzdem geschrieben.",
    },
    {
      title: "Veröffentlichen",
      body: "Artikel gehen am geplanten Tag an Ihre verbundene Website: direkt veröffentlicht, als Entwurf an Ihr CMS gesendet oder in RepGet gehalten, bis Sie sie freigeben. Wie die Veröffentlichung beginnt, lesen Sie weiter unten.",
    },
  ],
  publishing: {
    title: "Die Veröffentlichung ist automatisch, solange Sie nichts ändern",
    points: [
      "Eine neue Website startet im automatischen Modus: Jeder Artikel wird am geplanten Tag live veröffentlicht.",
      "Der erste Artikel Ihrer Website wird live veröffentlicht, sobald er geschrieben und Ihre Website verbunden ist – in jedem Modus, damit Sie einen echten Beitrag auf Ihrer Website sehen.",
      "Danach können Sie Artikel in den Veröffentlichungseinstellungen der Website als Entwurf an Ihr CMS senden oder in RepGet halten, bis Sie sie freigeben. Die Prüfung vor der Veröffentlichung ist nicht die Standardeinstellung.",
      "Standardmäßig enthalten Artikel einen kleinen Link „powered by RepGet“, und Ihre Website tritt dem Partner Network von RepGet bei, sodass in Ihren Artikeln Links zu Websites anderer Mitglieder platziert werden können. Beides können Sie abschalten.",
    ],
  },
  connectionsTitle: "Wo RepGet veröffentlichen kann",
  connectionsIntro: "Jede Anbindung erfordert eine kurze Einrichtung auf Ihrer Seite. Das sind alle Plattformen, auf denen RepGet direkt veröffentlicht:",
  connections: [
    {
      name: "WordPress-Plugin",
      setup:
        "Installieren Sie das Plugin RepGet Connector als WordPress-Administrator. Es prüft etwa einmal pro Stunde über den WordPress-eigenen Zeitplaner auf neue Artikel. Dieser läuft, wenn Ihre Website Besuche hat, daher kann der Zeitpunkt variieren.",
    },
    {
      name: "WordPress (Anwendungspasswort)",
      setup: "Eine selbst gehostete WordPress-Website und ein Konto mit der Rolle Redakteur oder Administrator, um ein Anwendungspasswort zu erstellen.",
    },
    { name: "Shopify", setup: "Ein Admin-API-Zugriffstoken aus einer benutzerdefinierten App in Ihrem Shop, um in dessen Blog zu veröffentlichen." },
    { name: "Ghost", setup: "Ein Admin-API-Schlüssel aus einer benutzerdefinierten Integration im Ghost-Admin, selbst gehostet oder Ghost(Pro)." },
    { name: "Webflow", setup: "Eine Webflow-Website mit kostenpflichtigem Tarif, ein Site-API-Token und eine CMS-Collection für Ihren Blog." },
    { name: "Wix", setup: "Die App Wix Blog, ein API-Schlüssel mit Blog-Berechtigungen und Ihre Site-ID. Der Artikeltext kommt als ein einziger HTML-Block an." },
    {
      name: "Eigener Webhook",
      setup: "Ein HTTPS-Endpunkt, den Sie selbst bauen und der den fertigen Artikel als JSON annimmt – für Plattformen, die hier nicht aufgeführt sind.",
    },
  ],
  connectionsNote: "Andere Plattformen sind nicht direkt angebunden.",
  connectionsLink: "Einrichtungsanleitungen lesen",
  planTitle: "Der Launch-Tarif",
  planIntro: launch
    ? `${launch.price} pro Monat, abgerechnet in Euro, nach einer 3-tägigen kostenlosen Testphase für neue Konten. Ein Abonnement gilt für eine Website.`
    : "Ein Abonnement gilt für eine Website. Der aktuelle Preis steht auf der Preisseite und im Checkout.",
  planPoints: [
    ...(launch
      ? [`${launch.articles} SEO-Artikel pro Monat`, `${count(launch.terms, "de")} recherchierte und zu Themen gruppierte Suchbegriffe`]
      : []),
    "Veröffentlichung auf einer verbundenen Website",
    "Artikel auf Englisch, Spanisch, Französisch, Italienisch, Deutsch, Portugiesisch, Niederländisch, Polnisch und Rumänisch",
    "Außerdem enthalten: Social-Media-Beiträge, ein Website-Audit, der Growth Copilot und die weiteren Tools auf der Preisseite",
  ],
  limitsTitle: "Was RepGet nicht macht",
  limits: [
    "Die technische SEO Ihrer Website für Sie beheben. Das Website-Audit listet die gefundenen Probleme und ihre Behebung auf.",
    "Schema-Markup (strukturierte Daten) zu Ihren Artikeln hinzufügen.",
    "Auf einer Plattform ohne eine der oben genannten Anbindungen veröffentlichen.",
    "Rankings, Traffic oder Kunden garantieren. Das kann niemand.",
  ],
  termsTitle: "Testphase, Zahlung und Kündigung",
  terms: [
    "Die 3-tägige kostenlose Testphase gilt für ein neues Konto, das noch nie ein Abonnement hatte. Hatten Sie bereits eines, beginnt der Tarif mit dem Abschluss und wird dann berechnet.",
    "Zum Start der Testphase hinterlegen Sie im Checkout eine Zahlungsmethode: eine Karte oder eine PayPal-Freigabe. Während der Testphase wird nichts berechnet.",
    launch
      ? `In der Testphase erhalten Sie den Tarif in seinem täglichen Tempo: bis zu ${launch.trialArticles} Artikel in den drei Tagen.`
      : "In der Testphase erhalten Sie den Tarif in seinem täglichen Tempo.",
    launch
      ? `Am Ende der Testphase werden ${launch.price} berechnet, danach jeden Monat bis zur Kündigung – es sei denn, Sie kündigen vor Ende der Testphase. Der Checkout zeigt Beträge und Termine, bevor Sie bestätigen.`
      : "Am Ende der Testphase wird der Preis des Tarifs berechnet, danach jeden Monat bis zur Kündigung – es sei denn, Sie kündigen vor Ende der Testphase. Der Checkout zeigt Beträge und Termine, bevor Sie bestätigen.",
    "Sie können jederzeit über die Abrechnungsseite in Ihrem Konto kündigen. Der Zugang bleibt bis zum Ende des bezahlten Zeitraums bestehen.",
    "Unabhängig von der Testphase: Wenn Sie nicht zufrieden sind, schreiben Sie uns innerhalb von 3 Tagen nach Ihrer ersten Zahlung, und wir erstatten sie vollständig.",
  ],
  termsLinks: {
    refunds: "Erstattungsrichtlinie",
    terms: "Nutzungsbedingungen",
    pricing: "Alle Tarife und Preise",
    englishOnly: "Die Erstattungsrichtlinie und die Nutzungsbedingungen sind nur auf Englisch verfügbar.",
  },
  faqTitle: "Fragen",
  faq: [
    {
      question: "Kann ich Artikel vor der Veröffentlichung lesen?",
      answer:
        "Ab dem zweiten Artikel ja, wenn Sie die Website auf den Entwurfs- oder Prüfmodus umstellen. Der erste Artikel wird immer live veröffentlicht, sobald er geschrieben ist, und neue Websites starten im automatischen Modus.",
    },
    {
      question: "Behebt RepGet die SEO meiner Website?",
      answer:
        "RepGet schreibt und veröffentlicht neue Artikel. Für Ihre bestehenden Seiten meldet das Website-Audit Probleme wie fehlende Titel oder Beschreibungen und erklärt die Behebung; die Änderung nehmen Sie oder Ihr Entwickler vor.",
    },
    {
      question: "Brauche ich SEO-Erfahrung?",
      answer: "Nein. Sie fügen Ihre Website und einige Angaben zu Ihrem Unternehmen hinzu; Recherche, Planung, Schreiben und Veröffentlichen bauen darauf auf. Sie können alles ändern.",
    },
    {
      question: "Kann ich RepGet für mehr als eine Website nutzen?",
      answer: "Jedes Abonnement gilt für eine Website. Eine zweite Website braucht ein eigenes Abonnement.",
    },
  ],
  closingTitle: "Bringen Sie Ihren Blog in einen festen Rhythmus",
  closingBody: "Starten Sie mit der Launch-Testphase oder vergleichen Sie zuerst alle Tarife.",
});

const es = (launch: LaunchFacts | null): SeoContentAutomationCopy => ({
  metaTitle: "Automatización de contenido SEO para webs de empresa",
  metaDescription:
    "Planifique temas SEO, cree artículos con IA y publíquelos en WordPress, Shopify, Ghost, Webflow, Wix o mediante un webhook. El plan Launch empieza con una prueba de 3 días.",
  eyebrow: "Automatización de contenido SEO",
  title: "Automatización de contenido SEO para la web de su empresa",
  intro:
    "RepGet reúne en un solo flujo de trabajo la planificación de temas, la redacción de artículos con IA y la publicación en su web. Conecte su web, elija cómo se publican los artículos y RepGet los redacta y los entrega según un calendario.",
  primaryCta: "Empezar la prueba de Launch",
  secondaryCta: "Comparar todos los planes",
  stepsTitle: "De la investigación al artículo publicado",
  steps: [
    {
      title: "Investigación",
      body: `Añada su web. RepGet la analiza, investiga palabras clave para su negocio y las agrupa en temas. ${
        launch ? `Launch incluye ${count(launch.terms, "es")} palabras clave investigadas.` : ""
      }`.trim(),
    },
    {
      title: "Planificación",
      body: "Esos temas se convierten en un calendario de contenidos con fechas. Puede editar, mover o eliminar cualquier artículo planificado.",
    },
    {
      title: "Redacción",
      body: "La IA redacta cada artículo en el idioma de su web, con un título, una meta descripción y enlaces internos a páginas que existen en su sitio. Se añade una imagen de portada cuando la generación de imágenes está disponible; si no lo está, el artículo se redacta igualmente.",
    },
    {
      title: "Publicación",
      body: "Los artículos llegan a su web conectada el día previsto: publicados directamente, enviados como borradores a su CMS o guardados en RepGet hasta que usted los apruebe. Más abajo se explica cómo empieza la publicación.",
    },
  ],
  publishing: {
    title: "La publicación es automática salvo que usted la cambie",
    points: [
      "Una web nueva empieza en modo automático: cada artículo se publica el día previsto.",
      "El primer artículo de su web se publica en cuanto está redactado y la web está conectada, sea cual sea el modo elegido, para que vea un artículo real en su sitio.",
      "Después puede enviar los artículos a su CMS como borradores, o guardarlos en RepGet hasta que los apruebe, desde los ajustes de publicación de la web. La revisión no es la opción predeterminada.",
      "De forma predeterminada, los artículos llevan un pequeño enlace “powered by RepGet” y su web se une a la Partner Network de RepGet, de modo que en sus artículos pueden colocarse enlaces a webs de otros miembros. Puede desactivar ambas opciones.",
    ],
  },
  connectionsTitle: "Dónde puede publicar RepGet",
  connectionsIntro: "Cada conexión requiere una breve configuración por su parte. Estas son todas las plataformas en las que RepGet publica directamente:",
  connections: [
    {
      name: "Plugin de WordPress",
      setup:
        "Instale el plugin RepGet Connector como administrador de WordPress. Comprueba si hay artículos nuevos aproximadamente una vez por hora con el programador de tareas de WordPress, que se ejecuta cuando su sitio recibe visitas, así que los tiempos pueden variar.",
    },
    {
      name: "WordPress (contraseña de aplicación)",
      setup: "Un sitio WordPress autoalojado y una cuenta de Editor o Administrador para crear una contraseña de aplicación.",
    },
    { name: "Shopify", setup: "Un token de acceso a la Admin API de una app personalizada de su tienda, para publicar en su blog." },
    { name: "Ghost", setup: "Una Admin API key de una integración personalizada en el panel de Ghost, autoalojado o Ghost(Pro)." },
    { name: "Webflow", setup: "Un sitio de Webflow con plan de pago, un Site API token y una colección del CMS para su blog." },
    { name: "Wix", setup: "La app Wix Blog, una API key con permisos de blog y su Site ID. El cuerpo del artículo llega como un único bloque HTML." },
    {
      name: "Webhook personalizado",
      setup: "Un endpoint HTTPS creado por usted que recibe el artículo terminado en formato JSON, para plataformas que no aparecen aquí.",
    },
  ],
  connectionsNote: "Las demás plataformas no se conectan directamente.",
  connectionsLink: "Leer las guías de configuración",
  planTitle: "El plan Launch",
  planIntro: launch
    ? `${launch.price} al mes, facturado en euros, después de una prueba gratuita de 3 días para cuentas nuevas. Una suscripción cubre una web.`
    : "Una suscripción cubre una web. El precio actual aparece en la página de precios y en la página de pago.",
  planPoints: [
    ...(launch
      ? [`${launch.articles} artículos SEO al mes`, `${count(launch.terms, "es")} palabras clave investigadas y agrupadas en temas`]
      : []),
    "Publicación en una web conectada",
    "Artículos en inglés, español, francés, italiano, alemán, portugués, neerlandés, polaco y rumano",
    "También incluye: publicaciones para redes sociales, una auditoría del sitio, el Growth Copilot y las demás herramientas de la página de precios",
  ],
  limitsTitle: "Lo que RepGet no hace",
  limits: [
    "Corregir por usted el SEO técnico de su web. La auditoría del sitio enumera los problemas que encuentra y cómo resolverlos.",
    "Añadir marcado schema (datos estructurados) a sus artículos.",
    "Publicar en una plataforma sin una de las conexiones anteriores.",
    "Garantizar posiciones, tráfico o clientes. Nadie puede hacerlo.",
  ],
  termsTitle: "Prueba, pago y cancelación",
  terms: [
    "La prueba gratuita de 3 días es para una cuenta nueva que nunca ha tenido una suscripción. Si ya ha tenido una, el plan empieza, y se cobra, cuando se suscribe.",
    "Para empezar la prueba, configura un método de pago en la página de pago: una tarjeta o una autorización de PayPal. Durante la prueba no se cobra nada.",
    launch
      ? `Durante la prueba recibe el plan a su ritmo diario: hasta ${launch.trialArticles} artículos en los tres días.`
      : "Durante la prueba recibe el plan a su ritmo diario.",
    launch
      ? `Cuando termina la prueba se cobran ${launch.price} y después cada mes hasta que cancele, salvo que cancele antes de que termine la prueba. La página de pago muestra los importes y las fechas antes de que confirme.`
      : "Cuando termina la prueba se cobra el precio del plan y después cada mes hasta que cancele, salvo que cancele antes de que termine la prueba. La página de pago muestra los importes y las fechas antes de que confirme.",
    "Puede cancelar en cualquier momento desde la página de facturación de su cuenta. Mantiene el acceso hasta el final del periodo pagado.",
    "Aparte de la prueba: si no está satisfecho, escríbanos en los 3 días siguientes a su primer pago y se lo reembolsamos íntegramente.",
  ],
  termsLinks: {
    refunds: "Política de reembolso",
    terms: "Condiciones del servicio",
    pricing: "Todos los planes y precios",
    englishOnly: "La política de reembolso y las condiciones del servicio solo están disponibles en inglés.",
  },
  faqTitle: "Preguntas",
  faq: [
    {
      question: "¿Puedo leer los artículos antes de que se publiquen?",
      answer:
        "A partir del segundo artículo, sí, si cambia la web al modo borrador o revisión. El primer artículo siempre se publica en cuanto está redactado, y las webs nuevas empiezan en modo automático.",
    },
    {
      question: "¿RepGet corrige el SEO de mi web?",
      answer:
        "Redacta y publica artículos nuevos. Para sus páginas existentes, la auditoría del sitio señala problemas como títulos o descripciones que faltan y explica cómo resolverlos; hacer el cambio les corresponde a usted o a su desarrollador.",
    },
    {
      question: "¿Necesito experiencia en SEO?",
      answer: "No. Añade su web y algunos datos sobre su negocio; la investigación, la planificación, la redacción y la publicación parten de ahí. Puede cambiar cualquier cosa.",
    },
    {
      question: "¿Puedo usarlo para más de una web?",
      answer: "Cada suscripción cubre una web. Una segunda web necesita su propia suscripción.",
    },
  ],
  closingTitle: "Dé a su blog un calendario fijo",
  closingBody: "Empiece con la prueba de Launch o compare antes todos los planes.",
});

const fr = (launch: LaunchFacts | null): SeoContentAutomationCopy => ({
  metaTitle: "Automatisation de contenu SEO pour sites d'entreprise",
  metaDescription:
    "Planifiez vos sujets SEO, créez des articles avec l'IA et publiez-les sur WordPress, Shopify, Ghost, Webflow, Wix ou via un webhook. La formule Launch commence par un essai de 3 jours.",
  eyebrow: "Automatisation de contenu SEO",
  title: "Automatisation de contenu SEO pour le site de votre entreprise",
  intro:
    "RepGet réunit en un seul flux la planification des sujets, la rédaction d'articles par IA et leur publication sur votre site. Connectez votre site, choisissez comment les articles sont publiés, et RepGet les rédige et les livre selon un calendrier.",
  primaryCta: "Commencer l'essai Launch",
  secondaryCta: "Comparer toutes les formules",
  stepsTitle: "De la recherche à l'article publié",
  steps: [
    {
      title: "Recherche",
      body: `Ajoutez votre site. RepGet l'analyse, recherche des mots-clés pour votre activité et les regroupe en sujets. ${
        launch ? `Launch comprend ${count(launch.terms, "fr")} mots-clés recherchés.` : ""
      }`.trim(),
    },
    {
      title: "Planification",
      body: "Ces sujets deviennent un calendrier éditorial daté. Vous pouvez modifier, déplacer ou supprimer n'importe quel article prévu.",
    },
    {
      title: "Rédaction",
      body: "Chaque article est rédigé par l'IA dans la langue de votre site, avec un titre, une méta-description et des liens internes vers des pages qui existent sur votre site. Une image de couverture est ajoutée quand la génération d'images est disponible ; sinon, l'article est tout de même rédigé.",
    },
    {
      title: "Publication",
      body: "Les articles arrivent sur votre site connecté le jour prévu : publiés en ligne, envoyés en brouillon à votre CMS ou conservés dans RepGet jusqu'à votre validation. Voyez plus bas comment la publication démarre.",
    },
  ],
  publishing: {
    title: "La publication est automatique, sauf si vous la modifiez",
    points: [
      "Un nouveau site démarre en mode automatique : chaque article est publié en ligne le jour prévu.",
      "Le premier article de votre site est publié en ligne dès qu'il est rédigé et que votre site est connecté, quel que soit le mode choisi, pour que vous voyiez un vrai article sur votre site.",
      "Ensuite, depuis les réglages de publication du site, vous pouvez envoyer les articles à votre CMS en brouillon, ou les conserver dans RepGet jusqu'à votre validation. La relecture n'est pas le mode par défaut.",
      "Par défaut, les articles comportent un petit lien « powered by RepGet » et votre site rejoint le Partner Network de RepGet : des liens vers les sites d'autres membres peuvent donc être placés dans vos articles. Vous pouvez désactiver l'un et l'autre.",
    ],
  },
  connectionsTitle: "Où RepGet peut publier",
  connectionsIntro: "Chaque connexion demande une courte configuration de votre côté. Voici toutes les plateformes sur lesquelles RepGet publie directement :",
  connections: [
    {
      name: "Extension WordPress",
      setup:
        "Installez l'extension RepGet Connector en tant qu'administrateur WordPress. Elle vérifie les nouveaux articles environ une fois par heure grâce au planificateur de WordPress, qui s'exécute quand votre site reçoit des visites ; les délais peuvent donc varier.",
    },
    {
      name: "WordPress (mot de passe d'application)",
      setup: "Un site WordPress auto-hébergé et un compte Éditeur ou Administrateur pour créer un mot de passe d'application.",
    },
    { name: "Shopify", setup: "Un jeton d'accès Admin API issu d'une application personnalisée de votre boutique, pour publier sur son blog." },
    { name: "Ghost", setup: "Une clé Admin API issue d'une intégration personnalisée dans l'administration de Ghost, auto-hébergé ou Ghost(Pro)." },
    { name: "Webflow", setup: "Un site Webflow avec un forfait payant, un jeton Site API et une collection CMS pour votre blog." },
    { name: "Wix", setup: "L'application Wix Blog, une clé API avec les autorisations du blog et votre Site ID. Le corps de l'article arrive sous la forme d'un seul bloc HTML." },
    {
      name: "Webhook personnalisé",
      setup: "Un point de terminaison HTTPS que vous développez et qui reçoit l'article terminé au format JSON, pour les plateformes non listées ici.",
    },
  ],
  connectionsNote: "Les autres plateformes ne sont pas connectées directement.",
  connectionsLink: "Lire les guides de configuration",
  planTitle: "La formule Launch",
  planIntro: launch
    ? `${launch.price} par mois, facturés en euros, après un essai gratuit de 3 jours pour les nouveaux comptes. Un abonnement couvre un site.`
    : "Un abonnement couvre un site. Le prix actuel figure sur la page des tarifs et sur la page de paiement.",
  planPoints: [
    ...(launch ? [`${launch.articles} articles SEO par mois`, `${count(launch.terms, "fr")} mots-clés recherchés et regroupés en sujets`] : []),
    "Publication sur un site connecté",
    "Articles en anglais, espagnol, français, italien, allemand, portugais, néerlandais, polonais et roumain",
    "Également inclus : des publications pour les réseaux sociaux, un audit du site, le Growth Copilot et les autres outils indiqués sur la page des tarifs",
  ],
  limitsTitle: "Ce que RepGet ne fait pas",
  limits: [
    "Corriger à votre place le SEO technique de votre site. L'audit du site liste les problèmes trouvés et la façon de les corriger.",
    "Ajouter un balisage schema (données structurées) à vos articles.",
    "Publier sur une plateforme sans l'une des connexions ci-dessus.",
    "Garantir des positions, du trafic ou des clients. Personne ne le peut.",
  ],
  termsTitle: "Essai, paiement et résiliation",
  terms: [
    "L'essai gratuit de 3 jours est réservé à un nouveau compte qui n'a jamais eu d'abonnement. Si vous en avez déjà eu un, la formule commence, et est facturée, dès votre abonnement.",
    "Pour démarrer l'essai, vous enregistrez un moyen de paiement sur la page de paiement : une carte ou une autorisation PayPal. Rien n'est prélevé pendant l'essai.",
    launch
      ? `Pendant l'essai, vous recevez la formule à son rythme quotidien : jusqu'à ${launch.trialArticles} articles sur les trois jours.`
      : "Pendant l'essai, vous recevez la formule à son rythme quotidien.",
    launch
      ? `À la fin de l'essai, ${launch.price} sont prélevés, puis chaque mois jusqu'à la résiliation, sauf si vous résiliez avant la fin de l'essai. La page de paiement indique les montants et les dates avant votre confirmation.`
      : "À la fin de l'essai, le prix de la formule est prélevé, puis chaque mois jusqu'à la résiliation, sauf si vous résiliez avant la fin de l'essai. La page de paiement indique les montants et les dates avant votre confirmation.",
    "Vous pouvez résilier à tout moment depuis la page de facturation de votre compte. Vous gardez l'accès jusqu'à la fin de la période payée.",
    "Indépendamment de l'essai : si vous n'êtes pas satisfait, écrivez-nous dans les 3 jours suivant votre premier paiement et nous vous le remboursons intégralement.",
  ],
  termsLinks: {
    refunds: "Politique de remboursement",
    terms: "Conditions d'utilisation",
    pricing: "Toutes les formules et tous les tarifs",
    englishOnly: "La politique de remboursement et les conditions d'utilisation sont disponibles en anglais uniquement.",
  },
  faqTitle: "Questions",
  faq: [
    {
      question: "Puis-je lire les articles avant leur publication ?",
      answer:
        "À partir du deuxième article, oui, si vous passez le site en mode brouillon ou relecture. Le premier article est toujours publié en ligne dès qu'il est rédigé, et les nouveaux sites démarrent en mode automatique.",
    },
    {
      question: "RepGet corrige-t-il le SEO de mon site ?",
      answer:
        "Il rédige et publie de nouveaux articles. Pour vos pages existantes, l'audit du site signale des problèmes comme des titres ou des descriptions manquants et explique la correction ; la modification vous revient, à vous ou à votre développeur.",
    },
    {
      question: "Faut-il de l'expérience en SEO ?",
      answer: "Non. Vous ajoutez votre site et quelques informations sur votre activité ; la recherche, la planification, la rédaction et la publication suivent. Vous pouvez tout modifier.",
    },
    {
      question: "Puis-je l'utiliser pour plusieurs sites ?",
      answer: "Chaque abonnement couvre un site. Un deuxième site nécessite son propre abonnement.",
    },
  ],
  closingTitle: "Donnez un calendrier à votre blog",
  closingBody: "Commencez par l'essai Launch, ou comparez d'abord toutes les formules.",
});

export const SEO_CONTENT_AUTOMATION_TRANSLATIONS: Record<Translated, (launch: LaunchFacts | null) => SeoContentAutomationCopy> = { it, de, es, fr };
