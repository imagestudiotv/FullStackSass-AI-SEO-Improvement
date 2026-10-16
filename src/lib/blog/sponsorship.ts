import "server-only";

import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";

import { adminEmails } from "@/lib/admin/guard";
import { blogPath, LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import { getPostInAnyLanguage } from "@/lib/blog/posts";
import { db } from "@/lib/db";
import { blogSponsorships } from "@/lib/db/schema";
import { escapeHtml, emailButton, emailLayout, emailText } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import type { Locale } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/site-url";
import { isStripeConfigured } from "@/lib/stripe/client";

/**
 * "Get Featured in This Article" on RepGet's own blog (client, 2026-10-08):
 * a reader pays €99, once, through Stripe, for a sponsored mention and a
 * link inside the article, subject to editorial approval. Nothing is added
 * to an article automatically - an administrator reviews each paid request
 * (Admin -> Blog -> Featured placements) and edits the article by hand.
 *
 * Paid through RepGet's existing Stripe account and confirmed by its existing
 * webhook (lib/billing/stripe-events.ts): a session carrying
 * metadata.blogSponsorshipId is a placement, never an add-on. So it works
 * wherever subscriptions do, with no extra key, endpoint or event.
 *
 * A request's status:
 *   pending   - the buyer started checkout and has not paid (or gave up)
 *   paid      - Stripe confirmed the payment: waiting for review
 *   published - an administrator placed the mention
 *   declined  - an administrator declined it (anything owed is settled by
 *               hand, in Stripe; nothing is promised on the page)
 *
 * On every language's articles (client, 2026-10-15): a request names its
 * article by slug, which is unique across languages, so the article's own
 * row says which language it is in; the buyer sees the offer, Stripe's page
 * and the page after paying in that language (lib/blog/sponsorship-copy.ts).
 */

/** In euros since 2026-10-16 (client: "change the currency from USD to EUR"); US dollars before. */
export const SPONSORSHIP_CENTS = 9900;
export const SPONSORSHIP_CURRENCY = "eur";
/** The price as administrators read it (the admin list). Buyers see sponsorship-copy.ts. */
export const SPONSORSHIP_PRICE_LABEL = "€99";

/**
 * Prices a request's checkout may carry from before the current one. A buyer
 * who opened the dollar checkout just before the switch to euros can still
 * pay it while Stripe keeps it open (24 hours) - the same request is shown
 * the same checkout again - and that payment must count, not be left
 * "pending" with the money taken.
 */
const EARLIER_PRICES: ReadonlyArray<{ cents: number; currency: string }> = [{ cents: 9900, currency: "usd" }];

/** The session paid the price of a placement: today's, or one a checkout opened earlier still carries. */
function paidThePrice(session: Pick<Stripe.Checkout.Session, "amount_total" | "currency">): boolean {
  return [{ cents: SPONSORSHIP_CENTS, currency: SPONSORSHIP_CURRENCY }, ...EARLIER_PRICES].some(
    (price) => session.amount_total === price.cents && session.currency === price.currency,
  );
}

/** What a session actually took, e.g. "€99.00" - for the administrators' email. */
function amountPaid(session: Pick<Stripe.Checkout.Session, "amount_total" | "currency">): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: (session.currency ?? SPONSORSHIP_CURRENCY).toUpperCase() }).format(
    (session.amount_total ?? 0) / 100,
  );
}

/**
 * Each request is a Stripe call on the account that also runs subscriptions,
 * and a row in the admin list. Capped per buyer, per visitor and overall, as
 * the free tools are (lib/tools/description-writer.ts), so a script cannot
 * flood either (lib/blog/sponsorship-actions.ts).
 */
export const SPONSORSHIP_LIMITS = {
  perEmailPerHour: 5,
  perVisitorPerHour: 5,
  perVisitorPerDay: 20,
  globalPerHour: 60,
};

