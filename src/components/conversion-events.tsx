"use client";

import { useEffect } from "react";

import { readConsent } from "@/lib/consent";
import { sendGoogleConversions, type BrowserConversion } from "@/lib/google-analytics";

/**
 * Reports the conversions the server found due (lib/conversions/conversions.ts)
 * - a sign-up, the start of the free articles - to Google, for a visitor who
 * accepted the cookie banner. Rendered by the signed-in layouts only when
 * there is something to report, so it costs nothing otherwise. The layouts
 * re-render on router.refresh(), which is how a free-articles start found
 * while the checkout page waits for Stripe still gets sent.
 */
export function ConversionEvents({ events }: { events: BrowserConversion[] }) {
  useEffect(() => {
    sendGoogleConversions(events, readConsent());
  }, [events]);
  return null;
}
