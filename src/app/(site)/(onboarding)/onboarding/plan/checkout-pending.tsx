"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { getMessages, type Messages } from "@/lib/i18n/messages";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Shown for the few seconds between paying and the subscription existing.
 *
 * Stripe returns the browser as soon as the payment is authorised; the
 * subscription row is written by the webhook, which arrives separately and
 * usually within a second or two. In that gap the customer has paid and the
 * database does not know it yet.
 *
 * Showing the plan picker during that gap is the worst option available: it
 * asks someone who has just been charged to pay again. This says what has
 * actually happened and moves on by itself.
 *
 * IT GRANTS NOTHING. It refreshes, and the server decides — the page above
 * forwards to the next step the moment real subscription state says the plan
 * is live. Anyone opening this URL by hand simply waits here and is then sent
 * back to the picker by the timeout below.
 */

/** How often to ask the server whether the webhook has landed. */
const POLL_MS = 2000;

/**
 * When to stop waiting and say so.
 *
 * Webhooks normally arrive in under two seconds. Thirty is long enough that a
 * slow delivery still resolves on its own, and short enough that a customer
 * whose webhook never arrives is not left watching a spinner indefinitely —
 * they get a route to support instead.
 */
const GIVE_UP_MS = 30000;

export function CheckoutPending({
  websiteId,
  t = getMessages("en").app.onboarding,
}: {
  websiteId: string;
  /** This screen's copy, defaulting to English. */
  t?: Messages["app"]["onboarding"];
}) {
  const router = useRouter();
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setWaited((ms) => ms + POLL_MS);
      /*
        refresh() re-runs the server component, which redirects onward as soon
        as the subscription is real. No client-side entitlement check exists
        here, deliberately — the server is the only thing that decides.
      */
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [router]);

  const stuck = waited >= GIVE_UP_MS;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
        {stuck ? (
          <CheckCircle2
            className="size-7 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
        ) : (
          <Loader2
            className="size-7 animate-spin text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
        )}
      </span>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">
        {stuck ? "Payment received" : "Payment received - setting up"}
      </h1>

      <p className="mt-3 text-muted-foreground">
        {stuck ? (
          <>
            {t.paymentTakingLonger}
            </>
        ) : (
          <>
            {t.activatingNow}
            </>
        )}
      </p>

      {/*
        A way out once waiting has stopped being useful. Both links go
        somewhere that reads real state, so neither can show a plan as active
        before it is.
      */}
      {stuck ? (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className="h-11 rounded-full px-6">
            <Link href={`/websites/${websiteId}`}>{t.goToMyWebsite}</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-full px-6">
            <Link href="/billing">{t.checkBilling}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
