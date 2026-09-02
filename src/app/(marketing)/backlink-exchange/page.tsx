import { ArrowRight, Check, Link2, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Backlink exchange",
  description:
    "Earn links to your website by publishing one article for another business. Relevant matches only, verified daily, credits refunded if a link is removed.",
  alternates: { canonical: "/backlink-exchange" },
};

/**
 * Public explainer for the backlink network.
 *
 * Every number and rule here is read from the implementation — one credit per
 * link, relevance as a hard filter, daily re-checks, refund after three
 * consecutive failures. A page that overstates how the network works is the
 * fastest way to lose the trust the network depends on, and link building is
 * a field where customers have usually been lied to before.
 */

const STEPS = [
  {
    title: "You host one article",
    body: "We write an article for another business in a related field and publish it on your site. It is a real article on a topic your readers care about, not a page of links.",
  },
  {
    title: "You earn a credit",
    body: "Hosting one article earns one credit. Your plan also includes credits every month, so you can start before you have hosted anything.",
  },
  {
    title: "You spend it on a link",
    body: "One credit buys one link to your site, written naturally into an article on someone else's website in a related field.",
  },
];

const RULES = [
  {
    icon: ShieldCheck,
    title: "Related businesses only",
    body: "A dentist is never matched with a crypto blog. If we cannot establish that two sites are topically related, we do not make the match — an irrelevant link is worth nothing and can do harm.",
  },
  {
    icon: RefreshCw,
    title: "Checked every day",
    body: "We re-check every link daily. Links do not silently disappear without you finding out.",
  },
  {
    icon: Check,
    title: "Credits refunded if a link goes",
    body: "If a link is removed, you get the credit back and it disappears from your dashboard. We do not count links that no longer exist.",
  },
];

export default function BacklinkExchangePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-muted">
          <Link2 className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
          Backlink exchange
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Links from other websites are one of the strongest signals Google
          uses, and the hardest thing for a small business to earn. Our network
          lets you earn them by helping someone else.
        </p>
      </div>

      <div className="mt-14 space-y-4">
        {STEPS.map((step, index) => (
          <Card key={step.title}>
            <CardContent className="flex gap-4 py-5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {index + 1}
              </div>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-14">
        <h2 className="text-xl font-medium tracking-tight">The rules</h2>
        <div className="mt-5 space-y-4">
          {RULES.map((rule) => (
            <div key={rule.title} className="flex gap-3">
              <rule.icon
                className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">{rule.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {rule.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/*
        Said plainly rather than buried. Anyone who has been sold link building
        before has been sold a private blog network, and the honest difference
        is worth more than a claim we cannot back.
      */}
      <div className="mt-14 rounded-lg border bg-muted/30 p-6">
        <h2 className="font-medium">What this is not</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This is not a private blog network, and we do not sell links. Every
          link sits inside a real article on a real business&apos;s website,
          published because that business wanted an article. Buying links is
          against Google&apos;s guidelines and can be penalised — which is
          exactly why the network works by exchange rather than by sale.
        </p>
      </div>

      <div className="mt-14 text-center">
        <p className="text-muted-foreground">
          The exchange is included in every plan, along with everything else.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/sign-up">
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
