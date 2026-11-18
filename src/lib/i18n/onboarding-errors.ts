import type { Locale } from "@/lib/i18n/config";

/**
 * What the first setup steps' server actions say when they refuse: adding the
 * website (lib/websites/actions.ts addWebsite), the quick look at it
 * (lib/websites/preview.ts) and starting the Google connection
 * (lib/analytics/actions.ts startGoogleConnect).
 *
 * Before 2026-11-18 the steps around these were in the customer's language and
 * every refusal was English. Five languages, formal address (Lei, Sie, usted,
 * vous); a plan is "piano", "Tarif", "plan", "forfait", as in the rest of the
 * app. The English is word for word what the actions returned before
 * (onboarding-errors.test.ts).
 *
 * Only our own sentences live here. A failure whose words are not ours - a
 * network library's message, an unexpected exception - is never shown: the
 * action logs it and says `unreachable`, `unreadable` or `unexpected` instead.
 */
export type OnboardingErrorsCopy = {
  website: {
    /** lib/websites/url.ts InvalidUrlError, its three messages. */
    invalidUrl: string;
    notPublic: string;
    socialProfile: string;
    /** addWebsite's own refusals. */
    alreadyInWorkspace: string;
    alreadyShared: string;
    invitationWaiting: string;
    /** lib/websites/analysis-quota.ts queueAnalysis, the free analyses. */
    analysisDailyLimit: string;
    analysisBusy: string;
    /** lib/websites/crawl.ts CrawlError, as the preview meets it. */
    timedOut: (ms: number) => string;
    blocksBots: string;
    passwordProtected: string;
    httpStatus: (status: number) => string;
    notWebPage: string;
    redirectRefused: string;
    tooManyRedirects: string;
    /** The site could not be reached; the reason, in a library's words, is logged. */
    unreachable: string;
    /** The preview failed for a reason that is not a CrawlError. */
    unreadable: string;
    /** Anything else: the step's toast when the action itself fails. */
    unexpected: string;
  };
  google: {
    /** lib/websites/require-editor.ts, for an invited viewer. */
    viewOnly: string;
    cannotReplace: string;
    notConfigured: string;
    signIn: string;
  };
};

