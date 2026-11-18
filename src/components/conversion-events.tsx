"use client";

import { useEffect } from "react";

import { readConsent } from "@/lib/consent";
import { mirrorMetaConversions } from "@/lib/conversions/meta-actions";
import { sendGoogleConversions, type BrowserConversion } from "@/lib/google-analytics";
import { claimMetaServerConversions, sendMetaConversions } from "@/lib/meta-pixel";

/**
 * Reports the conversions the server found due (lib/conversions/conversions.ts)
 * - a sign-up, the start of the free articles - to Google and the Meta Pixel, for a visitor who
 * accepted the cookie banner, and asks the server to send Meta its own copy
 * (Conversions API, same event ids). Rendered by the signed-in layouts only when
 * there is something to report, so it costs nothing otherwise. The layouts
 * re-render on router.refresh(), which is how a free-articles start found
 * while the checkout page waits for Stripe still gets sent.
 */
export function ConversionEvents({ events }: { events: BrowserConversion[] }) {
  useEffect(() => {
    const consent = readConsent();
    sendGoogleConversions(events, consent);
    sendMetaConversions(events, consent);
    const ids = claimMetaServerConversions(events, consent);
    if (ids.length > 0) void mirrorMetaConversions(ids).catch(() => {});
  }, [events]);
  return null;
}
