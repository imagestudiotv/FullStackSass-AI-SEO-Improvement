"use client";

import { Check, Eye, EyeOff, Loader2, Lock, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

import { JoinWithGoogle } from "@/app/(marketing)/_home/join-with-google";
import { GoogleMark } from "@/components/google-mark";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { fill, type GrowthPlanCopy } from "@/lib/i18n/growth-plan";
import type { Messages } from "@/lib/i18n/messages";

import styles from "./growth-plan.module.css";

/** The sign-up form's own words (lib/i18n/messages.ts app.auth), in the flow's language. */
export type AccountAuthCopy = Pick<
  Messages["app"]["auth"],
  | "continueWithGoogle"
  | "orContinueWithEmail"
  | "fullName"
  | "namePlaceholder"
  | "email"
  | "emailPlaceholder"
  | "password"
  | "passwordHint"
  | "passwordPlaceholder"
  | "showPassword"
  | "hidePassword"
  | "tooManyAttempts"
  | "passwordTooLong"
  | "createAccount"
  | "creatingAccount"
  | "legal"
  | "terms"
  | "privacy"
  | "haveAccount"
  | "signIn"
  | "connectionFailed"
>;

export type SignedInAccount = { name: string; email: string };

/**
 * The account step (Daniel, 2026-11-19: the details, then billing, in the
 * flow): sign-up without leaving the page, done EXACTLY as /sign-up does it
 * (components/auth-form.tsx):
 *
 *  - the same Better Auth call, authClient.signUp.email, so the server's
 *    rules all apply unchanged: its password policy, its rate limits per
 *    visitor (lib/auth/rate-limit.ts), the sign-up hook that queues the
 *    welcome emails and remembers the browser's language as the account's
 *    signup_locale (lib/auth.ts), the new account's workspace;
 *  - the same checks in the browser: every field required, an email address,
 *    MIN_PASSWORD_LENGTH, and a password over MAX_PASSWORD_LENGTH refused
 *    with the form's own words rather than cut;
 *  - the same answers: a 429 in the reader's language, otherwise Better
 *    Auth's message, and the form's line when the connection fails;
 *  - the same legal line with the terms and privacy links.
 *
 * Sign-up fires no analytics of its own on /sign-up either: the new
 * account's sign-up is reported by the signed-in pages from the server's
 * list (lib/conversions/conversions.ts), which the billing step renders here
 * the same way (growth-plan-flow.tsx ConversionEvents).
 *
 * "Continue with Google" is the site's JoinWithGoogle, coming back to this
 * flow at billing with the plan chosen (flow-steps.ts flowReturnPath), and
 * "Sign in" carries the same return. An error is said in the step, and the
 * usual sign-up page stays one link away.
 *
 * The auth client loads on the press, as JoinWithGoogle loads it: most
 * visitors who open the growth plan never sign up.
 */
export function AccountStep({
  t,
  auth,
  host,
  account,
  links,
  onSignedIn,
  onContinue,
}: {
  t: GrowthPlanCopy;
  auth: AccountAuthCopy;
  host: string;
  account: SignedInAccount | null;
  links: {
    /** Back into this flow at billing (flowReturnPath). */
    flowReturn: string;
    /** /sign-up carrying the same return: Google's fallback and the usual page. */
    signUp: string;
    /** /sign-in carrying the same return. */
    signIn: string;
  };
  onSignedIn: (account: SignedInAccount) => void;
  onContinue: () => void;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (account) {
    return (
      <div className={styles.account}>
        <p className={styles.kicker}>{t.account.heading}</p>
        <p className={styles.signedIn}>
          <Check size={18} aria-hidden="true" /> {fill(t.account.signedIn, { email: account.email })}
        </p>
        <button type="button" className={styles.primaryButton} onClick={onContinue}>
          {t.flow.toCheckout} <span aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length > MAX_PASSWORD_LENGTH) {
      setError(auth.passwordTooLong);
      return;
    }
    const person = { name: name.trim(), email: email.trim() };
    setPending(true);
    try {
      const { authClient } = await import("@/lib/auth-client");
      const { error: refused } = await authClient.signUp.email({ ...person, password });
      if (refused) {
        setError(refused.status === 429 ? auth.tooManyAttempts : (refused.message ?? "Something went wrong"));
        return;
      }
      onSignedIn(person);
      // The header (and anything else read on the server) learns of the new session; the flow keeps its place.
      router.refresh();
    } catch {
      setError(auth.connectionFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.account}>
      <div className={styles.accountIntro}>
        <p className={styles.kicker}>{t.account.heading}</p>
        <p className={styles.billingLead}>{fill(t.account.intro, { host })}</p>
        <ul className={styles.perks}>
          {t.account.perks.map((perk) => (
            <li key={perk}>
              <Check size={15} aria-hidden="true" />
              {fill(perk, { host })}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.accountForm}>
        <JoinWithGoogle className={styles.google} signUpHref={links.signUp} next={links.flowReturn}>
          <GoogleMark className={styles.googleMark} />
          <span>{auth.continueWithGoogle}</span>
        </JoinWithGoogle>

        <p className={styles.divider}>
          <span>{auth.orContinueWithEmail}</span>
        </p>

        <form onSubmit={submit} className={styles.fields} aria-describedby={error ? `${id}-error` : undefined}>
          <label className={styles.field}>
            <span>{auth.fullName}</span>
            <span className={styles.inputWrap}>
              <UserRound size={16} aria-hidden="true" />
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder={auth.namePlaceholder} autoComplete="name" required />
            </span>
          </label>
          <label className={styles.field}>
            <span>{auth.email}</span>
            <span className={styles.inputWrap}>
              <Mail size={16} aria-hidden="true" />
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={auth.emailPlaceholder} autoComplete="email" required />
            </span>
          </label>
          <label className={styles.field}>
            <span>{auth.password}</span>
            <span className={styles.inputWrap}>
              <Lock size={16} aria-hidden="true" />
              {/* No maxLength, as on /sign-up: a long pasted password is refused in words, never cut. */}
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={auth.passwordPlaceholder}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                aria-describedby={`${id}-hint`}
                required
              />
              <button
                type="button"
                className={styles.reveal}
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? auth.hidePassword : auth.showPassword}
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </span>
            <small id={`${id}-hint`}>{auth.passwordHint}</small>
          </label>

          {error ? (
            <p id={`${id}-error`} className={styles.formError} role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className={styles.primaryButton} disabled={pending}>
            {pending ? (
              <>
                <Loader2 size={16} className={styles.spin} aria-hidden="true" />
                {auth.creatingAccount}
              </>
            ) : (
              <>
                {auth.createAccount} <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </form>

        <p className={styles.legal}>
          {auth.legal.split(/(\{terms\}|\{privacy\})/).map((part, index) =>
            part === "{terms}" || part === "{privacy}" ? (
              // The documents themselves are in English (/terms, /privacy), as on /sign-up.
              <Link key={index} prefetch={false} href={part === "{terms}" ? "/terms" : "/privacy"}>
                {part === "{terms}" ? auth.terms : auth.privacy}
              </Link>
            ) : (
              part
            ),
          )}
        </p>
        <p className={styles.accountSwitch}>
          {auth.haveAccount}{" "}
          <Link prefetch={false} href={links.signIn}>
            {auth.signIn}
          </Link>
          {" · "}
          <Link prefetch={false} href={links.signUp}>
            {t.account.fallback}
          </Link>
        </p>
      </div>
    </div>
  );
}

