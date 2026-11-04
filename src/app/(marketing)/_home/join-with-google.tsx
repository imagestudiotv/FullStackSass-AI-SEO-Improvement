"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

import { googleErrorPath } from "@/lib/auth/next";

/**
 * The hero's "Join with Google": starts the same Google sign-in as the
 * sign-up page's button (components/auth-form.tsx), so it does what it says.
 *
 * Referrals need nothing from here: the `ref` and `repget_partner` cookies are
 * set before sign-up, to survive this very round trip to Google.
 *
 * A real link to sign-up underneath, so it works before the page has loaded
 * its scripts and opens in a new tab like any link, and anything that goes
 * wrong on the way to Google lands on the page that explains it. Someone
 * already signed in goes where the link was taking them, as sign-up does,
 * rather than being asked to pick a Google account again.
 *
 * The auth client loads on the click: the homepage's first paint does not pay
 * for a sign-in most visitors never start.
 */
export function JoinWithGoogle({
  className,
  signUpHref,
  next,
  loginHint,
  children,
}: {
  className?: string;
  /** Sign-up, carrying whatever the visitor typed. */
  signUpHref: string;
  /** Where to land afterwards. */
  next: string;
  /** The email the visitor typed, so Google offers that account first. */
  loginHint?: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);

  // Coming back from Google with the browser's back button restores this page as it was.
  useEffect(() => {
    const ready = () => setPending(false);
    window.addEventListener("pageshow", ready);
    return () => window.removeEventListener("pageshow", ready);
  }, []);

  async function start(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const { authClient } = await import("@/lib/auth-client");
      const { data: session } = await authClient.getSession();
      if (session) {
        window.location.assign(next);
        return;
      }
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: next,
        errorCallbackURL: googleErrorPath(next),
        ...(loginHint ? { loginHint } : {}),
      });
      if (error) window.location.assign(signUpHref);
      // Otherwise Better Auth is on its way to Google; stay busy until the page goes.
    } catch {
      window.location.assign(signUpHref);
    }
  }

  return (
    <a className={className} href={signUpHref} onClick={start} aria-busy={pending || undefined}>
      {children}
    </a>
  );
}
