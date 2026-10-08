"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { onConsentChange, onConsentSettingsOpen, openConsentSettings, readConsent, saveConsent, type Consent } from "@/lib/consent";
import {
  cleanReferrer,
  forgetGoogleAnalytics,
  measurementId,
  pauseGoogleAnalytics,
  startGoogleAnalytics,
  trackGooglePage,
} from "@/lib/google-analytics";
import { splitLocale, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const GA_ID = measurementId();

type Copy = Messages["consent"];

/** The server cannot know the answer; "unknown" until the browser has read it. */
const UNKNOWN = "unknown" as const;
const serverSnapshot = () => UNKNOWN;

/**
 * The analytics cookie banner, and the Google Analytics it controls
 * (lib/google-analytics.ts).
 *
 * Mounted on the public pages and on sign-in/sign-up only - the marketing
 * shell and the auth layout - and that is the whole of where GA counts:
 * leaving those pages unmounts this and silences GA, so the signed-in app
 * (whose page titles name customers' articles) and the admin area are never
 * sent to Google, even by a visitor who accepted.
 *
 * Renders nothing, and loads nothing, without NEXT_PUBLIC_GA4_MEASUREMENT_ID
 * or before the browser has read the stored answer, so the server's HTML and
 * the first paint never include it. Accept and Decline carry equal weight;
 * either one closes the banner, and "Cookie settings" (footer, privacy page)
 * opens it again.
 *
 * The words come from the server as props (`copy`) - never import
 * messages.ts here (lib/i18n/site-chrome.ts explains why). The public pages
 * pass every language and the address picks one; sign-in passes the one it
 * chose from the browser's languages, with `locale`.
 */
export function ConsentBanner({ copy, locale }: { copy: Partial<Record<Locale, Copy>>; locale?: Locale }) {
  const pathname = usePathname();
  const t = copy[locale ?? splitLocale(pathname).locale] ?? copy.en;
  const consent = useSyncExternalStore(onConsentChange, readConsent, serverSnapshot);
  const [reopened, setReopened] = useState(false);
  const visible = Boolean(GA_ID && t) && (consent === null || reopened);

  const panel = useRef<HTMLElement>(null);
  /** Where focus was when "Cookie settings" was pressed, to return it there. */
  const opener = useRef<HTMLElement | null>(null);
  const focusOnOpen = useRef(false);
  /** Accepted on this page: load GA now rather than when the browser is idle. */
  const justAccepted = useRef(false);
  /** The last page reported, as the next one's referrer. */
  const previous = useRef<string | null>(null);

  useEffect(
    () =>
      onConsentSettingsOpen(() => {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        focusOnOpen.current = true;
        setReopened(true);
      }),
    [],
  );

  useEffect(() => {
    if (!visible) return;
    if (focusOnOpen.current) {
      focusOnOpen.current = false;
      panel.current?.querySelector("button")?.focus();
    }
    // Phones: the chat bubble would sit on the buttons (globals.css).
    document.documentElement.setAttribute("data-consent-open", "");
    return () => document.documentElement.removeAttribute("data-consent-open");
  }, [visible]);

  // GA follows the answer, page by page, and falls silent when this unmounts.
  useEffect(() => {
    if (!GA_ID || consent !== "granted") return;
    startGoogleAnalytics(GA_ID, { soon: justAccepted.current });
    // After the commit, so document.title is the new page's.
    const timer = window.setTimeout(() => {
      const referrer = previous.current ?? cleanReferrer(document.referrer, window.location.origin);
      previous.current = trackGooglePage(GA_ID, { href: window.location.href, referrer, title: document.title }) ?? previous.current;
    }, 0);
    return () => {
      window.clearTimeout(timer);
      pauseGoogleAnalytics(GA_ID, true);
    };
  }, [consent, pathname]);

  if (!visible || !t) return null;

  const choose = (value: Consent) => {
    if (value === "granted") justAccepted.current = true;
    else if (GA_ID) forgetGoogleAnalytics(GA_ID);
    setReopened(false);
    saveConsent(value);
    opener.current?.focus();
    opener.current = null;
  };

  return (
    <section
      ref={panel}
      aria-label={t.label}
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 rounded-xl border bg-background p-4 text-sm shadow-lg sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[22rem]"
    >
      <p className="text-foreground">
        {t.message}{" "}
        <Link href="/privacy" className="font-medium underline underline-offset-4 hover:no-underline">
          {t.privacy}
        </Link>
      </p>
      {/* Same size and style, so neither answer is the easier one to give. Thumb-sized on phones. */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" className="max-sm:h-10" onClick={() => choose("denied")}>
          {t.decline}
        </Button>
        <Button type="button" variant="outline" size="lg" className="max-sm:h-10" onClick={() => choose("granted")}>
          {t.accept}
        </Button>
      </div>
    </section>
  );
}

/** Opens the banner again. Renders nothing when GA is not configured: there is no choice to change. */
export function CookieSettingsButton({ label, className }: { label: string; className?: string }) {
  if (!GA_ID) return null;
  return (
    <button
      type="button"
      onClick={openConsentSettings}
      className={cn("rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      {label}
    </button>
  );
}
