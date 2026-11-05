"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useId, useRef, useState, useSyncExternalStore, useTransition, type FormEvent, type ReactNode } from "react";

import { cleanEmail } from "@/app/(marketing)/_home/start-field";
import type { WebsiteCreationCopy } from "@/lib/marketing/website-creation/copy";
import { isWebsiteProjectKind, signUpForWebsiteProject, type WebsiteProjectKind } from "@/lib/website-projects/shared";

import styles from "./website-creation.module.css";

/**
 * The page's only moving parts: which project was chosen, and the email fields.
 * They only navigate, to the real sign-up with the address and the choice in its
 * parameters (lib/website-projects/shared.ts). No account is simulated here, and
 * nothing is stored.
 */

type Choice = { kind: WebsiteProjectKind; setKind: (kind: WebsiteProjectKind) => void; email: string; setEmail: (email: string) => void };

const ChoiceContext = createContext<Choice | null>(null);

function useChoice(): Choice {
  const choice = use(ChoiceContext);
  if (!choice) throw new Error("Inside ProjectChoice only");
  return choice;
}

const subscribeNever = () => () => {};

/** A parameter of the address this page was opened with (a /contact redirect keeps them), read after hydration so the cached page stays one page. */
function useAddressParam(name: string): string | null {
  return useSyncExternalStore(
    subscribeNever,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}

export function ProjectChoice({ children }: { children: ReactNode }) {
  const fromAddress = useAddressParam("type");
  const emailFromAddress = useAddressParam("email");
  const [picked, setKind] = useState<WebsiteProjectKind | null>(null);
  const [typed, setEmail] = useState<string | null>(null);
  const kind = picked ?? (isWebsiteProjectKind(fromAddress) ? fromAddress : "new");
  const email = typed ?? emailFromAddress ?? "";
  return <ChoiceContext.Provider value={{ kind, setKind, email, setEmail }}>{children}</ChoiceContext.Provider>;
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 20 20" width="17">
      <path d="M10 3v14M3 10h14" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 20 20" width="17">
      <path d="M15.7 8.4A6 6 0 1 0 16 11" />
      <path d="M15.7 3.8v4.6h-4.6" />
    </svg>
  );
}

function MailIcon({ size }: { size: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width={size}>
      <rect height="14" rx="2" width="18" x="3" y="5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function EmailForm({
  id,
  formClass,
  submit,
  label,
  strings,
  signUpPath,
  size,
}: {
  id?: string;
  formClass: string;
  submit: string;
  label: string;
  strings: WebsiteCreationCopy["hero"];
  signUpPath: string;
  size: number;
}) {
  const { kind, email, setEmail } = useChoice();
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const generated = useId();
  const inputId = id ?? generated;
  const errorId = `${inputId}-error`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = cleanEmail(email);
    if (!address) {
      setError(email.trim() ? strings.invalidEmail : strings.emptyEmail);
      input.current?.focus();
      return;
    }
    setError("");
    start(() => router.push(signUpForWebsiteProject(signUpPath, kind, address)));
  }

  return (
    <>
      {/* noValidate: our own message, in the page's language, rather than the browser's. */}
      <form className={formClass} aria-label={label} onSubmit={handleSubmit} noValidate>
        <MailIcon size={size} />
        <label className="sr-only" htmlFor={inputId}>
          {strings.emailLabel}
        </label>
        <input
          ref={input}
          id={inputId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder={strings.emailPlaceholder}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError("");
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <button type="submit" disabled={pending}>
          <span>{submit}</span> <span aria-hidden="true">↗</span>
        </button>
      </form>
      <p id={errorId} className={styles.formError} role="status" aria-live="polite">
        {error}
      </p>
    </>
  );
}

/** The hero's two options, the field under them, and the words that follow the choice. */
export function HeroStart({ strings, signUpPath }: { strings: WebsiteCreationCopy["hero"]; signUpPath: string }) {
  const { kind, setKind } = useChoice();
  const redesign = kind === "redesign";

  return (
    <>
      <div className={styles.projectSwitch} role="group" aria-label={strings.switchLabel}>
        {(["new", "redesign"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={kind === option}
            className={`${styles.projectChoice} ${kind === option ? styles.isActive : ""}`}
            onClick={() => setKind(option)}
          >
            {option === "new" ? <PlusIcon /> : <RedoIcon />}
            {option === "new" ? strings.choiceNew : strings.choiceRedesign}
          </button>
        ))}
      </div>
      <div className={styles.ctaZone} id="create-your-website">
        <div className={styles.ctaLabel}>
          <span aria-hidden="true" className={styles.signal} />
          <span>{redesign ? strings.labelRedesign : strings.labelNew}</span>
        </div>
        <EmailForm
          id="studio-email"
          formClass={styles.heroForm}
          submit={redesign ? strings.submitRedesign : strings.submitNew}
          label={strings.formLabel}
          strings={strings}
          signUpPath={signUpPath}
          size={22}
        />
        <p className={styles.help}>{redesign ? strings.helpRedesign : strings.helpNew}</p>
      </div>
    </>
  );
}

/** The closing panel's field, carrying whichever project was chosen above. */
export function ClosingStart({ strings, submit, label, signUpPath }: { strings: WebsiteCreationCopy["hero"]; submit: string; label: string; signUpPath: string }) {
  return <EmailForm id="end-email" formClass={styles.closingForm} submit={submit} label={label} strings={strings} signUpPath={signUpPath} size={19} />;
}

/** A plain link to registration that still carries the choice. */
export function RegisterLink({ className, signUpPath, children }: { className?: string; signUpPath: string; children: ReactNode }) {
  const { kind, email } = useChoice();
  return (
    <a className={className} href={signUpForWebsiteProject(signUpPath, kind, cleanEmail(email))}>
      {children}
    </a>
  );
}

/** "Start a similar project": a new build, up at the field, as the design does. */
export function StartSimilar({ className, children }: { className?: string; children: ReactNode }) {
  const { setKind } = useChoice();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        setKind("new");
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        document.getElementById("create-your-website")?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
        document.getElementById("studio-email")?.focus({ preventScroll: true });
      }}
    >
      {children}
    </button>
  );
}
