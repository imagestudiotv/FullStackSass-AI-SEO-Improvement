import { ArrowRight, Gift } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/shared";

export const metadata = {
  title: "Refer a business",
  description:
    "Share your link and earn link credits when someone you refer starts a paid plan.",
  alternates: { canonical: "/affiliate" },
};

/**
 * Public page for the referral programme.
 *
 * The reward figure is imported from the implementation rather than typed
 * here, so the advertised number cannot drift from the number actually paid.
 *
 * Everything else is stated plainly for the same reason: the reward is account
 * credit rather than cash, and it arrives when the referred customer pays
 * rather than when they sign up. Someone who discovers either of those after
 * sharing a link with twenty people has been misled, and this page is where
 * they would find out.
 */

const STEPS = [
  {
    title: "Share your link",
    body: "Every workspace gets a link. You will find it in Settings once you sign up.",
  },
  {
    title: "They sign up and subscribe",
    body: "Nothing is owed while someone is only trying the product. The referral counts when they pay for their first month.",
  },
  {
    title: `You get ${REFERRAL_REWARD_CREDITS} credits`,
    body: "Credits land in your account automatically and can be spent on backlinks straight away.",
  },
];

export default function AffiliatePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-muted">
          <Gift className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
          Refer a business
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Know another business that needs to be found on Google? Share your
          link and earn {REFERRAL_REWARD_CREDITS} link credits when they
          subscribe.
        </p>
      </div>

      <div className="mt-12 space-y-4">
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

      {/*
        The terms, before anyone shares a link rather than after. Credit rather
        than cash is the part people most often assume otherwise, so it leads.
      */}
      <div className="mt-12 rounded-lg border bg-muted/30 p-6">
        <h2 className="font-medium">The terms, plainly</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            The reward is {REFERRAL_REWARD_CREDITS} link credits, not cash.
            Credits are spent inside the platform and cannot be withdrawn.
          </li>
          <li>
            A referral counts once the person you referred pays for their first
            month. Signups alone earn nothing.
          </li>
          <li>Each business can be referred once.</li>
          <li>
            You cannot refer yourself, including with a second workspace.
          </li>
        </ul>
      </div>

      <div className="mt-12 text-center">
        <p className="text-muted-foreground">
          Your referral link is in Settings once you have an account.
        </p>
        <Button asChild className="mt-5">
          <Link href="/sign-up">
            Get started
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
