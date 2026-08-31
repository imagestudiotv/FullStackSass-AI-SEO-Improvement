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
          <Button size="lg" asChild>
            <Link href="/sign-up">
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </section>

      <section className="mt-16 border-t pt-10">
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
    </div>
  );
}
