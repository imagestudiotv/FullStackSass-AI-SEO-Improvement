import type { Locale } from "@/lib/i18n/config";

/**
 * The guest Growth Copilot (client, 2026-11-11,
 * repget-copilot-signup-after-every-reply.html) - the section on the
 * homepage and the free tools, and its chat - in every language.
 *
 * English is the design's wording. `{n}` is a number, `{domain}` a website.
 * The copilot answers in the language the visitor writes in; these are only
 * the words around it.
 */
export type GuestCopilotCopy = {
  section: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    lead: string;
    /** Ask, Plan, Grow: the bold word and its line. */
    proof: [{ lead: string; text: string }, { lead: string; text: string }, { lead: string; text: string }];
    /** The word between ** ** is bold, as in the design ("Try the **AI** copilot free"). */
    tryFree: string;
    unlock: string;
    noteStrong: string;
    noteRest: string;
  };
  chat: {
    /** The chat window's accessible name. */
    label: string;
    name: string;
    by: string;
    status: string;
    /** In the window's corner. */
    triesMany: string;
    triesOne: string;
    triesNone: string;
    websiteTitle: string;
    optional: string;
    yourWebsite: string;
    guestAccess: string;
    websiteLabel: string;
    websitePlaceholder: string;
    addWebsite: string;
    changeWebsite: string;
    skipLead: string;
    skip: string;
    greeting: string;
    websiteAdded: string;
    websiteChanged: string;
    /** A website restored from earlier in this tab. */
    welcomeBack: string;
    chips: [string, string, string, string];
    sender: string;
    you: string;
    writing: string;
    inputLabel: string;
    placeholder: string;
    placeholderSite: string;
    placeholderClosed: string;
    send: string;
    /** Under the field: "{n} of 3 guest questions available" ({n} is bold). */
    counter: string;
    noSignup: string;
    replyCtaTitle: string;
    replyCtaText: string;
    replyCtaLink: string;
    gateTitle: string;
    gateText: string;
    gateButton: string;
    gateSmall: string;
    errors: {
      website: string;
      tooLong: string;
      limit: string;
      busy: string;
      unavailable: string;
      failed: string;
    };
  };
  tool: {
    /** The tool page's description, for search results. */
    metaDescription: string;
    explainer: [{ heading: string; body: string }, { heading: string; body: string }, { heading: string; body: string }];
  };
};

