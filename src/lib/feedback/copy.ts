import type { Locale } from "@/lib/i18n/config";

import type { FeedbackErrorCode, FeedbackKind } from "./shared";

/**
 * The feedback form's words in the five languages, in the formal address the
 * site uses. A page hands the form only its own language's copy (the whole
 * table never reaches the browser).
 */
export type FeedbackCopy = {
  /** The dashboard header's button. */
  button: string;
  title: string;
  intro: string;
  kindLabel: string;
  kinds: Record<FeedbackKind, string>;
  messageLabel: string;
  placeholders: Record<FeedbackKind, string>;
  emailLabel: string;
  emailHint: string;
  /** A signed-in customer: "We will reply to {email}." */
  accountEmail: string;
  nameLabel: string;
  screenshotLabel: string;
  /** The button that picks pictures (several at once, up to the limit). */
  screenshotAdd: string;
  /** "{max}": the most pictures a message can carry. */
  screenshotHint: string;
  /** A picture's remove button, for screen readers: "{n}" is its number. */
  screenshotRemove: string;
  send: string;
  sending: string;
  thanksTitle: string;
  thanksBody: string;
  sendAnother: string;
  close: string;
  /** "screenshot_count" says "{max}". */
  errors: Record<FeedbackErrorCode | "failed", string>;
};

