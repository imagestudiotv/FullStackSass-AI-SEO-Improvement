import type { Locale } from "@/lib/i18n/config";

/**
 * The Meta Description Generator's words in five languages. The title is the
 * registry's. The descriptions themselves are written in the page's own
 * language (lib/tools/description-writer.ts).
 */
export type MetaDescriptionCopy = {
  metaDescription: string;
  description: string;
  submit: string;
  pending: string;
  fieldLabel: string;
  placeholder: string;
  couldNotWrite: string;
  currently: string;
  /** [one, other], with {count}. */
  chars: [string, string];
  noDescription: string;
  suggestions: string;
  /** Appended to the character count; {min}, {max}. */
  outsideRange: string;
  copy: string;
  intro: string;
  /** Bodies take {min} and {max}. */
  explainer: { heading: string; body: string }[];
  ctaHeadline: string;
  ctaBody: string;
};

export const META_DESCRIPTION_COPY: Record<Locale, MetaDescriptionCopy> = {
  en: {
    metaDescription: "Five meta descriptions written from your actual page content, each with a reason to click. Free, no signup.",
    description:
      "Reads your page first, then writes five descriptions from what is actually on it. Each one is checked against the length Google truncates at, so none of them get cut off mid-sentence.",
    submit: "Write descriptions",
    pending: "Reading your page…",
    fieldLabel: "Page address",
    placeholder: "yourwebsite.com/page",
    couldNotWrite: "We could not write descriptions",
    currently: "Currently",
    chars: ["{count} character", "{count} characters"],
    noDescription: "This page has no meta description. Google is picking a sentence from the page itself - often the wrong one.",
    suggestions: "Suggestions",
    outsideRange: " - outside the {min}–{max} range Google shows",
    copy: "Copy",
    intro:
      "A meta description does not affect ranking. It affects whether anyone clicks the ranking you already have, which is usually the cheaper thing to fix.",
    explainer: [
      {
        heading: "How this works",
        body: "We fetch your page and read its actual text, then write five descriptions from it, each taking a different angle. Length is enforced in our own code afterwards rather than trusted to the model - {min} to {max} characters, which is what Google shows before truncating.",
      },
      {
        heading: "Read them before you use them",
        body: "These are written from your page, but they are still written by a model, and it does not know which claims you can stand behind. Check anything specific - a guarantee, a number, a service you may not offer any more - before it becomes the sentence a stranger reads about your business.",
      },
    ],
    ctaHeadline: "Descriptions win clicks. Content wins rankings.",
    ctaBody: "RepGet writes the pages that rank, then keeps their titles and descriptions right automatically.",
  },
  es: {
    metaDescription:
      "Cinco meta descripciones escritas a partir del contenido real de su página, cada una con un motivo para hacer clic. Gratis, sin registro.",
    description:
      "Primero lee su página y después escribe cinco descripciones a partir de lo que realmente contiene. Cada una se comprueba frente a la longitud a la que Google corta, para que ninguna quede cortada a mitad de frase.",
    submit: "Escribir descripciones",
    pending: "Leyendo su página…",
    fieldLabel: "Dirección de la página",
    placeholder: "suweb.com/pagina",
    couldNotWrite: "No pudimos escribir las descripciones",
    currently: "Actualmente",
    chars: ["{count} carácter", "{count} caracteres"],
    noDescription: "Esta página no tiene meta descripción. Google está eligiendo una frase de la propia página, a menudo la equivocada.",
    suggestions: "Sugerencias",
    outsideRange: ": fuera del intervalo de {min} a {max} que muestra Google",
    copy: "Copiar",
    intro:
      "Una meta descripción no afecta al posicionamiento. Afecta a que alguien haga clic en la posición que ya tiene, que suele ser lo más barato de mejorar.",
    explainer: [
      {
        heading: "Cómo funciona",
        body: "Descargamos su página y leemos su texto real, y después escribimos cinco descripciones a partir de él, cada una con un enfoque distinto. La longitud la impone después nuestro propio código, sin fiarnos del modelo: de {min} a {max} caracteres, que es lo que Google muestra antes de cortar.",
      },
      {
        heading: "Léalas antes de usarlas",
        body: "Están escritas a partir de su página, pero las escribe un modelo, y no sabe qué afirmaciones puede usted respaldar. Revise todo lo concreto (una garantía, una cifra, un servicio que quizá ya no ofrezca) antes de que se convierta en la frase que un desconocido lee sobre su negocio.",
      },
    ],
    ctaHeadline: "Las descripciones ganan clics. El contenido gana posiciones.",
    ctaBody: "RepGet escribe las páginas que se posicionan y después mantiene al día sus títulos y descripciones automáticamente.",
  },
  fr: {
    metaDescription:
      "Cinq meta descriptions rédigées à partir du contenu réel de votre page, chacune avec une raison de cliquer. Gratuit, sans inscription.",
    description:
      "Lit d’abord votre page, puis rédige cinq descriptions à partir de ce qu’elle contient vraiment. Chacune est vérifiée par rapport à la longueur à laquelle Google tronque, pour qu’aucune ne soit coupée en pleine phrase.",
    submit: "Rédiger les descriptions",
    pending: "Lecture de votre page…",
    fieldLabel: "Adresse de la page",
    placeholder: "votresite.fr/page",
    couldNotWrite: "Nous n’avons pas pu rédiger les descriptions",
    currently: "Actuellement",
    chars: ["{count} caractère", "{count} caractères"],
    noDescription: "Cette page n’a pas de meta description. Google choisit une phrase de la page elle-même, souvent la mauvaise.",
    suggestions: "Suggestions",
    outsideRange: " : hors de la plage de {min} à {max} caractères affichée par Google",
    copy: "Copier",
    intro:
      "Une meta description n’influe pas sur le classement. Elle influe sur le fait qu’on clique sur la position que vous avez déjà, ce qui est généralement le moins coûteux à améliorer.",
    explainer: [
      {
        heading: "Comment ça marche",
        body: "Nous récupérons votre page et lisons son vrai texte, puis rédigeons cinq descriptions à partir de celui-ci, chacune sous un angle différent. La longueur est imposée ensuite par notre propre code plutôt que confiée au modèle : de {min} à {max} caractères, ce que Google affiche avant de tronquer.",
      },
      {
        heading: "Relisez-les avant de les utiliser",
        body: "Elles sont rédigées à partir de votre page, mais par un modèle, qui ne sait pas quelles affirmations vous pouvez assumer. Vérifiez tout élément précis (une garantie, un chiffre, un service que vous ne proposez peut-être plus) avant qu’il ne devienne la phrase qu’un inconnu lit sur votre entreprise.",
      },
    ],
    ctaHeadline: "Les descriptions gagnent des clics. Le contenu gagne des positions.",
    ctaBody: "RepGet rédige les pages qui se positionnent, puis tient automatiquement leurs titres et descriptions à jour.",
  },
  it: {
    metaDescription: "Cinque meta description scritte dal contenuto reale della sua pagina, ognuna con un motivo per cliccare. Gratis, senza registrazione.",
    description:
      "Prima legge la sua pagina, poi scrive cinque descrizioni a partire da ciò che contiene davvero. Ognuna viene verificata rispetto alla lunghezza a cui Google tronca, così nessuna viene tagliata a metà frase.",
    submit: "Scrivi le descrizioni",
    pending: "Lettura della pagina in corso…",
    fieldLabel: "Indirizzo della pagina",
    placeholder: "ilsuosito.it/pagina",
    couldNotWrite: "Non siamo riusciti a scrivere le descrizioni",
    currently: "Attualmente",
    chars: ["{count} carattere", "{count} caratteri"],
    noDescription: "Questa pagina non ha una meta description. Google sta scegliendo una frase dalla pagina stessa, spesso quella sbagliata.",
    suggestions: "Suggerimenti",
    outsideRange: ": fuori dall’intervallo da {min} a {max} caratteri mostrato da Google",
    copy: "Copia",
    intro:
      "Una meta description non influisce sul posizionamento. Influisce sul fatto che qualcuno clicchi sulla posizione che ha già, che di solito è la cosa più economica da migliorare.",
    explainer: [
      {
        heading: "Come funziona",
        body: "Scarichiamo la sua pagina e ne leggiamo il testo reale, poi scriviamo cinque descrizioni a partire da quello, ognuna con un taglio diverso. La lunghezza viene imposta dopo dal nostro codice invece di affidarla al modello: da {min} a {max} caratteri, ciò che Google mostra prima di troncare.",
      },
      {
        heading: "Le legga prima di usarle",
        body: "Sono scritte a partire dalla sua pagina, ma da un modello, che non sa quali affermazioni lei può sostenere. Controlli ogni dettaglio specifico (una garanzia, un numero, un servizio che forse non offre più) prima che diventi la frase che uno sconosciuto legge sulla sua attività.",
      },
    ],
    ctaHeadline: "Le descrizioni portano clic. I contenuti portano posizionamenti.",
    ctaBody: "RepGet scrive le pagine che si posizionano, poi mantiene automaticamente corretti titoli e descrizioni.",
  },
  de: {
    metaDescription: "Fünf Meta-Beschreibungen, geschrieben aus dem echten Inhalt Ihrer Seite, jede mit einem Grund zum Klicken. Kostenlos, ohne Anmeldung.",
    description:
      "Liest zuerst Ihre Seite und schreibt dann fünf Beschreibungen aus dem, was wirklich darauf steht. Jede wird gegen die Länge geprüft, bei der Google abschneidet, sodass keine mitten im Satz abbricht.",
    submit: "Beschreibungen schreiben",
    pending: "Ihre Seite wird gelesen…",
    fieldLabel: "Adresse der Seite",
    placeholder: "ihrewebsite.de/seite",
    couldNotWrite: "Wir konnten keine Beschreibungen schreiben",
    currently: "Derzeit",
    chars: ["{count} Zeichen", "{count} Zeichen"],
    noDescription: "Diese Seite hat keine Meta-Beschreibung. Google wählt einen Satz von der Seite selbst, oft den falschen.",
    suggestions: "Vorschläge",
    outsideRange: ": außerhalb der {min}–{max} Zeichen, die Google anzeigt",
    copy: "Kopieren",
    intro:
      "Eine Meta-Beschreibung beeinflusst nicht das Ranking. Sie beeinflusst, ob jemand auf das Ranking klickt, das Sie schon haben, und das lässt sich meist günstiger verbessern.",
    explainer: [
      {
        heading: "So funktioniert es",
        body: "Wir laden Ihre Seite, lesen ihren echten Text und schreiben daraus fünf Beschreibungen, jede aus einem anderen Blickwinkel. Die Länge setzt anschließend unser eigener Code durch, statt sie dem Modell zu überlassen: {min} bis {max} Zeichen, so viel zeigt Google, bevor gekürzt wird.",
      },
      {
        heading: "Lesen Sie sie, bevor Sie sie verwenden",
        body: "Sie sind aus Ihrer Seite geschrieben, aber von einem Modell, und das weiß nicht, für welche Aussagen Sie einstehen können. Prüfen Sie alles Konkrete (eine Garantie, eine Zahl, eine Leistung, die Sie vielleicht nicht mehr anbieten), bevor es der Satz wird, den ein Fremder über Ihr Unternehmen liest.",
      },
    ],
    ctaHeadline: "Beschreibungen bringen Klicks. Inhalte bringen Rankings.",
    ctaBody: "RepGet schreibt die Seiten, die ranken, und hält ihre Titel und Beschreibungen automatisch aktuell.",
  },
};
