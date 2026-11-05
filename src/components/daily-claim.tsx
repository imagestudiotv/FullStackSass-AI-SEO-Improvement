"use client";

import { ArrowRight, ArrowUpRight, Check, Flame, Gift, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Notice } from "@/components/workspace/notice";
import { claimDailyCreditsAction } from "@/lib/credits/daily-actions";
import type { DailyCredits, DailyProgressDay } from "@/lib/credits/daily";
import type { Locale } from "@/lib/i18n/config";
import { dailyWhen, type DailyClaimCopy } from "@/lib/i18n/daily-claim";
import { format, formatDate, plural } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import styles from "./daily-claim.module.css";

/**
 * The daily check-in (client design and ticket, 2026-11-05): a launcher and the
 * modal it opens, on the Radix dialog, which traps focus and gives it back to
 * the launcher. The modal shows what the server says: success only after the
 * claim action confirmed it, the streak and the days from the ledger, the real
 * amount. Nothing here is stored in the browser.
 *
 * Each launcher is its own instance. A confirmed claim refreshes the route, so
 * every other launcher, the balance and the history get new figures.
 *
 * The launcher hides itself when there is nothing to claim: on a plan without
 * daily credits it would be a promise the server refuses. The Earn Credits card
 * says why instead.
 */

type Variant = "row" | "chip" | "button" | "banner";

/** Pieces thrown from the middle, at fixed angles so a render is repeatable. */
const CONFETTI = Array.from({ length: 28 }, (_, index) => {
  const angle = (2 * Math.PI * index) / 28;
  const reach = 90 + ((index * 37) % 220);
  return {
    "--x": `${Math.round(Math.cos(angle) * reach)}px`,
    "--y": `${Math.round(Math.sin(angle) * reach - 75)}px`,
    "--turn": `${(index * 97) % 720}deg`,
    animationDelay: `${(index % 7) * 0.02}s`,
  } as React.CSSProperties;
});

