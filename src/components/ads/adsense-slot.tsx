"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { adsenseScriptUrl } from "@/lib/ads/adsense-config";
import { onConsentChange, readConsent } from "@/lib/consent";

/**
 * One AdSense unit on a blog article, and the loader it needs (ticket
 * 2026-11-19, item 7; lib/ads/adsense-config.ts).
 *
 * AFTER CONSENT ONLY. Nothing from Google is requested, and no space is
 * kept, until the visitor accepted cookies in the banner (lib/consent.ts);
 * accepting on the page brings the unit in, refusing removes it. The server
 * reads the same cookie and passes `consented`, so for a visitor who
 * accepted earlier the reserved box is in the first HTML and nothing shifts
 * when the ad arrives.
 *
 * BELOW THE FOLD, LAZILY. The script and the unit's request wait until the
 * box is within LAZY_MARGIN of the screen, so a reader who never scrolls
 * costs no third-party download (PageSpeed). The box has a fixed minimum
 * height, the AdSense way of keeping space for a responsive unit (its height
 * is never capped - Google asks for that).
 *
 * NO AD, NO BOX. Google marks a unit it has no ad for with
 * data-ad-status="unfilled"; the box and its label then go.
 *
 * The script is added by this bundle, so on the article pages' nonce policy
 * 'strict-dynamic' lets it, and what it loads, run (src/proxy.ts adds the
 * hosts it talks to and frames).
 */

const LAZY_MARGIN = "600px 0px";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** Adds adsbygoogle.js once per page. */
export function loadAdsense(client: string): void {
  if (document.getElementById("adsense-loader")) return;
  const script = document.createElement("script");
  script.id = "adsense-loader";
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = adsenseScriptUrl(client);
  document.head.appendChild(script);
}

/** Whether the visitor accepted cookies, following the banner live; the server's answer until hydrated. */
function useConsented(initial: boolean): boolean {
  return useSyncExternalStore(
    (onChange) => onConsentChange(() => onChange()),
    () => readConsent() === "granted",
    () => initial,
  );
}

/**
 * The loader alone, for an article with no unit configured yet: Google sees
 * its code on the page (after consent), and nothing is drawn.
 */
export function AdsenseLoader({ client, consented }: { client: string; consented: boolean }) {
  const granted = useConsented(consented);
  useEffect(() => {
    if (granted) loadAdsense(client);
  }, [granted, client]);
  return null;
}

export function AdsenseSlot({
  client,
  slot,
  format,
  label,
  consented,
}: {
  client: string;
  slot: string;
  /** "in-article": AdSense's in-article layout (fluid); "display": a responsive display unit. */
  format: "in-article" | "display";
  /** "Advertisement", in the article's language. */
  label: string;
  consented: boolean;
}) {
  const granted = useConsented(consented);
  const box = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    const element = box.current;
    // Refused after an ad was shown: the unit is gone, and a later Accept draws a new one.
    if (!granted) {
      pushed.current = false;
      return;
    }
    if (!element || pushed.current) return;
    const fill = () => {
      if (pushed.current) return;
      pushed.current = true;
      loadAdsense(client);
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        // A unit that cannot be filled leaves its box empty; the article is unaffected.
        console.error("[adsense] push failed", error);
      }
    };
    if (typeof IntersectionObserver === "undefined") return fill();
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          fill();
        }
      },
      { rootMargin: LAZY_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [granted, client]);

  if (!granted) return null;
  return (
    <aside aria-label={label} className="my-10 has-[ins[data-ad-status=unfilled]]:hidden">
      <p className="mb-1 text-center text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <div ref={box} className={format === "in-article" ? "min-h-[200px]" : "min-h-[280px]"}>
        {format === "in-article" ? (
          <ins
            className="adsbygoogle"
            style={{ display: "block", textAlign: "center" }}
            data-ad-layout="in-article"
            data-ad-format="fluid"
            data-ad-client={client}
            data-ad-slot={slot}
          />
        ) : (
          <ins
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client={client}
            data-ad-slot={slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        )}
      </div>
    </aside>
  );
}
