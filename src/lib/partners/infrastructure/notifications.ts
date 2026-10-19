import "server-only";

import { emailButton, emailFallback, emailLayout, emailText, escapeHtml } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";

import type { Mailer } from "../application/ports/directory";

/**
 * Partner emails, through the app's mailer (Resend). English, like the
 * other transactional emails. Sending never throws; a failure comes back as
 * { ok: false } and the job that asked retries. A partner is a person, not a
 * workspace, so these go to the partner's address rather than through the
 * organization-scoped in-app notifications.
 */
export const partnerMailer: Mailer = {
  async sendPartnerWelcome(input) {
    const html = emailLayout({
      heading: "Welcome to the RepGet partner program",
      preheader: "Your partner link is ready.",
      body: [
        emailText(`Hi ${escapeHtml(input.name)}, your application was approved.`),
        emailText(
          "Share your partner link. When someone you refer opens a new RepGet account and pays for a subscription, you earn a commission on the money they actually pay, for twelve months.",
        ),
        emailText(`Your link: <strong>${escapeHtml(input.referralUrl)}</strong>`),
        emailButton(input.portalUrl, "Open the partner portal"),
        emailText(
          `<span style="color:#71717a;font-size:13px;">To be paid, set up payouts with Stripe in the portal. Sign in with the account you already use - nothing new to create.</span>`,
        ),
        emailFallback(input.portalUrl, "Or paste this link into your browser:"),
      ].join(""),
    });
    const text = [
      `Hi ${input.name}, your application to the RepGet partner program was approved.`,
      ``,
      `Your partner link: ${input.referralUrl}`,
      ``,
      `Open the partner portal: ${input.portalUrl}`,
      ``,
      `To be paid, set up payouts with Stripe in the portal.`,
    ].join("\n");
    const result = await sendEmail({ to: input.to, subject: "Welcome to the RepGet partner program", html, text });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  },
  async sendPartnerNotice(input) {
    const html = emailLayout({
      heading: input.subject,
      preheader: input.lines[0] ?? input.subject,
      body: [
        emailText(`Hi ${escapeHtml(input.name)},`),
        ...input.lines.map((line) => emailText(escapeHtml(line))),
        emailButton(input.portalUrl, "Open the partner portal"),
      ].join(""),
    });
    const text = [`Hi ${input.name},`, ``, ...input.lines, ``, input.portalUrl].join("\n");
    const result = await sendEmail({ to: input.to, subject: input.subject, html, text });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  },
};
