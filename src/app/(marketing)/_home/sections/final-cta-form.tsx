"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";

import type { FinalCtaCopy } from "@/lib/i18n/home/final-cta";
import { cleanEmail, cleanWebsite, signUpWithEmail, signUpWithWebsite } from "../start-field";
import styles from "./final-cta.module.css";

type Mode = "website" | "email";

/** The design's two drawings (<script id="rcta-form-script">). */
function WebIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9Z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

/**
 * The closing banner's field (client's design, 2026-11-03): a website by
 * default, an email on request.
 *
 * It submits exactly as the hero's field does - it only navigates: a website
 * goes through sign-up to the website step with the address pre-filled
 * (`?next=` -> /onboarding/website?domain=), an email goes to sign-up with
 * the address pre-filled (`?email=`). The messages are the design's: one for
 * an empty field, one for an address that is not one.
 */
export function FinalCtaForm({
  strings,
  signUpPath,
  onboardingPath,
}: {
  strings: FinalCtaCopy["form"];
  /** Locale-aware /sign-up. */
  signUpPath: string;
  /** Locale-aware /onboarding/website, where a typed website is carried to. */
  onboardingPath: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("website");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();
  const email = mode === "email";

  function fail(message: string) {
    setError(message);
    input.current?.focus();
  }

  function switchMode() {
    setMode(email ? "website" : "email");
    setValue("");
    setError("");
    input.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) return fail(email ? strings.emptyEmail : strings.emptyWebsite);
    if (!email) {
      const domain = cleanWebsite(value);
      if (!domain) return fail(strings.invalidWebsite);
      setError("");
      startTransition(() => router.push(signUpWithWebsite(signUpPath, onboardingPath, domain)));
      return;
    }
    const address = cleanEmail(value);
    if (!address) return fail(strings.invalidEmail);
    setError("");
    startTransition(() => router.push(signUpWithEmail(signUpPath, address)));
  }

  return (
    <div className={styles["rcta-entry"]}>
      {/* noValidate: our own message, in the page's language, rather than the browser's. */}
      <form className={styles["rcta-form"]} onSubmit={handleSubmit} noValidate>
        <span className={styles["rcta-icon"]} aria-hidden="true">
          {email ? <MailIcon /> : <WebIcon />}
        </span>
        <label htmlFor={inputId}>{email ? strings.emailLabel : strings.websiteLabel}</label>
        <input
          ref={input}
          id={inputId}
          className={styles["rcta-input"]}
          name={email ? "email" : "website"}
          type={email ? "email" : "text"}
          autoComplete={email ? "email" : "url"}
          inputMode={email ? "email" : "url"}
          autoCapitalize="none"
          spellCheck={false}
          placeholder={email ? strings.emailPlaceholder : strings.websitePlaceholder}
          required
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError("");
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <button className={styles["rcta-submit"]} type="submit" disabled={pending}>
          {strings.submit} <span aria-hidden="true">↗</span>
        </button>
      </form>
      <div className={styles["rcta-under"]}>
        <span>{strings.under}</span>
        <button type="button" className={styles["rcta-swap"]} onClick={switchMode}>
          {/* The arrow as text, as drawn: on a phone the design hides every span in this row. */}
          {`${email ? strings.useWebsite : strings.useEmail} ↗`}
        </button>
      </div>
      <p className={styles["rcta-error"]} id={errorId} role="status" aria-live="polite">
        {error}
      </p>
    </div>
  );
}
