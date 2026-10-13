import type { Locale } from "@/lib/i18n/config";

import type { ToolCategory } from "../registry";

/**
 * The free tools' shared words in five languages (client, 2026-10-13: pages
 * in the visitor's language): the hub, every tool's name and one-line
 * description, the categories, and the furniture every tool page has.
 *
 * Words that already exist elsewhere on the site are the same here: "Free
 * tools" is the footer's, the address field and "Checking…" are the home
 * page's free check.
 */

export type ToolText = { title: string; blurb: string };

export type ToolsCommon = {
  hub: {
    metaTitle: string;
    metaDescription: string;
    badge: string;
    title: string;
    intro: string;
    pricingLead: string;
    pricingLink: string;
  };
  categories: Record<ToolCategory, string>;
  /** By the tool's English path, as the registry lists it. */
  tools: Record<string, ToolText>;
  home: string;
  freeTools: string;
  badges: [string, string, string];
  moreTools: string;
  allTools: string;
  auditCta: string;
  fieldLabel: string;
  placeholder: string;
  checking: string;
  /** Above an error from the check. */
  couldNotCheck: string;
  /** Read the file yourself at {url}: the lead-in. */
  readItAt: string;
  /** "and {count} more". */
  andMore: string;
  /** After a copy button is pressed. */
  copied: string;
};