const en: GuestCopilotCopy = {
  section: {
    eyebrow: "Your AI growth copilot",
    titleLead: "Your next growth move starts with",
    titleAccent: "a question.",
    lead: "Ask about SEO, social media or AI search and get ideas to grow your business. Start a conversation instantly, or add your website for more tailored guidance.",
    proof: [
      { lead: "Ask.", text: "Get useful answers for your business." },
      { lead: "Plan.", text: "Find what to improve and create next." },
      { lead: "Grow.", text: "Connect your tools to put the plan to work." },
    ],
    tryFree: "Try the **AI** copilot free",
    unlock: "Unlock full access",
    noteStrong: "3 free questions.",
    noteRest: "No website, account or credit card required.",
  },
  chat: {
    label: "Growth Copilot chat",
    name: "Growth Copilot",
    by: "by RepGet",
    status: "Guest Copilot",
    triesMany: "{n} free tries",
    triesOne: "1 free try",
    triesNone: "Guest limit reached",
    websiteTitle: "Add a website for tailored guidance",
    optional: "(optional)",
    yourWebsite: "Your website",
    guestAccess: "Guest access",
    websiteLabel: "Website address",
    websitePlaceholder: "yourwebsite.com",
    addWebsite: "Add website",
    changeWebsite: "Change site",
    skipLead: "Just exploring? No website needed.",
    skip: "Start chatting without a website",
    greeting:
      "Hi! I'm your Growth Copilot. Ask me anything about SEO, content, AI search or social media. You can add a website anytime, but you don't need one to start.",
    websiteAdded: "Website added: {domain}. I'll read its public homepage to tailor my answers. What would you like to explore?",
    websiteChanged: "You can switch websites. Your remaining guest questions stay the same.",
    welcomeBack: "Welcome back. You are chatting about {domain}.",
    chips: ["What should I improve first?", "How can I get more Google traffic?", "Give me 3 social post ideas", "How do I appear in AI search?"],
    sender: "RepGet Copilot",
    you: "You",
    writing: "Growth Copilot is writing an answer",
    inputLabel: "Ask Growth Copilot a question",
    placeholder: "Ask anything about growing your business…",
    placeholderSite: "Ask about {domain}…",
    placeholderClosed: "Create an account to keep going",
    send: "Send message",
    counter: "{n} of 3 guest questions available",
    noSignup: "No signup required",
    replyCtaTitle: "Unlock the full Growth Copilot",
    replyCtaText: "Sign up to connect your data and put growth ideas into action.",
    replyCtaLink: "Sign up free",
    gateTitle: "Your first 3 questions are done. Your growth plan is just getting started.",
    gateText: "Create a RepGet account to connect your data, uncover deeper opportunities, save conversations and turn recommendations into action.",
    gateButton: "Unlock my Growth Copilot",
    gateSmall: "Connect your website, search data and social channels whenever you're ready.",
    errors: {
      website: "Please enter a public website, such as example.com.",
      tooLong: "Please keep your question under 750 characters.",
      limit: "Your guest questions are used. Create a RepGet account to continue.",
      busy: "The Copilot is very busy right now. Please try again in a few minutes.",
      unavailable: "The Copilot is not available right now. Please try again later.",
      failed: "Sorry, the Copilot could not respond right now. Please try again.",
    },
  },
  tool: {
    metaDescription:
      "Ask RepGet's AI Growth Copilot about SEO, content, AI search and social media. 3 free questions a day, no signup. Add your website for tailored ideas.",
    explainer: [
      {
        heading: "Growth questions, answered",
        body: "SEO and Google traffic, content ideas, appearing in ChatGPT and other AI answers, backlinks and social posts: ask in your own words and get practical next steps.",
      },
      {
        heading: "Tailored to your website",
        body: "Add your website and the Copilot reads its public homepage, so its suggestions fit what you actually offer. It does not see your analytics or accounts.",
      },
      {
        heading: "Free, then unlimited",
        body: "Three free questions a day, without an account. Sign up to connect your data, save conversations and turn the advice into articles, posts and fixes.",
      },
    ],
  },
};

