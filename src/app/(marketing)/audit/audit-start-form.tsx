"use client";

import { ArrowRight, Globe, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type MouseEvent, type ReactNode } from "react";

import type { AuditLandingCopy } from "@/lib/i18n/audit-landing";

import { cleanWebsite } from "../_home/start-field";
import styles from "./audit-landing.module.css";

/** The page's first field: where every "check my website" link on it leads. */
export const AUDIT_FIELD_ID = "audit-url";

/**
 * The website field on the free audit's landing page (client's design,
 * 2026-11-05).
 *
 * Carries the address to this same route and stops there, as the homepage's
 * fields do. The page owns the URL validation, the SSRF guard, the limits, the
 * caching and the progress screen; this only catches what plainly is not an
 * address, in the page's language.
 */
export function AuditStartForm({
  strings,
  action,
  placeholder,
  initialValue = "",
  id,
  className,
}: {
  strings: AuditLandingCopy["form"];
  /** Locale-aware /audit. */
  action: string;
  placeholder: string;
  /** The address that just failed, so it can be corrected rather than retyped. */
  initialValue?: string;
  id?: string;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const message = useRef<HTMLParagraphElement>(null);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  // On a short screen the message can land just under the fold, below a field that looks unchanged.
  useEffect(() => {
    if (error) message.current?.scrollIntoView({ block: "nearest" });
  }, [error]);

  function fail(message: string) {
    setError(message);
    input.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) return fail(strings.emptyError);
    const domain = cleanWebsite(value);
    if (!domain) return fail(strings.invalidError);
    setError("");
    startTransition(() => router.push(`${action}?domain=${encodeURIComponent(domain)}`));
  }

  return (
    <>
      {/* noValidate: our own message, in the page's language, rather than the browser's. */}
      <form className={`${styles.form} ${className ?? ""}`} onSubmit={handleSubmit} noValidate>
        <span className={styles.formIcon} aria-hidden="true">
          <Globe />
        </span>
        <label htmlFor={inputId} className="sr-only">
          {strings.label}
        </label>
        <input
          ref={input}
          id={inputId}
          name="website"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder={placeholder}
          value={value}
          disabled={pending}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError("");
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {/* Disabled only while the page loads, so it cannot be pressed twice. */}
        <button type="submit" className={styles.formButton} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              {strings.pending}
            </>
          ) : (
            <>
              {strings.submit}
              <ArrowRight aria-hidden="true" />
            </>
          )}
        </button>
      </form>
      <p ref={message} id={errorId} className={styles.formError} role="status" aria-live="polite">
        {error}
      </p>
    </>
  );
}

/**
 * A "check my website" link further down the page: goes back to the real field
 * and puts the cursor in it. Still a plain link to it without JavaScript.
 */
export function AuditFocusLink({ className, children }: { className?: string; children: ReactNode }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const field = document.getElementById(AUDIT_FIELD_ID);
    if (!field) return;
    event.preventDefault();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    field.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    field.focus({ preventScroll: true });
  }

  return (
    <a href={`#${AUDIT_FIELD_ID}`} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
