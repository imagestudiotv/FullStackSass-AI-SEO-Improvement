"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
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
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const isSignUp = mode === "sign-up";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  /**
   * Report a failure that happened during the OAuth round trip.
   *
   * Better Auth redirects back with ?error=<code>. Nothing read it, so a
   * refused sign-in looked like nothing happening at all. Shown once and then
   * stripped from the address, so a reload does not repeat it.
   */
  const searchParams = useSearchParams();
  useEffect(() => {
    const code = searchParams.get("error");
    if (!code) return;
    toast.error(OAUTH_ERRORS[code] ?? "Sign-in did not complete. Try again.");
    window.history.replaceState(null, "", window.location.pathname);
  }, [searchParams]);

  async function handleGoogle() {
    setGooglePending(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: CALLBACK_URL,
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

    router.push(CALLBACK_URL);
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">
        {isSignUp ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {isSignUp
          ? "Get started in minutes. No credit card required."
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
            Redirecting…
          </>
        ) : (
          <>
            <GoogleMark className="size-5" />
            Continue with Google
          </>
        )}
      </Button>

      {/* Rule with the label sitting in it, as the reference has. */}
      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">
          Or continue with email
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp ? (
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              autoComplete="name"
              className="h-11"
              required
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="h-11"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={8}
            className="h-11"
            required
          />
          {isSignUp ? (
            // Stated before they choose one, not after the form rejects it.
            <p className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          className="h-11 w-full"
          disabled={pending || googlePending}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {isSignUp ? "Creating your account…" : "Signing you in…"}
            </>
          ) : isSignUp ? (
            "Create account"
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

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
