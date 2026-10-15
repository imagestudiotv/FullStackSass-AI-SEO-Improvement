import { eq } from "drizzle-orm";
import { CircleCheck, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { blogPath } from "@/lib/blog/locale";
import { getPostInAnyLanguage } from "@/lib/blog/posts";
import { confirmSponsorship, sponsorshipConfigured } from "@/lib/blog/sponsorship";
import { SPONSORSHIP_COPY } from "@/lib/blog/sponsorship-copy";
import { db } from "@/lib/db";
import { blogSponsorships } from "@/lib/db/schema";
import { localePath, type Locale } from "@/lib/i18n/config";
import { stripe } from "@/lib/stripe/client";

/**
 * Where Stripe sends a buyer after paying for a "Get Featured" placement
 * (lib/blog/sponsorship-actions.ts), in the article's language: the English
 * route (/blog/sponsorship/thanks) and the others (/it/blog/sponsorship/thanks)
 * draw this page. It never takes the address bar's word for anything: the
 * request is looked up by its stored checkout id first, so a made-up id costs
 * a database read and no call to Stripe; only a request still waiting for its
 * payment is checked with Stripe (the webhook usually got there first).
 *
 * No promises beyond what the offer said: the placement is reviewed before
 * it is published. Not for search engines.
 */

export function sponsorshipThanksMetadata(locale: Locale): Metadata {
  return { title: SPONSORSHIP_COPY[locale].thanks.metaTitle, robots: { index: false, follow: false } };
}

/** "{name}" in a sentence, the value drawn in its own style. */
function withValue(template: string, name: string, value: ReactNode): ReactNode {
  const [before, after] = template.split(`{${name}}`);
  return (
    <>
      {before}
      {value}
      {after}
    </>
  );
}

export async function sponsorshipThanksPage({
  locale,
  sessionId,
}: {
  locale: Locale;
  sessionId: string | string[] | undefined;
}) {
  const t = SPONSORSHIP_COPY[locale].thanks;
  const id = typeof sessionId === "string" && /^cs_[a-zA-Z0-9_]{10,250}$/.test(sessionId) ? sessionId : null;

  const [order] = id ? await db.select().from(blogSponsorships).where(eq(blogSponsorships.checkoutId, id)).limit(1) : [];
  let paid = Boolean(order && order.status !== "pending");
  if (order && !paid && sponsorshipConfigured()) {
    try {
      paid = await confirmSponsorship(await stripe.checkout.sessions.retrieve(order.checkoutId!));
    } catch (error) {
      // The webhook confirms it independently; this page only reports.
      console.error("[blog-sponsorship] thanks page check failed", error);
    }
  }
  const post = order ? await getPostInAnyLanguage(order.postSlug) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <div className="rounded-2xl border bg-card p-8 sm:p-10">
        {paid ? (
          <CircleCheck className="size-10 text-success" aria-hidden="true" />
        ) : (
          <Clock className="size-10 text-muted-foreground" aria-hidden="true" />
        )}
        <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">{paid ? t.paidTitle : t.waitingTitle}</h1>
        {paid && order ? (
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p>
              {post
                ? withValue(t.paidWithTitle, "title", <span className="font-medium text-foreground">{post.title}</span>)
                : t.paidWithoutTitle}
            </p>
            <p>{withValue(t.writeTo, "email", <span className="font-medium text-foreground">{order.email}</span>)}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p>{t.waitingBody}</p>
            <p>{t.doNotPayAgain}</p>
          </div>
        )}
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium">
          {post ? (
            <Link href={blogPath(post.locale ?? "en", post.slug)} className="underline underline-offset-4">
              {t.backToArticle}
            </Link>
          ) : (
            <Link href={blogPath(locale)} className="underline underline-offset-4">
              {t.backToBlog}
            </Link>
          )}
          <Link href={localePath(locale, "/contact")} className="underline underline-offset-4">
            {t.contact}
          </Link>
        </div>
      </div>
    </div>
  );
}
