import { eq } from "drizzle-orm";
import { CircleCheck, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getPost } from "@/lib/blog/posts";
import { confirmSponsorship, sponsorshipConfigured } from "@/lib/blog/sponsorship";
import { db } from "@/lib/db";
import { blogSponsorships } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe/client";

/**
 * Where Stripe sends a buyer after paying for a "Get Featured" placement
 * (lib/blog/sponsorship-actions.ts). It never takes the address bar's word
 * for anything: the request is looked up by its stored checkout id first, so
 * a made-up id costs a database read and no call to Stripe; only a request
 * still waiting for its payment is checked with Stripe (the webhook usually
 * got there first).
 *
 * No promises beyond what the offer said: the placement is reviewed before
 * it is published.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your placement request",
  robots: { index: false, follow: false },
};

export default async function SponsorshipThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  const { session_id: sessionId } = await searchParams;
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
  const post = order ? await getPost(order.postSlug) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <div className="rounded-2xl border bg-card p-8 sm:p-10">
        {paid ? (
          <CircleCheck className="size-10 text-success" aria-hidden="true" />
        ) : (
          <Clock className="size-10 text-muted-foreground" aria-hidden="true" />
        )}
        <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
          {paid ? "Thank you - your payment is confirmed" : "We are confirming your payment"}
        </h1>
        {paid && order ? (
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p>
              Your request for a sponsored mention
              {post ? (
                <>
                  {" "}
                  in <span className="font-medium text-foreground">{post.title}</span>
                </>
              ) : null}{" "}
              is with our editors. Every placement is reviewed before it is published.
            </p>
            <p>
              We will write to <span className="font-medium text-foreground">{order.email}</span> about your placement.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-muted-foreground">
            <p>
              We have not received confirmation of a payment for this page yet. If you have just paid, it can take a
              moment: refresh this page shortly.
            </p>
            <p>Please do not pay again. If something looks wrong, contact us and we will check it for you.</p>
          </div>
        )}
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium">
          {post ? (
            <Link href={`/blog/${post.slug}`} className="underline underline-offset-4">
              Back to the article
            </Link>
          ) : (
            <Link href="/blog" className="underline underline-offset-4">
              Back to the blog
            </Link>
          )}
          <Link href="/contact" className="underline underline-offset-4">
            Contact us
          </Link>
        </div>
      </div>
    </div>
  );
}
