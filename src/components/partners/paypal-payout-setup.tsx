"use client";

import { CheckCircle2, Mail, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { choosePayoutMethodAction, setPayPalRecipientAction, verifyPayPalRecipientAction } from "@/lib/partners/presentation/actions";
import { fill } from "@/lib/partners/presentation/copy";
import type { PartnerPayPalCopy } from "@/lib/partners/presentation/paypal-copy";

/**
 * Being paid through PayPal: the address, the code sent to it, and the
 * choice of method. Everything is decided on the server (paypal-payouts.ts):
 * this asks and shows what it answers.
 */
export function PayPalPayoutSetup({
  copy,
  account,
  method,
  manual,
  canChooseStripe,
}: {
  copy: PartnerPayPalCopy;
  account: { receiver: string; status: "pending_verification" | "verified" | "disabled" } | null;
  method: "stripe" | "paypal";
  manual: boolean;
  /** The partner's Stripe payouts are set up, so switching back is possible. */
  canChooseStripe: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(account === null);
  const [email, setEmail] = useState(account?.receiver ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const message = (detail?: string, reason?: string) =>
    detail === "email"
      ? copy.errors.email
      : detail === "code" || detail === "no_code"
        ? copy.errors.code
        : detail === "code_expired"
          ? copy.errors.expired
          : reason === "rate_limited"
            ? copy.errors.tooMany
            : detail === "country_not_supported"
              ? copy.errors.country
              : detail === "paypal_not_verified"
                ? copy.errors.notVerified
                : copy.errors.generic;

  function run(work: () => Promise<{ ok: boolean; error?: string; detail?: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      const result = await work();
      if (!result.ok) {
        setError(message(result.detail, result.error));
        return;
      }
      after?.();
      router.refresh();
    });
  }

  const awaitingCode = account?.status === "pending_verification" && !editing;
  const verified = account?.status === "verified" && !editing;

  return (
    <section className="rounded-xl border bg-card p-6" aria-labelledby="paypal-payouts-title">
      <div className="flex items-start gap-3">
        <Wallet className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="paypal-payouts-title" className="font-semibold">{copy.title}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{copy.intro}</p>
          {manual ? <p className="mt-1 max-w-xl text-sm text-muted-foreground">{copy.manualNote}</p> : null}
        </div>
      </div>

      <p className="mt-4 text-sm" role="status">
        {method === "paypal" && account?.status === "verified" ? fill(copy.currentPayPal, { email: account.receiver }) : copy.currentStripe}
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {editing || !account ? (
        <form
          className="mt-4 flex max-w-md flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => setPayPalRecipientAction(email), () => setEditing(false));
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="paypal-email">{copy.email}</Label>
            <Input id="paypal-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} required />
          </div>
          <Button type="submit" disabled={pending}>
            <Mail className="size-4" aria-hidden="true" />
            {copy.sendCode}
          </Button>
        </form>
      ) : null}

      {awaitingCode ? (
        <form
          className="mt-4 max-w-md space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => verifyPayPalRecipientAction(code), () => setCode(""));
          }}
        >
          <p className="text-sm text-muted-foreground">{fill(copy.codeSent, { email: account!.receiver })}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="paypal-code">{copy.code}</Label>
              <Input id="paypal-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} disabled={pending} required />
            </div>
            <Button type="submit" disabled={pending}>
              {copy.confirm}
            </Button>
          </div>
          <Button type="button" variant="link" className="h-auto px-0" onClick={() => setEditing(true)} disabled={pending}>
            {copy.changeAddress}
          </Button>
        </form>
      ) : null}

      {verified ? (
        <div className="mt-4 space-y-3">
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            {fill(copy.verified, { email: account!.receiver })}
          </p>
          <p className="text-xs text-muted-foreground">{copy.unclaimedHint}</p>
          <div className="flex flex-wrap gap-2">
            {method !== "paypal" ? (
              <Button onClick={() => run(() => choosePayoutMethodAction("paypal"))} disabled={pending}>
                {copy.usePayPal}
              </Button>
            ) : canChooseStripe ? (
              <Button variant="outline" onClick={() => run(() => choosePayoutMethodAction("stripe"))} disabled={pending}>
                {copy.useStripe}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setEditing(true)} disabled={pending}>
              {copy.changeAddress}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
