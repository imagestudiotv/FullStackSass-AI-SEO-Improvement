"use client";

import { useRouter } from "next/navigation";
import { getMessages, type Messages } from "@/lib/i18n/messages";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  UserRound,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { GoogleMark } from "@/components/google-mark";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CALLBACK_URL = "/dashboard";

/**
 * Where to go after signing in, from ?next=.
 *
 * AN OPEN-REDIRECT GUARD, not a convenience. Whatever lands here is put
 * straight into a navigation the moment a session exists, so an unchecked
 * value turns our own sign-in page into a redirector to anywhere - the
 * classic phishing setup, where the victim really did sign in to RepGet and
 * really was then handed to somebody else's site.
 *
 * Only a path on this origin is allowed:
 *  - must start with a single "/"
 *  - "//evil.com" is rejected: browsers read it as a protocol-relative URL
 *  - a backslash is rejected too, since some clients normalise "/\" to "//"
 *
 * Anything else falls back to the dashboard rather than erroring. A bad
 * `next` is not the customer's problem to solve; they came here to sign in.
 */
function safeNext(value: string | null): string {
  if (!value) return CALLBACK_URL;
  if (!value.startsWith("/")) return CALLBACK_URL;
  if (value.startsWith("//") || value.startsWith("/\\")) return CALLBACK_URL;
  return value;
}

/**
 * What Better Auth's OAuth error codes mean to a customer.
 *
 * Its own codes read like internals — "account_not_linked" tells someone
 * nothing about what to do next. Anything unmapped falls back to a plain
 * sentence rather than showing the raw code.
 */
const OAUTH_ERRORS: Record<string, string> = {
  account_not_linked:
    "That email already has a password account. Sign in with your password, or contact support to link Google.",
  email_does_not_match:
    "That Google account uses a different email than the one on file.",
  account_already_linked_to_different_user:
    "That Google account is already connected to another account.",
  unable_to_link_account: "Google sign-in could not be linked to your account.",
};

/**
 * Sign-in and sign-up, following the reference design.
 *
 * No card wrapper: the reference sets the form directly on the page, beside
 * the showcase panel, and a card inside a split screen reads as a box within a
 * box.
 *
 * The reference leads with a magic link ("Email me a sign-in link") rather
 * than a password. We do not send email — no provider is configured — so a
 * magic-link button would be a button that silently does nothing. Google and a
 * password are what actually work, so they are what the form offers. If an
 * email provider is added later, the magic link belongs here as the primary
 * action, with the password behind a "sign in with a password instead" link,
 * exactly as the reference has it.
 */
