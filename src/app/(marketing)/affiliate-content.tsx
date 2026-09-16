import { ArrowRight, Gift } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Messages } from "@/lib/i18n/messages";
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/shared";

/**
 * Public page for the referral programme.
 *
 * The reward figure is imported from the implementation rather than typed
 * here, so the advertised number cannot drift from the number actually paid.
 * That is also why the translated terms below never contain the figure: a
 * number inside a sentence in five languages is five places to forget when it
 * changes, so the sentence carries the rule and the figure is rendered beside
 * it from the constant.
 *
 * Everything else is stated plainly for the same reason: the reward is account
 * credit rather than cash, and it arrives when the referred customer pays
 * rather than when they sign up. Someone who discovers either of those after
 * sharing a link with twenty people has been misled, and this page is where
 * they would find out.
 */
export function AffiliateContent({ t }: { t: Messages }) {
  const copy = t.affiliate;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-muted">
          <Gift className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
          {copy.title}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          {copy.intro}
        </p>
      </div>

      <div className="mt-12 space-y-4">
        {copy.steps.map((step, index) => (
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

      {/*
        The terms, before anyone shares a link rather than after. Credit rather
        than cash is the part people most often assume otherwise, so it leads.
      */}
      <div className="mt-12 rounded-lg border bg-muted/30 p-6">
        <h2 className="font-medium">{copy.termsTitle}</h2>
        {/*
          The figure stands on its own line rather than inside a translated
          sentence: a number embedded in copy is five places to forget when the
          reward changes, and it is imported so it cannot drift from what the
          webhook actually credits.
        */}
        <p className="mt-2 text-sm font-medium tabular-nums text-foreground">
          {REFERRAL_REWARD_CREDITS}
        </p>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {copy.terms.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      </div>

      <div className="mt-12 text-center">
        <p className="text-muted-foreground">{copy.ctaNote}</p>
        <Button asChild className="mt-5">
          <Link href="/sign-up">
            {copy.ctaPrimary}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
