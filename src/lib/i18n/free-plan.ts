import type { Locale } from "@/lib/i18n/config";

/**
 * The Free Forever plan (Daniel, 2026-11-19: "REPGET / NEW PLAN Free
 * Forever. Discover what your growth team can do. €0 No credit card."), in
 * every language: its card (free-plan-card.png, word for word in English),
 * the launch counter, and the in-app words - the plan indicator, the upgrade
 * prompts on locked features and spent allowances, and why Free generation
 * paused.
 *
 * The figures are NOT written here: `{articles}`, `{posts}`, `{terms}`,
 * `{copilot}`, `{taken}`, `{cap}`, `{left}`, `{days}` are filled in from
 * lib/plans/free-plan.ts FREE_PLAN, the numbers the allowances enforce.
 * `**words**` are bold. Formal address in every language; plan names (Free,
 * Grow, Scale) stay in English, as on the pricing page.
 */
export type FreePlanCopy = {
  card: {
    name: string;
    desc: string;
    badge: string;
    perMonth: string;
    caption: string;
    cta: string;
    ctaLabel: string;
    includedLabel: string;
    /** In the card's order: articles, posts, terms, website, audit, snapshot, copilot. */
    features: string[];
    /** Greyed lines: what needs an upgrade. */
    locked: string[];
    more: string;
    /** "430 / 500 free spots taken". */
    counter: string;
    counterLabel: string;
    /** When the cap is reached. */
    full: string;
    fullNote: string;
    fullCta: string;
  };
  /** The comparison table's Free column and the rows only Free fills in differently. */
  compare: {
    audits: string;
    snapshot: string;
    copilotPerDay: string;
  };
  app: {
    /** "Free plan · 3 of 4 articles left" */
    indicator: string;
    indicatorNone: string;
    upgrade: string;
    upgradeTitle: string;
    /** Locked features, each a full sentence. */
    lockedBacklinks: string;
    lockedVideos: string;
    lockedAutomation: string;
    /** An allowance used up for the month (or the day, for Copilot). */
    articlesUsed: string;
    postsUsed: string;
    auditUsed: string;
    snapshotUsed: string;
    copilotUsed: string;
    termsUsed: string;
    /** The monthly AI cost cap, or the day's Free budget, reached. */
    paused: string;
    verifyEmail: string;
    domainTaken: string;
    oneWebsite: string;
    trialHint: string;
    buyCredits: string;
  };
};

const en: FreePlanCopy = {
  card: {
    name: "Free",
    desc: "Experience RepGet with real AI content and social publishing. No credit card required.",
    badge: "FREE FOREVER · NO CREDIT CARD",
    perMonth: "/ month",
    caption: "Always free · upgrade anytime",
    cta: "Start Free · No card required",
    ctaLabel: "Start the Free plan, no credit card required",
    includedLabel: "Everything you need to get started",
    features: [
      "**{articles} AI SEO articles** per month",
      "**{posts} social posts** per month",
      "**{terms} search terms**",
      "**1 connected website**",
      "**1 limited SEO audit** per month",
      "**1 AI visibility snapshot**",
      "**{copilot} Growth Copilot requests** per day",
    ],
    locked: ["**Backlink placements** available on Grow", "**AI video production** available on paid plans"],
    more: "See full comparison",
    counter: "{taken} / {cap} free spots taken",
    counterLabel: "{taken} of {cap} free spots taken",
    full: "All {cap} free spots are taken",
    fullNote: "Free is full for now. Grow and Scale still start with a {days}-day free trial.",
    fullCta: "Start a {days}-day free trial",
  },
  compare: {
    audits: "1 limited / month",
    snapshot: "1 snapshot",
    copilotPerDay: "{copilot} / day",
  },
  app: {
    indicator: "Free plan · {left} of {articles} articles left",
    indicatorNone: "Free plan · all {articles} articles used this month",
    upgrade: "Upgrade",
    upgradeTitle: "Available on paid plans",
    lockedBacklinks: "Backlink placements and the partner exchange are available on Grow. Upgrade to start earning links.",
    lockedVideos: "AI video production is available on paid plans. Upgrade to turn your ideas into videos.",
    lockedAutomation: "Automatic publishing and autopilot are available on paid plans. On Free you publish each article yourself.",
    articlesUsed: "You have used the {articles} free articles of this month. Upgrade for more, or wait for next month.",
    postsUsed: "You have used the {posts} free social posts of this month. Buy credits or upgrade to post more.",
    auditUsed: "Your free SEO audit of this month has been used. Upgrade for full audits whenever you need them.",
    snapshotUsed: "Your free AI visibility snapshot of this month has been used. Upgrade for weekly checks.",
    copilotUsed: "You have used today's {copilot} free Growth Copilot requests. Upgrade, or ask again tomorrow.",
    termsUsed: "Free includes {terms} search terms. Upgrade to research more.",
    paused: "Free AI generation is paused for now - this month's free AI budget is used. Upgrade or buy credits to keep going.",
    verifyEmail: "Confirm your email address first - Free starts once it is confirmed.",
    domainTaken: "This website is already on a Free account. Each website can be on Free once.",
    oneWebsite: "Free includes 1 connected website. Upgrade to add another.",
    trialHint: "Grow and Scale start with a {days}-day free trial.",
    buyCredits: "Buy credits",
  },
};

