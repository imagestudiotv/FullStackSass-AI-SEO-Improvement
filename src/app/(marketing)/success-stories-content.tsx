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
import type { Messages } from "@/lib/i18n/messages";

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
 * WHEN REAL STORIES EXIST: replace the `results` entries in messages.ts with
 * them. Keep the closing invitation — a case-study page with a way in is worth
 * more than one without.
 *
 * Copy comes from the dictionary, like the about and FAQ pages, so /es, /fr,
 * /it and /de render this same component in their own language rather than
 * drifting into five separate pages.
 */

/**
 * Icons stay in code while the words live in the dictionary: an icon is not
 * translatable, and putting a component name in a messages file would mean a
 * translator could break the build with a typo.
 *
 * Order matches `results` in the dictionary. A missing icon falls back rather
 * than throwing, so adding a fifth result cannot take the page down.
 */
const RESULT_ICONS: LucideIcon[] = [BarChart3, Bot, FileText, Link2];

export function SuccessStoriesContent({ t }: { t: Messages }) {
  const copy = t.successStories;

  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          {copy.eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-5 max-w-2xl text-muted-foreground">{copy.intro}</p>

        {/* What the dashboard reports. Everything here is a real feature. */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {copy.results.map((result, index) => {
            const Icon = RESULT_ICONS[index] ?? BarChart3;
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
          {copy.timelineTitle}
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {copy.timelineIntro}
        </p>

        <ol className="mt-8 space-y-4">
          {copy.timeline.map((step) => (
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
            {copy.ctaTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">{copy.ctaBody}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/audit">
                {copy.ctaPrimary}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/pricing">{copy.ctaSecondary}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
