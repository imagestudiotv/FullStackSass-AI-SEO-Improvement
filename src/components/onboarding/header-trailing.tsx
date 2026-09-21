"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * What sits at the right of the setup header, which differs by step.
 *
 * ON THE PLAN STEP the reference replaces the escape link with a "Secure
 * checkout" reassurance, and that is the one screen where it earns its place:
 * the customer is about to type card details, and the sentence that says the
 * card never reaches us was previously only at the very bottom of the form,
 * below the fold on a laptop — read after the decision rather than during it.
 *
 * "Skip for now" also actively works against that screen. Everywhere else it
 * is a fair way out for someone who signed in as the wrong account; beside a
 * price it reads as an invitation to not pay, which is not what a checkout
 * header should offer.
 *
 * A CLIENT COMPONENT so the layout around it can stay a server component —
 * the header needs the current path and nothing else, and making the whole
 * layout client-side to learn one string would drag the session read and the
 * organization recovery with it.
 */
export function HeaderTrailing() {
  const pathname = usePathname();
  const onPlanStep = pathname?.startsWith("/onboarding/plan") ?? false;

  if (onPlanStep) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Lock className="size-3.5" aria-hidden="true" />
        Secure checkout
      </span>
    );
  }

  return (
    <Link
      href="/dashboard"
      className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
    >
      Skip for now
    </Link>
  );
}
