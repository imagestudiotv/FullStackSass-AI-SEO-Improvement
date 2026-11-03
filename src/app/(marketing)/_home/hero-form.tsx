"use client";

import { ArrowRight, ArrowUpRight, Globe, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition, type FormEvent } from "react";

import type { HomeRedesignCopy } from "@/lib/i18n/home-redesign";
import styles from "./home.module.css";

/** Every word the field shows, handed down by the hero (a server component). */
export type HeroFormStrings = Pick<
  HomeRedesignCopy["hero"],
  "websiteLabel" | "emailLabel" | "emailPlaceholder" | "startTrial" | "useEmail" | "useWebsite" | "invalidWebsite" | "invalidEmail"
>;

type Mode = "website" | "email";

/**
 * Accepts what people actually type - "acme.com", "www.acme.com",
 * "https://acme.com/shop" - and returns it trimmed, or null.
 *
 * Deliberately loose: this only decides whether the address is worth
 * carrying through sign-up. The website step re-validates it (and owns the
 * reachability checks), so a second strict copy of those rules here would
 * only drift from them. URL() also punycodes an international domain, hence
 * the xn-- top-level domains.
 */
function cleanWebsite(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i;
    return host.test(url.hostname) ? value : null;
  } catch {
    return null;
  }
}

function cleanEmail(raw: string): string | null {
  const value = raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

/**
 * The hero's one field: a website by default, an email on request (client's
 * design, 2026-11-03: "Use your email instead").
 *
 * It only navigates. A website goes through sign-up to the website step with
 * the address pre-filled (`?next=` -> /onboarding/website?domain=); an email
 * goes to sign-up with the address pre-filled (`?email=`, read by the sign-up
 * page). Nothing is created or crawled from here, so there is one sign-up and
 * one website check, not a second copy of either.
 *
 * The placeholder types itself out, as drawn. It is only ever the
 * placeholder - never the field's value, so nothing a visitor did not type
 * can be submitted - and it stops while the field holds text, while the tab
 * is hidden, and entirely under reduced motion.
 */
export function HeroForm({
  strings,
  websiteExamples,
  signUpPath,
  onboardingPath,
}: {
  strings: HeroFormStrings;
  /** Example addresses the placeholder types in turn, in the reader's language. */
  websiteExamples: string[];
  /** Locale-aware /sign-up. */
  signUpPath: string;
  /** Locale-aware /onboarding/website, where a typed website is carried to. */
  onboardingPath: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("website");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState<{ mode: Mode; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  const emailExample = strings.emailPlaceholder;
  // Memoised: a new array each render would restart the typing at every letter it types.
  const examples = useMemo(() => (mode === "website" ? websiteExamples : [emailExample]), [mode, websiteExamples, emailExample]);
  const hasValue = value !== "";

  useEffect(() => {
    if (hasValue || examples.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // The design's timings: type, hold, erase, a breath, the next example.
    let timer: ReturnType<typeof setTimeout>;
    let index = 0;
    let letters = 0;
    let erasing = false;
    const step = () => {
      if (document.hidden) {
        timer = setTimeout(step, 600);
        return;
      }
      const text = examples[index % examples.length]!;
      setTyped({ mode, text: text.slice(0, letters) });
      if (!erasing && letters < text.length) {
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
        index++;
        timer = setTimeout(step, 560);
      }
    };
    timer = setTimeout(step, 450);
    return () => clearTimeout(timer);
  }, [examples, mode, hasValue]);

  // The full example until the typing starts: what the server renders, and
  // what reduced motion keeps.
  const placeholder = typed && typed.mode === mode ? typed.text : (examples[0] ?? "");

  function switchMode() {
    setMode((current) => (current === "website" ? "email" : "website"));
    setValue("");
    setError(null);
    setTyped(null);
    // Straight back into the field: the switch was a request to type something else.
    input.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "website") {
      const domain = cleanWebsite(value);
      if (!domain) {
        setError(strings.invalidWebsite);
        input.current?.focus();
        return;
      }
      setError(null);
      const next = `${onboardingPath}?domain=${encodeURIComponent(domain)}`;
      startTransition(() => router.push(`${signUpPath}?next=${encodeURIComponent(next)}`));
      return;
    }
    const email = cleanEmail(value);
    if (!email) {
      setError(strings.invalidEmail);
      input.current?.focus();
      return;
    }
    setError(null);
    startTransition(() => router.push(`${signUpPath}?email=${encodeURIComponent(email)}`));
  }

  const isWebsite = mode === "website";
  const Icon = isWebsite ? Globe : Mail;

  return (
    <>
      {/* noValidate: our own message, in the page's language, rather than the browser's. */}
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <Icon className={styles.formIcon} aria-hidden="true" />
        <label htmlFor={inputId} className={styles.srOnly}>
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
            setValue(event.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <button type="submit" className={styles.primary} disabled={pending}>
          <span>{strings.startTrial}</span>
          <span className={styles.primaryArrow} aria-hidden="true">
            <ArrowRight />
          </span>
        </button>
      </form>
      {/* Always in the page, so a screen reader hears the message when it appears. */}
      <div aria-live="polite">
        {error ? (
          <p id={errorId} className={styles.formError}>
            {error}
          </p>
        ) : null}
      </div>
      <button type="button" className={styles.modeSwitch} onClick={switchMode}>
        {isWebsite ? strings.useEmail : strings.useWebsite}
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </button>
    </>
  );
}