const es: FreePlanCopy = {
  card: {
    name: "Free",
    desc: "Descubra RepGet con contenido real creado con IA y publicación en redes sociales. Sin tarjeta de crédito.",
    badge: "GRATIS PARA SIEMPRE · SIN TARJETA",
    perMonth: "/ mes",
    caption: "Siempre gratis · mejore su plan cuando quiera",
    cta: "Empezar gratis · Sin tarjeta",
    ctaLabel: "Empezar el plan Free, sin tarjeta de crédito",
    includedLabel: "Todo lo necesario para empezar",
    features: [
      "**{articles} artículos SEO con IA** al mes",
      "**{posts} publicaciones sociales** al mes",
      "**{terms} términos de búsqueda**",
      "**1 sitio web conectado**",
      "**1 auditoría SEO limitada** al mes",
      "**1 instantánea de visibilidad en IA**",
      "**{copilot} consultas a Growth Copilot** al día",
    ],
    locked: ["**Colocación de backlinks** disponible en Grow", "**Producción de vídeo con IA** disponible en los planes de pago"],
    more: "Ver la comparación completa",
    counter: "{taken} / {cap} plazas gratuitas ocupadas",
    counterLabel: "{taken} de {cap} plazas gratuitas ocupadas",
    full: "Las {cap} plazas gratuitas están ocupadas",
    fullNote: "Free está completo por ahora. Grow y Scale siguen empezando con {days} días de prueba gratuita.",
    fullCta: "Empezar {days} días de prueba gratuita",
  },
  compare: {
    audits: "1 limitada / mes",
    snapshot: "1 instantánea",
    copilotPerDay: "{copilot} / día",
  },
  app: {
    indicator: "Plan Free · le quedan {left} de {articles} artículos",
    indicatorNone: "Plan Free · ha usado los {articles} artículos de este mes",
    upgrade: "Mejorar plan",
    upgradeTitle: "Disponible en los planes de pago",
    lockedBacklinks: "La colocación de backlinks y el intercambio de enlaces están disponibles en Grow. Mejore su plan para empezar a conseguir enlaces.",
    lockedVideos: "La producción de vídeo con IA está disponible en los planes de pago. Mejore su plan para convertir sus ideas en vídeos.",
    lockedAutomation: "La publicación automática y el piloto automático están disponibles en los planes de pago. En Free usted publica cada artículo.",
    articlesUsed: "Ha usado los {articles} artículos gratuitos de este mes. Mejore su plan para escribir más, o espere al mes que viene.",
    postsUsed: "Ha usado las {posts} publicaciones sociales gratuitas de este mes. Compre créditos o mejore su plan para publicar más.",
    auditUsed: "Ya ha usado la auditoría SEO gratuita de este mes. Mejore su plan para auditorías completas cuando las necesite.",
    snapshotUsed: "Ya ha usado la instantánea de visibilidad en IA de este mes. Mejore su plan para comprobaciones semanales.",
    copilotUsed: "Ha usado las {copilot} consultas gratuitas de hoy a Growth Copilot. Mejore su plan o vuelva a preguntar mañana.",
    termsUsed: "Free incluye {terms} términos de búsqueda. Mejore su plan para investigar más.",
    paused: "La generación con IA de Free está en pausa: el presupuesto de IA gratuito de este mes se ha agotado. Mejore su plan o compre créditos para continuar.",
    verifyEmail: "Confirme primero su dirección de correo: Free empieza en cuanto esté confirmada.",
    domainTaken: "Este sitio web ya está en una cuenta Free. Cada sitio web puede estar en Free una sola vez.",
    oneWebsite: "Free incluye 1 sitio web conectado. Mejore su plan para añadir otro.",
    trialHint: "Grow y Scale empiezan con {days} días de prueba gratuita.",
    buyCredits: "Comprar créditos",
  },
};

