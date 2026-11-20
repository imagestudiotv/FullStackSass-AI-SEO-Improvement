"use client";

import { ArrowRight, Check, Loader2, MailCheck, Minus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { confirmEmail } from "@/lib/auth/confirm-email-actions";
import type { FreePlanDisplay } from "@/lib/plans/free-plan";
import { startFreePlanAction } from "@/lib/plans/free-plan-actions";
import type { StartFreePlanRefusal } from "@/lib/plans/free-plan-server";
import { WIZARD_STEPS, wizardStepIndex } from "@/lib/onboarding/wizard";

/** `**words**` bold, as the card writes them. */
function bold(text: string): ReactNode {
  return text.split(/\*\*([^*]+)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

/**
 * The plan step for someone who pressed "Start Free" (Daniel, 2026-11-19:
 * "Start Free · No card required"): the Free card, and ONE button that starts
 * it - no card, no checkout, no billing step. Setup then carries on as after
 * a paid plan's checkout (Connect Google, AI visibility, the first article).
 *
 * The email is confirmed first, with a code, as the paid plans' free trial
 * asks: Free generation is only given to a proven address
 * (lib/plans/free-plan-server.ts startFreePlan), so one person cannot open
 * Free accounts with made-up ones.
 *
 * When the launch cap is reached the card says so and offers the paid plans'
 * free trial instead (`paidHref`).
 */
export function FreeStep({
  websiteId,
  card,
  emailVerified,
  email,
  paidHref,
  paidLabel,
  title,
}: {
  websiteId: string;
  /** lib/plans/free-plan.ts freePlanDisplay, with the launch counter. */
  card: FreePlanDisplay;
  emailVerified: boolean;
  email: string;
  /** The paid plans on this step (Grow, with its free trial). */
  paidHref: string;
  paidLabel: string;
  title: string;
}) {
  const router = useRouter();
  const emailCode = useEmailCode({
    email,
    emailVerified,
    onNotice: (notice) => {
      if (notice === "sent") toast.success(`We sent a 6-digit code to ${email}.`);
      else if (notice === "confirmed") toast.success("Email confirmed.");
      else if (notice === "send_failed") toast.error("We could not send the code. Please try again in a minute.");
      else if (notice === "invalid") toast.error("That code is not right. Check the email and try again.");
      else toast.error("That code no longer works. Send a new one.");
    },
  });
  const freeStart = useStartFree({
    websiteId,
    full: card.counter?.full ?? false,
    onStarted: (next) => router.push(next),
    onRefused: (error, reason) => {
      if (reason === "email_unverified") emailCode.setVerified(false);
      toast.error(error);
    },
  });
  const { verified, codeSent, code, setCode, sendCode, submitCode } = emailCode;
  const { full, start } = freeStart;
  const busy = emailCode.busy ?? (freeStart.starting ? "start" : null);

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        Step {String(wizardStepIndex("plan") + 1).padStart(2, "0")}{" "}
        <span className="text-muted-foreground">/ {String(WIZARD_STEPS.length).padStart(2, "0")}</span>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>

      <section
        aria-label={card.name}
        className="mt-5 rounded-[19px] border-[1.5px] border-primary/60 bg-card px-4 pt-5 pb-5 shadow-[0_12px_50px_rgba(19,19,19,0.025)] min-[501px]:px-[22px] min-[501px]:pt-[22px]"
      >
        <h2 className="text-lg font-bold tracking-tight">{card.name}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{card.desc}</p>
        <span className="mt-4 inline-flex rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-bold tracking-wide text-primary-strong">
          {card.badge}
        </span>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-5xl leading-none font-extrabold tracking-tight tabular-nums">{card.price}</span>
          <span className="text-sm text-muted-foreground">{card.perMonth}</span>
        </div>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">{card.caption}</p>

        {card.counter ? (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground">{card.counter.text}</p>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={card.counter.label}
              aria-valuemin={0}
              aria-valuemax={card.counter.cap}
              aria-valuenow={card.counter.taken}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${card.counter.percent}%` }} />
            </div>
          </div>
        ) : null}

        {full ? (
          <div className="mt-4 rounded-2xl border bg-muted/40 p-4 text-sm">
            <p>{card.fullNote}</p>
            <Button asChild className="mt-3 h-11 w-full rounded-full font-bold">
              <Link href={paidHref}>
                {paidLabel} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {!verified ? (
              <div className="mt-4 rounded-2xl border bg-muted/40 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <MailCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  Confirm your email to start Free
                </p>
                {codeSent ? (
                  <form onSubmit={submitCode} className="mt-3 flex flex-wrap gap-2">
                    <Input
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      aria-label="Confirmation code"
                      className="h-11 min-w-0 flex-1 rounded-full bg-background px-4 tracking-[0.3em]"
                    />
                    <Button type="submit" disabled={busy !== null || code.length !== 6} className="h-11 rounded-full px-5">
                      {busy === "confirm" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                      Confirm
                    </Button>
                    <p className="w-full text-xs text-muted-foreground">
                      Sent to {email}.{" "}
                      <button type="button" onClick={sendCode} disabled={busy !== null} className="font-medium text-foreground underline underline-offset-2">
                        Send a new code
                      </button>
                    </p>
                  </form>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button type="button" variant="outline" onClick={sendCode} disabled={busy !== null} className="h-11 rounded-full px-5">
                      {busy === "send" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                      Email me a code
                    </Button>
                    <span className="min-w-0 text-xs text-muted-foreground">We send it to {email}.</span>
                  </div>
                )}
              </div>
            ) : null}
            <Button
              onClick={start}
              disabled={busy !== null || !verified}
              aria-label={card.ctaLabel}
              className="mt-4 h-12 w-full rounded-full text-[15px] font-bold"
            >
              {busy === "start" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {card.cta}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </>
        )}

        <div className="mt-5 border-t pt-4">
          <p className="text-sm font-bold">{card.includedLabel}</p>
          <ul className="mt-3 grid gap-2.5 text-sm text-muted-foreground">
            {card.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>{bold(feature)}</span>
              </li>
            ))}
            {card.locked.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 opacity-70">
                <Minus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{bold(feature)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {full ? null : (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href={paidHref} className="font-medium text-foreground underline underline-offset-2">
            {paidLabel}
          </Link>
        </p>
      )}
    </div>
  );
}

/** What the email code did, for the screen to say in its own words. */
export type EmailCodeNotice = "sent" | "send_failed" | "confirmed" | "invalid" | "expired";

/**
 * The email code before Free (and before the paid plans' free trial): sent
 * only when asked for, through Better Auth's own rate-limited route, then
 * confirmed by confirmEmail. Shared with the growth plan's billing step
 * ((marketing)/growth-plan/billing-step.tsx), which says the same things in
 * the visitor's language, so the two cannot come to behave differently.
 */
export function useEmailCode({
  email,
  emailVerified,
  onNotice,
}: {
  email: string;
  emailVerified: boolean;
  onNotice: (notice: EmailCodeNotice) => void;
}) {
  const [verified, setVerified] = useState(emailVerified);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCodeValue] = useState("");
  const [busy, setBusy] = useState<"send" | "confirm" | null>(null);

  async function sendCode() {
    setBusy("send");
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
    setBusy(null);
    if (error) {
      onNotice("send_failed");
      return;
    }
    setCodeSent(true);
    setCodeValue("");
    onNotice("sent");
  }

  async function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("confirm");
    const result = await confirmEmail(code);
    setBusy(null);
    if (result.ok) {
      setVerified(true);
      onNotice("confirmed");
      return;
    }
    onNotice(result.error === "INVALID" ? "invalid" : "expired");
  }

  /** Digits only, never more than six: a pasted code often carries a space or the sentence around it. */
  const setCode = (value: string) => setCodeValue(value.replace(/\D/g, "").slice(0, 6));

  return { verified, setVerified, codeSent, code, setCode, busy, sendCode, submitCode };
}

/**
 * The one button that starts Free (startFreePlanAction), shared with the
 * growth plan's billing step. `onRefused` gets the server's words, already in
 * the reader's language; "full" also turns the card to the paid plans.
 */
export function useStartFree({
  websiteId,
  full: initiallyFull,
  onStarted,
  onRefused,
}: {
  websiteId: string;
  full: boolean;
  onStarted: (next: string) => void;
  onRefused: (error: string, reason: StartFreePlanRefusal) => void;
}) {
  const [starting, setStarting] = useState(false);
  const [full, setFull] = useState(initiallyFull);

  async function start() {
    setStarting(true);
    const result = await startFreePlanAction(websiteId);
    if (result.ok) {
      onStarted(result.next);
      return;
    }
    setStarting(false);
    if (result.reason === "full") setFull(true);
    onRefused(result.error, result.reason);
  }

  return { starting, full, start };
}
