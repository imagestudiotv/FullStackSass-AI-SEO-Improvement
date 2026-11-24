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
/** What the partner must do to be paid, by the method that is on for them (review-application.ts welcomePayout). */
export const WELCOME_PAYOUT: Record<Parameters<Mailer["sendPartnerWelcome"]>[0]["payout"], string> = {
  credits: "For now, commissions are paid as RepGet credits: choose in the portal's Settings which of your workspaces receives them.",
  stripe: "To be paid to your bank, set up payouts with Stripe in the portal's Settings.",
  paypal: "To be paid with PayPal, confirm your PayPal address in the portal's Settings.",
  stripe_or_paypal: "To be paid, set up payouts in the portal's Settings: to your bank with Stripe, or to your PayPal account.",
  unavailable: "Payouts are not available in your country yet. Your commissions are recorded and kept for you.",
};

export const partnerMailer: Mailer = {
  async sendPartnerWelcome(input) {
    const html = emailLayout({
      heading: "Welcome to the RepGet Affiliate Program",
      preheader: "Your partner link is ready.",
      body: [
        emailText(`Hi ${escapeHtml(input.name)}, your application was approved.`),
        emailText(
          "Share your partner link. When someone you refer opens a new RepGet account and pays for a subscription, you earn a commission on the money they actually pay, for twelve months.",
        ),
        emailText(`Your link: <strong>${escapeHtml(input.referralUrl)}</strong>`),
        emailButton(input.portalUrl, "Open the partner portal"),
        emailText(
          `<span style="color:#71717a;font-size:13px;">${escapeHtml(WELCOME_PAYOUT[input.payout])} Sign in with the account you already use - nothing new to create.</span>`,
        ),
        emailFallback(input.portalUrl, "Or paste this link into your browser:"),
      ].join(""),
    });
    const text = [
      `Hi ${input.name}, your application to the RepGet Affiliate Program was approved.`,
      ``,
      `Your partner link: ${input.referralUrl}`,
      ``,
      `Open the partner portal: ${input.portalUrl}`,
      ``,
      WELCOME_PAYOUT[input.payout],
    ].join("\n");
    const result = await sendEmail({ to: input.to, subject: "Welcome to the RepGet Affiliate Program", html, text });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  },
  async sendPartnerNotice(input) {
    const html = emailLayout({
      heading: input.subject,
      preheader: input.lines[0] ?? input.subject,
      body: [
        emailText(`Hi ${escapeHtml(input.name)},`),
        ...input.lines.map((line) => emailText(escapeHtml(line))),
        emailButton(input.portalUrl, input.button ?? "Open the partner portal"),
      ].join(""),
    });
    const text = [`Hi ${input.name},`, ``, ...input.lines, ``, input.portalUrl].join("\n");
    const result = await sendEmail({ to: input.to, subject: input.subject, html, text });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  },
};
