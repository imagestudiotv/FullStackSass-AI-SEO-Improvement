import "server-only";

import { emailLayout, emailText, escapeHtml } from "@/lib/email/layout";
import type { Locale } from "@/lib/i18n/config";

import type { FeedbackStatus } from "./shared";

/**
 * The email an administrator's reply to feedback goes out as (Admin ->
 * Feedback), in the language the sender wrote from: the reply, what is now
 * happening with it when the administrator changed its status, and their own
 * message quoted underneath.
 */

type ReplyCopy = {
  subject: string;
  heading: string;
  /** "{name}" when the sender gave one. */
  greetingNamed: string;
  greeting: string;
  status: Partial<Record<FeedbackStatus, string>>;
  yourMessage: string;
  signOff: string;
};

const COPY: Record<Locale, ReplyCopy> = {
  en: {
    subject: "Re: your feedback to RepGet",
    heading: "Thank you for your feedback",
    greetingNamed: "Hello {name},",
    greeting: "Hello,",
    status: {
      planned: "We have added this to our plans.",
      done: "This is now done.",
      wont_do: "We will not be doing this for now, but thank you for telling us.",
    },
    yourMessage: "Your message:",
    signOff: "The RepGet team",
  },
  es: {
    subject: "Re: sus comentarios a RepGet",
    heading: "Gracias por sus comentarios",
    greetingNamed: "Hola, {name}:",
    greeting: "Hola:",
    status: {
      planned: "Lo hemos añadido a nuestros planes.",
      done: "Ya está hecho.",
      wont_do: "Por ahora no lo haremos, pero gracias por contárnoslo.",
    },
    yourMessage: "Su mensaje:",
    signOff: "El equipo de RepGet",
  },
  fr: {
    subject: "Re : votre avis sur RepGet",
    heading: "Merci pour votre avis",
    greetingNamed: "Bonjour {name},",
    greeting: "Bonjour,",
    status: {
      planned: "Nous l’avons ajouté à nos projets.",
      done: "C’est maintenant fait.",
      wont_do: "Nous ne le ferons pas pour l’instant, mais merci de nous en avoir parlé.",
    },
    yourMessage: "Votre message :",
    signOff: "L’équipe RepGet",
  },
  it: {
    subject: "Re: il suo feedback a RepGet",
    heading: "Grazie per il suo feedback",
    greetingNamed: "Buongiorno {name},",
    greeting: "Buongiorno,",
    status: {
      planned: "Lo abbiamo aggiunto ai nostri piani.",
      done: "Ora è fatto.",
      wont_do: "Per ora non lo faremo, ma grazie per avercelo segnalato.",
    },
    yourMessage: "Il suo messaggio:",
    signOff: "Il team di RepGet",
  },
  de: {
    subject: "Re: Ihr Feedback an RepGet",
    heading: "Vielen Dank für Ihr Feedback",
    greetingNamed: "Guten Tag {name},",
    greeting: "Guten Tag,",
    status: {
      planned: "Wir haben es in unsere Pläne aufgenommen.",
      done: "Das ist jetzt erledigt.",
      wont_do: "Wir werden das vorerst nicht umsetzen, aber danke, dass Sie es uns mitgeteilt haben.",
    },
    yourMessage: "Ihre Nachricht:",
    signOff: "Ihr RepGet-Team",
  },
};

const paragraphs = (text: string) => escapeHtml(text).replace(/\n/g, "<br>");

/** The reply as an email: subject, HTML and plain text. */
export function feedbackReplyEmail(input: {
  locale: Locale;
  name: string | null;
  reply: string;
  original: string;
  /** The status it was given with this reply, when it changed. */
  status: FeedbackStatus | null;
}): { subject: string; html: string; text: string } {
  const copy = COPY[input.locale];
  const greeting = input.name ? copy.greetingNamed.replace("{name}", input.name) : copy.greeting;
  const statusLine = input.status ? (copy.status[input.status] ?? null) : null;
  const original = input.original.length > 1500 ? `${input.original.slice(0, 1499)}…` : input.original;
  const html = emailLayout({
    heading: copy.heading,
    preheader: input.reply.replace(/\s+/g, " ").slice(0, 140),
    body: [
      emailText(escapeHtml(greeting)),
      emailText(paragraphs(input.reply)),
      statusLine ? emailText(`<strong>${escapeHtml(statusLine)}</strong>`) : "",
      emailText(escapeHtml(copy.signOff)),
      emailText(`<span style="color:#71717a;">${escapeHtml(copy.yourMessage)}<br>${paragraphs(original)}</span>`),
    ].join(""),
  });
  const text = [greeting, input.reply, statusLine ?? "", copy.signOff, `${copy.yourMessage}\n${original}`].filter(Boolean).join("\n\n");
  return { subject: copy.subject, html, text };
}