const es: GuestCopilotCopy = {
  section: {
    eyebrow: "Su copiloto de crecimiento con IA",
    titleLead: "Su próximo paso para crecer empieza con",
    titleAccent: "una pregunta.",
    lead: "Pregunte sobre SEO, redes sociales o búsqueda con IA y obtenga ideas para hacer crecer su negocio. Empiece a conversar al instante o añada su web para recibir consejos más personalizados.",
    proof: [
      { lead: "Pregunte.", text: "Reciba respuestas útiles para su negocio." },
      { lead: "Planifique.", text: "Descubra qué mejorar y qué crear después." },
      { lead: "Crezca.", text: "Conecte sus herramientas para poner el plan en marcha." },
    ],
    tryFree: "Pruebe gratis el copiloto con **IA**",
    unlock: "Desbloquee el acceso completo",
    noteStrong: "3 preguntas gratis.",
    noteRest: "Sin web, sin cuenta y sin tarjeta de crédito.",
  },
  chat: {
    label: "Chat de Growth Copilot",
    name: "Growth Copilot",
    by: "de RepGet",
    status: "Copiloto invitado",
    triesMany: "{n} intentos gratis",
    triesOne: "1 intento gratis",
    triesNone: "Límite de invitado alcanzado",
    websiteTitle: "Añada una web para recibir consejos personalizados",
    optional: "(opcional)",
    yourWebsite: "Su web",
    guestAccess: "Acceso de invitado",
    websiteLabel: "Dirección web",
    websitePlaceholder: "suweb.com",
    addWebsite: "Añadir web",
    changeWebsite: "Cambiar web",
    skipLead: "¿Solo está explorando? No hace falta una web.",
    skip: "Empezar a conversar sin web",
    greeting:
      "¡Hola! Soy su Growth Copilot. Pregúnteme lo que quiera sobre SEO, contenido, búsqueda con IA o redes sociales. Puede añadir una web cuando quiera, pero no la necesita para empezar.",
    websiteAdded: "Web añadida: {domain}. Leeré su página de inicio pública para adaptar mis respuestas. ¿Qué le gustaría explorar?",
    websiteChanged: "Puede cambiar de web. Sus preguntas de invitado restantes se mantienen.",
    welcomeBack: "Bienvenido de nuevo. Está conversando sobre {domain}.",
    chips: ["¿Qué debería mejorar primero?", "¿Cómo consigo más tráfico de Google?", "Deme 3 ideas para publicaciones en redes", "¿Cómo aparezco en la búsqueda con IA?"],
    sender: "RepGet Copilot",
    you: "Usted",
    writing: "Growth Copilot está escribiendo una respuesta",
    inputLabel: "Haga una pregunta a Growth Copilot",
    placeholder: "Pregunte lo que quiera sobre cómo hacer crecer su negocio…",
    placeholderSite: "Pregunte sobre {domain}…",
    placeholderClosed: "Cree una cuenta para continuar",
    send: "Enviar mensaje",
    counter: "{n} de 3 preguntas de invitado disponibles",
    noSignup: "Sin registro",
    replyCtaTitle: "Desbloquee el Growth Copilot completo",
    replyCtaText: "Regístrese para conectar sus datos y poner en práctica las ideas de crecimiento.",
    replyCtaLink: "Registrarse gratis",
    gateTitle: "Sus 3 primeras preguntas ya están hechas. Su plan de crecimiento no ha hecho más que empezar.",
    gateText: "Cree una cuenta de RepGet para conectar sus datos, descubrir más oportunidades, guardar sus conversaciones y convertir las recomendaciones en acciones.",
    gateButton: "Desbloquear mi Growth Copilot",
    gateSmall: "Conecte su web, sus datos de búsqueda y sus redes sociales cuando quiera.",
    errors: {
      website: "Introduzca una web pública, como ejemplo.com.",
      tooLong: "Su pregunta debe tener menos de 750 caracteres.",
      limit: "Ya ha usado sus preguntas de invitado. Cree una cuenta de RepGet para continuar.",
      busy: "El Copilot está muy ocupado ahora mismo. Inténtelo de nuevo en unos minutos.",
      unavailable: "El Copilot no está disponible ahora mismo. Inténtelo más tarde.",
      failed: "Lo sentimos, el Copilot no ha podido responder. Inténtelo de nuevo.",
    },
  },
  tool: {
    metaDescription:
      "Pregunte al Growth Copilot con IA de RepGet sobre SEO, contenido, búsqueda con IA y redes sociales. 3 preguntas gratis al día, sin registro.",
    explainer: [
      {
        heading: "Respuestas a sus preguntas de crecimiento",
        body: "SEO y tráfico de Google, ideas de contenido, aparecer en ChatGPT y otras respuestas de IA, backlinks y publicaciones en redes: pregunte con sus propias palabras y reciba pasos prácticos.",
      },
      {
        heading: "Adaptado a su web",
        body: "Añada su web y el Copilot leerá su página de inicio pública, para que sus sugerencias encajen con lo que realmente ofrece. No ve sus analíticas ni sus cuentas.",
      },
      {
        heading: "Gratis y, después, sin límites",
        body: "Tres preguntas gratis al día, sin cuenta. Regístrese para conectar sus datos, guardar sus conversaciones y convertir los consejos en artículos, publicaciones y mejoras.",
      },
    ],
  },
};

