import "server-only";

import { Resend } from "resend";

/**
 * Transactional email.
 *
 * WHY THIS EXISTS AT ALL: for most of this product's life there was no email
 * provider, and several features were shaped around its absence — invitations
 * matched an existing account instead of inviting anybody, the email address
 * in Settings is read-only because changing it needs verification, and
 * password reset simply did not exist. Those are the features this unblocks.
 *
 * TWO RULES, both learned elsewhere in this codebase:
 *
 *  1. Construction is DEFERRED. `next build` evaluates every route module to
 *     collect page data, so a module-scope throw for a missing key fails the
 *     whole build on any machine without secrets — a fresh Vercel deploy, CI,
 *     a new clone. See the same pattern in lib/auth.ts and lib/db.
 *
 *  2. Sending NEVER throws. Every caller is doing something else that already
 *     succeeded: an invitation row is written, a password is reset, an account
 *     is created. A rejected promise here would roll that back or, worse,
 *     leave it half-done — which is exactly how a user once ended up with an
 *     account but no workspace (see the databaseHooks comment in auth.ts).
 *     So this returns a result and the caller decides.
 */

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

let client: Resend | null = null;

function getClient(): Resend | null {
  if (client) return client;

  const key = process.env.RESEND_API_KEY;
  if (!key) return null;

  client = new Resend(key);
  return client;
}

/**
 * Who mail comes from.
 *
 * `onboarding@resend.dev` is Resend's shared sender and works with no DNS at
 * all — but it will ONLY deliver to the address the Resend account was opened
 * with. That is fine for development and useless in production, so the day a
 * domain is verified this becomes `RepGet <noreply@send.repget.com>` and
 * nothing else changes.
 */
function from(): string {
  return process.env.EMAIL_FROM ?? "RepGet <onboarding@resend.dev>";
}

/** True when a provider is configured. Callers use it to soften their copy. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  /**
   * The plain-text alternative.
   *
   * Not optional by accident: a message with no text part scores badly with
   * spam filters, and some corporate mail clients show it in preference to
   * the HTML. Every template in this folder produces both.
   */
  text: string;
  /** Where a reply should go, when it is not the unattended default. */
  replyTo?: string;
}): Promise<SendResult> {
  const resend = getClient();

  /**
   * No key configured. Reported rather than thrown, and logged loudly enough
   * to be findable — a silent no-op here would look to the customer like an
   * invitation that was accepted and never arrived.
   */
  if (!resend) {
    console.error(
      "[email] RESEND_API_KEY is not set; not sending",
      options.subject,
    );
    return { ok: false, error: "Email is not configured on this deployment." };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: from(),
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });

    if (error) {
      /*
        Resend reports a refusal in `error` rather than by rejecting, so this
        branch is the common failure: an unverified domain, a suppressed
        address, a malformed sender. The message is logged in full and a
        short one is returned — the raw text names our sending domain and
        account, which is not a customer's business.
      */
      console.error("[email] send refused", {
        subject: options.subject,
        error,
      });
      return { ok: false, error: error.message };
    }

    if (!data?.id) {
      return { ok: false, error: "The email provider returned no message id." };
    }

    return { ok: true, id: data.id };
  } catch (error) {
    // A network failure or a thrown SDK error. Same contract: report, never throw.
    console.error("[email] send failed", { subject: options.subject, error });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not send email.",
    };
  }
}
