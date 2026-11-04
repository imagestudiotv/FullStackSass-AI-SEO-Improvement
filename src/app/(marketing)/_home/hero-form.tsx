"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { CALLBACK_URL } from "@/lib/auth/next";
import type { FinalCtaCopy } from "@/lib/i18n/home/final-cta";
import type { HeroCopy } from "@/lib/i18n/home/hero";
import { JoinWithGoogle } from "./join-with-google";
import styles from "./sections/hero.module.css";
import { cleanEmail, cleanWebsite, signUpWithEmail, signUpWithWebsite, websiteStep } from "./start-field";

/** Every word the field and the row under it show, handed down by the hero (a server component). */
export type HeroFormStrings = Pick<
  HeroCopy["hero"],
  | "websiteLabel"
  | "emailLabel"
  | "websitePlaceholder"
  | "emailPlaceholder"
  | "startTrial"
  | "useEmail"
  | "useWebsite"
  | "invalidWebsite"
  | "invalidEmail"
  | "moreWays"
  | "noWebsite"
  | "buildOne"
> &
  Pick<FinalCtaCopy["form"], "emptyWebsite" | "emptyEmail">;

type Mode = "website" | "email";

/** The design's timings (`rgx-balanced-interactions`): first start, after a switch, after the field is emptied. */
const START_DELAY = 450;
const SWITCH_DELAY = 170;
const CLEARED_DELAY = 580;

/**
 * The hero's field (client's design, 2026-11-03): a website by default, an
 * email on request ("Use your email instead"), and under it the way to ask
 * for a website when there is none.
 *
 * It only navigates. A website goes through sign-up to the website step with
 * the address pre-filled (`?next=` -> /onboarding/website?domain=); an email
 * goes to sign-up with the address pre-filled (`?email=`, read by the sign-up
 * page). Nothing is created or crawled from here, so there is one sign-up and
 * one website check, not a second copy of either. "Join with Google" lives here
 * too because it carries whatever has been typed so far: a valid website to
 * the website step, a valid email as the account Google offers first.
 *
 * The benefits and "See how it works" sit between and beside those controls in
 * the design, so the hero hands them in rather than wrapping them in here.
 *
 * The placeholder types itself out, as drawn. It is only ever the
 * placeholder - never the field's value, so nothing a visitor did not type
 * can be submitted - and it stops while the field holds text, while the tab
 * is hidden, and entirely under reduced motion (the whole example shows).
 */