const fr: GuestCopilotCopy = {
  section: {
    eyebrow: "Votre copilote de croissance IA",
    titleLead: "Votre prochaine étape de croissance commence par",
    titleAccent: "une question.",
    lead: "Posez vos questions sur le SEO, les réseaux sociaux ou la recherche IA et obtenez des idées pour développer votre activité. Lancez la conversation tout de suite, ou ajoutez votre site pour des conseils plus personnalisés.",
    proof: [
      { lead: "Demandez.", text: "Obtenez des réponses utiles pour votre activité." },
      { lead: "Planifiez.", text: "Voyez quoi améliorer et quoi créer ensuite." },
      { lead: "Grandissez.", text: "Connectez vos outils pour mettre le plan en œuvre." },
    ],
    tryFree: "Essayez gratuitement le copilote **IA**",
    unlock: "Débloquer l’accès complet",
    noteStrong: "3 questions gratuites.",
    noteRest: "Sans site, sans compte et sans carte bancaire.",
  },
  chat: {
    label: "Chat Growth Copilot",
    name: "Growth Copilot",
    by: "par RepGet",
    status: "Copilote invité",
    triesMany: "{n} essais gratuits",
    triesOne: "1 essai gratuit",
    triesNone: "Limite invité atteinte",
    websiteTitle: "Ajoutez un site pour des conseils personnalisés",
    optional: "(facultatif)",
    yourWebsite: "Votre site",
    guestAccess: "Accès invité",
    websiteLabel: "Adresse du site",
    websitePlaceholder: "votresite.com",
    addWebsite: "Ajouter le site",
    changeWebsite: "Changer de site",
    skipLead: "Vous découvrez ? Pas besoin de site.",
    skip: "Discuter sans site",
    greeting:
      "Bonjour ! Je suis votre Growth Copilot. Posez-moi vos questions sur le SEO, le contenu, la recherche IA ou les réseaux sociaux. Vous pouvez ajouter un site à tout moment, mais ce n’est pas nécessaire pour commencer.",
    websiteAdded: "Site ajouté : {domain}. Je lirai sa page d’accueil publique pour adapter mes réponses. Que souhaitez-vous explorer ?",
    websiteChanged: "Vous pouvez changer de site. Vos questions invité restantes ne changent pas.",
    welcomeBack: "Bon retour. Vous discutez de {domain}.",
    chips: ["Que dois-je améliorer en premier ?", "Comment obtenir plus de trafic Google ?", "Donnez-moi 3 idées de publications", "Comment apparaître dans la recherche IA ?"],
    sender: "RepGet Copilot",
    you: "Vous",
    writing: "Growth Copilot rédige une réponse",
    inputLabel: "Posez une question à Growth Copilot",
    placeholder: "Posez une question sur la croissance de votre activité…",
    placeholderSite: "Posez une question sur {domain}…",
    placeholderClosed: "Créez un compte pour continuer",
    send: "Envoyer le message",
    counter: "{n} questions invité sur 3 disponibles",
    noSignup: "Sans inscription",
    replyCtaTitle: "Débloquez le Growth Copilot complet",
    replyCtaText: "Inscrivez-vous pour connecter vos données et passer de l’idée à l’action.",
    replyCtaLink: "Inscription gratuite",
    gateTitle: "Vos 3 premières questions sont posées. Votre plan de croissance ne fait que commencer.",
    gateText: "Créez un compte RepGet pour connecter vos données, découvrir d’autres opportunités, garder vos conversations et transformer les recommandations en actions.",
    gateButton: "Débloquer mon Growth Copilot",
    gateSmall: "Connectez votre site, vos données de recherche et vos réseaux sociaux quand vous voulez.",
    errors: {
      website: "Saisissez un site public, par exemple exemple.com.",
      tooLong: "Votre question doit faire moins de 750 caractères.",
      limit: "Vos questions invité sont utilisées. Créez un compte RepGet pour continuer.",
      busy: "Le Copilot est très sollicité en ce moment. Réessayez dans quelques minutes.",
      unavailable: "Le Copilot n’est pas disponible pour le moment. Réessayez plus tard.",
      failed: "Désolé, le Copilot n’a pas pu répondre. Réessayez.",
    },
  },
  tool: {
    metaDescription:
      "Posez vos questions SEO, contenu, recherche IA et réseaux sociaux au Growth Copilot IA de RepGet. 3 questions gratuites par jour, sans inscription.",
    explainer: [
      {
        heading: "Vos questions de croissance, avec des réponses",
        body: "SEO et trafic Google, idées de contenu, apparaître dans ChatGPT et les autres réponses IA, backlinks et publications : posez vos questions avec vos mots et obtenez des étapes concrètes.",
      },
      {
        heading: "Adapté à votre site",
        body: "Ajoutez votre site et le Copilot lit sa page d’accueil publique, pour que ses suggestions correspondent à ce que vous proposez vraiment. Il ne voit ni vos statistiques ni vos comptes.",
      },
      {
        heading: "Gratuit, puis illimité",
        body: "Trois questions gratuites par jour, sans compte. Inscrivez-vous pour connecter vos données, garder vos conversations et transformer les conseils en articles, publications et corrections.",
      },
    ],
  },
};

