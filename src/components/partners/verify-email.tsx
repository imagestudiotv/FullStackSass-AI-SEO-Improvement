"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { confirmEmail } from "@/lib/auth/confirm-email-actions";
import type { PartnerCopy } from "@/lib/partners/presentation/copy";

/**
 * Proves the signed-in person's address before they can apply: the same
 * one-time code the plan step uses (Better Auth's email-verification code,
 * confirmed by lib/auth/confirm-email-actions.ts against the SESSION's own
 * address - never one typed here).
 */
export function VerifyEmail({ email, copy }: { email: string; copy: PartnerCopy["portal"]["verify"] }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send() {
    setError(null);
    start(async () => {
      const result = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
      if (result.error) setError(copy.errors.FAILED);
      else setSent(true);
    });
  }

  function confirm(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await confirmEmail(code);
      if (result.ok) router.refresh();
      else setError(copy.errors[result.error]);
    });
  }

  return (
    <section className="max-w-md rounded-xl border bg-card p-6" aria-labelledby="verify-title">
      <h2 id="verify-title" className="font-semibold">{copy.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
      {!sent ? (
        <Button className="mt-5" onClick={send} disabled={pending}>
          {copy.send}
        </Button>
      ) : (
        <form className="mt-5 space-y-3" onSubmit={confirm}>
          <p className="text-sm" role="status">{copy.sent.replace("{email}", email)}</p>
          <div className="space-y-1.5">
            <Label htmlFor="partner-otp">{copy.code}</Label>
            <Input
              id="partner-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "partner-otp-error" : undefined}
              className="max-w-40 tracking-widest"
            />
          </div>
          <Button type="submit" disabled={pending || code.length !== 6}>
            {copy.confirm}
          </Button>
        </form>
      )}
      {error ? (
        <p id="partner-otp-error" className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
