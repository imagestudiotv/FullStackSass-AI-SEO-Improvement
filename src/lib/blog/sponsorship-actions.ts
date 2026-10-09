"use server";

import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { reserveAll, type QuotaRule } from "@/lib/billing/spend-quota";
import { getPost } from "@/lib/blog/posts";
import { SPONSORSHIP_CENTS, SPONSORSHIP_CURRENCY, SPONSORSHIP_LIMITS, sponsorshipConfigured } from "@/lib/blog/sponsorship";
import { db } from "@/lib/db";
import { blogSponsorships } from "@/lib/db/schema";
import { siteUrl } from "@/lib/site-url";
import { stripe } from "@/lib/stripe/client";
import { visitorKey } from "@/lib/visitor-key";

/**
 * Starts a "Get Featured" payment: records the request, then opens a Stripe
 * Checkout for $99 (lib/blog/sponsorship.ts). Public - no account needed -
 * so what it accepts is checked here, and how often anyone may start one is
 * capped (SPONSORSHIP_LIMITS, lib/blog/sponsorship.ts).
 *
 * The browser makes up the request's id when the form is sent and keeps it
 * while the details stay the same, so pressing the button twice, or again
 * after a network error, reuses the one request and its one checkout instead
 * of starting another.
 */

const MESSAGE_LIMIT = 1000;

const inputSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  website: z.string().trim().min(1).max(2000),
  message: z.string().trim().min(1).max(MESSAGE_LIMIT),
});

export type SponsorshipInput = z.input<typeof inputSchema>;

/**
 * The website as a full address. People type "example.com" as often as
 * "https://example.com", so a missing scheme means https; anything that is
 * not a public web address is refused.
 */
function websiteAddress(value: string): string | null {
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".") || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function limits(email: string, visitor: string): QuotaRule[] {
  return [
    { key: `blog-featured:email:${sha(email)}`, limit: SPONSORSHIP_LIMITS.perEmailPerHour, window: { seconds: 3600 } },
    { key: `blog-featured:visitor:${visitor}`, limit: SPONSORSHIP_LIMITS.perVisitorPerHour, window: { seconds: 3600 } },
    { key: `blog-featured:visitor-day:${visitor}`, limit: SPONSORSHIP_LIMITS.perVisitorPerDay, window: { seconds: 86400 } },
    { key: "blog-featured:global", limit: SPONSORSHIP_LIMITS.globalPerHour, window: { seconds: 3600 } },
  ];
}

type Result = { url: string } | { error: string };

export async function startBlogSponsorship(input: SponsorshipInput): Promise<Result> {
  if (!sponsorshipConfigured()) {
    return { error: "Online payment is not available right now. Please contact us about a placement." };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Enter your email, your website and what you would like mentioned." };
  }
  const website = websiteAddress(parsed.data.website);
  if (!website) return { error: "Enter your website's address, for example yourwebsite.com." };
  const data = { ...parsed.data, website };

  const post = await getPost(data.slug);
  if (!post) return { error: "This article is no longer available." };

  // The same request again (a double click, a retry) is not a new one: no new slot, no new checkout.
  const [existing] = await db.select().from(blogSponsorships).where(eq(blogSponsorships.id, data.id));
  if (!existing) {
    const admitted = await reserveAll(limits(data.email, visitorKey(await headers())), {
      operation: "blog.sponsorship.checkout",
      metadata: { articleSlug: data.slug },
    });
    if (!admitted.ok) {
      return {
        error: admitted.rule.key === "blog-featured:global"
          ? "We are receiving a lot of requests right now. Please try again in a few minutes."
          : "Too many requests from you in a short time. Please try again in an hour.",
      };
    }
    await db
      .insert(blogSponsorships)
      .values({ id: data.id, postSlug: data.slug, email: data.email, websiteUrl: data.website, message: data.message })
      .onConflictDoNothing();
  }

  const [order] = await db.select().from(blogSponsorships).where(eq(blogSponsorships.id, data.id));
  if (
    !order ||
    order.email !== data.email ||
    order.postSlug !== data.slug ||
    order.websiteUrl !== data.website ||
    order.message !== data.message
  ) {
    return { error: "Your details changed while we were opening the payment. Please press the button again." };
  }
  if (order.status !== "pending") {
    return { error: "This request is already paid. We will be in touch at the email you gave." };
  }

  try {
    if (order.checkoutId) {
      const session = await stripe.checkout.sessions.retrieve(order.checkoutId);
      if (session.status === "open" && session.url) return { url: session.url };
      return {
        error:
          session.status === "complete"
            ? "This request is already paid. We will be in touch at the email you gave."
            : "That payment page has expired. Close this box and start again.",
      };
    }
    // Stripe forgets idempotency keys after a day; never risk a second checkout for an old request.
    if (Date.now() - order.createdAt.getTime() > 23 * 60 * 60 * 1000) {
      return { error: "That payment page has expired. Close this box and start again." };
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: data.email,
        client_reference_id: data.id,
        metadata: { blogSponsorshipId: data.id, articleSlug: data.slug },
        payment_intent_data: {
          description: `Featured placement: ${post.title}`.slice(0, 500),
          metadata: { blogSponsorshipId: data.id, articleSlug: data.slug },
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: SPONSORSHIP_CURRENCY,
              unit_amount: SPONSORSHIP_CENTS,
              product_data: { name: "Featured placement in a RepGet article", description: post.title.slice(0, 200) },
            },
          },
        ],
        success_url: `${siteUrl()}/blog/sponsorship/thanks?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl()}/blog/${encodeURIComponent(data.slug)}?featured=cancelled`,
        custom_text: {
          submit: { message: "One-time payment for a sponsored mention and link in this article. Subject to editorial approval." },
        },
      },
      { idempotencyKey: `blog-sponsorship:${data.id}` },
    );
    await db
      .update(blogSponsorships)
      .set({ checkoutId: session.id, checkoutUrl: session.url, updatedAt: new Date() })
      .where(eq(blogSponsorships.id, data.id));
    return session.url ? { url: session.url } : { error: "The payment page did not open. Please try again." };
  } catch (error) {
    console.error("[blog-sponsorship] checkout failed", error);
    return { error: "The payment page did not open. Please try again - you will not be charged twice." };
  }
}
