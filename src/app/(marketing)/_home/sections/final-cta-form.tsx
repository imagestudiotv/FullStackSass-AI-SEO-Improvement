"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";

import type { FinalCtaCopy } from "@/lib/i18n/home/final-cta";
import { cleanEmail, cleanWebsite, signUpWithEmail, signUpWithWebsite } from "../start-field";
import styles from "./final-cta.module.css";

/** The two tabs: the free website check, or the free trial (sign-up). */
export type StartWay = "audit" | "trial";
/** What the one field takes. */
export type Entry = "website" | "email";

export const START_WAYS: StartWay[] = ["audit", "trial"];

export type FinalCtaPaths = {
  /** Locale-aware /audit, the free check. */
  auditPath: string;
  /** Locale-aware /sign-up. */
  signUpPath: string;
  /** Locale-aware /onboarding/website, where a typed website is carried to. */
  onboardingPath: string;
};

/** What the button, the line under the field and the switch say. */
export function startWording(strings: FinalCtaCopy["form"], way: StartWay, entry: Entry) {
  const t = strings[way];
  const email = entry === "email";
  return {
    submit: email ? t.submitEmail : t.submit,
    hint: email ? t.hintEmail : t.hint,
    swap: email ? strings.useWebsite : strings.useEmail,
  };
}

/**
 * Where the field takes the visitor, or the message to show instead.
 *
 * A website on "Check my website" runs the free check (/audit?domain=, no
 * account needed), as the audit page's own field does. On "Start free trial"
 * it goes through sign-up to the website step with the address pre-filled
 * (`?next=` -> /onboarding/website?domain=), as the hero's field does. An
 * email goes to sign-up with the address pre-filled (`?email=`) on either
 * tab; the website is asked for after sign-up.
 */
export function startDestination(
  strings: FinalCtaCopy["form"],
  way: StartWay,
  entry: Entry,
  raw: string,
  paths: FinalCtaPaths,
): { url: string } | { error: string } {
  if (!raw.trim()) return { error: entry === "email" ? strings.emptyEmail : strings.emptyWebsite };
  if (entry === "email") {
    const address = cleanEmail(raw);
    return address ? { url: signUpWithEmail(paths.signUpPath, address) } : { error: strings.invalidEmail };
  }
  const domain = cleanWebsite(raw);
  if (!domain) return { error: strings.invalidWebsite };
  if (way === "audit") return { url: `${paths.auditPath}?domain=${encodeURIComponent(domain)}` };
  return { url: signUpWithWebsite(paths.signUpPath, paths.onboardingPath, domain) };
}

/** The design's globe; the envelope is the 2026-11-03 banner's. */
function WebIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18" />
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
 * The closing banner's two tabs and its one field (client's design cta.html,
 * 2026-11-11): a website by default, an email on request.
 *
 * The tabs follow the WAI-ARIA tabs pattern: one tab in the Tab order, the
 * arrow keys (and Home/End) move between them and select. The field keeps
 * what was typed when the tab changes; switching between website and email
 * empties it. Errors show under the field, in the page's language.
 */
export function FinalCtaForm({ strings, paths }: { strings: FinalCtaCopy["form"]; paths: FinalCtaPaths }) {
  const router = useRouter();
  const [way, setWay] = useState<StartWay>("audit");
  const [entry, setEntry] = useState<Entry>("website");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const tabs = useRef<Partial<Record<StartWay, HTMLButtonElement | null>>>({});
  const id = useId();
  const tabId = (tab: StartWay) => `${id}-tab-${tab}`;
  const panelId = `${id}-panel`;
  const inputId = `${id}-input`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const email = entry === "email";
  const words = startWording(strings, way, entry);

  function choose(next: StartWay) {
    setWay(next);
    setError("");
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const at = START_WAYS.indexOf(way);
    const last = START_WAYS.length - 1;
    const to =
      event.key === "ArrowRight" ? (at === last ? 0 : at + 1)
      : event.key === "ArrowLeft" ? (at === 0 ? last : at - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : -1;
    if (to < 0) return;
    event.preventDefault();
    choose(START_WAYS[to]);
    tabs.current[START_WAYS[to]]?.focus();
  }

  function switchEntry() {
    setEntry(email ? "website" : "email");
    setValue("");
    setError("");
    input.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = startDestination(strings, way, entry, value, paths);
    if ("error" in next) {
      setError(next.error);
      input.current?.focus();
      return;
    }
    setError("");
    startTransition(() => router.push(next.url));
  }

  return (
    <div className={styles["rcta-start"]}>
      <p className={styles["rcta-start-label"]}>{strings.startLabel}</p>
      <div className={styles["rcta-tabs"]} role="tablist" aria-label={strings.tabsLabel}>
        {START_WAYS.map((tab) => (
          <button
            key={tab}
            ref={(element) => {
              tabs.current[tab] = element;
            }}
            type="button"
            role="tab"
            id={tabId(tab)}
            className={styles["rcta-tab"]}
            aria-selected={way === tab}
            aria-controls={panelId}
            tabIndex={way === tab ? 0 : -1}
            onClick={() => choose(tab)}
            onKeyDown={handleTabKey}
          >
            <span className={styles["rcta-tab-icon"]} aria-hidden="true">
              {tab === "audit" ? "⌁" : "✦"}
            </span>
            {strings[tab].tab}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={panelId} aria-labelledby={tabId(way)}>
        {/* noValidate: our own message, in the page's language, rather than the browser's. */}
        <form className={styles["rcta-form"]} onSubmit={handleSubmit} noValidate>
          <label className={styles["rcta-field"]} htmlFor={inputId}>
            <span className={styles["rcta-icon"]} aria-hidden="true">
              {email ? <MailIcon /> : <WebIcon />}
            </span>
            <span className="sr-only">{email ? strings.emailLabel : strings.websiteLabel}</span>
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
              aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            />
          </label>
          <button className={styles["rcta-submit"]} type="submit" disabled={pending}>
            {words.submit} <span aria-hidden="true">↗</span>
          </button>
        </form>
        <div className={styles["rcta-help"]}>
          <span id={hintId}>{words.hint}</span>
          <button type="button" className={styles["rcta-swap"]} onClick={switchEntry}>
            {words.swap} <span aria-hidden="true">↗</span>
          </button>
        </div>
        <p className={styles["rcta-error"]} id={errorId} role="status" aria-live="polite">
          {error}
        </p>
      </div>
    </div>
  );
}