const it: GuestCopilotCopy = {
  section: {
    eyebrow: "Il Suo copilota di crescita IA",
    titleLead: "La Sua prossima mossa di crescita inizia con",
    titleAccent: "una domanda.",
    lead: "Chieda di SEO, social media o ricerca IA e ottenga idee per far crescere la Sua attività. Inizi subito una conversazione, oppure aggiunga il Suo sito per consigli più mirati.",
    proof: [
      { lead: "Chieda.", text: "Riceva risposte utili per la Sua attività." },
      { lead: "Pianifichi.", text: "Scopra cosa migliorare e cosa creare dopo." },
      { lead: "Cresca.", text: "Colleghi i Suoi strumenti per mettere in pratica il piano." },
    ],
    tryFree: "Provi gratis il copilota **IA**",
    unlock: "Sblocchi l’accesso completo",
    noteStrong: "3 domande gratuite.",
    noteRest: "Nessun sito, account o carta di credito richiesti.",
  },
  chat: {
    label: "Chat di Growth Copilot",
    name: "Growth Copilot",
    by: "di RepGet",
    status: "Copilota ospite",
    triesMany: "{n} tentativi gratuiti",
    triesOne: "1 tentativo gratuito",
    triesNone: "Limite ospite raggiunto",
    websiteTitle: "Aggiunga un sito per consigli mirati",
    optional: "(facoltativo)",
    yourWebsite: "Il Suo sito",
    guestAccess: "Accesso ospite",
    websiteLabel: "Indirizzo del sito",
    websitePlaceholder: "ilsuosito.com",
    addWebsite: "Aggiungi sito",
    changeWebsite: "Cambia sito",
    skipLead: "Sta solo esplorando? Il sito non serve.",
    skip: "Inizi a chattare senza sito",
    greeting:
      "Salve! Sono il Suo Growth Copilot. Mi chieda qualsiasi cosa su SEO, contenuti, ricerca IA o social media. Può aggiungere un sito quando vuole, ma non serve per iniziare.",
    websiteAdded: "Sito aggiunto: {domain}. Leggerò la sua homepage pubblica per adattare le mie risposte. Cosa vorrebbe approfondire?",
    websiteChanged: "Può cambiare sito. Le domande ospite rimaste non cambiano.",
    welcomeBack: "Bentornato. Sta parlando di {domain}.",
    chips: ["Cosa dovrei migliorare per primo?", "Come ottengo più traffico da Google?", "Mi dia 3 idee per post sui social", "Come compaio nella ricerca IA?"],
    sender: "RepGet Copilot",
    you: "Lei",
    writing: "Growth Copilot sta scrivendo una risposta",
    inputLabel: "Faccia una domanda a Growth Copilot",
    placeholder: "Chieda qualsiasi cosa su come far crescere la Sua attività…",
    placeholderSite: "Chieda di {domain}…",
    placeholderClosed: "Crei un account per continuare",
    send: "Invia messaggio",
    counter: "{n} domande ospite su 3 disponibili",
    noSignup: "Nessuna registrazione",
    replyCtaTitle: "Sblocchi il Growth Copilot completo",
    replyCtaText: "Si registri per collegare i Suoi dati e mettere in pratica le idee di crescita.",
    replyCtaLink: "Registrazione gratuita",
    gateTitle: "Le Sue prime 3 domande sono fatte. Il Suo piano di crescita è appena iniziato.",
    gateText: "Crei un account RepGet per collegare i Suoi dati, scoprire altre opportunità, salvare le conversazioni e trasformare i consigli in azioni.",
    gateButton: "Sblocca il mio Growth Copilot",
    gateSmall: "Colleghi il Suo sito, i dati di ricerca e i canali social quando vuole.",
    errors: {
      website: "Inserisca un sito pubblico, per esempio esempio.com.",
      tooLong: "La domanda deve essere più corta di 750 caratteri.",
      limit: "Ha usato le sue domande ospite. Crei un account RepGet per continuare.",
      busy: "Il Copilot è molto occupato in questo momento. Riprovi tra qualche minuto.",
      unavailable: "Il Copilot non è disponibile in questo momento. Riprovi più tardi.",
      failed: "Ci scusi, il Copilot non è riuscito a rispondere. Riprovi.",
    },
  },
  tool: {
    metaDescription:
      "Chieda al Growth Copilot IA di RepGet di SEO, contenuti, ricerca IA e social media. 3 domande gratuite al giorno, senza registrazione.",
    explainer: [
      {
        heading: "Risposte alle Sue domande di crescita",
        body: "SEO e traffico da Google, idee per i contenuti, comparire in ChatGPT e nelle altre risposte IA, backlink e post sui social: chieda con parole Sue e riceva passi concreti.",
      },
      {
        heading: "Su misura per il Suo sito",
        body: "Aggiunga il Suo sito e il Copilot legge la sua homepage pubblica, così i suggerimenti si adattano a ciò che offre davvero. Non vede le Sue statistiche né i Suoi account.",
      },
      {
        heading: "Gratis, poi senza limiti",
        body: "Tre domande gratuite al giorno, senza account. Si registri per collegare i Suoi dati, salvare le conversazioni e trasformare i consigli in articoli, post e correzioni.",
      },
    ],
  },
};