export const SPONSORSHIP_STATUSES = ["pending", "paid", "published", "declined"] as const;
export type SponsorshipStatus = (typeof SPONSORSHIP_STATUSES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True wherever Stripe is: the button then leads to checkout instead of the contact page. */
export function sponsorshipConfigured(): boolean {
  return isStripeConfigured();
}

/** The page Stripe returns a buyer to, in the article's language: /blog/sponsorship/thanks, /it/blog/sponsorship/thanks... */
export function sponsorshipThanksPath(locale: Locale): string {
  return `${blogPath(locale)}/sponsorship/thanks`;
}

/** A Checkout Session started by a "Get Featured" request, whatever its state. */
export function isSponsorshipSession(session: Pick<Stripe.Checkout.Session, "metadata">): boolean {
  return Boolean(session.metadata?.blogSponsorshipId);
}

/**
 * Marks a request paid, once Stripe says so. Only ever called with a session
 * from a signature-verified webhook or read from Stripe with the secret key,
 * never with anything a browser sent.
 *
 * Paid means all of it: the session is the one stored for this request, a
 * one-time payment, paid, for exactly the price (€99; see EARLIER_PRICES for
 * a checkout opened before the switch from dollars). Only a pending
 * request moves, so a replayed event changes nothing and a request an
 * administrator has already handled stays handled. Returns whether the
 * request is paid (or beyond) now.
 */
export async function confirmSponsorship(session: Stripe.Checkout.Session): Promise<boolean> {
  const id = session.metadata?.blogSponsorshipId;
  if (
    !id ||
    !UUID.test(id) ||
    session.mode !== "payment" ||
    session.payment_status !== "paid" ||
    !paidThePrice(session)
  ) {
    return false;
  }

  const [order] = await db.select().from(blogSponsorships).where(eq(blogSponsorships.id, id));
  if (!order) return false;
  // The session was created but its id not yet written: the webhook retries.
  if (!order.checkoutId) throw new Error(`[blog-sponsorship] ${id}: checkout not recorded yet`);
  if (order.checkoutId !== session.id) return false;

  const now = new Date();
  const moved = await db
    .update(blogSponsorships)
    .set({ status: "paid", paidAt: now, updatedAt: now })
    .where(and(eq(blogSponsorships.id, id), eq(blogSponsorships.checkoutId, session.id), eq(blogSponsorships.status, "pending")))
    .returning({ id: blogSponsorships.id });

  // Told once, by whichever confirmation got there first (webhook or thanks page).
  if (moved.length > 0) await notifyAdmins(order, amountPaid(session));
  return moved.length > 0 || order.status !== "pending";
}

/** Emails the administrators about a newly paid request. Never throws: the payment is recorded either way. */
async function notifyAdmins(order: typeof blogSponsorships.$inferSelect, paid: string): Promise<void> {
  const to = adminEmails();
  if (to.length === 0) return;
  try {
    const post = await getPostInAnyLanguage(order.postSlug);
    const title = post?.title ?? `/blog/${order.postSlug}`;
    // Which language's article: an Italian request is placed in the Italian article.
    const language = post?.locale && post.locale !== "en" ? ` (${LANGUAGE_NAMES_EN[post.locale]}, ${blogPath(post.locale, post.slug)})` : "";
    const review = `${siteUrl()}/admin/blog/sponsorships`;
    const html = emailLayout({
      heading: "New paid placement to review",
      preheader: `${paid} paid for a mention in “${title}”.`,
      body: [
        emailText(`<strong>${escapeHtml(order.email)}</strong> paid ${escapeHtml(paid)} for a sponsored mention in <strong>${escapeHtml(title)}</strong>${escapeHtml(language)}.`),
        emailText(`Website: ${escapeHtml(order.websiteUrl)}`),
        emailText(`What they would like mentioned:<br>${escapeHtml(order.message)}`),
        emailButton(review, "Review the request"),
      ].join(""),
    });
    const text = [
      `${order.email} paid ${paid} for a sponsored mention in "${title}"${language}.`,
      `Website: ${order.websiteUrl}`,
      `What they would like mentioned: ${order.message}`,
      `Review it: ${review}`,
    ].join("\n\n");
    for (const address of to) {
      await sendEmail({ to: address, subject: `Paid placement request: ${title}`, html, text, replyTo: order.email });
    }
  } catch (error) {
    console.error("[blog-sponsorship] admin notification failed", error);
  }
}
