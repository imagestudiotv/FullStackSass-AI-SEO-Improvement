import type { Locale } from "@/lib/i18n/config";

/**
 * The SEO Title Checker's words in five languages. The title is the
 * registry's. `form` is everything the in-browser form shows; only the
 * visitor's language is sent to the browser.
 */
export type SnippetFormCopy = {
  pageTitle: string;
  descriptionLabel: string;
  urlLabel: string;
  titlePlaceholder: string;
  descPlaceholder: string;
  urlPlaceholder: string;
  displayUrl: string;
  previewTitle: string;
  titleEmpty: string;
  descEmpty: string;
  widthNote: string;
  /** {min}, {max} */
  titleAdvice: { good: string; empty: string; short: string; long: string };
  descAdvice: { good: string; empty: string; short: string; long: string };
};

export type SnippetCopy = {
  metaDescription: string;
  description: string;
  form: SnippetFormCopy;
  explainer: { heading: string; body: string }[];
  ctaHeadline: string;
  ctaBody: string;
};

export const SNIPPET_COPY: Record<Locale, SnippetCopy> = {
  en: {
    metaDescription:
      "See how your page title and description will look on Google, and whether they are long enough to be cut short. Free, no account needed.",
    description:
      "Type your title and description to see exactly how they will appear on Google. Anything too long gets cut, and the part that gets cut is usually the part that would have persuaded someone to click.",
    form: {
      pageTitle: "Page title",
      descriptionLabel: "Description",
      urlLabel: "Page address (optional)",
      titlePlaceholder: "Emergency dentist in Utrecht - open Saturdays",
      descPlaceholder: "Same-day appointments for toothache and broken teeth. Open Saturdays, five minutes from Utrecht Centraal.",
      urlPlaceholder: "example.com/emergency-dentist",
      displayUrl: "example.com/your-page",
      previewTitle: "How it will look",
      titleEmpty: "Your page title appears here",
      descEmpty: "Your description appears here. Without one, Google picks a sentence from the page - often the wrong one.",
      widthNote: "Google cuts text by width rather than by character, so treat this as a close guide rather than an exact match.",
      titleAdvice: {
        good: "Good length. This should show in full.",
        empty: "Every page needs a title. It is the headline in search results.",
        short: "Short titles waste space you are given. Aim for {min}–{max} characters.",
        long: "Google usually cuts titles around {max} characters. Put what matters first.",
      },
      descAdvice: {
        good: "Good length. This should show in full.",
        empty: "Without a description, Google picks a sentence from the page - often the wrong one.",
        short: "Use the space: {min}–{max} characters gives you room to say why to click.",
        long: "Google usually cuts descriptions around {max} characters.",
      },
    },
    explainer: [
      {
        heading: "What this checks",
        body: "Your title and description are measured against the lengths Google actually truncates at, and the preview updates as you type. Nothing is sent anywhere - this one runs entirely in your browser.",
      },
      {
        heading: "Why the order matters",
        body: 'Truncation always takes the end. Put what distinguishes you first and your brand name last: a title reading "Emergency plumber, open 24/7 - Acme" survives the cut where "Acme - the trusted name in…" loses everything that would have earned the click.',
      },
    ],
    ctaHeadline: "Check every page at once",
    ctaBody: "Our free website check reads your whole site and finds every page with a missing, duplicate or over-long title.",
  },
  es: {
    metaDescription:
      "Vea cómo se verán en Google el título y la descripción de su página, y si son tan largos que se cortarán. Gratis, sin cuenta.",
    description:
      "Escriba su título y su descripción para ver exactamente cómo aparecerán en Google. Lo que es demasiado largo se corta, y la parte cortada suele ser la que habría convencido a alguien de hacer clic.",
    form: {
      pageTitle: "Título de la página",
      descriptionLabel: "Descripción",
      urlLabel: "Dirección de la página (opcional)",
      titlePlaceholder: "Dentista de urgencia en Valencia, abierto los sábados",
      descPlaceholder: "Citas el mismo día para dolor de muelas y dientes rotos. Abierto los sábados, a cinco minutos de la estación del Norte.",
      urlPlaceholder: "ejemplo.com/dentista-urgencia",
      displayUrl: "ejemplo.com/su-pagina",
      previewTitle: "Cómo se verá",
      titleEmpty: "Aquí aparece el título de su página",
      descEmpty: "Aquí aparece su descripción. Sin ella, Google elige una frase de la página, a menudo la equivocada.",
      widthNote: "Google corta el texto por anchura y no por número de caracteres, así que tómelo como una guía aproximada y no como una coincidencia exacta.",
      titleAdvice: {
        good: "Buena longitud. Debería verse completo.",
        empty: "Toda página necesita un título. Es el titular en los resultados de búsqueda.",
        short: "Los títulos cortos desaprovechan el espacio disponible. Apunte a {min}–{max} caracteres.",
        long: "Google suele cortar los títulos hacia los {max} caracteres. Ponga primero lo importante.",
      },
      descAdvice: {
        good: "Buena longitud. Debería verse completa.",
        empty: "Sin descripción, Google elige una frase de la página, a menudo la equivocada.",
        short: "Aproveche el espacio: {min}–{max} caracteres le dan margen para explicar por qué hacer clic.",
        long: "Google suele cortar las descripciones hacia los {max} caracteres.",
      },
    },
    explainer: [
      {
        heading: "Qué comprueba",
        body: "Su título y su descripción se comparan con las longitudes a las que Google corta de verdad, y la vista previa se actualiza mientras escribe. No se envía nada a ningún sitio: esta herramienta funciona por completo en su navegador.",
      },
      {
        heading: "Por qué importa el orden",
        body: "El corte siempre se lleva el final. Ponga primero lo que le diferencia y su marca al final: un título como «Fontanero urgente, abierto 24/7 - Acme» sobrevive al corte, mientras que «Acme - el nombre de confianza en…» pierde todo lo que le habría ganado el clic.",
      },
    ],
    ctaHeadline: "Revise todas las páginas a la vez",
    ctaBody: "Nuestra revisión gratuita lee toda su web y encuentra cada página con un título que falta, está duplicado o es demasiado largo.",
  },
  fr: {
    metaDescription:
      "Voyez à quoi ressembleront le titre et la description de votre page sur Google, et s’ils sont trop longs au point d’être coupés. Gratuit, sans compte.",
    description:
      "Saisissez votre titre et votre description pour voir exactement comment ils apparaîtront sur Google. Ce qui est trop long est coupé, et la partie coupée est souvent celle qui aurait convaincu quelqu’un de cliquer.",
    form: {
      pageTitle: "Titre de la page",
      descriptionLabel: "Description",
      urlLabel: "Adresse de la page (facultatif)",
      titlePlaceholder: "Dentiste d’urgence à Lyon, ouvert le samedi",
      descPlaceholder: "Rendez-vous le jour même pour les rages de dents et les dents cassées. Ouvert le samedi, à cinq minutes de la gare Part-Dieu.",
      urlPlaceholder: "exemple.fr/dentiste-urgence",
      displayUrl: "exemple.fr/votre-page",
      previewTitle: "Aperçu",
      titleEmpty: "Le titre de votre page apparaît ici",
      descEmpty: "Votre description apparaît ici. Sans elle, Google choisit une phrase de la page, souvent la mauvaise.",
      widthNote: "Google coupe le texte selon la largeur et non selon le nombre de caractères : considérez ceci comme un bon repère plutôt qu’une correspondance exacte.",
      titleAdvice: {
        good: "Bonne longueur. Il devrait s’afficher en entier.",
        empty: "Chaque page a besoin d’un titre. C’est le titre affiché dans les résultats de recherche.",
        short: "Un titre court gaspille l’espace disponible. Visez {min} à {max} caractères.",
        long: "Google coupe généralement les titres vers {max} caractères. Mettez l’essentiel en premier.",
      },
      descAdvice: {
        good: "Bonne longueur. Elle devrait s’afficher en entier.",
        empty: "Sans description, Google choisit une phrase de la page, souvent la mauvaise.",
        short: "Profitez de l’espace : {min} à {max} caractères vous laissent la place de dire pourquoi cliquer.",
        long: "Google coupe généralement les descriptions vers {max} caractères.",
      },
    },
    explainer: [
      {
        heading: "Ce que l’outil vérifie",
        body: "Votre titre et votre description sont comparés aux longueurs auxquelles Google tronque réellement, et l’aperçu se met à jour pendant la saisie. Rien n’est envoyé nulle part : cet outil fonctionne entièrement dans votre navigateur.",
      },
      {
        heading: "Pourquoi l’ordre compte",
        body: "La coupe enlève toujours la fin. Mettez d’abord ce qui vous distingue et votre marque à la fin : un titre comme « Plombier d’urgence, ouvert 24 h/24 - Acme » survit à la coupe, alors que « Acme - le nom de confiance en… » perd tout ce qui aurait mérité le clic.",
      },
    ],
    ctaHeadline: "Vérifiez toutes les pages d’un coup",
    ctaBody: "Notre vérification gratuite lit tout votre site et trouve chaque page dont le titre manque, est en double ou est trop long.",
  },
  it: {
    metaDescription:
      "Veda come appariranno su Google il titolo e la descrizione della sua pagina, e se sono così lunghi da essere tagliati. Gratis, senza account.",
    description:
      "Scriva titolo e descrizione per vedere esattamente come appariranno su Google. Ciò che è troppo lungo viene tagliato, e la parte tagliata di solito è quella che avrebbe convinto qualcuno a cliccare.",
    form: {
      pageTitle: "Titolo della pagina",
      descriptionLabel: "Descrizione",
      urlLabel: "Indirizzo della pagina (facoltativo)",
      titlePlaceholder: "Dentista d’urgenza a Bologna, aperto il sabato",
      descPlaceholder: "Appuntamenti in giornata per mal di denti e denti rotti. Aperto il sabato, a cinque minuti dalla stazione centrale.",
      urlPlaceholder: "esempio.it/dentista-urgenza",
      displayUrl: "esempio.it/la-sua-pagina",
      previewTitle: "Come apparirà",
      titleEmpty: "Qui compare il titolo della sua pagina",
      descEmpty: "Qui compare la sua descrizione. Senza, Google sceglie una frase dalla pagina, spesso quella sbagliata.",
      widthNote: "Google taglia il testo in base alla larghezza e non al numero di caratteri: lo consideri una guida affidabile, non una corrispondenza esatta.",
      titleAdvice: {
        good: "Lunghezza giusta. Dovrebbe comparire per intero.",
        empty: "Ogni pagina ha bisogno di un titolo. È il titolo che compare nei risultati di ricerca.",
        short: "I titoli corti sprecano lo spazio a disposizione. Punti a {min}–{max} caratteri.",
        long: "Google di solito taglia i titoli intorno ai {max} caratteri. Metta per prima la parte importante.",
      },
      descAdvice: {
        good: "Lunghezza giusta. Dovrebbe comparire per intero.",
        empty: "Senza descrizione, Google sceglie una frase dalla pagina, spesso quella sbagliata.",
        short: "Sfrutti lo spazio: {min}–{max} caratteri le danno modo di dire perché cliccare.",
        long: "Google di solito taglia le descrizioni intorno ai {max} caratteri.",
      },
    },
    explainer: [
      {
        heading: "Cosa controlla",
        body: "Titolo e descrizione vengono confrontati con le lunghezze a cui Google tronca davvero, e l’anteprima si aggiorna mentre scrive. Non viene inviato nulla: questo strumento funziona interamente nel suo browser.",
      },
      {
        heading: "Perché l’ordine conta",
        body: "Il taglio porta via sempre la fine. Metta prima ciò che la distingue e il nome del brand in fondo: un titolo come «Idraulico urgente, aperto 24/7 - Acme» sopravvive al taglio, mentre «Acme - il nome di fiducia per…» perde tutto ciò che avrebbe meritato il clic.",
      },
    ],
    ctaHeadline: "Controlli tutte le pagine in una volta",
    ctaBody: "Il nostro controllo gratuito legge tutto il suo sito e trova ogni pagina con un titolo mancante, duplicato o troppo lungo.",
  },
  de: {
    metaDescription:
      "Sehen Sie, wie Titel und Beschreibung Ihrer Seite bei Google aussehen und ob sie so lang sind, dass sie abgeschnitten werden. Kostenlos, ohne Konto.",
    description:
      "Geben Sie Titel und Beschreibung ein und sehen Sie genau, wie sie bei Google erscheinen. Was zu lang ist, wird abgeschnitten, und der abgeschnittene Teil ist meist der, der jemanden zum Klicken bewegt hätte.",
    form: {
      pageTitle: "Seitentitel",
      descriptionLabel: "Beschreibung",
      urlLabel: "Adresse der Seite (optional)",
      titlePlaceholder: "Zahnarzt-Notdienst in Köln, samstags geöffnet",
      descPlaceholder: "Termine am selben Tag bei Zahnschmerzen und abgebrochenen Zähnen. Samstags geöffnet, fünf Minuten vom Hauptbahnhof.",
      urlPlaceholder: "beispiel.de/zahnarzt-notdienst",
      displayUrl: "beispiel.de/ihre-seite",
      previewTitle: "So wird es aussehen",
      titleEmpty: "Hier erscheint Ihr Seitentitel",
      descEmpty: "Hier erscheint Ihre Beschreibung. Ohne sie wählt Google einen Satz von der Seite, oft den falschen.",
      widthNote: "Google kürzt Text nach Breite und nicht nach Zeichenzahl. Sehen Sie das also als gute Orientierung, nicht als exakte Übereinstimmung.",
      titleAdvice: {
        good: "Gute Länge. Er sollte vollständig angezeigt werden.",
        empty: "Jede Seite braucht einen Titel. Er ist die Überschrift in den Suchergebnissen.",
        short: "Kurze Titel verschenken Platz, den Sie haben. Peilen Sie {min}–{max} Zeichen an.",
        long: "Google kürzt Titel meist bei etwa {max} Zeichen. Stellen Sie das Wichtigste nach vorn.",
      },
      descAdvice: {
        good: "Gute Länge. Sie sollte vollständig angezeigt werden.",
        empty: "Ohne Beschreibung wählt Google einen Satz von der Seite, oft den falschen.",
        short: "Nutzen Sie den Platz: {min}–{max} Zeichen geben Ihnen Raum zu sagen, warum man klicken sollte.",
        long: "Google kürzt Beschreibungen meist bei etwa {max} Zeichen.",
      },
    },
    explainer: [
      {
        heading: "Was geprüft wird",
        body: "Titel und Beschreibung werden mit den Längen verglichen, bei denen Google tatsächlich kürzt, und die Vorschau aktualisiert sich beim Tippen. Es wird nichts verschickt: Dieses Werkzeug läuft vollständig in Ihrem Browser.",
      },
      {
        heading: "Warum die Reihenfolge zählt",
        body: "Gekürzt wird immer am Ende. Stellen Sie das, was Sie unterscheidet, nach vorn und Ihren Markennamen ans Ende: Ein Titel wie „Notfall-Klempner, rund um die Uhr - Acme“ übersteht die Kürzung, während „Acme - der vertrauenswürdige Name für…“ alles verliert, was den Klick gebracht hätte.",
      },
    ],
    ctaHeadline: "Alle Seiten auf einmal prüfen",
    ctaBody: "Unsere kostenlose Website-Prüfung liest Ihre ganze Website und findet jede Seite mit fehlendem, doppeltem oder zu langem Titel.",
  },
};
