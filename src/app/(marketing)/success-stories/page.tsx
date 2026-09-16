import {
  ArrowRight,
  BarChart3,
  Bot,
  FileText,
  Link2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Success stories",
  description:
    "What RepGet customers measure: rankings, AI visibility, published articles and backlinks earned — and how the first results arrive.",
  alternates: { canonical: "/success-stories" },
};

/**
 * Success stories.
 *
 * The design asks for customer case studies. There are none yet — the product
 * is new — and the homepage already refuses to invent them, for the reason
 * written there: a fabricated testimonial is the fastest way to lose the first
 * real customer, and the first person to recognise a made-up business is
 * usually the one you most wanted to keep.
 *
 * So this page is about RESULTS rather than about customers. Everything on it
 * is something the product genuinely measures and shows in a dashboard, and
 * the page says plainly that the named stories are not here yet and invites
 * the reader to be the first. That is a weaker page than four logos and a
 * growth percentage, and it is one we can stand behind on the day someone
 * checks.
 *
 * WHEN REAL STORIES EXIST: replace RESULTS below with them. Keep the closing
 * invitation — a case-study page with a way in is worth more than one without.
 */

/**
 * The four things a customer watches, taken from what the dashboard actually
 * reports rather than from a marketing list. These are the same four the
 * homepage names, deliberately: a visitor who reads both should not find two
 * different accounts of what the product does.
 */
const RESULTS: { icon: LucideIcon; label: string; body: string }[] = [
  {
    icon: BarChart3,
    label: "Rankings and clicks",
    body: "Pulled from your own Search Console, not estimated. You see which queries you moved on, and what that was worth in clicks.",
  },
  {
    icon: Bot,
    label: "AI visibility",
    body: "Whether ChatGPT, Claude and Perplexity name your business when someone asks for what you sell. Checked on your own prompts.",
  },
  {
    icon: FileText,
    label: "Articles published",
    body: "What was written, when it went live, and what it did afterwards — so a month's work has an answer rather than an invoice.",
  },
  {
    icon: Link2,
    label: "Backlinks earned",
    body: "Real links inside real articles on other businesses' sites, checked daily. If one is removed, your credit comes back.",
  },
];

/** What actually happens, in the order it happens. No invented timelines. */
const TIMELINE = [
  {
    when: "Week one",
    body: "We crawl the site, find the technical problems holding it back, and plan a month of articles around what your customers actually search for.",
  },
  {
    when: "Weeks two to four",
    body: "Articles go live on your schedule. Backlinks start being placed as other businesses in the network publish theirs.",
  },
  {
    when: "Month two onward",
    body: "Search Console data arrives for the first articles. This is where rankings begin to move — SEO does not pay out in week one, and anyone promising otherwise is selling something else.",
  },
];

export default function SuccessStoriesPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Success stories
        </p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          We would rather show you what we measure than invent a customer.
        </h1>
        <p className="mt-5 max-w-2xl text-muted-foreground">
          RepGet is new, and we are not going to invent a business that used
          it or round someone&apos;s numbers up for a landing page. Here is what
          the product actually tracks, and what the first months honestly look
          like — so you can judge it on something real.
        </p>

        {/* What the dashboard reports. Everything here is a real feature. */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {RESULTS.map((result) => {
            const Icon = result.icon;
            return (
              <Card key={result.label}>
                <CardContent className="py-6">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="size-5 text-primary" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 font-semibold">{result.label}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {result.body}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <h2 className="mt-16 text-2xl font-semibold tracking-tight">
          What the first three months look like
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Honestly, including the part where nothing has happened yet.
        </p>

        <ol className="mt-8 space-y-4">
          {TIMELINE.map((step) => (
            <li
              key={step.when}
              className="flex flex-col gap-1 rounded-xl border bg-card p-5 sm:flex-row sm:gap-6"
            >
              <span className="shrink-0 text-sm font-semibold text-primary sm:w-40">
                {step.when}
              </span>
              <span className="text-sm text-muted-foreground">{step.body}</span>
            </li>
          ))}
        </ol>

        {/*
          The invitation, which is the point of the page as it stands. Someone
          reading a case-study page is deciding whether to trust us; the honest
          move is to ask them in rather than pretend the section is full.
        */}
        <div className="mt-16 rounded-2xl border bg-muted/40 p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            Be the first story on this page.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Start with a free check of your site — it takes a minute and costs
            nothing. If what we find is worth acting on, plans start at €1 for
            the first month.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/audit">
                Check my website
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
