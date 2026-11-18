import "server-only";

import {
  emailLayout,
  emailText,
  escapeHtml,
} from "@/lib/email/layout";
import { sendEmail, type SendResult } from "@/lib/email/send";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/**
 * The one-time code emails.
 *
 * Four kinds share this template because they are the same message with a
 * different sentence: signing in, verifying an address, resetting a password
 * and changing an address all say "here is a number, type it back". Splitting
 * them into four templates would mean four places to get the code markup
 * wrong.
 *
 * NO LINK IN THESE EMAILS, deliberately. A code the reader types into a page
 * they already have open cannot be clicked by a mail scanner, forwarded into
 * someone else's session, or followed from a phone that is not the device
 * signing in. That is the property worth having, and adding a convenience
 * link would give it away.
 */

type OtpPurpose =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email";

/**
 * What each code is for, in the reader's terms.
 *
 * The subject names the action rather than the product — "Your RepGet code"
 * tells somebody nothing about whether they expected it, and a person who did
 * NOT request a sign-in code needs to understand that from the subject line
 * alone.
 *
 * IN THE READER'S LANGUAGE (2026-11-18). The code that starts the free trial
 * is the first email a visitor from an Italian, German, Spanish or French page
 * receives; it was English. The language is the request's
 * (lib/i18n/app-locale.ts signupLocaleFromHeaders: the site page last read,
 * then the browser), passed in by lib/auth.ts. English when none is known.
 */
type OtpWords = {
  purposes: Record<OtpPurpose, { subject: string; heading: string; lead: string }>;
  minutes: (value: number) => string;
  expires: string;
  ignore: string;
  ignoreShort: string;
};

const WORDS: Record<Locale, OtpWords> = {
  en: {
    purposes: {
      "sign-in": { subject: "Your sign-in code", heading: "Sign in to RepGet", lead: "Enter this code to finish signing in." },
      "email-verification": {
        subject: "Confirm your email address",
        heading: "Confirm your email",
        lead: "Enter this code to confirm this address belongs to you.",
      },
      "forget-password": { subject: "Your password reset code", heading: "Reset your password", lead: "Enter this code to choose a new password." },
      "change-email": {
        subject: "Confirm your new email address",
        heading: "Confirm your new email",
        lead: "Enter this code to start using this address for your account.",
      },
    },
    minutes: (value) => (value === 1 ? "1 minute" : `${value} minutes`),
    expires: "This code expires in {window}.",
    ignore: "If you did not request this, you can ignore this email. The code will not work for anyone who does not have it.",
    ignoreShort: "If you did not request this, you can ignore this email.",
  },
  it: {
    purposes: {
      "sign-in": { subject: "Il suo codice di accesso", heading: "Acceda a RepGet", lead: "Inserisca questo codice per completare l'accesso." },
      "email-verification": {
        subject: "Confermi il suo indirizzo email",
        heading: "Confermi la sua email",
        lead: "Inserisca questo codice per confermare che questo indirizzo è suo.",
      },
      "forget-password": {
        subject: "Il suo codice per reimpostare la password",
        heading: "Reimposti la password",
        lead: "Inserisca questo codice per scegliere una nuova password.",
      },
      "change-email": {
        subject: "Confermi il suo nuovo indirizzo email",
        heading: "Confermi la nuova email",
        lead: "Inserisca questo codice per iniziare a usare questo indirizzo per il suo account.",
      },
    },
    minutes: (value) => (value === 1 ? "1 minuto" : `${value} minuti`),
    expires: "Questo codice scade tra {window}.",
    ignore: "Se non ha richiesto questo codice, può ignorare questa email. Il codice non funziona per chi non lo possiede.",
    ignoreShort: "Se non ha richiesto questo codice, può ignorare questa email.",
  },
  de: {
    purposes: {
      "sign-in": { subject: "Ihr Anmeldecode", heading: "Bei RepGet anmelden", lead: "Geben Sie diesen Code ein, um die Anmeldung abzuschließen." },
      "email-verification": {
        subject: "Bestätigen Sie Ihre E-Mail-Adresse",
        heading: "E-Mail-Adresse bestätigen",
        lead: "Geben Sie diesen Code ein, um zu bestätigen, dass diese Adresse Ihnen gehört.",
      },
      "forget-password": {
        subject: "Ihr Code zum Zurücksetzen des Passworts",
        heading: "Passwort zurücksetzen",
        lead: "Geben Sie diesen Code ein, um ein neues Passwort festzulegen.",
      },
      "change-email": {
        subject: "Bestätigen Sie Ihre neue E-Mail-Adresse",
        heading: "Neue E-Mail-Adresse bestätigen",
        lead: "Geben Sie diesen Code ein, um diese Adresse für Ihr Konto zu verwenden.",
      },
    },
    minutes: (value) => (value === 1 ? "1 Minute" : `${value} Minuten`),
    expires: "Dieser Code läuft in {window} ab.",
    ignore: "Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren. Der Code funktioniert nur für jemanden, der ihn hat.",
    ignoreShort: "Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren.",
  },
  es: {
    purposes: {
      "sign-in": { subject: "Su código de inicio de sesión", heading: "Inicie sesión en RepGet", lead: "Introduzca este código para terminar de iniciar sesión." },
      "email-verification": {
        subject: "Confirme su dirección de correo",
        heading: "Confirme su correo",
        lead: "Introduzca este código para confirmar que esta dirección le pertenece.",
      },
      "forget-password": {
        subject: "Su código para restablecer la contraseña",
        heading: "Restablezca su contraseña",
        lead: "Introduzca este código para elegir una contraseña nueva.",
      },
      "change-email": {
        subject: "Confirme su nueva dirección de correo",
        heading: "Confirme su nuevo correo",
        lead: "Introduzca este código para empezar a usar esta dirección en su cuenta.",
      },
    },
    minutes: (value) => (value === 1 ? "1 minuto" : `${value} minutos`),
    expires: "Este código caduca en {window}.",
    ignore: "Si no lo ha solicitado, puede ignorar este correo. El código no sirve a nadie que no lo tenga.",
    ignoreShort: "Si no lo ha solicitado, puede ignorar este correo.",
  },
  fr: {
    purposes: {
      "sign-in": { subject: "Votre code de connexion", heading: "Connexion à RepGet", lead: "Saisissez ce code pour terminer la connexion." },
      "email-verification": {
        subject: "Confirmez votre adresse e-mail",
        heading: "Confirmez votre e-mail",
        lead: "Saisissez ce code pour confirmer que cette adresse vous appartient.",
      },
      "forget-password": {
        subject: "Votre code de réinitialisation du mot de passe",
        heading: "Réinitialisez votre mot de passe",
        lead: "Saisissez ce code pour choisir un nouveau mot de passe.",
      },
      "change-email": {
        subject: "Confirmez votre nouvelle adresse e-mail",
        heading: "Confirmez votre nouvel e-mail",
        lead: "Saisissez ce code pour commencer à utiliser cette adresse pour votre compte.",
      },
    },
    minutes: (value) => (value === 1 ? "1 minute" : `${value} minutes`),
    expires: "Ce code expire dans {window}.",
    ignore: "Si vous n'avez rien demandé, vous pouvez ignorer cet e-mail. Le code ne fonctionne pour personne d'autre que vous.",
    ignoreShort: "Si vous n'avez rien demandé, vous pouvez ignorer cet e-mail.",
  },
};

