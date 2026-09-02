"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CALLBACK_URL = "/dashboard";

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

  async function handleGoogle() {
    setGooglePending(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: CALLBACK_URL,
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

      <Button
        type="button"
        variant="outline"
        className="mt-8 h-11 w-full"
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
            {/*
              Google's own mark, inline. Their brand guidelines require the
              real logo rather than a generic icon, and inlining it avoids a
              request for a 300-byte image.
            */}
            <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 1.47 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z"
              />
            </svg>
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
