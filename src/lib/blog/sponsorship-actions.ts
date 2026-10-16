"use server";

import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { reserveAll, type QuotaRule } from "@/lib/billing/spend-quota";
import { blogPath } from "@/lib/blog/locale";
import { getPost } from "@/lib/blog/posts";
import { SPONSORSHIP_CENTS, SPONSORSHIP_CURRENCY, SPONSORSHIP_LIMITS, sponsorshipConfigured, sponsorshipThanksPath } from "@/lib/blog/sponsorship";
import { SPONSORSHIP_COPY } from "@/lib/blog/sponsorship-copy";
import { db } from "@/lib/db";
import { blogSponsorships } from "@/lib/db/schema";
import { LOCALES } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/site-url";
import { stripe } from "@/lib/stripe/client";
import { visitorKey } from "@/lib/visitor-key";

/**
 * Starts a "Get Featured" payment: records the request, then opens a Stripe
 * Checkout for €99 (lib/blog/sponsorship.ts). Public - no account needed -
 * so what it accepts is checked here, and how often anyone may start one is
 * capped (SPONSORSHIP_LIMITS, lib/blog/sponsorship.ts).
 *
 * The browser makes up the request's id when the form is sent and keeps it
 * while the details stay the same, so pressing the button twice, or again
 * after a network error, reuses the one request and its one checkout instead
 * of starting another.
 *
 * In the article's language (client, 2026-10-15; lib/blog/sponsorship-copy.ts):
 * the answers, Stripe's page, the way back from it and the page after paying.
 * The article is looked for in that language only, so a slug and a language
 * that do not belong together are refused like any unpublished article.
 */

const MESSAGE_LIMIT = 1000;

const inputSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(100),
  // Older pages sent none: English, as they were.
  locale: z.enum(LOCALES).default("en"),
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

/**
 * The page's words, from the language it sent, before the rest is checked: a
 * refusal is in its language too. Read defensively - a forged call can send
 * anything, even no object at all, and gets the English "invalid" answer.
 */
function wordsFor(input: unknown) {
  const sent = input && typeof input === "object" ? (input as { locale?: unknown }).locale : undefined;
  return SPONSORSHIP_COPY[LOCALES.find((candidate) => candidate === sent) ?? "en"];
}

export async function startBlogSponsorship(input: SponsorshipInput): Promise<Result> {
  const copy = wordsFor(input);
  const errors = copy.errors;
  if (!sponsorshipConfigured()) {
    return { error: errors.notConfigured };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: errors.invalid };
  }
  const website = websiteAddress(parsed.data.website);
  if (!website) return { error: errors.website };
  const data = { ...parsed.data, website };

  // The article in the page's language: /it/blog/<slug> for an Italian one.
  const post = await getPost(data.slug, data.locale);
  if (!post) return { error: errors.gone };

  // The same request again (a double click, a retry) is not a new one: no new slot, no new checkout.
  const [existing] = await db.select().from(blogSponsorships).where(eq(blogSponsorships.id, data.id));
  if (!existing) {
    const admitted = await reserveAll(limits(data.email, visitorKey(await headers())), {
      operation: "blog.sponsorship.checkout",
      metadata: { articleSlug: data.slug },
    });
    if (!admitted.ok) {
      return { error: admitted.rule.key === "blog-featured:global" ? errors.busy : errors.tooMany };
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
    return { error: errors.changed };
  }
  if (order.status !== "pending") {
    return { error: errors.alreadyPaid };
  }

  try {
    if (order.checkoutId) {
      const session = await stripe.checkout.sessions.retrieve(order.checkoutId);
      if (session.status === "open" && session.url) return { url: session.url };
      return { error: session.status === "complete" ? errors.alreadyPaid : errors.expired };
    }
    // Stripe forgets idempotency keys after a day; never risk a second checkout for an old request.
    if (Date.now() - order.createdAt.getTime() > 23 * 60 * 60 * 1000) {
      return { error: errors.expired };
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: data.email,
        client_reference_id: data.id,
        // Stripe's page in the article's language.
        locale: data.locale,
        metadata: { blogSponsorshipId: data.id, articleSlug: data.slug, articleLocale: data.locale },
        payment_intent_data: {
          description: `Featured placement: ${post.title}`.slice(0, 500),
          metadata: { blogSponsorshipId: data.id, articleSlug: data.slug, articleLocale: data.locale },
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: SPONSORSHIP_CURRENCY,
              unit_amount: SPONSORSHIP_CENTS,
              product_data: { name: copy.stripe.productName, description: post.title.slice(0, 200) },
            },
          },
        ],
        success_url: `${siteUrl()}${sponsorshipThanksPath(data.locale)}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl()}${blogPath(data.locale, encodeURIComponent(data.slug))}?featured=cancelled`,
        custom_text: {
          submit: { message: copy.stripe.submitMessage },
        },
      },
      { idempotencyKey: `blog-sponsorship:${data.id}` },
    );
    await db
      .update(blogSponsorships)
      .set({ checkoutId: session.id, checkoutUrl: session.url, updatedAt: new Date() })
      .where(eq(blogSponsorships.id, data.id));
    return session.url ? { url: session.url } : { error: errors.notOpened };
  } catch (error) {
    console.error("[blog-sponsorship] checkout failed", error);
    return { error: errors.failed };
  }
}
