import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Marketing homepage.
 *
 * Written for a small-business owner, not an SEO professional: it says what
 * the product does for their business, not which techniques it uses. No
 * invented statistics or customer counts — there are none yet, and a fake
 * "trusted by 10,000 businesses" is the fastest way to lose a real one.
 */
export default function HomePage() {
  const included = [
    "We read your website and learn what you do",
    "We find the searches your customers actually use",
    "We write and publish the articles that answer them",
    "You see exactly what improved",
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:py-28">
      <section className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Get found on Google, without hiring an agency
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
          We do the SEO work for your business — finding the terms worth going
          after, writing the pages, and showing you what changed.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {/* The free check leads: it costs the visitor nothing and shows
              real problems on their own site, which sells better than a
              sign-up form. */}
          <Button size="lg" asChild>
            <Link href="/audit">
              Check my website free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </section>

      {/*
        Anchored because the brief links to /#how-it-works from elsewhere.
        scroll-mt keeps the heading clear of the sticky header when jumped to.
      */}
      <section id="how-it-works" className="mt-16 scroll-mt-20 border-t pt-10">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          How it works
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-muted-foreground">
          Four steps, and we do all of them.
        </p>
        <ul className="mx-auto grid max-w-lg gap-3 text-left">
          {included.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10"
                aria-hidden="true"
              >
                <Check className="size-3 text-primary" />
              </span>
              <span className="text-sm text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Anchored for /#pricing, which the brief links to. */}
      <section id="pricing" className="mt-16 scroll-mt-20 border-t pt-10">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          Pricing
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-muted-foreground">
          Everything is included in every plan. The difference is how much we
          write for you each month, starting at EUR 1.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/pricing">
              See all plans
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          {/*
            The guarantee is a reason to start, so it belongs beside the
            pricing link rather than buried in the footer. It links to the
            refund policy rather than restating the terms, so there is one
            place those terms live.
          */}
          <Button variant="outline" asChild>
            <Link href="/refunds#guarantee">14-day money-back guarantee</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