export function HeroForm({
  strings,
  signUpPath,
  onboardingPath,
  buildPath,
  googleLabel,
  googleIcon,
  benefits,
  watch,
}: {
  strings: HeroFormStrings;
  /** Locale-aware /sign-up. */
  signUpPath: string;
  /** Locale-aware /onboarding/website, where a typed website is carried to. */
  onboardingPath: string;
  /** Locale-aware page to ask for a website to be built (the contact page). */
  buildPath: string;
  googleLabel: string;
  googleIcon: ReactNode;
  /** The row of benefits under the field. */
  benefits: ReactNode;
  /** The link beside "Join with Google". */
  watch: ReactNode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("website");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState<{ mode: Mode; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const nextDelay = useRef(START_DELAY);
  const inputId = useId();
  const errorId = useId();

  const isWebsite = mode === "website";
  const example = isWebsite ? strings.websitePlaceholder : strings.emailPlaceholder;
  const hasValue = value !== "";

  useEffect(() => {
    if (hasValue || !example) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Type, hold, erase, a breath, again - the design's rhythm.
    let timer: ReturnType<typeof setTimeout>;
    let letters = 0;
    let erasing = false;
    const step = () => {
      if (document.hidden) {
        timer = setTimeout(step, 600);
        return;
      }
      setTyped({ mode, text: example.slice(0, letters) });
      if (!erasing && letters < example.length) {
        letters++;
        timer = setTimeout(step, 86);
      } else if (!erasing) {
        erasing = true;
        timer = setTimeout(step, 2200);
      } else if (letters > 0) {
        letters--;
        timer = setTimeout(step, 47);
      } else {
        erasing = false;
        timer = setTimeout(step, 560);
      }
    };
    const delay = nextDelay.current;
    // The design empties the placeholder first, then starts typing.
    timer = setTimeout(() => {
      setTyped({ mode, text: "" });
      timer = setTimeout(step, delay);
    }, 0);
    return () => clearTimeout(timer);
  }, [example, mode, hasValue]);

  // The full example until the typing starts: what the server renders, and
  // what reduced motion keeps.
  const placeholder = typed && typed.mode === mode ? typed.text : example;

  function switchMode() {
    nextDelay.current = SWITCH_DELAY;
    setMode((current) => (current === "website" ? "email" : "website"));
    setValue("");
    setError(null);
    setTyped(null);
    // Straight back into the field: the switch was a request to type something else.
    input.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) {
      setError(isWebsite ? strings.emptyWebsite : strings.emptyEmail);
      input.current?.focus();
      return;
    }
    if (isWebsite) {
      const domain = cleanWebsite(value);
      if (!domain) {
        setError(strings.invalidWebsite);
        input.current?.focus();
        return;
      }
      setError(null);
      startTransition(() => router.push(signUpWithWebsite(signUpPath, onboardingPath, domain)));
      return;
    }
    const email = cleanEmail(value);
    if (!email) {
      setError(strings.invalidEmail);
      input.current?.focus();
      return;
    }
    setError(null);
    startTransition(() => router.push(signUpWithEmail(signUpPath, email)));
  }

  // What "Join with Google" carries. Anything not yet valid is left behind: it never blocks Google.
  const typedDomain = isWebsite ? cleanWebsite(value) : null;
  const typedEmail = isWebsite ? null : cleanEmail(value);
  const googleSignUp = typedDomain
    ? signUpWithWebsite(signUpPath, onboardingPath, typedDomain)
    : typedEmail
      ? signUpWithEmail(signUpPath, typedEmail)
      : signUpPath;

  return (
    <>
      <div className={styles["rgx-start-spotlight"]}>
        <div className={styles["rgx-form-highlight"]}>
          {/* noValidate: our own message, in the page's language, rather than the browser's. */}
          <form className={styles["rgx-form"]} onSubmit={handleSubmit} noValidate>
            <span className={styles["rgx-input-icon"]} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9Z" />
              </svg>
            </span>
            <label htmlFor={inputId} className={styles["rgx-sr-only"]}>
              {isWebsite ? strings.websiteLabel : strings.emailLabel}
            </label>
            <input
              ref={input}
              id={inputId}
              name={isWebsite ? "website" : "email"}
              type={isWebsite ? "text" : "email"}
              inputMode={isWebsite ? "url" : "email"}
              autoComplete={isWebsite ? "url" : "email"}
              autoCapitalize="none"
              spellCheck={false}
              required
              placeholder={placeholder}
              value={value}
              onChange={(event) => {
                const next = event.target.value;
                // Emptied by hand: the design waits a little longer before typing again.
                if (next === "") nextDelay.current = CLEARED_DELAY;
                setValue(next);
                if (error) setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            <button type="submit" className={styles["rgx-primary"]} disabled={pending}>
              <span>{strings.startTrial}</span>
              <span className={styles["rgx-primary-arr"]} aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 10h10m-4-4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          </form>
        </div>
      </div>
      {/* Always in the page, so a screen reader hears the message when it appears. */}
      <div aria-live="polite">
        {error ? (
          <p id={errorId} className={styles["rgx-form-error"]}>
            {error}
          </p>
        ) : null}
      </div>
      <div className={styles["rgx-no-website-options"]} role="group" aria-label={strings.moreWays}>
        <button type="button" className={styles["rgx-mode-switch"]} onClick={switchMode}>
          {isWebsite ? strings.useEmail : strings.useWebsite} <b aria-hidden="true">↗</b>
        </button>
        <div className={styles["rgx-build-prompt"]}>
          <span>{strings.noWebsite}</span>
          <Link prefetch={false} className={styles["rgx-website-creation-link"]} href={buildPath}>
            {strings.buildOne} <b aria-hidden="true">↗</b>
          </Link>
        </div>
      </div>
      {benefits}
      <div className={styles["rgx-hero-actions"]}>
        <JoinWithGoogle
          className={styles["rgx-google"]}
          signUpHref={googleSignUp}
          next={typedDomain ? websiteStep(onboardingPath, typedDomain) : CALLBACK_URL}
          loginHint={typedEmail ?? undefined}
        >
          {googleIcon}
          <span>{googleLabel}</span>
        </JoinWithGoogle>
        {watch}
      </div>
    </>
  );
}
