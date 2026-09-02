import { ArrowRight, Check, PenLine, ShieldCheck, Sliders } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Monetize your blog",
  description:
    "Host one article a month for a related business and earn link credits you can spend on backlinks to your own site.",
  alternates: { canonical: "/publishers" },
};

/**
 * The publisher side of the backlink network.
 *
 * The brief lists a "Monetize your blog" page. What we can honestly offer is
 * not money — it is credits, earned by hosting an article, spendable on links
 * back to your own site. That is a genuinely useful trade for a small
 * business, and it is what the code actually does.
 *
 * Saying "monetize" and then paying in credits would be the kind of surprise
 * that loses the publisher on their first payout, so the page leads with what
 * they actually get.
 */

const STEPS = [
  {
    title: "Tell us what your site is about",
    body: "Your topic, language and country. We only match you with businesses in a related field.",
  },
  {
    title: "Set how many articles a month",
    body: "Up to twenty, and most publishers start at three. You can pause or leave at any time.",
  },
  {
    title: "We write the article",
    body: "A real article on a topic your readers care about, written for your site, with one natural link in it.",
  },
  {
    title: "You earn a credit",
    body: "One credit per article hosted, spendable on a link back to your own site from someone else's.",
  },
];

const RULES = [
  {
    icon: ShieldCheck,
    title: "Related topics only",
    body: "You will never be asked to host something unrelated to your site. If we cannot establish that two sites are topically related, we do not make the match.",
  },
  {
    icon: Sliders,
    title: "You set the limit",
    body: "Between one and twenty articles a month, changed whenever you like. Set it to zero and you stop receiving requests.",
  },
  {
    icon: PenLine,
    title: "You keep editorial control",
    body: "Articles arrive as drafts on your site. Publish, edit or reject them — nothing goes live without you.",
  },
];

export default function PublishersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Monetize your blog
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Host one article a month for a business in a related field, and earn
          credits you can spend on links back to your own site.
        </p>
      </div>

      {/*
        The thing people assume wrongly, said before anything else. A page
        titled "monetize" that pays in credits has to be honest about that in
        the first breath, not in a footnote.
      */}
      <Card className="mt-10 border-primary/30">
        <CardContent className="py-5">
          <p className="font-medium">Credits, not cash</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You are paid in link credits rather than money. One hosted article
            earns one credit, and one credit buys you a link from another
            business&apos;s site. If you want cash for guest posts, this is not
            that — and there are marketplaces that do it.
          </p>
        </CardContent>
      </Card>

      <div className="mt-12 space-y-4">
        {STEPS.map((step, index) => (
          <Card key={step.title}>
            <CardContent className="flex gap-4 py-5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {index + 1}
              </div>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-14">
        <h2 className="text-xl font-medium tracking-tight">
          What you control
        </h2>
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

      <div className="mt-14 rounded-lg border bg-muted/30 p-6">
        <h2 className="font-medium">Who this suits</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A small business with a blog that already publishes occasionally, and
          wants links to its own pages without paying for them. If your site has
          no readers, hosting articles will not change that — the links you earn
          are worth what your site is worth.
        </p>
      </div>

      <div className="mt-14 text-center">
        <p className="text-muted-foreground">
          Joining is part of every plan. Turn it on from your website settings.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/sign-up">
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/backlink-exchange">
              <Check className="size-4" />
              How the exchange works
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
