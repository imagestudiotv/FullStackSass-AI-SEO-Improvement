"use client";

import { CheckCircle2, Clock3, Info, Loader2, MonitorPlay, Play, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { readConsent } from "@/lib/consent";
import { claimRewardedAdAction, endRewardedAdAction, startRewardedAdAction } from "@/lib/earn/rewarded-ads-actions";
import type { RewardedAdRefusal, RewardedAdState } from "@/lib/earn/rewarded-ads";
import type { EarnRewardedAdsCopy } from "@/lib/i18n/earn-rewarded-ads";
import { format } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import { loadGpt, requestRewardedAd, type RewardedOutcome } from "./rewarded-ad-gpt";

/**
 * "Watch an ad to earn credits" (client ticket, 2026-11-13; reference: a card
 * with "10 ads/day" and a countdown). The disclosure is on the card before
 * anything loads: what to do, what it gives, how many a day. Nothing is
 * requested from Google until the member presses "Watch an ad"; the ad is
 * shown only after a second press once it is ready, with an equal "Not now".
 *
 * Every figure is the server's (lib/earn/rewarded-ads.ts), and success is
 * said only once the claim action confirmed the credits.
 */

/**
 * Whether this document was loaded on /earn-credits itself.
 *
 * The page's Content-Security-Policy is the one of the page the browser
 * LOADED, and a click on an in-app link (the sidebar's "Earn Credits", the
 * Credits page, the daily check-in) changes the page without loading a new
 * document. Only /earn-credits' own policy allows Google Publisher Tag's
 * requests and frames (src/proxy.ts), so arriving from the dashboard kept
 * the dashboard's policy and every ad was blocked - "on dashboard the video
 * ads are not displaying" (ticket 2026-11-19). Pressing "Watch an ad" then
 * loads the page for real first (?watch=1 carries the press over).
 */
export function loadedOnEarnCredits(entry: { name: string } | undefined): boolean {
  if (!entry) return true;
  try {
    return new URL(entry.name).pathname === "/earn-credits";
  } catch {
    return true;
  }
}

function documentEntry(): { name: string } | undefined {
  try {
    return performance.getEntriesByType("navigation")[0];
  } catch {
    return undefined;
  }
}

/** The address that loads Earn Credits as a document and starts the ad the member asked for. */
export const WATCH_URL = "/earn-credits?watch=1";

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; show: () => boolean }
  | { kind: "playing" }
  | { kind: "claiming" }
  | { kind: "success"; credits: number }
  | { kind: "message"; text: string; tone: "info" | "error" };

