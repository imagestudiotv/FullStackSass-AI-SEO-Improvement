import "server-only";

import {
  emailButton,
  emailFallback,
  emailLayout,
  emailText,
  escapeHtml,
} from "@/lib/email/layout";
import { sendEmail, type SendResult } from "@/lib/email/send";

/**
 * The two invitation emails.
 *
 * WRITTEN IN ENGLISH ONLY, deliberately. The app renders in five languages by
 * reading the account's stored preference (see i18n/app-locale.ts) — but the
 * whole point of an invitation is that the recipient has NO account, so there
 * is no preference to read and no request of theirs to take Accept-Language
 * from. Guessing from the inviter's language would be worse than English: the
 * freelancer being invited is frequently not from the customer's country,
 * which is why they are being invited by email in the first place.
 *
 * The notification email (someone who already has an account) COULD be
 * localised, and should be the day these are worth translating. It is kept in
 * the same voice as its sibling for now so the two do not drift.
 */

const ROLE_SENTENCE: Record<string, string> = {
  editor: "You will be able to write, edit and publish articles on this site.",
  viewer: "You will be able to read everything on this site, without changing it.",
};

function roleSentence(role: string): string {
  return ROLE_SENTENCE[role] ?? ROLE_SENTENCE.editor;
}

/**
 * To somebody with no account: a link that creates one and grants access.
 *
 * `inviterName` is the person, `domain` is the website. Both appear in the
 * subject because an invitation from an unknown product is indistinguishable
 * from spam — the recipient needs to recognise at least one of them in the
 * inbox list, before opening anything.
 */
export async function sendInvitationEmail(options: {
  to: string;
  inviterName: string;
  domain: string;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
}): Promise<SendResult> {
  const inviter = escapeHtml(options.inviterName);
  const domain = escapeHtml(options.domain);

  const html = emailLayout({
    heading: `${options.inviterName} invited you to work on ${options.domain}`,
    preheader: `Join ${options.domain} on RepGet as a ${options.role}.`,
    body: [
      emailText(
        `<strong>${inviter}</strong> has invited you to work on <strong>${domain}</strong> in RepGet, an AI SEO tool for planning, writing and publishing articles.`,
      ),
      emailText(escapeHtml(roleSentence(options.role))),
      emailButton(options.acceptUrl, "Accept invitation"),
      emailText(
        `<span style="color:#71717a;font-size:13px;">This invitation expires in ${options.expiresInDays} days. If you were not expecting it, you can ignore this email — nothing will be created.</span>`,
      ),
      emailFallback(options.acceptUrl, "Or paste this link into your browser:"),
    ].join(""),
  });

  const text = [
    `${options.inviterName} has invited you to work on ${options.domain} in RepGet.`,
    ``,
    roleSentence(options.role),
    ``,
    `Accept the invitation:`,
    options.acceptUrl,
    ``,
    `This invitation expires in ${options.expiresInDays} days. If you were not expecting it, you can ignore this email.`,
  ].join("\n");

  return sendEmail({
    to: options.to,
    subject: `${options.inviterName} invited you to work on ${options.domain}`,
    html,
    text,
  });
}

/**
 * To somebody who already has an account: access has been granted, here it is.
 *
 * No token and no accept step — the row was written the moment the owner
 * clicked invite, exactly as it was before email existed. This is a
 * notification, and it says so: a message that looked like an invitation but
 * required no action would leave the reader hunting for a button.
 */
export async function sendAccessGrantedEmail(options: {
  to: string;
  inviterName: string;
  domain: string;
  role: string;
  websiteUrl: string;
}): Promise<SendResult> {
  const inviter = escapeHtml(options.inviterName);
  const domain = escapeHtml(options.domain);

  const html = emailLayout({
    heading: `You now have access to ${options.domain}`,
    preheader: `${options.inviterName} gave you ${options.role} access on RepGet.`,
    body: [
      emailText(
        `<strong>${inviter}</strong> has given you access to <strong>${domain}</strong> in RepGet.`,
      ),
      emailText(escapeHtml(roleSentence(options.role))),
      emailButton(options.websiteUrl, "Open the website"),
      emailText(
        `<span style="color:#71717a;font-size:13px;">Sign in with the account you already use — nothing new to set up.</span>`,
      ),
      emailFallback(options.websiteUrl, "Or paste this link into your browser:"),
    ].join(""),
  });

  const text = [
    `${options.inviterName} has given you access to ${options.domain} in RepGet.`,
    ``,
    roleSentence(options.role),
    ``,
    `Open it here:`,
    options.websiteUrl,
    ``,
    `Sign in with the account you already use.`,
  ].join("\n");

  return sendEmail({
    to: options.to,
    subject: `You now have access to ${options.domain}`,
    html,
    text,
  });
}
