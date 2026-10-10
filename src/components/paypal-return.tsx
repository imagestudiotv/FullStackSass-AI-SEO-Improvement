"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { confirmPayPalReturn } from "@/lib/paypal/actions";

/**
 * Settles a return from PayPal for the website on screen
 * (lib/paypal/actions.ts confirmPayPalReturn), rendered by /billing and the
 * onboarding plan step when PayPal sends the customer back.
 *
 *  - "success": the subscription is read back from PayPal and recorded, so
 *    the plan appears even when PayPal's webhook is late or never comes.
 *  - "cancelled": an approval the customer walked away from is released, so
 *    it stops blocking card checkout, other plans and deleting the website.
 *
 * A Server Action rather than work in the page because both are writes,
 * which a render cannot do. The outcome is read once, at mount: the page
 * strips the return parameters from the address, and the refresh below
 * must not cut the retries short. Nothing here grants anything - the server
 * acts only on what PayPal says when asked.
 */

/** Asked again while PayPal is still activating: activation can trail the redirect by seconds. */
const RETRY_MS = [3000, 6000, 12000];

export function PayPalReturn({
  outcome,
  websiteId,
}: {
  /** The page's ?paypal= value; anything but "success" or "cancelled" does nothing. */
  outcome: string | undefined;
  /** The website the page is about, from the session; null does nothing. */
  websiteId: string | null;
}) {
  const router = useRouter();
  const [initial] = useState(() => ({ outcome, websiteId }));

  useEffect(() => {
    const { outcome: result, websiteId: site } = initial;
    if (!site || (result !== "success" && result !== "cancelled")) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = async (n: number) => {
      try {
        const settled = await confirmPayPalReturn(site, result);
        if (stopped) return;
        if (settled.changed) router.refresh();
        if (settled.waiting && n < RETRY_MS.length) {
          timer = setTimeout(() => void attempt(n + 1), RETRY_MS[n]);
        }
      } catch {
        // The webhook and the maintenance job still record it; the page must not break.
      }
    };
    void attempt(0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [initial, router]);

  return null;
}