export function AuthForm({
  mode,
  t = getMessages("en").app.auth,
}: {
  mode: "sign-in" | "sign-up";
  /**
   * The form's wording.
   *
   * From Accept-Language, not an account: nobody is signed in on this
   * screen, so there is no stored preference to read.
   */
  t?: Messages["app"]["auth"];
}) {
  const router = useRouter();
  const isSignUp = mode === "sign-up";

  const [name, setName] = useState("");
  /**
   * Prefilled from ?email= when an invitation sent them here.
   *
   * An invitation is addressed to ONE mailbox and is only accepted by an
   * account with that address, so typing a different one here produces an
   * account that cannot accept it. Prefilling removes that trap, and the
   * field stays editable for anyone who genuinely wants a different address.
   */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  /**
   * The eye control in the design. Worth having: a password typed blind
   * into a field with an 8-character rule is the most common reason a
   * sign-up form gets abandoned, and every browser offers this anyway.
   */
  const [showPassword, setShowPassword] = useState(false);

  /**
   * Password or a one-time code.
   *
   * Password stays the default. The code is better for somebody who never set
   * one — a Google signup, an invited collaborator — but switching the default
   * would make every returning customer press an extra button to reach the
   * field their manager already filled in.
   */
  const [method, setMethod] = useState<"password" | "code">("password");

  /**
   * Which half of the code flow is on screen: asking for the address, or
   * entering what arrived.
   *
   * One component rather than two screens, because the address typed in step
   * one is the address step two verifies, and carrying it through a
   * navigation would mean putting it in the URL.
   */
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");

  /**
   * Report a failure that happened during the OAuth round trip.
   *
   * Better Auth redirects back with ?error=<code>. Nothing read it, so a
   * refused sign-in looked like nothing happening at all. Shown once and then
   * stripped from the address, so a reload does not repeat it.
   */
  const searchParams = useSearchParams();

  /**
   * Where to land afterwards. Validated - see safeNext.
   *
   * Carried through the whole flow so an invitation link that bounced an
   * unknown visitor to sign-up returns them to the invitation once they
   * have an account, instead of stranding them on the dashboard with no
   * idea what they were invited to.
   */
  const next = safeNext(searchParams.get("next"));

  /**
   * Prefill the address an invitation was sent to.
   *
   * In an effect rather than useState's initialiser because useSearchParams
   * returns null during the initial server render, so the initialiser would
   * read nothing. Only ever sets it once, and never over something typed.
   */
  useEffect(() => {
    const invited = searchParams.get("email");
    if (invited) setEmail((current) => current || invited);
  }, [searchParams]);

  useEffect(() => {
    const code = searchParams.get("error");
    if (!code) return;
    toast.error(OAUTH_ERRORS[code] ?? "Sign-in did not complete. Try again.");
    /*
      Strip ONLY the error, keeping the rest of the query. It used to reset
      the address to the bare pathname, which also threw away ?next= and
      ?email= - so a failed Google attempt from an invitation link silently
      turned into an ordinary sign-up, and the invitation was never accepted.
    */
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("error");
    const query = rest.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }, [searchParams]);

  async function handleGoogle() {
    setGooglePending(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
      /**
       * Where a failure DURING the OAuth round trip lands.
       *
       * Without this it defaults to the site root, so a failed Google sign-in
       * dropped the customer on the marketing homepage with ?error=... in the
       * address bar and nothing reading it — they simply appeared not to be
       * signed in, with no reason given. Sending it back to the sign-in page
       * puts the message beside the buttons that produced it.
       *
       * The `error` returned here does NOT cover that case: it only catches
       * failures before the browser leaves for Google.
       */
      errorCallbackURL: "/sign-in",
    });
    if (error) {
      setGooglePending(false);
      toast.error(error.message ?? "Google sign-in failed");
    }
  }

  /**
   * Step one: ask for a code.
   *
   * The response is deliberately not inspected for "does this account exist".
   * Better Auth answers the same way either way, and so does this — a form
   * that says "no account with that address" tells anybody who asks which of
   * your customers' addresses are registered.
   */
  async function handleRequestCode() {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      toast.error(t.enterEmailFirst);
      return;
    }

    setPending(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: cleanEmail,
      type: "sign-in",
    });
    setPending(false);

    if (error) {
      toast.error(error.message ?? t.codeNotSent);
      return;
    }

    setCodeSent(true);
    setCode("");
    toast.success(t.codeSent);
  }

  /** Step two: exchange the code for a session. */
  async function handleVerifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const { error } = await authClient.signIn.emailOtp({
      email: email.trim(),
      otp: code.trim(),
    });

    if (error) {
      setPending(false);
      /*
        The code stays in the field on failure. Clearing it would be the
        obvious thing and the wrong one: the usual cause is one mistyped
        digit, and retyping all six to fix one is worse than correcting it.
      */
      toast.error(error.message ?? t.codeInvalid);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    /**
     * Trimmed before sending. Pasted credentials routinely carry a trailing
     * space, which fails the browser's own email validation and shows an
     * "Invalid email" tooltip before the request is ever made — a confusing
     * dead end for the customer.
     */
    const cleanEmail = email.trim();

    const { error } = isSignUp
      ? await authClient.signUp.email({
          name: name.trim(),
          email: cleanEmail,
          password,
        })
      : await authClient.signIn.email({ email: cleanEmail, password });

    if (error) {
      setPending(false);
      toast.error(error.message ?? "Something went wrong");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {isSignUp ? "Create your account" : "Welcome back"}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {isSignUp ? "Start growing today" : "Sign in to RepGet"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {isSignUp
          ? "Get started in minutes."
          : "Sign in to access your dashboard."}
      </p>

      {/*
        Google as the primary route, given its own weight.
        
        Both reference designs make this the most prominent control on the
        screen — taller, rounded, its own ring — because it is one tap against
        three fields, and most people take it. The ring is the brand colour at
        low opacity rather than a heavy border, so it reads as emphasis rather
        than as an error state.
      */}
      <Button
        type="button"
        variant="outline"
        className="mt-8 h-14 w-full rounded-full border-primary/30 text-base font-semibold shadow-sm ring-4 ring-primary/5 transition-shadow hover:ring-primary/10"
        onClick={handleGoogle}
        disabled={googlePending || pending}
      >
        {googlePending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t.redirecting}
          </>
        ) : (
          <>
            <GoogleMark className="size-5" />
            {t.continueWithGoogle}
            <ArrowRight className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
          </>
        )}
      </Button>

      {/* Rule with the label sitting in it, as the reference has. */}
      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">
          {t.orContinueWithEmail}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/*
        THE CODE STEP REPLACES THE FORM, rather than appearing beside it.

        Once a code is on its way there is exactly one thing to do with it,
        and leaving the password field on screen invites somebody to fill in
        the wrong one. The address is still shown — in the help line — so
        nobody has to remember which mailbox to open.
      */}
      {!isSignUp && method === "code" && codeSent ? (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="otp">{t.codeLabel}</Label>
            <div className="relative">
              <Input
                id="otp"
                value={code}
                onChange={(event) =>
                  /*
                    Digits only, and never more than six. People paste the
                    code with a trailing space, or with the surrounding
                    sentence, and a field that silently keeps the rest fails
                    with "that code is not right" for something the form
                    could have fixed itself.
                  */
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder={t.codePlaceholder}
                /*
                  one-time-code lets iOS and Android offer the code straight
                  from the notification, which is the whole ergonomic win of
                  a number over a link.
                */
                autoComplete="one-time-code"
                inputMode="numeric"
                autoFocus
                required
                className="h-12 pl-10 font-mono text-lg tracking-[0.3em]"
              />
              <KeyRound
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t.codeHelp.replace("{email}", email.trim())}
            </p>
          </div>

          <Button
            type="submit"
            className="h-12 w-full text-base font-semibold"
            disabled={pending || code.length < 6}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t.verifying}
              </>
            ) : (
              <>
                {t.verifyCode}
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </Button>

          {/*
            Both ways out. A code that never arrives is the common failure,
            and without "send another" the only recovery is reloading the
            page — which loses the address they just typed.
          */}
          <div className="flex items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={handleRequestCode}
              disabled={pending}
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
            >
              {t.resendCode}
            </button>
            <button
              type="button"
              onClick={() => {
                setCodeSent(false);
                setCode("");
              }}
              disabled={pending}
              className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
            >
              <ArrowLeft className="size-3" aria-hidden="true" />
              {t.useDifferentEmail}
            </button>
          </div>
        </form>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp ? (
          <div className="space-y-1.5">
            <Label htmlFor="name">{t.fullName}</Label>
            <div className="relative">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.namePlaceholder}
                autoComplete="name"
                className="h-12 pl-10"
                required
              />
              <UserRound
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email">{t.email}</Label>
          {/*
            The icon sits inside the field as drawn. relative on the wrapper
            and pl-10 on the input rather than absolute positioning against the
            whole form, so the icon travels with the field if the layout moves.
          */}
          <div className="relative">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              autoComplete="email"
              className="h-12 pl-10"
              required
            />
            <Mail
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        </div>

        {/*
          Hidden when the customer chose a code. Not merely disabled: a
          greyed-out password field beside a "send me a code" button reads as
          something broken rather than something not needed.
        */}
        {isSignUp || method === "password" ? (
        <div className="space-y-1.5">
          <Label htmlFor="password">{t.password}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? "Create a password" : undefined}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={8}
              className="h-12 pr-11 pl-10"
              required
            />
            <Lock
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {isSignUp ? (
            // Stated before they choose one, not after the form rejects it.
            <p className="text-xs text-muted-foreground">
              {t.passwordHint}
            </p>
          ) : null}
        </div>
        ) : null}

        {/*
          One button, two jobs: it submits the password form, or asks for a
          code. Kept as a single control so the primary action never moves.
        */}
        <Button
          type={isSignUp || method === "password" ? "submit" : "button"}
          onClick={
            !isSignUp && method === "code" ? handleRequestCode : undefined
          }
          className="h-12 w-full text-base font-semibold"
          disabled={pending || googlePending}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {isSignUp
                ? "Creating your account…"
                : method === "code"
                  ? t.sendingCode
                  : "Signing you in…"}
            </>
          ) : (
            <>
              {isSignUp
                ? "Create account"
                : method === "code"
                  ? t.sendCode
                  : "Sign in"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>

        {/*
          Switching between the two. Sign-up is excluded: an account has to
          have a password before it can be offered as an alternative to one.
        */}
        {!isSignUp ? (
          <button
            type="button"
            onClick={() =>
              setMethod((current) =>
                current === "password" ? "code" : "password",
              )
            }
            className="w-full text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {method === "password" ? t.emailMeACode : t.usePasswordInstead}
          </button>
        ) : null}
      </form>
      )}

      {/*
        The legal line the reference carries. It belongs on the screen where
        someone actually agrees, not only in the footer.
      */}
      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms of Service
        </Link>{" "}
        and acknowledge our{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="mt-6 text-sm text-muted-foreground">
        {isSignUp ? "Already have an account? " : "Don't have an account? "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="font-medium text-primary hover:underline"
        >
          {isSignUp ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </div>
  );
}
