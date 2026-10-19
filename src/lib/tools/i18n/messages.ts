import type { Locale } from "@/lib/i18n/config";

/**
 * The free tools' result messages in the other four languages.
 *
 * The checks (lib/tools/*, lib/websites/url.ts) answer in English, as the
 * whole product's logs and tests expect. A translated page passes each message
 * through localizeToolMessage on its way to the screen. The set is finite and
 * listed here; messages.test.ts reads the checks' source and fails on any
 * message this list does not translate, so a new one cannot slip through in
 * English.
 */

type Translated = Exclude<Locale, "en">;
type Entry = { en: string | RegExp; t: Record<Translated, string> };

/** $1, $2... in a translation are the pattern's numbers, in order. */
const ENTRIES: Entry[] = [
  /* Shared abuse protection (lib/tools/public-guard.ts). */
  {
    en: "We are checking a lot of websites right now. Please try again in a few minutes.",
    t: {
      es: "Estamos comprobando muchas webs en este momento. Inténtelo de nuevo en unos minutos.",
      fr: "Nous vérifions beaucoup de sites en ce moment. Réessayez dans quelques minutes.",
      it: "Stiamo controllando molti siti in questo momento. Riprovi tra qualche minuto.",
      de: "Wir prüfen gerade sehr viele Websites. Bitte versuchen Sie es in ein paar Minuten erneut.",
    },
  },
  {
    en: "That website has been checked several times in the last hour. Please try again later.",
    t: {
      es: "Esa web se ha comprobado varias veces en la última hora. Inténtelo de nuevo más tarde.",
      fr: "Ce site a été vérifié plusieurs fois au cours de la dernière heure. Réessayez plus tard.",
      it: "Quel sito è stato controllato più volte nell’ultima ora. Riprovi più tardi.",
      de: "Diese Website wurde in der letzten Stunde mehrmals geprüft. Bitte versuchen Sie es später erneut.",
    },
  },
  {
    en: "You have used this free check many times today. Please try again tomorrow.",
    t: {
      es: "Hoy ya ha usado esta comprobación gratuita muchas veces. Inténtelo de nuevo mañana.",
      fr: "Vous avez déjà utilisé cette vérification gratuite de nombreuses fois aujourd’hui. Réessayez demain.",
      it: "Oggi ha già usato molte volte questo controllo gratuito. Riprovi domani.",
      de: "Sie haben diese kostenlose Prüfung heute schon oft genutzt. Bitte versuchen Sie es morgen erneut.",
    },
  },
  {
    en: "You have run this check several times in the last hour. Please try again later.",
    t: {
      es: "Ha hecho esta comprobación varias veces en la última hora. Inténtelo de nuevo más tarde.",
      fr: "Vous avez lancé cette vérification plusieurs fois au cours de la dernière heure. Réessayez plus tard.",
      it: "Ha eseguito questo controllo più volte nell’ultima ora. Riprovi più tardi.",
      de: "Sie haben diese Prüfung in der letzten Stunde mehrmals ausgeführt. Bitte versuchen Sie es später erneut.",
    },
  },
  {
    en: "We are checking a lot of websites right now. Please try again in a minute.",
    t: {
      es: "Estamos comprobando muchas webs en este momento. Inténtelo de nuevo en un minuto.",
      fr: "Nous vérifions beaucoup de sites en ce moment. Réessayez dans une minute.",
      it: "Stiamo controllando molti siti in questo momento. Riprovi tra un minuto.",
      de: "Wir prüfen gerade sehr viele Websites. Bitte versuchen Sie es in einer Minute erneut.",
    },
  },
  {
    en: "We are already checking that website. Refresh the page in a moment for the result.",
    t: {
      es: "Ya estamos comprobando esa web. Recargue la página en un momento para ver el resultado.",
      fr: "Nous vérifions déjà ce site. Actualisez la page dans un instant pour voir le résultat.",
      it: "Stiamo già controllando quel sito. Ricarichi la pagina tra un attimo per vedere il risultato.",
      de: "Wir prüfen diese Website bereits. Laden Sie die Seite gleich neu, um das Ergebnis zu sehen.",
    },
  },
  {
    en: "This free check is temporarily unavailable. Please try again in a few minutes.",
    t: {
      es: "Esta comprobación gratuita no está disponible temporalmente. Inténtelo de nuevo en unos minutos.",
      fr: "Cette vérification gratuite est temporairement indisponible. Réessayez dans quelques minutes.",
      it: "Questo controllo gratuito non è disponibile al momento. Riprovi tra qualche minuto.",
      de: "Diese kostenlose Prüfung ist vorübergehend nicht verfügbar. Bitte versuchen Sie es in ein paar Minuten erneut.",
    },
  },

  /* The address (lib/websites/url.ts and every check). */
  {
    en: "Enter a valid website address",
    t: {
      es: "Escriba una dirección web válida",
      fr: "Saisissez une adresse de site valide",
      it: "Inserisca un indirizzo web valido",
      de: "Geben Sie eine gültige Website-Adresse ein",
    },
  },
  {
    en: "That address is not a public website",
    t: {
      es: "Esa dirección no es una web pública",
      fr: "Cette adresse n’est pas un site public",
      it: "Quell’indirizzo non è un sito pubblico",
      de: "Diese Adresse ist keine öffentliche Website",
    },
  },
  {
    en: "Enter your own website, not a social profile",
    t: {
      es: "Escriba su propia web, no un perfil de red social",
      fr: "Saisissez votre propre site, pas un profil de réseau social",
      it: "Inserisca il suo sito, non un profilo social",
      de: "Geben Sie Ihre eigene Website ein, kein Social-Media-Profil",
    },
  },
  {
    en: "That address is not publicly reachable.",
    t: {
      es: "Esa dirección no es accesible públicamente.",
      fr: "Cette adresse n’est pas accessible publiquement.",
      it: "Quell’indirizzo non è raggiungibile pubblicamente.",
      de: "Diese Adresse ist nicht öffentlich erreichbar.",
    },
  },
  {
    en: "We could not reach that website. Check the address and try again.",
    t: {
      es: "No pudimos acceder a esa web. Revise la dirección e inténtelo de nuevo.",
      fr: "Nous n’avons pas pu joindre ce site. Vérifiez l’adresse et réessayez.",
      it: "Non siamo riusciti a raggiungere quel sito. Controlli l’indirizzo e riprovi.",
      de: "Wir konnten diese Website nicht erreichen. Prüfen Sie die Adresse und versuchen Sie es erneut.",
    },
  },
  {
    en: "We could not reach that page. Check the address and try again.",
    t: {
      es: "No pudimos acceder a esa página. Revise la dirección e inténtelo de nuevo.",
      fr: "Nous n’avons pas pu joindre cette page. Vérifiez l’adresse et réessayez.",
      it: "Non siamo riusciti a raggiungere quella pagina. Controlli l’indirizzo e riprovi.",
      de: "Wir konnten diese Seite nicht erreichen. Prüfen Sie die Adresse und versuchen Sie es erneut.",
    },
  },
  {
    en: /^That page returned (\d+) instead of loading\.$/,
    t: {
      es: "Esa página devolvió $1 en lugar de cargarse.",
      fr: "Cette page a renvoyé $1 au lieu de se charger.",
      it: "Quella pagina ha restituito $1 invece di caricarsi.",
      de: "Diese Seite lieferte $1, statt zu laden.",
    },
  },
  {
    en: /^That website returned an error \(HTTP (\d+)\) for robots\.txt\.$/,
    t: {
      es: "Esa web devolvió un error (HTTP $1) para robots.txt.",
      fr: "Ce site a renvoyé une erreur (HTTP $1) pour robots.txt.",
      it: "Quel sito ha restituito un errore (HTTP $1) per robots.txt.",
      de: "Diese Website hat für robots.txt einen Fehler gemeldet (HTTP $1).",
    },
  },
  {
    en: "We could not read any pages on that website. It may be blocking automated visitors.",
    t: {
      es: "No pudimos leer ninguna página de esa web. Puede que esté bloqueando a los visitantes automáticos.",
      fr: "Nous n’avons pu lire aucune page de ce site. Il bloque peut-être les visiteurs automatisés.",
      it: "Non siamo riusciti a leggere nessuna pagina di quel sito. Potrebbe bloccare i visitatori automatici.",
      de: "Wir konnten keine Seite dieser Website lesen. Möglicherweise blockiert sie automatisierte Besucher.",
    },
  },

  /* The meta description writer (lib/tools/description-writer.ts). */
  {
    en: "We could not write descriptions just now. Please try again.",
    t: {
      es: "No pudimos escribir las descripciones en este momento. Inténtelo de nuevo.",
      fr: "Nous n’avons pas pu rédiger les descriptions pour le moment. Réessayez.",
      it: "Al momento non siamo riusciti a scrivere le descrizioni. Riprovi.",
      de: "Wir konnten die Beschreibungen gerade nicht schreiben. Bitte versuchen Sie es erneut.",
    },
  },
  {
    en: "We are already writing descriptions for that page. Refresh in a moment.",
    t: {
      es: "Ya estamos escribiendo descripciones para esa página. Recargue en un momento.",
      fr: "Nous rédigeons déjà des descriptions pour cette page. Actualisez dans un instant.",
      it: "Stiamo già scrivendo le descrizioni per quella pagina. Ricarichi tra un attimo.",
      de: "Wir schreiben bereits Beschreibungen für diese Seite. Laden Sie gleich neu.",
    },
  },
  {
    en: "This tool is busy right now. Please try again in a few minutes.",
    t: {
      es: "Esta herramienta está ocupada en este momento. Inténtelo de nuevo en unos minutos.",
      fr: "Cet outil est très sollicité en ce moment. Réessayez dans quelques minutes.",
      it: "Questo strumento è occupato in questo momento. Riprovi tra qualche minuto.",
      de: "Dieses Werkzeug ist gerade ausgelastet. Bitte versuchen Sie es in ein paar Minuten erneut.",
    },
  },
  {
    en: "You have written several sets of descriptions recently. Please try again later.",
    t: {
      es: "Ha escrito varias series de descripciones hace poco. Inténtelo de nuevo más tarde.",
      fr: "Vous avez rédigé plusieurs séries de descriptions récemment. Réessayez plus tard.",
      it: "Ha scritto diverse serie di descrizioni di recente. Riprovi più tardi.",
      de: "Sie haben in letzter Zeit mehrere Sätze von Beschreibungen schreiben lassen. Bitte versuchen Sie es später erneut.",
    },
  },
  {
    en: "This tool is temporarily unavailable. Please try again later.",
    t: {
      es: "Esta herramienta no está disponible temporalmente. Inténtelo de nuevo más tarde.",
      fr: "Cet outil est temporairement indisponible. Réessayez plus tard.",
      it: "Questo strumento non è disponibile al momento. Riprovi più tardi.",
      de: "Dieses Werkzeug ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.",
    },
  },
  {
    en: "There is not enough text on that page to write from. Try a page with more content.",
    t: {
      es: "No hay suficiente texto en esa página para escribir a partir de él. Pruebe con una página con más contenido.",
      fr: "Il n’y a pas assez de texte sur cette page pour rédiger. Essayez une page plus fournie.",
      it: "Su quella pagina non c’è abbastanza testo da cui partire. Provi con una pagina con più contenuti.",
      de: "Auf dieser Seite steht nicht genug Text, um daraus zu schreiben. Versuchen Sie eine Seite mit mehr Inhalt.",
    },
  },

  /* Sitemaps (lib/tools/sitemap.ts). */
  {
    en: "Not a public web address.",
    t: { es: "No es una dirección web pública.", fr: "Ce n’est pas une adresse web publique.", it: "Non è un indirizzo web pubblico.", de: "Keine öffentliche Webadresse." },
  },
  { en: "Could not be reached.", t: { es: "No se pudo acceder.", fr: "Inaccessible.", it: "Non raggiungibile.", de: "Nicht erreichbar." } },
  {
    en: "Took longer than 15 seconds to load. Search engines may give up on it too.",
    t: {
      es: "Tardó más de 15 segundos en cargarse. Los buscadores también podrían dejar de intentarlo.",
      fr: "Le chargement a pris plus de 15 secondes. Les moteurs de recherche risquent aussi d’abandonner.",
      it: "Ha impiegato più di 15 secondi a caricarsi. Anche i motori di ricerca potrebbero rinunciare.",
      de: "Das Laden dauerte länger als 15 Sekunden. Auch Suchmaschinen könnten aufgeben.",
    },
  },
  {
    en: /^Returns (\d+) instead of loading\.$/,
    t: { es: "Devuelve $1 en lugar de cargarse.", fr: "Renvoie $1 au lieu de se charger.", it: "Restituisce $1 invece di caricarsi.", de: "Liefert $1, statt zu laden." },
  },
  {
    en: "This is a web page, not a sitemap.",
    t: { es: "Es una página web, no un sitemap.", fr: "C’est une page web, pas un sitemap.", it: "È una pagina web, non una sitemap.", de: "Das ist eine Webseite, keine Sitemap." },
  },
  {
    en: "No URLs found in the file.",
    t: {
      es: "No se encontró ninguna URL en el archivo.",
      fr: "Aucune URL trouvée dans le fichier.",
      it: "Nessun URL trovato nel file.",
      de: "In der Datei wurden keine URLs gefunden.",
    },
  },

  /* Meta tags (lib/tools/meta-tags.ts): headings, labels, notes. */
  { en: "Search engines", t: { es: "Buscadores", fr: "Moteurs de recherche", it: "Motori di ricerca", de: "Suchmaschinen" } },
  {
    en: "Sharing (Open Graph)",
    t: { es: "Al compartir (Open Graph)", fr: "Partage (Open Graph)", it: "Condivisione (Open Graph)", de: "Teilen (Open Graph)" },
  },
  {
    en: "Sharing (X / Twitter)",
    t: { es: "Al compartir (X / Twitter)", fr: "Partage (X / Twitter)", it: "Condivisione (X / Twitter)", de: "Teilen (X / Twitter)" },
  },
  { en: "Page title", t: { es: "Título de la página", fr: "Titre de la page", it: "Titolo della pagina", de: "Seitentitel" } },
  { en: "Meta description", t: { es: "Meta descripción", fr: "Meta description", it: "Meta description", de: "Meta-Beschreibung" } },
  { en: "Canonical URL", t: { es: "URL canónica", fr: "URL canonique", it: "URL canonico", de: "Kanonische URL" } },
  { en: "Language", t: { es: "Idioma", fr: "Langue", it: "Lingua", de: "Sprache" } },
  { en: "Robots directive", t: { es: "Directiva para robots", fr: "Directive robots", it: "Direttiva robots", de: "Robots-Anweisung" } },
  { en: "Viewport", t: { es: "Viewport", fr: "Viewport", it: "Viewport", de: "Viewport" } },
  {
    en: /^(\d+) characters - will be cut short at about (\d+)\.$/,
    t: {
      es: "$1 caracteres: se cortará hacia los $2.",
      fr: "$1 caractères : sera coupé vers $2.",
      it: "$1 caratteri: verrà troncato intorno ai $2.",
      de: "$1 Zeichen: wird bei etwa $2 abgeschnitten.",
    },
  },
  {
    en: /^Only (\d+) characters\. There is room to say more\.$/,
    t: {
      es: "Solo $1 caracteres. Hay espacio para decir más.",
      fr: "Seulement $1 caractères. Il reste de la place pour en dire plus.",
      it: "Solo $1 caratteri. C’è spazio per dire di più.",
      de: "Nur $1 Zeichen. Es ist Platz für mehr.",
    },
  },
  {
    en: "Add a title. It is the headline people see in search results.",
    t: {
      es: "Añada un título. Es el titular que la gente ve en los resultados de búsqueda.",
      fr: "Ajoutez un titre. C’est le titre que les gens voient dans les résultats de recherche.",
      it: "Aggiunga un titolo. È il titolo che le persone vedono nei risultati di ricerca.",
      de: "Fügen Sie einen Titel hinzu. Das ist die Überschrift, die Menschen in den Suchergebnissen sehen.",
    },
  },
  {
    en: "Without one, Google picks a sentence from the page - often the wrong one.",
    t: {
      es: "Sin ella, Google elige una frase de la página, a menudo la equivocada.",
      fr: "Sans elle, Google choisit une phrase de la page, souvent la mauvaise.",
      it: "Senza, Google sceglie una frase dalla pagina, spesso quella sbagliata.",
      de: "Ohne sie wählt Google einen Satz von der Seite, oft den falschen.",
    },
  },
  {
    en: "Tells search engines which address is the real one when a page is reachable more than one way.",
    t: {
      es: "Indica a los buscadores cuál es la dirección real cuando a una página se puede llegar de varias formas.",
      fr: "Indique aux moteurs de recherche quelle est la vraie adresse quand une page est accessible de plusieurs façons.",
      it: "Indica ai motori di ricerca qual è l’indirizzo vero quando una pagina è raggiungibile in più modi.",
      de: "Sagt Suchmaschinen, welche Adresse die echte ist, wenn eine Seite auf mehreren Wegen erreichbar ist.",
    },
  },
  {
    en: "Helps search engines serve your pages to the right people.",
    t: {
      es: "Ayuda a los buscadores a mostrar sus páginas a las personas adecuadas.",
      fr: "Aide les moteurs de recherche à montrer vos pages aux bonnes personnes.",
      it: "Aiuta i motori di ricerca a mostrare le sue pagine alle persone giuste.",
      de: "Hilft Suchmaschinen, Ihre Seiten den richtigen Menschen zu zeigen.",
    },
  },
  {
    en: "This page asks search engines not to index it. Deliberate on a staging site; serious on a live one.",
    t: {
      es: "Esta página pide a los buscadores que no la indexen. Es intencionado en una web de pruebas; grave en una web publicada.",
      fr: "Cette page demande aux moteurs de recherche de ne pas l’indexer. Volontaire sur un site de test ; grave sur un site en ligne.",
      it: "Questa pagina chiede ai motori di ricerca di non indicizzarla. Voluto su un sito di prova; grave su un sito online.",
      de: "Diese Seite bittet Suchmaschinen, sie nicht zu indexieren. Auf einer Testseite gewollt, auf einer Live-Website ernst.",
    },
  },
  {
    en: "Without it the page renders at desktop width on phones, which Google treats as not mobile friendly.",
    t: {
      es: "Sin ella, la página se muestra con ancho de escritorio en los móviles, y Google la considera no apta para móviles.",
      fr: "Sans elle, la page s’affiche en largeur d’ordinateur sur les téléphones, ce que Google considère comme non adapté aux mobiles.",
      it: "Senza, la pagina viene mostrata in larghezza desktop sui telefoni, e Google la considera non ottimizzata per i dispositivi mobili.",
      de: "Ohne es wird die Seite auf Smartphones in Desktop-Breite dargestellt, was Google als nicht mobilfreundlich wertet.",
    },
  },
  {
    en: "Falls back to the page title when shared.",
    t: {
      es: "Al compartir, se usa el título de la página.",
      fr: "À défaut, le titre de la page est utilisé lors du partage.",
      it: "In sua assenza, alla condivisione si usa il titolo della pagina.",
      de: "Beim Teilen wird ersatzweise der Seitentitel verwendet.",
    },
  },
  {
    en: "Falls back to the meta description when shared.",
    t: {
      es: "Al compartir, se usa la meta descripción.",
      fr: "À défaut, la meta description est utilisée lors du partage.",
      it: "In sua assenza, alla condivisione si usa la meta description.",
      de: "Beim Teilen wird ersatzweise die Meta-Beschreibung verwendet.",
    },
  },
  {
    en: "Without this your link shares as a grey box. The single highest-impact tag here.",
    t: {
      es: "Sin ella, su enlace se comparte como un recuadro gris. Es la etiqueta de más impacto de esta lista.",
      fr: "Sans elle, votre lien s’affiche comme un cadre gris lors du partage. C’est la balise la plus importante de cette liste.",
      it: "Senza, il suo link viene condiviso come un riquadro grigio. È il tag di maggiore impatto di questo elenco.",
      de: "Ohne dieses Tag wird Ihr Link als graues Feld geteilt. Das wirkungsvollste Tag in dieser Liste.",
    },
  },
  {
    en: 'Usually "website" or "article".',
    t: { es: "Normalmente «website» o «article».", fr: "Généralement « website » ou « article ».", it: "Di solito «website» o «article».", de: "Meist „website“ oder „article“." },
  },
  {
    en: "The canonical address for the shared link.",
    t: {
      es: "La dirección canónica del enlace compartido.",
      fr: "L’adresse canonique du lien partagé.",
      it: "L’indirizzo canonico del link condiviso.",
      de: "Die kanonische Adresse des geteilten Links.",
    },
  },
  {
    en: 'Set "summary_large_image" for a full-width preview instead of a thumbnail.',
    t: {
      es: "Ponga «summary_large_image» para una vista previa a todo lo ancho en lugar de una miniatura.",
      fr: "Indiquez « summary_large_image » pour un aperçu pleine largeur au lieu d’une vignette.",
      it: "Imposti «summary_large_image» per un’anteprima a tutta larghezza invece di una miniatura.",
      de: "Setzen Sie „summary_large_image“ für eine Vorschau in voller Breite statt eines kleinen Vorschaubilds.",
    },
  },
  {
    en: "Falls back to og:title.",
    t: { es: "Se usa og:title en su lugar.", fr: "À défaut, og:title est utilisé.", it: "In sua assenza si usa og:title.", de: "Ersatzweise wird og:title verwendet." },
  },
  {
    en: "Falls back to og:image.",
    t: { es: "Se usa og:image en su lugar.", fr: "À défaut, og:image est utilisé.", it: "In sua assenza si usa og:image.", de: "Ersatzweise wird og:image verwendet." },
  },
];

/** A check's English message in the visitor's language; an unknown one is returned as it is. */
export function localizeToolMessage(text: string, locale: Locale): string {
  if (locale === "en") return text;
  for (const entry of ENTRIES) {
    if (typeof entry.en === "string") {
      if (text === entry.en) return entry.t[locale];
      continue;
    }
    const match = entry.en.exec(text);
    if (match) return entry.t[locale].replace(/\$(\d)/g, (_, index: string) => match[Number(index)] ?? "");
  }
  return text;
}
