import "server-only";

import {
  emailLayout,
  emailText,
  escapeHtml,
} from "@/lib/email/layout";
import { sendEmail, type SendResult } from "@/lib/email/send";

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
 */
const COPY: Record<
  OtpPurpose,
  { subject: string; heading: string; lead: string }
> = {
  "sign-in": {
    subject: "Your sign-in code",
    heading: "Sign in to RepGet",
    lead: "Enter this code to finish signing in.",
  },
  "email-verification": {
    subject: "Confirm your email address",
    heading: "Confirm your email",
    lead: "Enter this code to confirm this address belongs to you.",
  },
  "forget-password": {
    subject: "Your password reset code",
    heading: "Reset your password",
    lead: "Enter this code to choose a new password.",
  },
  "change-email": {
    subject: "Confirm your new email address",
    heading: "Confirm your new email",
    lead: "Enter this code to start using this address for your account.",
  },
};

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
function minutes(expiresInSeconds: number): string {
  const value = Math.max(1, Math.round(expiresInSeconds / 60));
  return value === 1 ? "1 minute" : `${value} minutes`;
}

export async function sendOtpEmail(options: {
  to: string;
  code: string;
  purpose: OtpPurpose;
  /** So the email's deadline and the server's agree. */
  expiresInSeconds: number;
}): Promise<SendResult> {
  const copy = COPY[options.purpose];
  const window = minutes(options.expiresInSeconds);

  const html = emailLayout({
    heading: copy.heading,
    /*
      The preheader is the line a phone shows beside the subject. Putting the
      purpose there — never the code — means somebody can see what arrived
      without unlocking, while the code still requires opening the message.
    */
    preheader: `${copy.lead} It expires in ${window}.`,
    body: [
      emailText(escapeHtml(copy.lead)),
      codeBlock(options.code),
      emailText(`This code expires in ${escapeHtml(window)}.`),
      /*
        The line that matters when the email was NOT expected. No "contact
        support" — there is nothing for support to do about an unused code,
        and telling somebody to act turns a non-event into an alarm. Ignoring
        it genuinely is the correct response.
      */
      emailText(
        "If you did not request this, you can ignore this email. The code will not work for anyone who does not have it.",
      ),
    ].join("\n"),
  });

  const text = [
    copy.heading,
    "",
    copy.lead,
    "",
    options.code,
    "",
    `This code expires in ${window}.`,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  return sendEmail({
    to: options.to,
    subject: copy.subject,
    html,
    text,
  });
}