export const TOOLS_COMMON: Record<Locale, ToolsCommon> = {
  en: {
    hub: {
      metaTitle: "Free SEO & AI visibility tools",
      metaDescription:
        "Free tools to check your site: SEO score, robots.txt, sitemaps, AI crawler access, llms.txt, keyword density and more. No signup, real results.",
      badge: "Free tools",
      title: "Try our free SEO & AI visibility tools",
      intro: "No signup required - every tool runs a real check and shows the full result instantly.",
      pricingLead: "Want all of this running automatically, with articles written for you?",
      pricingLink: "See pricing",
    },
    categories: { "Technical SEO": "Technical SEO", "AI visibility": "AI visibility", "Content & meta": "Content & meta" },
    tools: {
      "/audit": { title: "SEO Score Checker", blurb: "One 0-100 score from a real crawl." },
      "/tools/robots-checker": { title: "Robots.txt Checker", blurb: "Verdicts for search and AI bots together." },
      "/tools/sitemap-checker": { title: "Sitemap Checker & Finder", blurb: "Find and validate XML sitemaps." },
      "/tools/meta-tag-checker": { title: "Meta Tag Checker", blurb: "Every tag Google and social sites read." },
      "/tools/ai-crawler-checker": { title: "AI Crawler Checker", blurb: "Test GPTBot, ClaudeBot and PerplexityBot access." },
      "/tools/llms-txt-generator": { title: "llms.txt Generator", blurb: "Build a valid llms.txt from your live site." },
      "/tools/llm-html-checker": { title: "LLM HTML Visibility Checker", blurb: "How much of your text can AI actually read?" },
      "/tools/snippet-preview": { title: "SEO Title Checker", blurb: "Score your title for SERP CTR, live." },
      "/tools/keyword-density": { title: "Keyword Density Checker", blurb: "What your page actually talks about." },
      "/tools/meta-description-generator": { title: "Meta Description Generator", blurb: "Five descriptions with a reason to click." },
    },
    home: "Home",
    freeTools: "Free tools",
    badges: ["100% free", "No signup", "Instant result"],
    moreTools: "More free tools",
    allTools: "All tools",
    auditCta: "Get your free audit",
    fieldLabel: "Your website address",
    placeholder: "yourwebsite.com",
    checking: "Checking…",
    couldNotCheck: "We could not check that website",
    readItAt: "Read the file yourself at",
    andMore: "and {count} more",
    copied: "Copied",
  },
  es: {
    hub: {
      metaTitle: "Herramientas gratuitas de SEO y visibilidad en IA",
      metaDescription:
        "Herramientas gratuitas para revisar su web: puntuación SEO, robots.txt, sitemaps, acceso de los rastreadores de IA, llms.txt, densidad de palabras clave y más. Sin registro, con resultados reales.",
      badge: "Herramientas gratuitas",
      title: "Pruebe nuestras herramientas gratuitas de SEO y visibilidad en IA",
      intro: "Sin registro: cada herramienta hace una comprobación real y muestra el resultado completo al instante.",
      pricingLead: "¿Quiere todo esto en marcha automáticamente, con artículos escritos para usted?",
      pricingLink: "Ver precios",
    },
    categories: { "Technical SEO": "SEO técnico", "AI visibility": "Visibilidad en IA", "Content & meta": "Contenido y metaetiquetas" },
    tools: {
      "/audit": { title: "Comprobador de puntuación SEO", blurb: "Una puntuación de 0 a 100 a partir de un rastreo real." },
      "/tools/robots-checker": { title: "Comprobador de robots.txt", blurb: "Veredictos para buscadores y bots de IA a la vez." },
      "/tools/sitemap-checker": { title: "Buscador y comprobador de sitemaps", blurb: "Encuentre y valide sitemaps XML." },
      "/tools/meta-tag-checker": { title: "Comprobador de metaetiquetas", blurb: "Todas las etiquetas que leen Google y las redes sociales." },
      "/tools/ai-crawler-checker": { title: "Comprobador de rastreadores de IA", blurb: "Compruebe el acceso de GPTBot, ClaudeBot y PerplexityBot." },
      "/tools/llms-txt-generator": { title: "Generador de llms.txt", blurb: "Cree un llms.txt válido a partir de su web publicada." },
      "/tools/llm-html-checker": { title: "Comprobador de visibilidad del HTML para IA", blurb: "¿Cuánto de su texto puede leer de verdad la IA?" },
      "/tools/snippet-preview": { title: "Comprobador de títulos SEO", blurb: "Puntúe su título para el CTR en los resultados, en directo." },
      "/tools/keyword-density": { title: "Comprobador de densidad de palabras clave", blurb: "De qué habla realmente su página." },
      "/tools/meta-description-generator": { title: "Generador de meta descripciones", blurb: "Cinco descripciones con un motivo para hacer clic." },
    },
    home: "Inicio",
    freeTools: "Herramientas gratuitas",
    badges: ["100 % gratis", "Sin registro", "Resultado al instante"],
    moreTools: "Más herramientas gratuitas",
    allTools: "Todas las herramientas",
    auditCta: "Obtenga su auditoría gratuita",
    fieldLabel: "La dirección de su web",
    placeholder: "suweb.com",
    checking: "Analizando…",
    couldNotCheck: "No pudimos comprobar esa web",
    readItAt: "Lea el archivo usted mismo en",
    andMore: "y {count} más",
    copied: "Copiado",
  },
  fr: {
    hub: {
      metaTitle: "Outils gratuits de SEO et de visibilité dans l’IA",
      metaDescription:
        "Des outils gratuits pour vérifier votre site : score SEO, robots.txt, sitemaps, accès des robots d’IA, llms.txt, densité de mots-clés et plus encore. Sans inscription, avec de vrais résultats.",
      badge: "Outils gratuits",
      title: "Essayez nos outils gratuits de SEO et de visibilité dans l’IA",
      intro: "Sans inscription : chaque outil effectue une vraie vérification et affiche le résultat complet immédiatement.",
      pricingLead: "Vous voulez que tout cela tourne automatiquement, avec des articles rédigés pour vous ?",
      pricingLink: "Voir les tarifs",
    },
    categories: { "Technical SEO": "SEO technique", "AI visibility": "Visibilité dans l’IA", "Content & meta": "Contenu et balises meta" },
    tools: {
      "/audit": { title: "Vérificateur de score SEO", blurb: "Un score de 0 à 100 issu d’une vraie exploration." },
      "/tools/robots-checker": { title: "Vérificateur de robots.txt", blurb: "Des verdicts pour les moteurs de recherche et les robots d’IA à la fois." },
      "/tools/sitemap-checker": { title: "Vérificateur et détecteur de sitemaps", blurb: "Trouvez et validez vos sitemaps XML." },
      "/tools/meta-tag-checker": { title: "Vérificateur de balises meta", blurb: "Toutes les balises que lisent Google et les réseaux sociaux." },
      "/tools/ai-crawler-checker": { title: "Vérificateur des robots d’IA", blurb: "Testez l’accès de GPTBot, ClaudeBot et PerplexityBot." },
      "/tools/llms-txt-generator": { title: "Générateur de llms.txt", blurb: "Créez un llms.txt valide à partir de votre site en ligne." },
      "/tools/llm-html-checker": { title: "Vérificateur de visibilité du HTML pour l’IA", blurb: "Quelle part de votre texte l’IA peut-elle vraiment lire ?" },
      "/tools/snippet-preview": { title: "Vérificateur de titre SEO", blurb: "Notez votre titre pour le taux de clic, en direct." },
      "/tools/keyword-density": { title: "Vérificateur de densité de mots-clés", blurb: "Ce dont parle vraiment votre page." },
      "/tools/meta-description-generator": { title: "Générateur de meta descriptions", blurb: "Cinq descriptions avec une raison de cliquer." },
    },
    home: "Accueil",
    freeTools: "Outils gratuits",
    badges: ["100 % gratuit", "Sans inscription", "Résultat immédiat"],
    moreTools: "Plus d’outils gratuits",
    allTools: "Tous les outils",
    auditCta: "Obtenir votre audit gratuit",
    fieldLabel: "L’adresse de votre site",
    placeholder: "votresite.fr",
    checking: "Analyse en cours…",
    couldNotCheck: "Nous n’avons pas pu vérifier ce site",
    readItAt: "Lisez le fichier vous-même à l’adresse",
    andMore: "et {count} de plus",
    copied: "Copié",
  },
  it: {
    hub: {
      metaTitle: "Strumenti gratuiti per SEO e visibilità nell’AI",
      metaDescription:
        "Strumenti gratuiti per controllare il suo sito: punteggio SEO, robots.txt, sitemap, accesso dei crawler AI, llms.txt, densità delle parole chiave e altro. Senza registrazione, con risultati reali.",
      badge: "Strumenti gratuiti",
      title: "Provi i nostri strumenti gratuiti per SEO e visibilità nell’AI",
      intro: "Senza registrazione: ogni strumento esegue un controllo reale e mostra subito il risultato completo.",
      pricingLead: "Vuole che tutto questo funzioni in automatico, con articoli scritti per lei?",
      pricingLink: "Vedi i prezzi",
    },
    categories: { "Technical SEO": "SEO tecnica", "AI visibility": "Visibilità nell’AI", "Content & meta": "Contenuti e meta tag" },
    tools: {
      "/audit": { title: "Verifica del punteggio SEO", blurb: "Un punteggio da 0 a 100 da una scansione reale." },
      "/tools/robots-checker": { title: "Verifica robots.txt", blurb: "Verdetti per motori di ricerca e bot AI insieme." },
      "/tools/sitemap-checker": { title: "Ricerca e verifica sitemap", blurb: "Trovi e convalidi le sitemap XML." },
      "/tools/meta-tag-checker": { title: "Verifica meta tag", blurb: "Tutti i tag che leggono Google e i social." },
      "/tools/ai-crawler-checker": { title: "Verifica crawler AI", blurb: "Controlli l’accesso di GPTBot, ClaudeBot e PerplexityBot." },
      "/tools/llms-txt-generator": { title: "Generatore di llms.txt", blurb: "Crei un llms.txt valido dal suo sito online." },
      "/tools/llm-html-checker": { title: "Verifica visibilità HTML per l’AI", blurb: "Quanta parte del suo testo l’AI riesce davvero a leggere?" },
      "/tools/snippet-preview": { title: "Verifica titolo SEO", blurb: "Valuti il suo titolo per il CTR nei risultati, in tempo reale." },
      "/tools/keyword-density": { title: "Verifica densità parole chiave", blurb: "Di cosa parla davvero la sua pagina." },
      "/tools/meta-description-generator": { title: "Generatore di meta description", blurb: "Cinque descrizioni con un motivo per cliccare." },
    },
    home: "Home",
    freeTools: "Strumenti gratuiti",
    badges: ["100% gratis", "Senza registrazione", "Risultato immediato"],
    moreTools: "Altri strumenti gratuiti",
    allTools: "Tutti gli strumenti",
    auditCta: "Ottenga l’audit gratuito",
    fieldLabel: "L’indirizzo del suo sito",
    placeholder: "ilsuosito.it",
    checking: "Analisi in corso…",
    couldNotCheck: "Non siamo riusciti a controllare quel sito",
    readItAt: "Legga il file direttamente all’indirizzo",
    andMore: "e altri {count}",
    copied: "Copiato",
  },
  de: {
    hub: {
      metaTitle: "Kostenlose Werkzeuge für SEO und KI-Sichtbarkeit",
      metaDescription:
        "Kostenlose Werkzeuge zum Prüfen Ihrer Website: SEO-Score, robots.txt, Sitemaps, Zugriff von KI-Crawlern, llms.txt, Keyword-Dichte und mehr. Ohne Anmeldung, mit echten Ergebnissen.",
      badge: "Kostenlose Werkzeuge",
      title: "Testen Sie unsere kostenlosen Werkzeuge für SEO und KI-Sichtbarkeit",
      intro: "Ohne Anmeldung: Jedes Werkzeug führt eine echte Prüfung durch und zeigt sofort das vollständige Ergebnis.",
      pricingLead: "Sie möchten, dass all das automatisch läuft, mit Artikeln, die für Sie geschrieben werden?",
      pricingLink: "Preise ansehen",
    },
    categories: { "Technical SEO": "Technisches SEO", "AI visibility": "KI-Sichtbarkeit", "Content & meta": "Inhalt und Meta-Tags" },
    tools: {
      "/audit": { title: "SEO-Score-Checker", blurb: "Ein Score von 0 bis 100 aus einem echten Crawl." },
      "/tools/robots-checker": { title: "Robots.txt-Checker", blurb: "Urteile für Suchmaschinen und KI-Bots auf einen Blick." },
      "/tools/sitemap-checker": { title: "Sitemap-Checker und -Finder", blurb: "XML-Sitemaps finden und prüfen." },
      "/tools/meta-tag-checker": { title: "Meta-Tag-Checker", blurb: "Jedes Tag, das Google und soziale Netzwerke lesen." },
      "/tools/ai-crawler-checker": { title: "KI-Crawler-Checker", blurb: "Zugriff von GPTBot, ClaudeBot und PerplexityBot testen." },
      "/tools/llms-txt-generator": { title: "llms.txt-Generator", blurb: "Eine gültige llms.txt aus Ihrer Live-Website erstellen." },
      "/tools/llm-html-checker": { title: "HTML-Sichtbarkeits-Checker für KI", blurb: "Wie viel Ihres Textes kann KI wirklich lesen?" },
      "/tools/snippet-preview": { title: "SEO-Titel-Checker", blurb: "Bewerten Sie Ihren Titel für die Klickrate, live." },
      "/tools/keyword-density": { title: "Keyword-Dichte-Checker", blurb: "Worüber Ihre Seite wirklich spricht." },
      "/tools/meta-description-generator": { title: "Meta-Description-Generator", blurb: "Fünf Beschreibungen mit einem Grund zum Klicken." },
    },
    home: "Startseite",
    freeTools: "Kostenlose Werkzeuge",
    badges: ["100 % kostenlos", "Ohne Anmeldung", "Sofortiges Ergebnis"],
    moreTools: "Weitere kostenlose Werkzeuge",
    allTools: "Alle Werkzeuge",
    auditCta: "Kostenloses Audit erhalten",
    fieldLabel: "Adresse Ihrer Website",
    placeholder: "ihrewebsite.de",
    checking: "Wird geprüft…",
    couldNotCheck: "Wir konnten diese Website nicht prüfen",
    readItAt: "Lesen Sie die Datei selbst unter",
    andMore: "und {count} weitere",
    copied: "Kopiert",
  },
};