const fr: FreePlanCopy = {
  card: {
    name: "Free",
    desc: "Découvrez RepGet avec de vrais contenus créés par l'IA et la publication sur les réseaux sociaux. Sans carte bancaire.",
    badge: "GRATUIT POUR TOUJOURS · SANS CARTE",
    perMonth: "/ mois",
    caption: "Toujours gratuit · passez à un plan supérieur à tout moment",
    cta: "Commencer gratuitement · Sans carte",
    ctaLabel: "Commencer le plan Free, sans carte bancaire",
    includedLabel: "Tout ce qu'il faut pour commencer",
    features: [
      "**{articles} articles SEO rédigés par l'IA** par mois",
      "**{posts} publications sociales** par mois",
      "**{terms} termes de recherche**",
      "**1 site web connecté**",
      "**1 audit SEO limité** par mois",
      "**1 instantané de visibilité IA**",
      "**{copilot} demandes à Growth Copilot** par jour",
    ],
    locked: ["**Placements de backlinks** disponibles avec Grow", "**Production vidéo par l'IA** disponible avec les plans payants"],
    more: "Voir la comparaison complète",
    counter: "{taken} / {cap} places gratuites prises",
    counterLabel: "{taken} places gratuites prises sur {cap}",
    full: "Les {cap} places gratuites sont prises",
    fullNote: "Free est complet pour le moment. Grow et Scale commencent toujours par {days} jours d'essai gratuit.",
    fullCta: "Commencer {days} jours d'essai gratuit",
  },
  compare: {
    audits: "1 limité / mois",
    snapshot: "1 instantané",
    copilotPerDay: "{copilot} / jour",
  },
  app: {
    indicator: "Plan Free · {left} articles sur {articles} restants",
    indicatorNone: "Plan Free · les {articles} articles du mois sont utilisés",
    upgrade: "Passer à un plan supérieur",
    upgradeTitle: "Disponible avec les plans payants",
    lockedBacklinks: "Les placements de backlinks et l'échange de liens sont disponibles avec Grow. Passez à un plan supérieur pour obtenir des liens.",
    lockedVideos: "La production vidéo par l'IA est disponible avec les plans payants. Passez à un plan supérieur pour transformer vos idées en vidéos.",
    lockedAutomation: "La publication automatique et le pilote automatique sont disponibles avec les plans payants. Avec Free, vous publiez chaque article vous-même.",
    articlesUsed: "Vous avez utilisé les {articles} articles gratuits de ce mois. Passez à un plan supérieur pour en écrire davantage, ou attendez le mois prochain.",
    postsUsed: "Vous avez utilisé les {posts} publications sociales gratuites de ce mois. Achetez des crédits ou passez à un plan supérieur pour publier davantage.",
    auditUsed: "L'audit SEO gratuit de ce mois a été utilisé. Passez à un plan supérieur pour des audits complets quand vous en avez besoin.",
    snapshotUsed: "L'instantané de visibilité IA de ce mois a été utilisé. Passez à un plan supérieur pour des vérifications chaque semaine.",
    copilotUsed: "Vous avez utilisé les {copilot} demandes gratuites du jour à Growth Copilot. Passez à un plan supérieur, ou revenez demain.",
    termsUsed: "Free comprend {terms} termes de recherche. Passez à un plan supérieur pour en rechercher davantage.",
    paused: "La génération par l'IA de Free est en pause : le budget IA gratuit de ce mois est épuisé. Passez à un plan supérieur ou achetez des crédits pour continuer.",
    verifyEmail: "Confirmez d'abord votre adresse e-mail : Free commence dès qu'elle est confirmée.",
    domainTaken: "Ce site web est déjà sur un compte Free. Chaque site web ne peut être sur Free qu'une seule fois.",
    oneWebsite: "Free comprend 1 site web connecté. Passez à un plan supérieur pour en ajouter un autre.",
    trialHint: "Grow et Scale commencent par {days} jours d'essai gratuit.",
    buyCredits: "Acheter des crédits",
  },
};