export function RewardedAdCard({ initial, t }: { initial: RewardedAdState; t: EarnRewardedAdsCopy }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const now = useNow(state.cooldownUntil);
  const session = useRef<string | null>(null);
  const abandon = useRef<(() => void) | null>(null);
  /** The claim, once rewardedSlotGranted fired; the close waits for it. */
  const claim = useRef<Promise<void> | null>(null);

  // Leaving the page closes an open attempt with nothing credited.
  useEffect(
    () => () => {
      abandon.current?.();
      if (session.current && !claim.current) void endRewardedAdAction(session.current, "closed_early").catch(() => {});
    },
    [],
  );

  // Back from the full load that "Watch an ad" asked for: carry the press over once, and tidy the address.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("watch") !== "1") return;
    window.history.replaceState(null, "", "/earn-credits");
    const timer = window.setTimeout(() => void watch(), 0);
    return () => window.clearTimeout(timer);
    // Once, on arrival; watch() reads the state it needs when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cooldownLeft = state.cooldownUntil ? Math.max(0, Date.parse(state.cooldownUntil) - now) : 0;
  const limitReached = state.watchedToday >= state.dailyLimit;
  const blockedToday = limitReached || state.capReached || state.attemptsExhausted;
  const busy = phase.kind === "loading" || phase.kind === "playing" || phase.kind === "claiming" || phase.kind === "ready";

  function refusal(error: RewardedAdRefusal): string {
    if (error === "daily_limit") return format(t.limitReached, { limit: state.dailyLimit });
    if (error === "cap") return t.capReached;
    if (error === "attempts") return t.attempts;
    if (error === "too_early" || error === "expired" || error === "disabled") return t.errors[error];
    return t.errors.generic;
  }

  function close(reason: RewardedOutcome | "blocked") {
    const id = session.current;
    session.current = null;
    abandon.current = null;
    if (id && reason !== "granted") void endRewardedAdAction(id, reason).catch(() => {});
  }

  async function watch() {
    setPhase({ kind: "loading" });
    // Arrived by an in-app link: this document still has the previous page's policy, which blocks the ad. Load the page for real.
    if (!loadedOnEarnCredits(documentEntry())) {
      // A full load on purpose: router.push would keep this document and its policy.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(WATCH_URL);
      return;
    }
    let started;
    try {
      started = await startRewardedAdAction();
    } catch {
      setPhase({ kind: "message", text: t.errors.generic, tone: "error" });
      return;
    }
    if (started.state) setState(started.state);
    if (!started.ok) {
      setPhase(started.error === "cooldown" ? { kind: "idle" } : { kind: "message", text: refusal(started.error), tone: "info" });
      return;
    }
    session.current = started.sessionId;
    claim.current = null;

    if (!(await loadGpt()) || !window.googletag) {
      close("blocked");
      setPhase({ kind: "message", text: t.blocked, tone: "error" });
      return;
    }
    abandon.current = requestRewardedAd(window.googletag, started.state.adUnitPath, readConsent() === "granted", {
      onReady: (show) => setPhase({ kind: "ready", show }),
      onGranted: () => {
        const id = session.current;
        if (!id) return;
        setPhase({ kind: "claiming" });
        claim.current = claimRewardedAdAction(id)
          .then((result) => {
            if (result.state) setState(result.state);
            setPhase(result.ok ? { kind: "success", credits: result.credits } : { kind: "message", text: refusal(result.error), tone: "error" });
            if (result.ok) router.refresh();
          })
          .catch(() => setPhase({ kind: "message", text: t.errors.generic, tone: "error" }));
      },
      onEnd: (outcome) => {
        close(outcome);
        if (outcome === "granted") return;
        const text = outcome === "closed_early" ? t.closedEarly : outcome === "unsupported" ? t.unsupported : t.noFill;
        setPhase({ kind: "message", text, tone: outcome === "closed_early" ? "info" : "error" });
      },
    });
  }

  function start(show: () => boolean) {
    if (show()) {
      setPhase({ kind: "playing" });
    } else {
      abandon.current?.();
      close("no_fill");
      setPhase({ kind: "message", text: t.noFill, tone: "error" });
    }
  }

  function notNow() {
    abandon.current?.();
    close("closed_early");
    setPhase({ kind: "idle" });
  }

  return (
    <section aria-labelledby="watch-ad" className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <MonitorPlay className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="watch-ad" className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
              {t.title}
              {state.testMode ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  {t.testMode}
                </span>
              ) : null}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{format(t.body, { credits: state.rewardCredits, limit: state.dailyLimit })}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="font-bold text-primary tabular-nums">{format(t.perAd, { credits: state.rewardCredits })}</span>
              <span className="tabular-nums">{format(t.today, { count: state.watchedToday, limit: state.dailyLimit })}</span>
            </p>
          </div>
        </div>
        <div className="shrink-0 sm:min-w-48">
          {blockedToday && !busy ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {limitReached ? format(t.limitReached, { limit: state.dailyLimit }) : state.capReached ? t.capReached : t.attempts}
            </p>
          ) : cooldownLeft > 0 && !busy ? (
            <Button type="button" variant="secondary" disabled className="w-full tabular-nums">
              <Clock3 aria-hidden="true" />
              <span suppressHydrationWarning>{format(t.cooldown, { time: clock(cooldownLeft) })}</span>
            </Button>
          ) : phase.kind === "ready" ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={() => start(phase.show)} className="flex-1">
                <Play aria-hidden="true" />
                {t.startAd}
              </Button>
              <Button type="button" variant="outline" onClick={notNow} className="flex-1">
                {t.notNow}
              </Button>
            </div>
          ) : (
            <Button type="button" onClick={watch} disabled={busy} className="w-full">
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
              {phase.kind === "loading" ? t.loading : phase.kind === "playing" ? t.playing : phase.kind === "claiming" ? t.claiming : t.watch}
            </Button>
          )}
        </div>
      </div>

      <div aria-live="polite" className="empty:hidden">
        {phase.kind === "ready" ? (
          <p className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">{format(t.ready, { credits: state.rewardCredits })}</p>
        ) : phase.kind === "success" ? (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            {format(t.success, { credits: phase.credits })}
          </p>
        ) : phase.kind === "message" ? (
          <p
            role={phase.tone === "error" ? "alert" : undefined}
            className={cn(
              "mt-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
              phase.tone === "error" ? "border-destructive/30 text-destructive" : "text-muted-foreground",
            )}
          >
            {phase.tone === "error" ? <XCircle className="size-4 shrink-0" aria-hidden="true" /> : <Info className="size-4 shrink-0" aria-hidden="true" />}
            {phase.text}
          </p>
        ) : null}
      </div>

      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{t.note}</p>
    </section>
  );
}

/**
 * The card when no ad can be offered at all: the feature is not set up on
 * this deployment (lib/earn/rewarded-ads-config.ts) or its state could not be
 * read. Said plainly rather than leaving a gap where the card was - the gap
 * read as "the video ads are not displaying" (ticket 2026-11-19).
 */
export function RewardedAdUnavailable({ t }: { t: EarnRewardedAdsCopy }) {
  return (
    <section aria-labelledby="watch-ad" className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex min-w-0 gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
          <MonitorPlay className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="watch-ad" className="text-lg font-semibold tracking-tight">
            {t.title}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            {t.errors.disabled}
          </p>
        </div>
      </div>
    </section>
  );
}

/** Ticks every second while a countdown runs; otherwise does nothing. */
function useNow(until: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  return now;
}

/** "4:05", or "1:02:03" past an hour. */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