export const ONBOARDING_ERRORS: Record<Locale, OnboardingErrorsCopy> = {
  en: {
    website: {
      invalidUrl: "Enter a valid website address",
      notPublic: "That address is not a public website",
      socialProfile: "Enter your own website, not a social profile",
      alreadyInWorkspace: "That website is already in this workspace",
      alreadyShared: "That website is already shared with you. Find it under Websites, in Shared with you.",
      invitationWaiting: "You have an invitation waiting for that website. Accept it on your dashboard.",
      analysisDailyLimit: "You have analysed several websites today. Choose a plan, or try again tomorrow.",
      analysisBusy: "Too many websites are being analysed right now. Please try again shortly.",
      timedOut: (ms) => `Timed out after ${ms}ms`,
      blocksBots:
        "This site blocks automated visitors, so we cannot read it. Your site is fine - the block is a security setting on it.",
      passwordProtected: "This site asks for a password before it will show a page.",
      httpStatus: (status) => `The site returned ${status}`,
      notWebPage: "That address is not a web page",
      redirectRefused: "The site redirected somewhere we will not follow",
      tooManyRedirects: "Too many redirects",
      unreachable: "Could not reach the site",
      unreadable: "Could not read that website",
      unexpected: "Something went wrong. Please try again.",
    },
    google: {
      viewOnly: "You have view-only access to this website.",
      cannotReplace:
        "This Google connection belongs to the website's owner. Only the owner can disconnect it or connect a different account.",
      notConfigured: "Google integration is not configured yet.",
      signIn: "Sign in to connect Google.",
    },
  },
  es: {
    website: {
      invalidUrl: "Introduzca una dirección web válida",
      notPublic: "Esa dirección no es un sitio web público",
      socialProfile: "Introduzca su propio sitio web, no un perfil de redes sociales",
      alreadyInWorkspace: "Ese sitio web ya está en este espacio de trabajo",
      alreadyShared: "Ese sitio web ya se ha compartido con usted. Lo encontrará en Sitios web, en Compartidos con usted.",
      invitationWaiting: "Tiene una invitación pendiente para ese sitio web. Acéptela en su panel.",
      analysisDailyLimit: "Hoy ya ha analizado varios sitios web. Elija un plan o inténtelo de nuevo mañana.",
      analysisBusy: "Ahora mismo se están analizando demasiados sitios web. Inténtelo de nuevo en breve.",
      timedOut: (ms) => `Sin respuesta tras ${ms} ms`,
      blocksBots:
        "Este sitio bloquea a los visitantes automatizados, así que no podemos leerlo. Su sitio está bien - el bloqueo es un ajuste de seguridad del propio sitio.",
      passwordProtected: "Este sitio pide una contraseña antes de mostrar una página.",
      httpStatus: (status) => `El sitio respondió con el código ${status}`,
      notWebPage: "Esa dirección no es una página web",
      redirectRefused: "El sitio redirige a una dirección que no seguimos",
      tooManyRedirects: "Demasiadas redirecciones",
      unreachable: "No se pudo acceder al sitio",
      unreadable: "No se pudo leer ese sitio web",
      unexpected: "Algo ha fallado. Inténtelo de nuevo.",
    },
    google: {
      viewOnly: "Solo tiene acceso de lectura a este sitio web.",
      cannotReplace:
        "Esta conexión de Google pertenece al propietario del sitio web. Solo el propietario puede desconectarla o conectar otra cuenta.",
      notConfigured: "La integración con Google aún no está configurada.",
      signIn: "Inicie sesión para conectar Google.",
    },
  },
  fr: {
    website: {
      invalidUrl: "Saisissez une adresse de site web valide",
      notPublic: "Cette adresse n’est pas un site web public",
      socialProfile: "Saisissez votre propre site web, pas un profil de réseau social",
      alreadyInWorkspace: "Ce site web est déjà dans cet espace de travail",
      alreadyShared: "Ce site web est déjà partagé avec vous. Retrouvez-le dans Sites web, sous Partagés avec vous.",
      invitationWaiting: "Une invitation vous attend pour ce site web. Acceptez-la sur votre tableau de bord.",
      analysisDailyLimit: "Vous avez déjà analysé plusieurs sites web aujourd’hui. Choisissez un forfait, ou réessayez demain.",
      analysisBusy: "Trop de sites web sont en cours d’analyse en ce moment. Veuillez réessayer dans un instant.",
      timedOut: (ms) => `Aucune réponse après ${ms} ms`,
      blocksBots:
        "Ce site bloque les visiteurs automatisés, nous ne pouvons donc pas le lire. Votre site fonctionne - le blocage est un réglage de sécurité du site.",
      passwordProtected: "Ce site demande un mot de passe avant d’afficher une page.",
      httpStatus: (status) => `Le site a répondu avec le code ${status}`,
      notWebPage: "Cette adresse n’est pas une page web",
      redirectRefused: "Le site redirige vers une adresse que nous ne suivons pas",
      tooManyRedirects: "Trop de redirections",
      unreachable: "Impossible de joindre le site",
      unreadable: "Impossible de lire ce site web",
      unexpected: "Un problème est survenu. Veuillez réessayer.",
    },
    google: {
      viewOnly: "Vous n’avez qu’un accès en lecture à ce site web.",
      cannotReplace:
        "Cette connexion Google appartient au propriétaire du site web. Seul le propriétaire peut la déconnecter ou connecter un autre compte.",
      notConfigured: "L’intégration Google n’est pas encore configurée.",
      signIn: "Connectez-vous pour connecter Google.",
    },
  },
  it: {
    website: {
      invalidUrl: "Inserisca un indirizzo web valido",
      notPublic: "Quell’indirizzo non è un sito web pubblico",
      socialProfile: "Inserisca il suo sito web, non un profilo social",
      alreadyInWorkspace: "Quel sito web è già in questo spazio di lavoro",
      alreadyShared: "Quel sito web è già condiviso con lei. Lo trova in Siti web, sotto Condivisi con lei.",
      invitationWaiting: "Ha un invito in attesa per quel sito web. Lo accetti nella sua dashboard.",
      analysisDailyLimit: "Oggi ha già analizzato diversi siti web. Scelga un piano o riprovi domani.",
      analysisBusy: "In questo momento si stanno analizzando troppi siti web. Riprovi tra poco.",
      timedOut: (ms) => `Nessuna risposta dopo ${ms} ms`,
      blocksBots:
        "Questo sito blocca i visitatori automatici, quindi non possiamo leggerlo. Il suo sito funziona - il blocco è un’impostazione di sicurezza del sito.",
      passwordProtected: "Questo sito chiede una password prima di mostrare una pagina.",
      httpStatus: (status) => `Il sito ha risposto con il codice ${status}`,
      notWebPage: "Quell’indirizzo non è una pagina web",
      redirectRefused: "Il sito reindirizza a un indirizzo che non seguiamo",
      tooManyRedirects: "Troppi reindirizzamenti",
      unreachable: "Non è stato possibile raggiungere il sito",
      unreadable: "Non è stato possibile leggere quel sito web",
      unexpected: "Qualcosa è andato storto. Riprovi.",
    },
    google: {
      viewOnly: "Ha accesso in sola lettura a questo sito web.",
      cannotReplace:
        "Questo collegamento Google appartiene al proprietario del sito web. Solo il proprietario può scollegarlo o collegare un altro account.",
      notConfigured: "L’integrazione con Google non è ancora configurata.",
      signIn: "Acceda per collegare Google.",
    },
  },
  de: {
    website: {
      invalidUrl: "Geben Sie eine gültige Website-Adresse ein",
      notPublic: "Diese Adresse ist keine öffentliche Website",
      socialProfile: "Geben Sie Ihre eigene Website ein, kein Social-Media-Profil",
      alreadyInWorkspace: "Diese Website ist bereits in diesem Arbeitsbereich",
      alreadyShared: "Diese Website wurde bereits mit Ihnen geteilt. Sie finden sie unter Websites, bei Mit Ihnen geteilt.",
      invitationWaiting: "Für diese Website wartet eine Einladung auf Sie. Nehmen Sie sie in Ihrem Dashboard an.",
      analysisDailyLimit:
        "Sie haben heute bereits mehrere Websites analysieren lassen. Wählen Sie einen Tarif oder versuchen Sie es morgen erneut.",
      analysisBusy: "Gerade werden zu viele Websites analysiert. Bitte versuchen Sie es in Kürze erneut.",
      timedOut: (ms) => `Keine Antwort nach ${ms} ms`,
      blocksBots:
        "Diese Website blockiert automatisierte Besucher, daher können wir sie nicht lesen. Mit Ihrer Website ist alles in Ordnung - die Sperre ist eine Sicherheitseinstellung der Website.",
      passwordProtected: "Diese Website verlangt ein Passwort, bevor sie eine Seite anzeigt.",
      httpStatus: (status) => `Die Website antwortete mit dem Status ${status}`,
      notWebPage: "Diese Adresse ist keine Webseite",
      redirectRefused: "Die Website leitet an eine Adresse weiter, der wir nicht folgen",
      tooManyRedirects: "Zu viele Weiterleitungen",
      unreachable: "Die Website war nicht erreichbar",
      unreadable: "Diese Website konnte nicht gelesen werden",
      unexpected: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    },
    google: {
      viewOnly: "Sie haben für diese Website nur Lesezugriff.",
      cannotReplace:
        "Diese Google-Verbindung gehört dem Inhaber der Website. Nur der Inhaber kann sie trennen oder ein anderes Konto verbinden.",
      notConfigured: "Die Google-Integration ist noch nicht eingerichtet.",
      signIn: "Melden Sie sich an, um Google zu verbinden.",
    },
  },
};

/** The website entries that are plain sentences (not the ones taking a number). */
export type WebsiteErrorKey = {
  [K in keyof OnboardingErrorsCopy["website"]]: OnboardingErrorsCopy["website"][K] extends string ? K : never;
}[keyof OnboardingErrorsCopy["website"]];

/**
 * Which of our sentences a lower layer's English message is (InvalidUrlError,
 * queueAnalysis, CrawlError), or undefined when the words are not ours.
 */
export function websiteErrorKey(english: string): WebsiteErrorKey | undefined {
  const en = ONBOARDING_ERRORS.en.website;
  return (Object.keys(en) as (keyof typeof en)[]).find(
    (candidate): candidate is WebsiteErrorKey => en[candidate] === english,
  );
}

/**
 * A website refusal worded in English below the action, in the reader's
 * language. Words that are not ours are never shown: they read as `fallback`
 * (`unexpected` unless the caller knows better) - in English too.
 */
export function websiteRefusal(
  english: string,
  locale: Locale,
  fallback: WebsiteErrorKey = "unexpected",
): string {
  const copy = (ONBOARDING_ERRORS[locale] ?? ONBOARDING_ERRORS.en).website;
  return copy[websiteErrorKey(english) ?? fallback];
}