const it: FreePlanCopy = {
  card: {
    name: "Free",
    desc: "Scopra RepGet con veri contenuti creati dall'IA e la pubblicazione sui social. Senza carta di credito.",
    badge: "GRATIS PER SEMPRE · SENZA CARTA",
    perMonth: "/ mese",
    caption: "Sempre gratis · passi a un piano superiore quando vuole",
    cta: "Inizi gratis · Senza carta",
    ctaLabel: "Inizi il piano Free, senza carta di credito",
    includedLabel: "Tutto il necessario per iniziare",
    features: [
      "**{articles} articoli SEO con IA** al mese",
      "**{posts} post social** al mese",
      "**{terms} termini di ricerca**",
      "**1 sito web collegato**",
      "**1 audit SEO limitato** al mese",
      "**1 istantanea di visibilità IA**",
      "**{copilot} richieste a Growth Copilot** al giorno",
    ],
    locked: ["**Inserimento di backlink** disponibile con Grow", "**Produzione video con IA** disponibile con i piani a pagamento"],
    more: "Vedi il confronto completo",
    counter: "{taken} / {cap} posti gratuiti occupati",
    counterLabel: "{taken} posti gratuiti occupati su {cap}",
    full: "I {cap} posti gratuiti sono esauriti",
    fullNote: "Free è al completo per ora. Grow e Scale iniziano sempre con {days} giorni di prova gratuita.",
    fullCta: "Inizi {days} giorni di prova gratuita",
  },
  compare: {
    audits: "1 limitato / mese",
    snapshot: "1 istantanea",
    copilotPerDay: "{copilot} / giorno",
  },
  app: {
    indicator: "Piano Free · restano {left} articoli su {articles}",
    indicatorNone: "Piano Free · ha usato i {articles} articoli di questo mese",
    upgrade: "Passi a un piano superiore",
    upgradeTitle: "Disponibile con i piani a pagamento",
    lockedBacklinks: "L'inserimento di backlink e lo scambio di link sono disponibili con Grow. Passi a un piano superiore per iniziare a ottenere link.",
    lockedVideos: "La produzione video con IA è disponibile con i piani a pagamento. Passi a un piano superiore per trasformare le sue idee in video.",
    lockedAutomation: "La pubblicazione automatica e il pilota automatico sono disponibili con i piani a pagamento. Con Free pubblica lei ogni articolo.",
    articlesUsed: "Ha usato i {articles} articoli gratuiti di questo mese. Passi a un piano superiore per scriverne altri, o attenda il mese prossimo.",
    postsUsed: "Ha usato i {posts} post social gratuiti di questo mese. Acquisti crediti o passi a un piano superiore per pubblicarne altri.",
    auditUsed: "L'audit SEO gratuito di questo mese è stato usato. Passi a un piano superiore per audit completi quando servono.",
    snapshotUsed: "L'istantanea di visibilità IA di questo mese è stata usata. Passi a un piano superiore per controlli settimanali.",
    copilotUsed: "Ha usato le {copilot} richieste gratuite di oggi a Growth Copilot. Passi a un piano superiore, o chieda di nuovo domani.",
    termsUsed: "Free include {terms} termini di ricerca. Passi a un piano superiore per ricercarne altri.",
    paused: "La generazione con IA di Free è in pausa: il budget IA gratuito di questo mese è esaurito. Passi a un piano superiore o acquisti crediti per continuare.",
    verifyEmail: "Confermi prima il suo indirizzo email: Free inizia appena è confermato.",
    domainTaken: "Questo sito web è già su un account Free. Ogni sito web può essere su Free una sola volta.",
    oneWebsite: "Free include 1 sito web collegato. Passi a un piano superiore per aggiungerne un altro.",
    trialHint: "Grow e Scale iniziano con {days} giorni di prova gratuita.",
    buyCredits: "Acquista crediti",
  },
};

