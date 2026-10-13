import type { Locale } from "@/lib/i18n/config";

/** The Robots.txt Checker's words in five languages. The title is the registry's (lib/tools/i18n/common.ts). */
export type RobotsCopy = {
  metaDescription: string;
  description: string;
  submit: string;
  blocksAllTitle: string;
  /** Around the rule, which stays as written: "{before} Disallow: / {after}". */
  blocksAllBefore: string;
  blocksAllAfter: string;
  notFoundTitle: string;
  notFoundBody: string;
  okTitle: string;
  okBody: string;
  sitemap: string;
  noSitemap: string;
  blocked: string;
  explainer: { heading: string; body: string }[];
  ctaHeadline: string;
  ctaBody: string;
};

export const ROBOTS_COPY: Record<Locale, RobotsCopy> = {
  en: {
    metaDescription: "Check whether your robots.txt is accidentally blocking search engines from your website. Free, no account needed.",
    description:
      "A robots.txt file tells search engines which parts of your site they may read. A single wrong line can hide your entire website from Google, and you cannot tell by looking at the site.",
    submit: "Check robots.txt",
    blocksAllTitle: "Your site is blocking all search engines",
    blocksAllBefore: "robots.txt contains",
    blocksAllAfter:
      "for every crawler, which asks Google to ignore the whole site. This is usually left over from a staging site. Until it is removed, nothing here can rank.",
    notFoundTitle: "No robots.txt found",
    notFoundBody: "That is usually fine - with no file, search engines may read everything. Adding one lets you point them at your sitemap.",
    okTitle: "Search engines are not blocked from your site",
    okBody: "Nothing in robots.txt stops crawlers reading your pages.",
    sitemap: "Sitemap",
    noSitemap: "No sitemap is listed. Adding one helps search engines find every page instead of following links to them.",
    blocked: "Blocked paths",
    explainer: [
      {
        heading: "What this checks",
        body: "We fetch your robots.txt and look for the one thing that matters most: a rule blocking every crawler from the whole site. We also list any sitemaps it declares and the paths it blocks, and show you the raw file's address so you can read exactly what we read.",
      },
      {
        heading: "The failure nobody notices",
        body: 'A site launches, and the "Disallow: /" from the staging server comes with it. The website works perfectly. Every page loads. Nothing in any dashboard complains. It simply never appears in Google, and by the time somebody thinks to check this file, months of content have been published into a site search engines were told to ignore.',
      },
    ],
    ctaHeadline: "Check the rest of your site",
    ctaBody: "robots.txt is one of many things that can keep a site out of Google. Our free check reads your pages and reports the rest.",
  },
  es: {
    metaDescription: "Compruebe si su robots.txt está bloqueando por error a los buscadores en su web. Gratis, sin cuenta.",
    description:
      "Un archivo robots.txt indica a los buscadores qué partes de su web pueden leer. Una sola línea equivocada puede ocultar toda su web a Google, y no se nota mirando la web.",
    submit: "Comprobar robots.txt",
    blocksAllTitle: "Su web está bloqueando a todos los buscadores",
    blocksAllBefore: "robots.txt contiene",
    blocksAllAfter:
      "para todos los rastreadores, lo que pide a Google que ignore toda la web. Suele ser un resto de una web de pruebas. Mientras no se quite, nada de aquí puede posicionarse.",
    notFoundTitle: "No se encontró ningún robots.txt",
    notFoundBody: "Normalmente no pasa nada: sin archivo, los buscadores pueden leerlo todo. Añadir uno le permite indicarles su sitemap.",
    okTitle: "Los buscadores no tienen bloqueado el acceso a su web",
    okBody: "Nada en robots.txt impide a los rastreadores leer sus páginas.",
    sitemap: "Sitemap",
    noSitemap: "No aparece ningún sitemap. Añadir uno ayuda a los buscadores a encontrar todas las páginas en lugar de llegar a ellas siguiendo enlaces.",
    blocked: "Rutas bloqueadas",
    explainer: [
      {
        heading: "Qué comprueba",
        body: "Descargamos su robots.txt y buscamos lo que más importa: una regla que impida a todos los rastreadores leer toda la web. También listamos los sitemaps que declara y las rutas que bloquea, y le mostramos la dirección del archivo para que lea exactamente lo mismo que nosotros.",
      },
      {
        heading: "El fallo que nadie nota",
        body: "Se lanza una web y el «Disallow: /» del servidor de pruebas llega con ella. La web funciona perfectamente. Todas las páginas cargan. Ningún panel se queja. Simplemente nunca aparece en Google, y cuando alguien piensa en revisar este archivo, ya se han publicado meses de contenido en una web que los buscadores tenían orden de ignorar.",
      },
    ],
    ctaHeadline: "Revise el resto de su web",
    ctaBody: "robots.txt es solo una de las muchas cosas que pueden dejar una web fuera de Google. Nuestra comprobación gratuita lee sus páginas e informa del resto.",
  },
  fr: {
    metaDescription: "Vérifiez si votre robots.txt bloque par erreur les moteurs de recherche sur votre site. Gratuit, sans compte.",
    description:
      "Un fichier robots.txt indique aux moteurs de recherche quelles parties de votre site ils peuvent lire. Une seule ligne erronée peut cacher tout votre site à Google, et cela ne se voit pas en regardant le site.",
    submit: "Vérifier le robots.txt",
    blocksAllTitle: "Votre site bloque tous les moteurs de recherche",
    blocksAllBefore: "Le robots.txt contient",
    blocksAllAfter:
      "pour tous les robots, ce qui demande à Google d’ignorer tout le site. C’est souvent un reste d’un site de test. Tant que cette ligne est là, rien ici ne peut se positionner.",
    notFoundTitle: "Aucun robots.txt trouvé",
    notFoundBody: "C’est généralement sans conséquence : sans fichier, les moteurs de recherche peuvent tout lire. En ajouter un vous permet de leur indiquer votre sitemap.",
    okTitle: "Les moteurs de recherche ne sont pas bloqués sur votre site",
    okBody: "Rien dans le robots.txt n’empêche les robots de lire vos pages.",
    sitemap: "Sitemap",
    noSitemap: "Aucun sitemap n’est indiqué. En ajouter un aide les moteurs de recherche à trouver toutes les pages au lieu de suivre des liens pour y arriver.",
    blocked: "Chemins bloqués",
    explainer: [
      {
        heading: "Ce que l’outil vérifie",
        body: "Nous récupérons votre robots.txt et cherchons ce qui compte le plus : une règle qui interdit tout le site à tous les robots. Nous listons aussi les sitemaps qu’il déclare et les chemins qu’il bloque, et vous donnons l’adresse du fichier pour que vous lisiez exactement ce que nous avons lu.",
      },
      {
        heading: "La panne que personne ne remarque",
        body: "Un site est mis en ligne, et le « Disallow: / » du serveur de test l’accompagne. Le site fonctionne parfaitement. Chaque page se charge. Aucun tableau de bord ne signale quoi que ce soit. Il n’apparaît simplement jamais dans Google, et quand quelqu’un pense enfin à vérifier ce fichier, des mois de contenu ont été publiés sur un site que les moteurs de recherche avaient ordre d’ignorer.",
      },
    ],
    ctaHeadline: "Vérifiez le reste de votre site",
    ctaBody: "Le robots.txt n’est qu’une des nombreuses choses qui peuvent tenir un site hors de Google. Notre vérification gratuite lit vos pages et signale le reste.",
  },
  it: {
    metaDescription: "Controlli se il suo robots.txt sta bloccando per errore i motori di ricerca sul suo sito. Gratis, senza account.",
    description:
      "Un file robots.txt dice ai motori di ricerca quali parti del suo sito possono leggere. Una sola riga sbagliata può nascondere l’intero sito a Google, e guardando il sito non si nota.",
    submit: "Controlla robots.txt",
    blocksAllTitle: "Il suo sito blocca tutti i motori di ricerca",
    blocksAllBefore: "Il robots.txt contiene",
    blocksAllAfter:
      "per tutti i crawler, e così chiede a Google di ignorare l’intero sito. Di solito è un residuo di un sito di prova. Finché non viene tolto, nulla qui può posizionarsi.",
    notFoundTitle: "Nessun robots.txt trovato",
    notFoundBody: "Di solito va bene: senza file, i motori di ricerca possono leggere tutto. Aggiungerne uno le permette di indicare loro la sitemap.",
    okTitle: "I motori di ricerca non sono bloccati sul suo sito",
    okBody: "Niente nel robots.txt impedisce ai crawler di leggere le sue pagine.",
    sitemap: "Sitemap",
    noSitemap: "Non è indicata nessuna sitemap. Aggiungerne una aiuta i motori di ricerca a trovare ogni pagina invece di arrivarci seguendo i link.",
    blocked: "Percorsi bloccati",
    explainer: [
      {
        heading: "Cosa controlla",
        body: "Scarichiamo il suo robots.txt e cerchiamo la cosa più importante: una regola che blocca l’intero sito a tutti i crawler. Elenchiamo anche le sitemap che dichiara e i percorsi che blocca, e le mostriamo l’indirizzo del file, così può leggere esattamente ciò che abbiamo letto noi.",
      },
      {
        heading: "Il guasto che nessuno nota",
        body: "Un sito va online e il «Disallow: /» del server di prova arriva con lui. Il sito funziona perfettamente. Ogni pagina si carica. Nessuna dashboard segnala nulla. Semplicemente non compare mai su Google, e quando qualcuno pensa di controllare questo file sono già stati pubblicati mesi di contenuti su un sito che i motori di ricerca avevano l’ordine di ignorare.",
      },
    ],
    ctaHeadline: "Controlli il resto del sito",
    ctaBody: "Il robots.txt è solo una delle tante cose che possono tenere un sito fuori da Google. Il nostro controllo gratuito legge le sue pagine e segnala il resto.",
  },
  de: {
    metaDescription: "Prüfen Sie, ob Ihre robots.txt Suchmaschinen versehentlich von Ihrer Website aussperrt. Kostenlos, ohne Konto.",
    description:
      "Eine robots.txt-Datei sagt Suchmaschinen, welche Teile Ihrer Website sie lesen dürfen. Eine einzige falsche Zeile kann Ihre ganze Website vor Google verbergen, und man sieht es der Website nicht an.",
    submit: "robots.txt prüfen",
    blocksAllTitle: "Ihre Website sperrt alle Suchmaschinen aus",
    blocksAllBefore: "Die robots.txt enthält",
    blocksAllAfter:
      "für jeden Crawler. Damit wird Google gebeten, die ganze Website zu ignorieren. Meist ist das ein Überbleibsel einer Testumgebung. Solange es nicht entfernt ist, kann hier nichts ranken.",
    notFoundTitle: "Keine robots.txt gefunden",
    notFoundBody: "Das ist meist in Ordnung: Ohne Datei dürfen Suchmaschinen alles lesen. Mit einer Datei können Sie sie auf Ihre Sitemap hinweisen.",
    okTitle: "Suchmaschinen sind auf Ihrer Website nicht gesperrt",
    okBody: "Nichts in der robots.txt hindert Crawler daran, Ihre Seiten zu lesen.",
    sitemap: "Sitemap",
    noSitemap: "Es ist keine Sitemap angegeben. Eine Sitemap hilft Suchmaschinen, jede Seite zu finden, statt sich über Links dorthin vorzuarbeiten.",
    blocked: "Gesperrte Pfade",
    explainer: [
      {
        heading: "Was geprüft wird",
        body: "Wir laden Ihre robots.txt und suchen nach dem Wichtigsten: einer Regel, die jedem Crawler die ganze Website sperrt. Außerdem listen wir die angegebenen Sitemaps und die gesperrten Pfade auf und zeigen Ihnen die Adresse der Datei, damit Sie genau das lesen können, was wir gelesen haben.",
      },
      {
        heading: "Der Fehler, den niemand bemerkt",
        body: "Eine Website geht live, und das „Disallow: /“ vom Testserver kommt mit. Die Website funktioniert einwandfrei. Jede Seite lädt. Kein Dashboard meldet etwas. Sie erscheint nur nie bei Google, und bis jemand auf die Idee kommt, diese Datei zu prüfen, wurden monatelang Inhalte auf einer Website veröffentlicht, die Suchmaschinen ignorieren sollten.",
      },
    ],
    ctaHeadline: "Prüfen Sie den Rest Ihrer Website",
    ctaBody: "Die robots.txt ist nur eines von vielem, was eine Website aus Google heraushalten kann. Unsere kostenlose Prüfung liest Ihre Seiten und meldet den Rest.",
  },
};