export function DailyClaim({
  status: served,
  copy,
  locale,
  variant,
  className,
}: {
  status: DailyCredits;
  copy: DailyClaimCopy;
  locale: Locale;
  variant: Variant;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  /*
    What the server answered, until the refresh it triggers brings new props:
    newer props always win, so this can never go stale.
  */
  const [answer, setAnswer] = useState<{ for: DailyCredits; status: DailyCredits } | null>(null);
  const status = answer?.for === served ? answer.status : served;
  const [message, setMessage] = useState<{ text: string; tone: "status" | "alert" } | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  // The phone chip only appears for an open check-in, but stays through it so the focus has somewhere to return.
  const [wasClaimable] = useState(served.claimable);
  const contentRef = useRef<HTMLDivElement>(null);

  const offered = status.eligible && status.perDay > 0;
  if (!open && (!offered || (variant === "chip" && !served.claimable && !wasClaimable))) return null;

  const creditWord = (count: number) => plural(copy.credits, count);
  const amount = creditWord(status.perDay);

  function changeOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) {
      setMessage(null);
      setCelebrate(false);
      // A page left open past midnight is showing yesterday: ask again, and the server decides anyway.
      if (status.nextAt && Date.now() >= new Date(status.nextAt).getTime()) router.refresh();
    }
  }

  function claim() {
    setMessage(null);
    start(async () => {
      try {
        const result = await claimDailyCreditsAction();
        setAnswer({ for: served, status: result.status });
        if (result.outcome === "claimed") {
          const text = format(copy.success, { credits: creditWord(result.amount) });
          setMessage({ text, tone: "status" });
          setCelebrate(true);
          toast.success(text);
        } else if (result.outcome === "already_claimed") {
          setMessage({ text: copy.already, tone: "status" });
        } else {
          setMessage({ text: copy.notEligible, tone: "alert" });
        }
        router.refresh();
      } catch {
        setMessage({ text: copy.failed, tone: "alert" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <Launcher status={status} variant={variant} copy={copy} locale={locale} amount={amount} creditWord={creditWord} className={className} />
      <DialogContent
        ref={contentRef}
        closeLabel={copy.close}
        overlayClassName="bg-black/50 supports-backdrop-filter:backdrop-blur-sm"
        // The dialog itself takes the focus, not the claim button, so Enter pressed on the launcher cannot claim by accident.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
        className="max-w-[calc(100%-1.25rem)] gap-0 overflow-x-hidden rounded-2xl p-0 shadow-2xl motion-reduce:animate-none sm:max-w-[58rem]"
      >
        <Hero status={status} copy={copy} locale={locale} amount={amount} creditWord={creditWord} />
        <div className="px-3.5 pt-4 pb-5 [@media(max-height:760px)]:pb-3 [@media(max-height:760px)]:pt-2 sm:px-8 sm:pt-6 sm:pb-6">
          {status.progress.length > 0 ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 [@media(max-height:760px)]:mb-2">
                <strong className="text-sm font-bold tracking-tight sm:text-base">
                  {format(status.plan === "trial" ? copy.trialJourney : copy.journey, { days: status.progress.length })}
                </strong>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
                  <Flame className="size-3.5" aria-hidden="true" />
                  {status.streak > 0 ? plural(copy.streak, status.streak) : copy.noStreak}
                </span>
              </div>
              <ol
                className={cn(
                  "grid gap-1.5 sm:gap-2.5",
                  status.progress.length === 7 ? "grid-cols-4 sm:grid-cols-7" : "grid-cols-3 sm:mx-auto sm:max-w-md",
                )}
              >
                {status.progress.map((day) => (
                  <DayCell key={day.day} day={day} perDay={status.perDay} copy={copy} />
                ))}
              </ol>
            </>
          ) : null}

          {message ? (
            <div className="mt-4">
              {message.tone === "alert" ? (
                <Notice tone="danger" role="alert">
                  {message.text}
                </Notice>
              ) : (
                <p role="status" className="text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {message.text}
                </p>
              )}
            </div>
          ) : null}

          {offered ? (
            <div className="mt-5 flex flex-col items-stretch gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:text-left [@media(max-height:760px)]:mt-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <b className="block text-sm font-bold text-foreground">{copy.momentum}</b>
                <span className="font-semibold text-primary">
                  {status.plan === "trial" && status.trialEndsAt
                    ? format(copy.trialDays, {
                        credits: amount,
                        days: status.progress.length,
                        date: formatDate(status.trialEndsAt, locale, { day: "numeric", month: "long", timeZone: "UTC" }),
                      })
                    : format(copy.everyDay, { credits: amount })}
                </span>
              </p>
              {status.claimable ? (
                <Button type="button" size="lg" onClick={claim} disabled={pending} className="min-h-12 shrink-0 sm:min-w-72">
                  {pending ? copy.collecting : format(copy.collect, { credits: amount })}
                  {pending ? null : <ArrowRight aria-hidden="true" />}
                </Button>
              ) : (
                <Button type="button" size="lg" variant="secondary" disabled className="min-h-12 shrink-0 whitespace-normal sm:min-w-72">
                  <Check aria-hidden="true" />
                  {format(copy.collected, { credits: creditWord(status.today) })}
                </Button>
              )}
            </div>
          ) : null}

          {offered ? (
            <p className="mt-4 flex items-start justify-center gap-1.5 border-t pt-3 text-center text-xs leading-normal text-muted-foreground sm:items-center [@media(max-height:760px)]:mt-3 [@media(max-height:760px)]:pt-2">
              <Info className="mt-0.5 size-3.5 shrink-0 sm:mt-0" aria-hidden="true" />
              <span>{status.plan === "trial" ? copy.fineTrial : format(copy.fine, { credits: amount, days: status.progress.length })}</span>
            </p>
          ) : null}
          <p className="mt-3 flex flex-wrap items-center justify-center gap-1 text-center text-xs text-muted-foreground">
            {offered ? format(copy.more, { credits: amount }) : null}{" "}
            <Link href="/earn-credits" onClick={() => setOpen(false)} className="font-bold text-primary underline-offset-2 hover:underline">
              {copy.moreLink}
            </Link>{" "}
            {copy.moreEnd}
          </p>
        </div>
        {celebrate ? (
          <div className={styles.confetti} aria-hidden="true">
            {CONFETTI.map((style, index) => (
              <i key={index} style={style} />
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Launcher({
  status,
  variant,
  copy,
  locale,
  amount,
  creditWord,
  className,
}: {
  status: DailyCredits;
  variant: Variant;
  copy: DailyClaimCopy;
  locale: Locale;
  amount: string;
  creditWord: (count: number) => string;
  className?: string;
}) {
  const label = status.claimable ? format(copy.launchClaim, { credits: amount }) : copy.launchView;

  if (variant === "chip") {
    return (
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "flex h-7 items-center gap-1 rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground tabular-nums transition-colors hover:bg-primary/90",
            className,
          )}
        >
          <Gift className="size-3.5" aria-hidden="true" />+{status.claimable ? status.perDay : status.today}
        </button>
      </DialogTrigger>
    );
  }
  if (variant === "row") {
    return (
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
            status.claimable
              ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            className,
          )}
        >
          {status.claimable ? <Gift className="size-4 shrink-0" aria-hidden="true" /> : <Check className="size-4 shrink-0" aria-hidden="true" />}
          <span className="min-w-0">{label}</span>
        </button>
      </DialogTrigger>
    );
  }
  if (variant === "banner") {
    return (
      <section
        aria-label={copy.eyebrow}
        className={cn(
          "relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6",
          className,
        )}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.13em] text-primary uppercase">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            {copy.eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight">{copy.bannerTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {status.claimable
              ? format(copy.bannerBody, { credits: amount })
              : status.nextAt
                ? format(copy.doneSub, { when: dailyWhen(new Date(status.nextAt), locale) })
                : status.paidPerDay > 0
                  ? format(copy.trialLastSubPaid, { credits: creditWord(status.paidPerDay) })
                  : copy.trialLastSub}
          </p>
        </div>
        {/*
          The same button in both states, so the focus can return to it when the
          modal closes. Claimed, it is marked disabled and does nothing, rather
          than natively disabled, which would throw the keyboard's place away.
        */}
        <DialogTrigger asChild>
          <Button
            type="button"
            variant={status.claimable ? "default" : "secondary"}
            aria-disabled={status.claimable ? undefined : true}
            onClick={status.claimable ? undefined : (event) => event.preventDefault()}
            className={cn("shrink-0", !status.claimable && "cursor-default text-muted-foreground hover:bg-secondary")}
          >
            {status.claimable ? null : <Check aria-hidden="true" />}
            {status.claimable ? label : copy.claimedToday}
            {status.claimable ? <ArrowUpRight aria-hidden="true" /> : null}
          </Button>
        </DialogTrigger>
      </section>
    );
  }
  return (
    <DialogTrigger asChild>
      <Button type="button" variant={status.claimable ? "default" : "outline"} className={className}>
        {status.claimable ? <Gift aria-hidden="true" /> : <Check aria-hidden="true" />}
        {label}
      </Button>
    </DialogTrigger>
  );
}

function Hero({
  status,
  copy,
  locale,
  amount,
  creditWord,
}: {
  status: DailyCredits;
  copy: DailyClaimCopy;
  locale: Locale;
  amount: string;
  creditWord: (count: number) => string;
}) {
  const trial = status.plan === "trial";
  const when = status.nextAt ? dailyWhen(new Date(status.nextAt), locale) : "";
  const trialDay = status.progress.find((day) => day.when === "today")?.day ?? 1;

  let title = trial ? copy.trialTitle : copy.title;
  let em = format(trial ? copy.trialEm : copy.titleEm, { credits: amount });
  let sub = trial ? format(copy.trialSub, { day: trialDay, days: status.progress.length }) : copy.sub;
  if (!status.eligible) {
    title = copy.title;
    em = "";
    sub = copy.notEligible;
  } else if (status.today > 0) {
    title = copy.doneTitle;
    if (status.nextAt) {
      em = format(trial ? copy.trialDoneEm : copy.doneEm, { count: status.perDay });
      sub = format(copy.doneSub, { when });
    } else {
      em = copy.trialLastEm;
      sub = status.paidPerDay > 0 ? format(copy.trialLastSubPaid, { credits: creditWord(status.paidPerDay) }) : copy.trialLastSub;
    }
  }

  return (
    <div className={styles.hero}>
      <span className={cn(styles.doodle, styles.doodleLeft)} aria-hidden="true" />
      <span className={cn(styles.doodle, styles.doodleRight)} aria-hidden="true" />
      {[styles.coinA, styles.coinB, styles.coinC, styles.coinD].map((coin) => (
        <span key={coin} className={cn(styles.coin, styles.floating, coin)} aria-hidden="true">
          R
        </span>
      ))}
      <p className="relative inline-flex items-center gap-2 text-[0.625rem] font-extrabold tracking-[0.15em] text-[#a3551f] uppercase dark:text-[#f0b48a]">
        <Gift className="size-3.5" aria-hidden="true" />
        {copy.eyebrow}
      </p>
      <DialogTitle className="relative mx-auto mt-3 max-w-xl text-2xl leading-tight font-extrabold tracking-tight text-[#181715] sm:text-4xl [@media(max-height:760px)]:mt-1.5 [@media(max-height:760px)]:text-2xl dark:text-foreground">
        {title}
        {em ? (
          <>
            <br />
            <span className="text-[#c9500f] dark:text-[#ff9d6c]">{em}</span>
          </>
        ) : null}
      </DialogTitle>
      <DialogDescription className="relative mt-2 text-xs leading-normal text-[#6a5f56] sm:text-sm dark:text-muted-foreground">{sub}</DialogDescription>
    </div>
  );
}

function DayCell({ day, perDay, copy }: { day: DailyProgressDay; perDay: number; copy: DailyClaimCopy }) {
  const today = day.when === "today";
  const state = day.claimed ? copy.stateClaimed : today ? copy.stateToday : day.when === "future" ? copy.stateUpcoming : copy.stateMissed;
  return (
    <li
      aria-current={today ? "date" : undefined}
      className={cn(
        "flex min-h-24 min-w-0 flex-col items-center justify-between gap-1 rounded-xl border px-0.5 py-2.5 text-center sm:min-h-32 sm:py-3.5 [@media(max-height:760px)]:min-h-24 [@media(max-height:760px)]:py-2",
        today && !day.claimed && styles.today,
        today && day.claimed && "border-foreground bg-foreground text-background",
        !today && "bg-muted/60 text-muted-foreground",
      )}
    >
      <span className="text-xs font-bold whitespace-nowrap sm:text-sm">{format(copy.day, { day: day.day })}</span>
      {day.claimed ? (
        <span
          className={cn(
            "grid size-9 place-items-center rounded-full sm:size-11 [@media(max-height:760px)]:size-9",
            today ? "bg-background text-foreground" : "bg-foreground text-background",
          )}
        >
          <Check className="size-5 stroke-[3]" aria-hidden="true" />
        </span>
      ) : (
        <span className={cn(styles.coin, styles.dayCoin, !today && styles.dayCoinMuted)}>+{perDay}</span>
      )}
      <span className="text-[0.6875rem] leading-tight font-semibold">{state}</span>
    </li>
  );
}