const de: FreePlanCopy = {
  card: {
    name: "Free",
    desc: "Erleben Sie RepGet mit echten KI-Inhalten und Social-Media-Veröffentlichung. Keine Kreditkarte nötig.",
    badge: "FÜR IMMER KOSTENLOS · KEINE KARTE",
    perMonth: "/ Monat",
    caption: "Immer kostenlos · jederzeit upgraden",
    cta: "Kostenlos starten · Keine Karte nötig",
    ctaLabel: "Den Free-Plan starten, keine Kreditkarte nötig",
    includedLabel: "Alles, was Sie für den Start brauchen",
    features: [
      "**{articles} KI-SEO-Artikel** pro Monat",
      "**{posts} Social-Media-Beiträge** pro Monat",
      "**{terms} Suchbegriffe**",
      "**1 verbundene Website**",
      "**1 eingeschränktes SEO-Audit** pro Monat",
      "**1 KI-Sichtbarkeits-Momentaufnahme**",
      "**{copilot} Growth-Copilot-Anfragen** pro Tag",
    ],
    locked: ["**Backlink-Platzierungen** ab Grow verfügbar", "**KI-Videoproduktion** in den bezahlten Plänen verfügbar"],
    more: "Vollständigen Vergleich ansehen",
    counter: "{taken} / {cap} kostenlose Plätze vergeben",
    counterLabel: "{taken} von {cap} kostenlosen Plätzen vergeben",
    full: "Alle {cap} kostenlosen Plätze sind vergeben",
    fullNote: "Free ist vorerst ausgebucht. Grow und Scale starten weiterhin mit {days} Tagen kostenloser Testphase.",
    fullCta: "{days} Tage kostenlos testen",
  },
  compare: {
    audits: "1 eingeschränkt / Monat",
    snapshot: "1 Momentaufnahme",
    copilotPerDay: "{copilot} / Tag",
  },
  app: {
    indicator: "Free-Plan · noch {left} von {articles} Artikeln",
    indicatorNone: "Free-Plan · alle {articles} Artikel dieses Monats genutzt",
    upgrade: "Upgraden",
    upgradeTitle: "In den bezahlten Plänen verfügbar",
    lockedBacklinks: "Backlink-Platzierungen und der Partner-Linktausch sind ab Grow verfügbar. Upgraden Sie, um Links zu erhalten.",
    lockedVideos: "KI-Videoproduktion ist in den bezahlten Plänen verfügbar. Upgraden Sie, um Ihre Ideen in Videos zu verwandeln.",
    lockedAutomation: "Automatisches Veröffentlichen und der Autopilot sind in den bezahlten Plänen verfügbar. Mit Free veröffentlichen Sie jeden Artikel selbst.",
    articlesUsed: "Sie haben die {articles} kostenlosen Artikel dieses Monats genutzt. Upgraden Sie für mehr, oder warten Sie auf den nächsten Monat.",
    postsUsed: "Sie haben die {posts} kostenlosen Social-Media-Beiträge dieses Monats genutzt. Kaufen Sie Credits oder upgraden Sie, um mehr zu posten.",
    auditUsed: "Ihr kostenloses SEO-Audit dieses Monats wurde genutzt. Upgraden Sie für vollständige Audits, wann immer Sie sie brauchen.",
    snapshotUsed: "Ihre kostenlose KI-Sichtbarkeits-Momentaufnahme dieses Monats wurde genutzt. Upgraden Sie für wöchentliche Prüfungen.",
    copilotUsed: "Sie haben die {copilot} kostenlosen Growth-Copilot-Anfragen von heute genutzt. Upgraden Sie, oder fragen Sie morgen wieder.",
    termsUsed: "Free umfasst {terms} Suchbegriffe. Upgraden Sie, um mehr zu recherchieren.",
    paused: "Die KI-Erstellung im Free-Plan ist pausiert: Das kostenlose KI-Budget dieses Monats ist aufgebraucht. Upgraden Sie oder kaufen Sie Credits, um weiterzumachen.",
    verifyEmail: "Bestätigen Sie zuerst Ihre E-Mail-Adresse - Free startet, sobald sie bestätigt ist.",
    domainTaken: "Diese Website ist bereits in einem Free-Konto. Jede Website kann nur einmal Free nutzen.",
    oneWebsite: "Free umfasst 1 verbundene Website. Upgraden Sie, um eine weitere hinzuzufügen.",
    trialHint: "Grow und Scale starten mit {days} Tagen kostenloser Testphase.",
    buyCredits: "Credits kaufen",
  },
};

export const FREE_PLAN_COPY: Record<Locale, FreePlanCopy> = { en, es, fr, it, de };

export function freePlanCopy(locale: Locale): FreePlanCopy {
  return FREE_PLAN_COPY[locale] ?? en;
}