/** The words for one language; exported for the test that holds the five to the same shape. */
export function otpWords(locale: Locale = DEFAULT_LOCALE): OtpWords {
  return WORDS[locale] ?? WORDS[DEFAULT_LOCALE];
}

/**
 * The code itself.
 *
 * Letter-spaced and monospaced because the reader's job is to copy six digits
 * without misreading one, and the usual failure is a transposition. Selectable
 * text rather than an image so it can be copied rather than retyped, and so it
 * survives clients that block images.
 */
function codeBlock(code: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
<tr><td style="border-radius:8px;background-color:#f4f4f5;border:1px solid #e4e4e7;padding:16px 24px;">
<span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:0.28em;color:#18181b;">${escapeHtml(code)}</span>
</td></tr>
</table>`;
}

/** Minutes, for the sentence that tells the reader how long they have. */
function minutes(expiresInSeconds: number, words: OtpWords): string {
  return words.minutes(Math.max(1, Math.round(expiresInSeconds / 60)));
}

export async function sendOtpEmail(options: {
  to: string;
  code: string;
  purpose: OtpPurpose;
  /** So the email's deadline and the server's agree. */
  expiresInSeconds: number;
  /** The reader's language; English when unknown. */
  locale?: Locale | null;
}): Promise<SendResult> {
  const words = otpWords(options.locale ?? DEFAULT_LOCALE);
  const copy = words.purposes[options.purpose];
  const window = minutes(options.expiresInSeconds, words);
  const expires = words.expires.replace("{window}", window);

  const html = emailLayout({
    lang: options.locale ?? DEFAULT_LOCALE,
    heading: copy.heading,
    /*
      The preheader is the line a phone shows beside the subject. Putting the
      purpose there — never the code — means somebody can see what arrived
      without unlocking, while the code still requires opening the message.
    */
    preheader: `${copy.lead} ${expires}`,
    body: [
      emailText(escapeHtml(copy.lead)),
      codeBlock(options.code),
      emailText(escapeHtml(expires)),
      /*
        The line that matters when the email was NOT expected. No "contact
        support" — there is nothing for support to do about an unused code,
        and telling somebody to act turns a non-event into an alarm. Ignoring
        it genuinely is the correct response.
      */
      emailText(escapeHtml(words.ignore)),
    ].join("\n"),
  });

  const text = [
    copy.heading,
    "",
    copy.lead,
    "",
    options.code,
    "",
    expires,
    "",
    words.ignoreShort,
  ].join("\n");

  return sendEmail({
    to: options.to,
    subject: copy.subject,
    html,
    text,
  });
}
