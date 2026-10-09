import "server-only";

import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";

import { adminEmails } from "@/lib/admin/guard";
import { getPost } from "@/lib/blog/posts";
import { db } from "@/lib/db";
import { blogSponsorships } from "@/lib/db/schema";
import { escapeHtml, emailButton, emailLayout, emailText } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { siteUrl } from "@/lib/site-url";
import { isStripeConfigured } from "@/lib/stripe/client";

/**
 * "Get Featured in This Article" on RepGet's own blog (client, 2026-10-08):
 * a reader pays $99, once, through Stripe, for a sponsored mention and a
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
 */

export const SPONSORSHIP_CENTS = 9900;
export const SPONSORSHIP_CURRENCY = "usd";

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
 * one-time payment, paid, for exactly $99 in US dollars. Only a pending
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
    session.amount_total !== SPONSORSHIP_CENTS ||
    session.currency !== SPONSORSHIP_CURRENCY
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
  if (moved.length > 0) await notifyAdmins(order);
  return moved.length > 0 || order.status !== "pending";
}

/** Emails the administrators about a newly paid request. Never throws: the payment is recorded either way. */
async function notifyAdmins(order: typeof blogSponsorships.$inferSelect): Promise<void> {
  const to = adminEmails();
  if (to.length === 0) return;
  try {
    const post = await getPost(order.postSlug);
    const title = post?.title ?? `/blog/${order.postSlug}`;
    const review = `${siteUrl()}/admin/blog/sponsorships`;
    const html = emailLayout({
      heading: "New paid placement to review",
      preheader: `$99 paid for a mention in “${title}”.`,
      body: [
        emailText(`<strong>${escapeHtml(order.email)}</strong> paid $99 for a sponsored mention in <strong>${escapeHtml(title)}</strong>.`),
        emailText(`Website: ${escapeHtml(order.websiteUrl)}`),
        emailText(`What they would like mentioned:<br>${escapeHtml(order.message)}`),
        emailButton(review, "Review the request"),
      ].join(""),
    });
    const text = [
      `${order.email} paid $99 for a sponsored mention in "${title}".`,
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
