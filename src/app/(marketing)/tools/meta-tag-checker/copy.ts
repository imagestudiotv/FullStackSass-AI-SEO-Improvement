import type { Locale } from "@/lib/i18n/config";

/** The Meta Tag Checker's words in five languages. The title is the registry's; tag labels and notes come from the check (lib/tools/i18n/messages.ts). */
export type MetaTagsCopy = {
  metaDescription: string;
  description: string;
  submit: string;
  fieldLabel: string;
  placeholder: string;
  couldNotCheck: string;
  good: string;
  warn: string;
  missing: string;
  notSet: string;
  intro: string;
  explainer: { heading: string; body: string }[];
  ctaHeadline: string;
  ctaBody: string;
};

export const META_TAGS_COPY: Record<Locale, MetaTagsCopy> = {
  en: {
    metaDescription:
      "Check every meta tag Google and the social networks read on your page - titles, descriptions, Open Graph and Twitter cards. Free, no signup.",
    description:
      "Reads every tag Google and the social networks actually use on your page, and tells you which are missing, which are the wrong length, and what each one does.",
    submit: "Check meta tags",
    fieldLabel: "Page address",
    placeholder: "yourwebsite.com/page",
    couldNotCheck: "We could not check that page",
    good: "Good",
    warn: "Needs attention",
    missing: "Missing",
    notSet: "Not set",
    intro:
      "Meta tags are what search engines and social networks read instead of looking at your page. They decide what your result says on Google and what your link looks like when somebody shares it.",
    explainer: [
      {
        heading: "What this checks",
        body: "Fourteen tags in three groups: the ones search engines read (title, description, canonical, language, robots, viewport), the Open Graph tags Facebook, LinkedIn, Slack and WhatsApp read, and the Twitter card tags. Lengths are checked against what Google actually truncates, not round numbers.",
      },
      {
        heading: "The one people miss",
        body: "og:image. Without it your link shares as a grey box on every platform, and you only find out after somebody posts it - by which point the post is already up and getting the clicks it was going to get. It costs nothing to set and it is the single highest-impact tag on this list.",
      },
    ],
    ctaHeadline: "Meta tags are the easy half",
    ctaBody: "RepGet checks these across your whole site automatically, then writes the pages that earn the clicks.",
  },
  es: {
    metaDescription:
      "Compruebe todas las metaetiquetas que leen Google y las redes sociales en su página: títulos, descripciones, Open Graph y tarjetas de Twitter. Gratis, sin registro.",
    description:
      "Lee todas las etiquetas que Google y las redes sociales usan realmente en su página y le dice cuáles faltan, cuáles tienen una longitud incorrecta y para qué sirve cada una.",
    submit: "Comprobar metaetiquetas",
    fieldLabel: "Dirección de la página",
    placeholder: "suweb.com/pagina",
    couldNotCheck: "No pudimos comprobar esa página",
    good: "Bien",
    warn: "Requieren atención",
    missing: "Faltan",
    notSet: "Sin definir",
    intro:
      "Las metaetiquetas son lo que leen los buscadores y las redes sociales en lugar de mirar su página. Deciden qué dice su resultado en Google y cómo se ve su enlace cuando alguien lo comparte.",
    explainer: [
      {
        heading: "Qué comprueba",
        body: "Catorce etiquetas en tres grupos: las que leen los buscadores (título, descripción, canónica, idioma, robots, viewport), las etiquetas Open Graph que leen Facebook, LinkedIn, Slack y WhatsApp, y las de las tarjetas de Twitter. Las longitudes se comparan con lo que Google corta de verdad, no con cifras redondas.",
      },
      {
        heading: "La que todo el mundo olvida",
        body: "og:image. Sin ella, su enlace se comparte como un recuadro gris en todas las plataformas, y solo se entera cuando alguien lo publica, cuando la publicación ya está ahí recibiendo los clics que iba a recibir. No cuesta nada definirla y es la etiqueta de más impacto de esta lista.",
      },
    ],
    ctaHeadline: "Las metaetiquetas son la parte fácil",
    ctaBody: "RepGet las comprueba automáticamente en toda su web y después escribe las páginas que se ganan los clics.",
  },
  fr: {
    metaDescription:
      "Vérifiez toutes les balises meta que lisent Google et les réseaux sociaux sur votre page : titres, descriptions, Open Graph et cartes Twitter. Gratuit, sans inscription.",
    description:
      "Lit toutes les balises que Google et les réseaux sociaux utilisent vraiment sur votre page, et vous dit lesquelles manquent, lesquelles ont une mauvaise longueur et à quoi sert chacune.",
    submit: "Vérifier les balises meta",
    fieldLabel: "Adresse de la page",
    placeholder: "votresite.fr/page",
    couldNotCheck: "Nous n’avons pas pu vérifier cette page",
    good: "Correctes",
    warn: "À revoir",
    missing: "Manquantes",
    notSet: "Non définie",
    intro:
      "Les balises meta sont ce que lisent les moteurs de recherche et les réseaux sociaux au lieu de regarder votre page. Elles décident de ce qu’affiche votre résultat sur Google et de l’apparence de votre lien quand quelqu’un le partage.",
    explainer: [
      {
        heading: "Ce que l’outil vérifie",
        body: "Quatorze balises en trois groupes : celles que lisent les moteurs de recherche (titre, description, canonique, langue, robots, viewport), les balises Open Graph que lisent Facebook, LinkedIn, Slack et WhatsApp, et les balises des cartes Twitter. Les longueurs sont comparées à ce que Google tronque réellement, pas à des chiffres ronds.",
      },
      {
        heading: "Celle que l’on oublie",
        body: "og:image. Sans elle, votre lien s’affiche comme un cadre gris sur toutes les plateformes, et vous ne le découvrez qu’une fois le lien publié, quand la publication est déjà en ligne et récolte les clics qu’elle allait récolter. Elle ne coûte rien à définir et c’est la balise la plus importante de cette liste.",
      },
    ],
    ctaHeadline: "Les balises meta, c’est la partie facile",
    ctaBody: "RepGet les vérifie automatiquement sur tout votre site, puis rédige les pages qui obtiennent les clics.",
  },
  it: {
    metaDescription:
      "Controlli tutti i meta tag che Google e i social leggono sulla sua pagina: titoli, descrizioni, Open Graph e Twitter card. Gratis, senza registrazione.",
    description:
      "Legge tutti i tag che Google e i social usano davvero sulla sua pagina e le dice quali mancano, quali hanno la lunghezza sbagliata e a cosa serve ciascuno.",
    submit: "Controlla i meta tag",
    fieldLabel: "Indirizzo della pagina",
    placeholder: "ilsuosito.it/pagina",
    couldNotCheck: "Non siamo riusciti a controllare quella pagina",
    good: "Corretti",
    warn: "Da rivedere",
    missing: "Mancanti",
    notSet: "Non impostato",
    intro:
      "I meta tag sono ciò che motori di ricerca e social leggono invece di guardare la sua pagina. Decidono cosa dice il suo risultato su Google e come appare il suo link quando qualcuno lo condivide.",
    explainer: [
      {
        heading: "Cosa controlla",
        body: "Quattordici tag in tre gruppi: quelli che leggono i motori di ricerca (titolo, descrizione, canonical, lingua, robots, viewport), i tag Open Graph che leggono Facebook, LinkedIn, Slack e WhatsApp, e i tag delle Twitter card. Le lunghezze sono confrontate con ciò che Google tronca davvero, non con numeri tondi.",
      },
      {
        heading: "Quello che tutti dimenticano",
        body: "og:image. Senza, il suo link viene condiviso come un riquadro grigio su ogni piattaforma, e lo scopre solo dopo che qualcuno lo pubblica, quando il post è già online e raccoglie i clic che avrebbe raccolto. Impostarlo non costa nulla ed è il tag di maggiore impatto di questo elenco.",
      },
    ],
    ctaHeadline: "I meta tag sono la parte facile",
    ctaBody: "RepGet li controlla automaticamente su tutto il suo sito, poi scrive le pagine che si guadagnano i clic.",
  },
  de: {
    metaDescription:
      "Prüfen Sie jedes Meta-Tag, das Google und soziale Netzwerke auf Ihrer Seite lesen: Titel, Beschreibungen, Open Graph und Twitter Cards. Kostenlos, ohne Anmeldung.",
    description:
      "Liest jedes Tag, das Google und soziale Netzwerke auf Ihrer Seite tatsächlich verwenden, und zeigt, welche fehlen, welche die falsche Länge haben und wofür jedes einzelne da ist.",
    submit: "Meta-Tags prüfen",
    fieldLabel: "Adresse der Seite",
    placeholder: "ihrewebsite.de/seite",
    couldNotCheck: "Wir konnten diese Seite nicht prüfen",
    good: "In Ordnung",
    warn: "Prüfen",
    missing: "Fehlen",
    notSet: "Nicht gesetzt",
    intro:
      "Meta-Tags lesen Suchmaschinen und soziale Netzwerke, statt sich Ihre Seite anzusehen. Sie bestimmen, was Ihr Ergebnis bei Google sagt und wie Ihr Link aussieht, wenn jemand ihn teilt.",
    explainer: [
      {
        heading: "Was geprüft wird",
        body: "Vierzehn Tags in drei Gruppen: die, die Suchmaschinen lesen (Titel, Beschreibung, Canonical, Sprache, Robots, Viewport), die Open-Graph-Tags, die Facebook, LinkedIn, Slack und WhatsApp lesen, und die Tags der Twitter Cards. Die Längen werden mit dem verglichen, was Google tatsächlich abschneidet, nicht mit runden Zahlen.",
      },
      {
        heading: "Das Tag, das alle vergessen",
        body: "og:image. Ohne es wird Ihr Link auf jeder Plattform als graues Feld geteilt, und Sie merken es erst, wenn jemand ihn postet. Dann ist der Beitrag schon online und bekommt die Klicks, die er bekommen wird. Das Tag zu setzen kostet nichts, und es ist das wirkungsvollste in dieser Liste.",
      },
    ],
    ctaHeadline: "Meta-Tags sind die leichte Hälfte",
    ctaBody: "RepGet prüft sie automatisch auf Ihrer ganzen Website und schreibt dann die Seiten, die die Klicks verdienen.",
  },
};
