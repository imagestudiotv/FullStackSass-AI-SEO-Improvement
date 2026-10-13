import type { Locale } from "@/lib/i18n/config";

/**
 * The llms.txt Generator's words in five languages. The title is the
 * registry's. The generated file itself is built from the visitor's own
 * pages, in whatever language they are written.
 */
export type LlmsTxtCopy = {
  metaDescription: string;
  description: string;
  submit: string;
  pending: string;
  couldNotRead: string;
  yourFile: string;
  /** [one, other], with {count}. */
  builtFrom: [string, string];
  /** "{saveAsBefore} /llms.txt {saveAsAfter}" */
  saveAsBefore: string;
  saveAsAfter: string;
  copyFile: string;
  whereTitle: string;
  /** "{whereBefore} <path>{whereAfter}" - whereAfter starts with its own punctuation. */
  whereBefore: string;
  whereAfter: string;
  intro: string;
  explainer: { heading: string; body: string }[];
  ctaHeadline: string;
  ctaBody: string;
};

export const LLMS_TXT_COPY: Record<Locale, LlmsTxtCopy> = {
  en: {
    metaDescription: "Generate a valid llms.txt from your live site - built from a real crawl of your pages, not a template. Free, no signup.",
    description:
      "Reads your site and writes an llms.txt from what is actually there - your real pages, with their real descriptions. Not a template with your domain pasted in.",
    submit: "Generate llms.txt",
    pending: "Reading your site…",
    couldNotRead: "We could not read that website",
    yourFile: "Your llms.txt",
    builtFrom: ["Built from {count} page.", "Built from {count} pages."],
    saveAsBefore: "Save this as",
    saveAsAfter: "at the root of your site.",
    copyFile: "Copy file",
    whereTitle: "Where to put it",
    whereBefore: "It belongs at",
    whereAfter: ". On most hosts that means dropping the file in your public or static folder - the same place robots.txt lives.",
    intro:
      "llms.txt is a proposed convention: a short markdown file telling an AI assistant what your site is and which pages matter, so it does not have to work that out from your navigation.",
    explainer: [
      {
        heading: "How this is built",
        body: 'We crawl up to a dozen pages of your site, take the name and summary from your homepage, then list your real pages with the descriptions you already wrote for them. Titles have the trailing brand name trimmed, because "Pricing | Acme" reads worse in a list than "Pricing".',
      },
      {
        heading: "Is this a standard?",
        body: "Not yet - it is a proposal that some tools have started reading, and adoption is genuinely uneven. It costs one small file to add and nothing breaks if nobody reads it. Worth doing on that basis, and worth being honest that it is not the reason assistants will start recommending you.",
      },
    ],
    ctaHeadline: "A file helps. Content is what gets cited.",
    ctaBody: "RepGet tracks whether assistants name your business, and writes the pages that make them.",
  },
  es: {
    metaDescription:
      "Genere un llms.txt válido a partir de su web publicada, creado con un rastreo real de sus páginas y no con una plantilla. Gratis, sin registro.",
    description:
      "Lee su web y escribe un llms.txt a partir de lo que realmente hay: sus páginas reales, con sus descripciones reales. No es una plantilla con su dominio pegado.",
    submit: "Generar llms.txt",
    pending: "Leyendo su web…",
    couldNotRead: "No pudimos leer esa web",
    yourFile: "Su llms.txt",
    builtFrom: ["Creado a partir de {count} página.", "Creado a partir de {count} páginas."],
    saveAsBefore: "Guárdelo como",
    saveAsAfter: "en la raíz de su web.",
    copyFile: "Copiar archivo",
    whereTitle: "Dónde ponerlo",
    whereBefore: "Debe estar en",
    whereAfter: ". En la mayoría de los hostings, eso significa dejar el archivo en la carpeta pública o de archivos estáticos, el mismo sitio donde está robots.txt.",
    intro:
      "llms.txt es una convención propuesta: un breve archivo markdown que le dice a un asistente de IA qué es su web y qué páginas importan, para que no tenga que deducirlo de su menú.",
    explainer: [
      {
        heading: "Cómo se crea",
        body: "Rastreamos hasta una docena de páginas de su web, tomamos el nombre y el resumen de su página de inicio y después listamos sus páginas reales con las descripciones que usted ya escribió para ellas. A los títulos se les quita el nombre de la marca del final, porque en una lista «Precios | Acme» se lee peor que «Precios».",
      },
      {
        heading: "¿Es un estándar?",
        body: "Todavía no: es una propuesta que algunas herramientas han empezado a leer, y su adopción es realmente desigual. Añadirlo cuesta un pequeño archivo y no se rompe nada si nadie lo lee. Merece la pena por eso, y conviene ser sinceros: no es la razón por la que los asistentes empezarán a recomendarle.",
      },
    ],
    ctaHeadline: "Un archivo ayuda. Lo que se cita es el contenido.",
    ctaBody: "RepGet sigue si los asistentes nombran a su negocio y escribe las páginas que hacen que lo nombren.",
  },
  fr: {
    metaDescription:
      "Générez un llms.txt valide depuis votre site en ligne, construit à partir d’une vraie exploration de vos pages, pas d’un modèle. Gratuit, sans inscription.",
    description:
      "Lit votre site et rédige un llms.txt à partir de ce qui s’y trouve vraiment : vos vraies pages, avec leurs vraies descriptions. Pas un modèle dans lequel on a collé votre domaine.",
    submit: "Générer le llms.txt",
    pending: "Lecture de votre site…",
    couldNotRead: "Nous n’avons pas pu lire ce site",
    yourFile: "Votre llms.txt",
    builtFrom: ["Construit à partir de {count} page.", "Construit à partir de {count} pages."],
    saveAsBefore: "Enregistrez-le sous",
    saveAsAfter: "à la racine de votre site.",
    copyFile: "Copier le fichier",
    whereTitle: "Où le placer",
    whereBefore: "Il doit se trouver à l’adresse",
    whereAfter: ". Chez la plupart des hébergeurs, il suffit de déposer le fichier dans le dossier public ou statique, au même endroit que le robots.txt.",
    intro:
      "Le llms.txt est une convention proposée : un court fichier markdown qui dit à un assistant d’IA ce qu’est votre site et quelles pages comptent, pour qu’il n’ait pas à le deviner à partir de votre menu.",
    explainer: [
      {
        heading: "Comment il est construit",
        body: "Nous explorons jusqu’à une douzaine de pages de votre site, prenons le nom et le résumé de votre page d’accueil, puis listons vos vraies pages avec les descriptions que vous avez déjà rédigées. Le nom de la marque est retiré de la fin des titres, car « Tarifs | Acme » se lit moins bien dans une liste que « Tarifs ».",
      },
      {
        heading: "Est-ce un standard ?",
        body: "Pas encore : c’est une proposition que certains outils ont commencé à lire, et son adoption est vraiment inégale. L’ajouter coûte un petit fichier, et rien ne casse si personne ne le lit. Cela vaut la peine pour cette raison, et il faut être honnête : ce n’est pas ce qui poussera les assistants à vous recommander.",
      },
    ],
    ctaHeadline: "Un fichier aide. C’est le contenu qui est cité.",
    ctaBody: "RepGet suit si les assistants citent votre entreprise, et rédige les pages qui les y amènent.",
  },
  it: {
    metaDescription:
      "Generi un llms.txt valido dal suo sito online, costruito da una vera scansione delle sue pagine, non da un modello. Gratis, senza registrazione.",
    description:
      "Legge il suo sito e scrive un llms.txt a partire da ciò che c’è davvero: le sue pagine reali, con le loro descrizioni reali. Non un modello con il suo dominio incollato dentro.",
    submit: "Genera llms.txt",
    pending: "Lettura del sito in corso…",
    couldNotRead: "Non siamo riusciti a leggere quel sito",
    yourFile: "Il suo llms.txt",
    builtFrom: ["Creato da {count} pagina.", "Creato da {count} pagine."],
    saveAsBefore: "Lo salvi come",
    saveAsAfter: "nella cartella principale del suo sito.",
    copyFile: "Copia il file",
    whereTitle: "Dove metterlo",
    whereBefore: "Va messo all’indirizzo",
    whereAfter: ". Sulla maggior parte degli hosting basta mettere il file nella cartella pubblica o statica, la stessa in cui si trova il robots.txt.",
    intro:
      "llms.txt è una convenzione proposta: un breve file markdown che dice a un assistente AI cos’è il suo sito e quali pagine contano, così non deve dedurlo dal menu.",
    explainer: [
      {
        heading: "Come viene creato",
        body: "Scansioniamo fino a una dozzina di pagine del suo sito, prendiamo nome e descrizione dalla home page, poi elenchiamo le sue pagine reali con le descrizioni che ha già scritto. Ai titoli viene tolto il nome del brand in fondo, perché in un elenco «Prezzi | Acme» si legge peggio di «Prezzi».",
      },
      {
        heading: "È uno standard?",
        body: "Non ancora: è una proposta che alcuni strumenti hanno iniziato a leggere, e la sua adozione è davvero disomogenea. Aggiungerlo costa un piccolo file e non si rompe nulla se nessuno lo legge. Vale la pena per questo, ed è giusto essere sinceri: non è il motivo per cui gli assistenti inizieranno a consigliarla.",
      },
    ],
    ctaHeadline: "Un file aiuta. Sono i contenuti a essere citati.",
    ctaBody: "RepGet controlla se gli assistenti nominano la sua attività e scrive le pagine che li portano a farlo.",
  },
  de: {
    metaDescription:
      "Erstellen Sie eine gültige llms.txt aus Ihrer Live-Website, aufgebaut aus einem echten Crawl Ihrer Seiten, nicht aus einer Vorlage. Kostenlos, ohne Anmeldung.",
    description:
      "Liest Ihre Website und schreibt eine llms.txt aus dem, was wirklich da ist: Ihre echten Seiten mit ihren echten Beschreibungen. Keine Vorlage, in die Ihre Domain eingefügt wurde.",
    submit: "llms.txt erstellen",
    pending: "Ihre Website wird gelesen…",
    couldNotRead: "Wir konnten diese Website nicht lesen",
    yourFile: "Ihre llms.txt",
    builtFrom: ["Erstellt aus {count} Seite.", "Erstellt aus {count} Seiten."],
    saveAsBefore: "Speichern Sie sie als",
    saveAsAfter: "im Stammverzeichnis Ihrer Website.",
    copyFile: "Datei kopieren",
    whereTitle: "Wohin damit",
    whereBefore: "Sie gehört nach",
    whereAfter: ". Bei den meisten Hostern heißt das: die Datei in den öffentlichen oder statischen Ordner legen, dorthin, wo auch die robots.txt liegt.",
    intro:
      "llms.txt ist eine vorgeschlagene Konvention: eine kurze Markdown-Datei, die einem KI-Assistenten sagt, was Ihre Website ist und welche Seiten zählen, damit er das nicht aus Ihrer Navigation ableiten muss.",
    explainer: [
      {
        heading: "Wie sie entsteht",
        body: "Wir crawlen bis zu ein Dutzend Seiten Ihrer Website, übernehmen Name und Zusammenfassung von Ihrer Startseite und listen dann Ihre echten Seiten mit den Beschreibungen auf, die Sie bereits für sie geschrieben haben. Der Markenname am Ende von Titeln wird entfernt, denn „Preise | Acme“ liest sich in einer Liste schlechter als „Preise“.",
      },
      {
        heading: "Ist das ein Standard?",
        body: "Noch nicht: Es ist ein Vorschlag, den einige Werkzeuge zu lesen begonnen haben, und die Verbreitung ist wirklich uneinheitlich. Es kostet eine kleine Datei, und nichts geht kaputt, wenn niemand sie liest. Deshalb lohnt es sich, und ehrlicherweise: Es ist nicht der Grund, warum Assistenten Sie empfehlen werden.",
      },
    ],
    ctaHeadline: "Eine Datei hilft. Zitiert werden Inhalte.",
    ctaBody: "RepGet verfolgt, ob Assistenten Ihr Unternehmen nennen, und schreibt die Seiten, die dafür sorgen.",
  },
};