export const FEEDBACK_COPY: Record<Locale, FeedbackCopy> = {
  en: {
    button: "Feedback",
    title: "Send feedback",
    intro: "An idea, a problem, or anything we could do better: tell us. We read every message.",
    kindLabel: "What is it about?",
    kinds: { idea: "An idea", problem: "A problem", other: "Something else" },
    messageLabel: "Your message",
    placeholders: {
      idea: "What would make RepGet more useful for you?",
      problem: "What happened, and what did you expect?",
      other: "Tell us what is on your mind.",
    },
    emailLabel: "Your email",
    emailHint: "So we can reply. We never use it for anything else.",
    accountEmail: "We will reply to {email}.",
    nameLabel: "Your name (optional)",
    screenshotLabel: "Screenshots (optional)",
    screenshotAdd: "Add screenshots",
    screenshotHint: "Up to {max} pictures: PNG, JPEG or WebP. You can also paste them into the message.",
    screenshotRemove: "Remove picture {n}",
    send: "Send feedback",
    sending: "Sending…",
    thanksTitle: "Thank you!",
    thanksBody: "We have your message. If it needs a reply, we will write to you by email.",
    sendAnother: "Send another",
    close: "Close",
    errors: {
      kind: "Choose what your message is about.",
      message_short: "Please write a little more (at least 10 characters).",
      message_long: "Please keep it under 5,000 characters.",
      email: "Enter an email address we can reply to.",
      name: "Please shorten your name.",
      links: "Please include no more than five links.",
      screenshot_type: "Each picture must be a PNG, JPEG or WebP image.",
      screenshot_count: "You can add up to {max} pictures.",
      screenshot_size: "The pictures are too large. Try fewer or smaller ones.",
      screenshot_unreadable: "One of the files could not be read as an image.",
      too_many: "You have sent several messages recently. Please try again later.",
      busy: "We are receiving a lot of messages right now. Please try again in a few minutes.",
      failed: "Your message could not be sent. Please try again.",
    },
  },
  es: {
    button: "Comentarios",
    title: "Enviar comentarios",
    intro: "Una idea, un problema o cualquier cosa que podamos mejorar: cuéntenoslo. Leemos todos los mensajes.",
    kindLabel: "¿De qué se trata?",
    kinds: { idea: "Una idea", problem: "Un problema", other: "Otra cosa" },
    messageLabel: "Su mensaje",
    placeholders: {
      idea: "¿Qué haría RepGet más útil para usted?",
      problem: "¿Qué ocurrió y qué esperaba que ocurriera?",
      other: "Cuéntenos lo que quiera.",
    },
    emailLabel: "Su correo electrónico",
    emailHint: "Para poder responderle. No lo usamos para nada más.",
    accountEmail: "Le responderemos a {email}.",
    nameLabel: "Su nombre (opcional)",
    screenshotLabel: "Capturas de pantalla (opcional)",
    screenshotAdd: "Añadir capturas",
    screenshotHint: "Hasta {max} imágenes: PNG, JPEG o WebP. También puede pegarlas en el mensaje.",
    screenshotRemove: "Quitar la imagen {n}",
    send: "Enviar comentarios",
    sending: "Enviando…",
    thanksTitle: "¡Gracias!",
    thanksBody: "Hemos recibido su mensaje. Si necesita respuesta, le escribiremos por correo electrónico.",
    sendAnother: "Enviar otro",
    close: "Cerrar",
    errors: {
      kind: "Elija de qué trata su mensaje.",
      message_short: "Escriba un poco más (al menos 10 caracteres).",
      message_long: "Manténgalo por debajo de 5.000 caracteres.",
      email: "Introduzca un correo electrónico al que podamos responder.",
      name: "Acorte su nombre, por favor.",
      links: "Incluya como máximo cinco enlaces.",
      screenshot_type: "Cada imagen debe ser PNG, JPEG o WebP.",
      screenshot_count: "Puede añadir hasta {max} imágenes.",
      screenshot_size: "Las imágenes son demasiado grandes. Pruebe con menos o más pequeñas.",
      screenshot_unreadable: "Uno de los archivos no se pudo leer como imagen.",
      too_many: "Ha enviado varios mensajes hace poco. Inténtelo de nuevo más tarde.",
      busy: "Estamos recibiendo muchos mensajes en este momento. Inténtelo de nuevo en unos minutos.",
      failed: "No se pudo enviar su mensaje. Inténtelo de nuevo.",
    },
  },
  fr: {
    button: "Avis",
    title: "Donner votre avis",
    intro: "Une idée, un problème ou quelque chose que nous pourrions améliorer : dites-le-nous. Nous lisons chaque message.",
    kindLabel: "De quoi s’agit-il ?",
    kinds: { idea: "Une idée", problem: "Un problème", other: "Autre chose" },
    messageLabel: "Votre message",
    placeholders: {
      idea: "Qu’est-ce qui rendrait RepGet plus utile pour vous ?",
      problem: "Que s’est-il passé, et à quoi vous attendiez-vous ?",
      other: "Dites-nous ce que vous avez en tête.",
    },
    emailLabel: "Votre adresse e-mail",
    emailHint: "Pour pouvoir vous répondre. Nous ne l’utilisons pour rien d’autre.",
    accountEmail: "Nous vous répondrons à {email}.",
    nameLabel: "Votre nom (facultatif)",
    screenshotLabel: "Captures d’écran (facultatives)",
    screenshotAdd: "Ajouter des captures",
    screenshotHint: "Jusqu’à {max} images : PNG, JPEG ou WebP. Vous pouvez aussi les coller dans le message.",
    screenshotRemove: "Retirer l’image {n}",
    send: "Envoyer",
    sending: "Envoi…",
    thanksTitle: "Merci !",
    thanksBody: "Nous avons bien reçu votre message. S’il appelle une réponse, nous vous écrirons par e-mail.",
    sendAnother: "Envoyer un autre message",
    close: "Fermer",
    errors: {
      kind: "Choisissez le sujet de votre message.",
      message_short: "Écrivez un peu plus (au moins 10 caractères).",
      message_long: "Restez sous 5 000 caractères.",
      email: "Indiquez une adresse e-mail à laquelle nous pouvons répondre.",
      name: "Raccourcissez votre nom, s’il vous plaît.",
      links: "Mettez cinq liens au maximum.",
      screenshot_type: "Chaque image doit être au format PNG, JPEG ou WebP.",
      screenshot_count: "Vous pouvez ajouter jusqu’à {max} images.",
      screenshot_size: "Les images sont trop lourdes. Essayez-en moins ou de plus petites.",
      screenshot_unreadable: "Un des fichiers n’a pas pu être lu comme une image.",
      too_many: "Vous avez envoyé plusieurs messages récemment. Réessayez plus tard.",
      busy: "Nous recevons beaucoup de messages en ce moment. Réessayez dans quelques minutes.",
      failed: "Votre message n’a pas pu être envoyé. Réessayez.",
    },
  },
  it: {
    button: "Feedback",
    title: "Invia un feedback",
    intro: "Un’idea, un problema o qualcosa che potremmo fare meglio: ce lo dica. Leggiamo ogni messaggio.",
    kindLabel: "Di cosa si tratta?",
    kinds: { idea: "Un’idea", problem: "Un problema", other: "Altro" },
    messageLabel: "Il suo messaggio",
    placeholders: {
      idea: "Cosa renderebbe RepGet più utile per lei?",
      problem: "Cosa è successo e cosa si aspettava?",
      other: "Ci dica cosa ha in mente.",
    },
    emailLabel: "La sua email",
    emailHint: "Per poterle rispondere. Non la usiamo per nient’altro.",
    accountEmail: "Le risponderemo a {email}.",
    nameLabel: "Il suo nome (facoltativo)",
    screenshotLabel: "Screenshot (facoltativi)",
    screenshotAdd: "Aggiungi screenshot",
    screenshotHint: "Fino a {max} immagini: PNG, JPEG o WebP. Può anche incollarle nel messaggio.",
    screenshotRemove: "Rimuovi l’immagine {n}",
    send: "Invia",
    sending: "Invio in corso…",
    thanksTitle: "Grazie!",
    thanksBody: "Abbiamo ricevuto il suo messaggio. Se serve una risposta, le scriveremo via email.",
    sendAnother: "Invia un altro messaggio",
    close: "Chiudi",
    errors: {
      kind: "Scelga di cosa tratta il suo messaggio.",
      message_short: "Scriva qualcosa in più (almeno 10 caratteri).",
      message_long: "Resti sotto i 5.000 caratteri.",
      email: "Inserisca un indirizzo email a cui possiamo rispondere.",
      name: "Accorci il suo nome, per favore.",
      links: "Inserisca al massimo cinque link.",
      screenshot_type: "Ogni immagine deve essere PNG, JPEG o WebP.",
      screenshot_count: "Può aggiungere fino a {max} immagini.",
      screenshot_size: "Le immagini sono troppo grandi. Ne provi meno o più piccole.",
      screenshot_unreadable: "Non è stato possibile leggere uno dei file come immagine.",
      too_many: "Ha inviato diversi messaggi di recente. Riprovi più tardi.",
      busy: "Stiamo ricevendo molti messaggi in questo momento. Riprovi tra qualche minuto.",
      failed: "Non è stato possibile inviare il messaggio. Riprovi.",
    },
  },
  de: {
    button: "Feedback",
    title: "Feedback senden",
    intro: "Eine Idee, ein Problem oder etwas, das wir besser machen könnten: Sagen Sie es uns. Wir lesen jede Nachricht.",
    kindLabel: "Worum geht es?",
    kinds: { idea: "Eine Idee", problem: "Ein Problem", other: "Etwas anderes" },
    messageLabel: "Ihre Nachricht",
    placeholders: {
      idea: "Was würde RepGet für Sie nützlicher machen?",
      problem: "Was ist passiert, und was haben Sie erwartet?",
      other: "Sagen Sie uns, was Ihnen am Herzen liegt.",
    },
    emailLabel: "Ihre E-Mail-Adresse",
    emailHint: "Damit wir antworten können. Wir verwenden sie für nichts anderes.",
    accountEmail: "Wir antworten an {email}.",
    nameLabel: "Ihr Name (optional)",
    screenshotLabel: "Screenshots (optional)",
    screenshotAdd: "Screenshots hinzufügen",
    screenshotHint: "Bis zu {max} Bilder: PNG, JPEG oder WebP. Sie können sie auch in die Nachricht einfügen.",
    screenshotRemove: "Bild {n} entfernen",
    send: "Senden",
    sending: "Wird gesendet…",
    thanksTitle: "Vielen Dank!",
    thanksBody: "Wir haben Ihre Nachricht erhalten. Wenn sie eine Antwort braucht, schreiben wir Ihnen per E-Mail.",
    sendAnother: "Weitere Nachricht senden",
    close: "Schließen",
    errors: {
      kind: "Wählen Sie, worum es in Ihrer Nachricht geht.",
      message_short: "Bitte schreiben Sie etwas mehr (mindestens 10 Zeichen).",
      message_long: "Bitte bleiben Sie unter 5.000 Zeichen.",
      email: "Geben Sie eine E-Mail-Adresse an, an die wir antworten können.",
      name: "Bitte kürzen Sie Ihren Namen.",
      links: "Bitte höchstens fünf Links.",
      screenshot_type: "Jedes Bild muss im Format PNG, JPEG oder WebP sein.",
      screenshot_count: "Sie können bis zu {max} Bilder hinzufügen.",
      screenshot_size: "Die Bilder sind zu groß. Versuchen Sie es mit weniger oder kleineren.",
      screenshot_unreadable: "Eine der Dateien konnte nicht als Bild gelesen werden.",
      too_many: "Sie haben kürzlich mehrere Nachrichten gesendet. Bitte versuchen Sie es später erneut.",
      busy: "Wir erhalten gerade sehr viele Nachrichten. Bitte versuchen Sie es in ein paar Minuten erneut.",
      failed: "Ihre Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
    },
  },
};