const de: GuestCopilotCopy = {
  section: {
    eyebrow: "Ihr KI-Wachstums-Copilot",
    titleLead: "Ihr nächster Wachstumsschritt beginnt mit",
    titleAccent: "einer Frage.",
    lead: "Fragen Sie zu SEO, Social Media oder KI-Suche und erhalten Sie Ideen für Ihr Unternehmen. Starten Sie sofort ein Gespräch oder fügen Sie Ihre Website hinzu, um gezieltere Tipps zu erhalten.",
    proof: [
      { lead: "Fragen.", text: "Erhalten Sie nützliche Antworten für Ihr Unternehmen." },
      { lead: "Planen.", text: "Sehen Sie, was Sie als Nächstes verbessern und erstellen." },
      { lead: "Wachsen.", text: "Verbinden Sie Ihre Tools, um den Plan umzusetzen." },
    ],
    tryFree: "**KI**-Copilot kostenlos testen",
    unlock: "Vollen Zugang freischalten",
    noteStrong: "3 kostenlose Fragen.",
    noteRest: "Keine Website, kein Konto und keine Kreditkarte nötig.",
  },
  chat: {
    label: "Growth-Copilot-Chat",
    name: "Growth Copilot",
    by: "von RepGet",
    status: "Gast-Copilot",
    triesMany: "{n} kostenlose Versuche",
    triesOne: "1 kostenloser Versuch",
    triesNone: "Gastlimit erreicht",
    websiteTitle: "Website hinzufügen für gezielte Tipps",
    optional: "(optional)",
    yourWebsite: "Ihre Website",
    guestAccess: "Gastzugang",
    websiteLabel: "Website-Adresse",
    websitePlaceholder: "ihrewebsite.de",
    addWebsite: "Website hinzufügen",
    changeWebsite: "Website ändern",
    skipLead: "Nur umsehen? Keine Website nötig.",
    skip: "Ohne Website chatten",
    greeting:
      "Hallo! Ich bin Ihr Growth Copilot. Fragen Sie mich alles zu SEO, Inhalten, KI-Suche oder Social Media. Sie können jederzeit eine Website hinzufügen, brauchen aber keine, um anzufangen.",
    websiteAdded: "Website hinzugefügt: {domain}. Ich lese ihre öffentliche Startseite, um meine Antworten anzupassen. Was möchten Sie wissen?",
    websiteChanged: "Sie können die Website wechseln. Ihre übrigen Gastfragen bleiben erhalten.",
    welcomeBack: "Willkommen zurück. Sie sprechen über {domain}.",
    chips: ["Was sollte ich zuerst verbessern?", "Wie bekomme ich mehr Google-Traffic?", "Geben Sie mir 3 Ideen für Social-Posts", "Wie erscheine ich in der KI-Suche?"],
    sender: "RepGet Copilot",
    you: "Sie",
    writing: "Growth Copilot schreibt eine Antwort",
    inputLabel: "Stellen Sie Growth Copilot eine Frage",
    placeholder: "Fragen Sie alles zum Wachstum Ihres Unternehmens…",
    placeholderSite: "Fragen Sie zu {domain}…",
    placeholderClosed: "Erstellen Sie ein Konto, um weiterzumachen",
    send: "Nachricht senden",
    counter: "{n} von 3 Gastfragen verfügbar",
    noSignup: "Keine Anmeldung nötig",
    replyCtaTitle: "Den vollen Growth Copilot freischalten",
    replyCtaText: "Registrieren Sie sich, um Ihre Daten zu verbinden und Wachstumsideen umzusetzen.",
    replyCtaLink: "Kostenlos registrieren",
    gateTitle: "Ihre ersten 3 Fragen sind gestellt. Ihr Wachstumsplan fängt gerade erst an.",
    gateText: "Erstellen Sie ein RepGet-Konto, um Ihre Daten zu verbinden, weitere Chancen zu entdecken, Gespräche zu speichern und Empfehlungen umzusetzen.",
    gateButton: "Meinen Growth Copilot freischalten",
    gateSmall: "Verbinden Sie Website, Suchdaten und Social-Media-Kanäle, wann immer Sie möchten.",
    errors: {
      website: "Bitte geben Sie eine öffentliche Website ein, zum Beispiel beispiel.de.",
      tooLong: "Ihre Frage darf höchstens 750 Zeichen lang sein.",
      limit: "Ihre Gastfragen sind aufgebraucht. Erstellen Sie ein RepGet-Konto, um weiterzumachen.",
      busy: "Der Copilot ist gerade sehr gefragt. Bitte versuchen Sie es in ein paar Minuten erneut.",
      unavailable: "Der Copilot ist gerade nicht verfügbar. Bitte versuchen Sie es später erneut.",
      failed: "Der Copilot konnte gerade nicht antworten. Bitte versuchen Sie es erneut.",
    },
  },
  tool: {
    metaDescription:
      "Fragen Sie den KI-Growth-Copilot von RepGet zu SEO, Inhalten, KI-Suche und Social Media. 3 kostenlose Fragen am Tag, ohne Anmeldung.",
    explainer: [
      {
        heading: "Antworten auf Ihre Wachstumsfragen",
        body: "SEO und Google-Traffic, Content-Ideen, Sichtbarkeit in ChatGPT und anderen KI-Antworten, Backlinks und Social-Posts: Fragen Sie in Ihren eigenen Worten und erhalten Sie konkrete nächste Schritte.",
      },
      {
        heading: "Passend zu Ihrer Website",
        body: "Fügen Sie Ihre Website hinzu, und der Copilot liest ihre öffentliche Startseite, damit seine Vorschläge zu Ihrem Angebot passen. Ihre Statistiken und Konten sieht er nicht.",
      },
      {
        heading: "Kostenlos, dann unbegrenzt",
        body: "Drei kostenlose Fragen am Tag, ohne Konto. Registrieren Sie sich, um Ihre Daten zu verbinden, Gespräche zu speichern und die Tipps in Artikel, Posts und Korrekturen umzusetzen.",
      },
    ],
  },
};

const COPY: Record<Locale, GuestCopilotCopy> = { en, es, fr, it, de };

export function guestCopilotCopy(locale: Locale): GuestCopilotCopy {
  return COPY[locale];
}
