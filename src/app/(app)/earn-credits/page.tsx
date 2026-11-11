import { ArrowUpRight, Check, CheckCircle2, ChevronDown, Coins, Info, Lightbulb, Plus, Sun, UserPlus, UsersRound, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cache } from "react";

import { DailyClaim } from "@/components/daily-claim";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Notice } from "@/components/workspace/notice";
import { requireSession } from "@/lib/auth-guard";
import { creditOverviewForRequest } from "@/lib/credits/overview-request";
import { TRIAL_CREDIT_DAYS } from "@/lib/credits/prices";
import { canEnterReferralCode, listEarnClaims } from "@/lib/earn/actions";
import { loadDiscover, type DiscoverState } from "@/lib/earn/discover";
import { EARN_WAYS } from "@/lib/earn/ways";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { DAILY_CLAIM_COPY, dailyWhen } from "@/lib/i18n/daily-claim";
import { EARN_COPY } from "@/lib/i18n/earn";
import { EARN_DISCOVER_COPY } from "@/lib/i18n/earn-discover";
import { EARN_SHARE_COPY } from "@/lib/i18n/earn-share";
import { format, formatDate, formatNumber, plural } from "@/lib/i18n/format";
import { getReferralSummary } from "@/lib/referrals/actions";
import { referralLine, REFERRALS_LISTED } from "@/lib/referrals/display";
import { REFERRAL_REWARD_CREDITS, type ReferralSummary } from "@/lib/referrals/shared";
import { siteUrl as canonicalSiteUrl } from "@/lib/site-url";
import { requireOrg } from "@/lib/tenant";
import { hasOnlySharedWork } from "@/lib/websites/accessible";

import { DiscoverEarn } from "./discover-earn";
import { EarnWays, EnterReferralCode, ReferralShare } from "./earn-client";
import { ShareKit } from "./share-kit";

const messagesFor = cache((userId: string) => getAppMessages(userId));

export async function generateMetadata(): Promise<Metadata> {
  const session = await requireSession();
  const { locale } = await messagesFor(session.user.id);
  return { title: EARN_COPY[locale].title };
}

// The balance, the referrals and the claims change with every visit.
export const dynamic = "force-dynamic";

/**
 * Earn Credits (client design, 2026-11-02), its own page rather than a card
 * on Settings: the referral program (code, link, the share kit, who signed
 * up), the daily check-in, Discover & earn (ticket 2026-11-11: upvotes and
 * comments on the blog's customer stories, and one bonus), the four other ways to earn (each reviewed by the
 * RepGet team, lib/earn), entering someone else's code, and the FAQ.
 *
 * Everything is the reader's own workspace (requireOrg). Someone who owns no
 * website is told the page is for their own workspace, as on Credits.
 */
export default async function EarnCreditsPage() {
  const session = await requireSession();
  const { orgId } = await requireOrg();
  const { t, locale } = await messagesFor(session.user.id);
  const e = EARN_COPY[locale];
  const r = t.app.referral;

  if (await hasOnlySharedWork()) {
    return (
      <PageShell>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{e.title}</h1>
        <Notice>{t.app.credits.guestOnly}</Notice>
      </PageShell>
    );
  }

  /*
    The referral summary also creates the code on a first visit (a write), so
    it stays in this per-request render. A failure there leaves the rest of
    the page working, as on Settings.
  */
  let referrals: ReferralSummary | null = null;
  try {
    referrals = await getReferralSummary();
  } catch (error) {
    console.error("[earn-credits] could not load the referral summary", error);
  }
  const [overview, claims, codeOpen, discover] = await Promise.all([
    creditOverviewForRequest(orgId).catch(() => null),
    listEarnClaims(),
    canEnterReferralCode(),
    // A failure here hides Discover & earn, never the rest of the page.
    loadDiscover(session.user.id, locale).catch((error: unknown): DiscoverState | null => {
      console.error("[earn-credits] could not load Discover & earn", error);
      return null;
    }),
  ]);
  // The production domain, never a localhost link a customer would then share.
  const link = referrals ? `${canonicalSiteUrl()}/r/${referrals.code}` : null;
  const day = (at: Date) => formatDate(at, locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const credits = REFERRAL_REWARD_CREDITS;
  const k = EARN_SHARE_COPY[locale];
  const dc = DAILY_CLAIM_COPY[locale];
  const daily = overview?.daily ?? null;
  const dailyOffered = Boolean(daily?.eligible && daily.perDay > 0);

  return (
    <PageShell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.13em] text-primary uppercase">{e.eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{e.title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{e.subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/credits">
              <Wallet aria-hidden="true" />
              {e.viewCredits}
            </Link>
          </Button>
          {overview ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold whitespace-nowrap text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Coins className="size-3.5" aria-hidden="true" />
              {format(e.available, { count: formatNumber(overview.available, locale) })}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(17rem,0.85fr)]">
        {/* The referral program: the one way to earn that needs nothing reviewed. */}
        <section aria-labelledby="invite" className="relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-7">
          <div className="pointer-events-none absolute -top-36 -right-28 size-72 rounded-full border border-primary/15" aria-hidden="true" />
          <div className="pointer-events-none absolute -top-24 -right-16 size-48 rounded-full border border-primary/10" aria-hidden="true" />
          <div className="relative flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold tracking-[0.13em] text-primary uppercase">{e.inviteEyebrow}</p>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-primary" aria-hidden="true" />
              {e.program}
            </span>
          </div>
          <div className="relative mt-4 grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="min-w-0">
              <h2 id="invite" className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
                {e.heroTitle}
                <br />
                <span className="text-primary">{format(e.heroEm, { credits })}</span>
              </h2>
              <p className="mt-3 max-w-xl text-sm text-muted-foreground">{format(e.heroBody, { credits })}</p>
              {referrals && link ? (
                <a
                  href="#share-kit"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  <Plus className="size-3.5 shrink-0" aria-hidden="true" />
                  {k.jump}
                  <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                </a>
              ) : null}
            </div>
            {/*
              The client's artwork with its drawn words removed, and the words set
              here over its pills, sized to the picture (cqw): in the reader's
              language, with the reward from REFERRAL_REWARD_CREDITS. The alt says
              it all for a screen reader, so these are hidden from one.
            */}
            <div className="@container relative mx-auto w-full max-w-84 sm:max-w-none">
              <Image
                src="/images/earn/referral-invite.webp"
                width={860}
                height={645}
                sizes="(min-width: 1024px) 22rem, (min-width: 640px) 40vw, 90vw"
                alt={format(k.artAlt, { credits })}
                className="w-full rounded-xl mix-blend-multiply dark:mix-blend-normal"
              />
              <div className="pointer-events-none absolute inset-0 font-medium text-[#181715]" aria-hidden="true">
                <span className="absolute top-[14.1%] left-[50.2%] flex min-w-[30.4cqw] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-[1.4cqw] rounded-full bg-[#fce7da] px-[3cqw] py-[2.2cqw] text-[3cqw] leading-none whitespace-nowrap">
                  <UserPlus className="size-[4.2cqw] text-primary" />
                  {e.inviteEyebrow}
                </span>
                <span className="absolute top-[42.9%] left-[65%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[1cqw] leading-none whitespace-nowrap">
                  <strong className="text-[7cqw] font-extrabold tracking-tight text-[#d9500f]">+{credits}</strong>
                  <span className="text-[3.2cqw] font-semibold">{k.artCredits}</span>
                </span>
                <span className="absolute top-[62.1%] left-[37.5%] flex min-w-[22.3cqw] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-[1.4cqw] rounded-full bg-white px-[1.8cqw] py-[1.7cqw] text-[2.7cqw] leading-none whitespace-nowrap shadow-sm">
                  <span className="grid size-[3.6cqw] place-items-center rounded-full bg-emerald-200 text-emerald-700">
                    <Check className="size-[2.6cqw] stroke-[3]" />
                  </span>
                  {k.artFriend}
                </span>
              </div>
            </div>
          </div>
          <div className="relative mt-4 max-w-2xl">
            {referrals && link ? (
              <ReferralShare code={referrals.code} link={link} t={e} />
            ) : (
              <Notice tone="danger" role="alert">
                {e.unavailable}
              </Notice>
            )}
          </div>
          <ul className="relative mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <Info className="size-3.5 text-primary" aria-hidden="true" />
              {format(e.metaPerReferral, { credits })}
            </li>
            <li className="flex items-center gap-1.5">
              <Info className="size-3.5 text-primary" aria-hidden="true" />
              {e.metaAfterPayment}
            </li>
          </ul>
        </section>

        {/* The daily credits: the customer's own check-in (lib/credits/daily.ts). What it says comes from the ledger. */}
        <section aria-labelledby="daily" className="flex flex-col rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sun className="size-5" aria-hidden="true" />
            </span>
            {dailyOffered ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                {e.dailyActive}
              </span>
            ) : null}
          </div>
          <h2 id="daily" className="mt-4 text-lg font-semibold tracking-tight">
            {e.dailyTitle}
          </h2>
          {daily && dailyOffered ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">{e.dailyBody}</p>
              <p className="mt-5 flex items-baseline gap-2 text-5xl font-bold tracking-tight tabular-nums">
                +{daily.perDay}
                <small className="text-sm font-normal tracking-normal text-muted-foreground">{e.perDay}</small>
              </p>
              {daily.plan === "trial" && daily.trialEndsAt ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {format(t.app.credits.dailyTrialHelp, {
                    count: daily.perDay,
                    days: TRIAL_CREDIT_DAYS,
                    date: formatDate(daily.trialEndsAt, locale, { day: "numeric", month: "long", timeZone: "UTC" }),
                  })}
                </p>
              ) : null}
              <div className="mt-auto pt-5">
                <DailyClaim status={daily} copy={dc} locale={locale} variant="button" className="w-full" />
                <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4 text-sm">
                  <span className="text-muted-foreground">{e.todayLabel}</span>
                  {daily.today > 0 ? (
                    <strong className="text-emerald-700 tabular-nums dark:text-emerald-400">{format(e.todayAdded, { count: daily.today })}</strong>
                  ) : (
                    <span className="text-muted-foreground">{dc.notCollected}</span>
                  )}
                </div>
                {daily.nextAt ? <p className="mt-2 text-xs text-muted-foreground">{format(dc.next, { when: dailyWhen(daily.nextAt, locale) })}</p> : null}
              </div>
            </>
          ) : (
            /* Nothing to claim, and no button that would be refused: say what is true for this account. */
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                {daily?.plan === "trial_over" && daily.trialEndsAt ? format(t.app.credits.dailyTrialOver, { count: daily.paidPerDay }) : e.dailyNone}
              </p>
              {daily && daily.paidPerDay > 0 && daily.plan !== "paid" ? (
                <div className="mt-auto pt-5">
                  {daily.plan === "trial_over" && daily.trialEndsAt ? null : (
                    <p className="text-sm text-muted-foreground">{format(dc.noneHelp, { credits: plural(dc.credits, daily.paidPerDay) })}</p>
                  )}
                  <Button asChild variant="outline" className="mt-3 w-full">
                    <Link href="/billing#plan">{dc.seePlans}</Link>
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      {discover && discover.businesses.length > 0 ? (
        <DiscoverEarn businesses={discover.businesses} progress={discover.progress} claimed={discover.claimed} t={EARN_DISCOVER_COPY[locale]} />
      ) : null}

      {referrals && link ? (
        <ShareKit code={referrals.code} link={link} postCredits={EARN_WAYS.post.credits} referralCredits={credits} locale={locale} t={k} />
      ) : null}

      <section id="more-ways" aria-labelledby="ways" className="scroll-mt-20 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="ways" className="text-lg font-semibold tracking-tight">
              {e.waysTitle}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{e.waysBody}</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
            <Lightbulb className="size-3.5" aria-hidden="true" />
            {e.reviewedTag}
          </span>
        </div>
        <EarnWays claims={claims} t={e} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-labelledby="activity" className="rounded-2xl border bg-card p-5 sm:p-6">
          <h2 id="activity" className="font-semibold">
            {e.activityTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{e.activityBody}</p>
          {referrals ? (
            <>
              <dl className="mt-5 grid grid-cols-3 divide-x overflow-hidden rounded-xl border">
                <Figure label={e.referred} value={referrals.referrals.length >= REFERRALS_LISTED ? `${formatNumber(REFERRALS_LISTED, locale)}+` : formatNumber(referrals.referrals.length, locale)} />
                <Figure label={e.awaiting} value={formatNumber(referrals.pending, locale)} />
                <Figure label={e.earned} value={formatNumber(referrals.earned, locale)} />
              </dl>
              <h3 className="mt-6 border-b pb-3 text-sm font-semibold">{e.referredBusinesses}</h3>
              {referrals.referrals.length === 0 ? (
                <div className="flex items-center gap-3 pt-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <UsersRound className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{e.noneTitle}</p>
                    <p className="text-sm text-muted-foreground">{e.noneBody}</p>
                  </div>
                </div>
              ) : (
                <ul className="divide-y">
                  {referrals.referrals.map((row) => (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.referredDomain ?? row.referredName ?? r.someoneReferred}</p>
                        <p className="text-xs text-muted-foreground">{referralLine(row, r, day)}</p>
                      </div>
                      {row.status === "rewarded" ? (
                        <StatusBadge status="rewarded" label={format(r.creditsBadge, { count: row.rewardCredits ?? 0 })} />
                      ) : row.status === "rejected" ? (
                        <StatusBadge status="rejected" label={r.notEligible} tone="neutral" />
                      ) : (
                        <StatusBadge status="pending" label={r.waiting} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <Notice tone="danger" role="alert">
              {e.unavailable}
            </Notice>
          )}
        </section>

        <section aria-labelledby="how" className="rounded-2xl border bg-card p-5 sm:p-6">
          <h2 id="how" className="font-semibold">
            {e.howTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{e.howIntro}</p>
          <ol className="mt-5 space-y-4">
            {e.steps.map(([title, body], index) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-sm font-medium">{format(title, { credits })}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 flex gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            {e.howNote}
          </p>
        </section>
      </div>

      {codeOpen ? <EnterReferralCode t={e} /> : null}

      <section aria-labelledby="faq" className="space-y-3">
        <h2 id="faq" className="text-lg font-semibold tracking-tight">
          {e.faqTitle}
        </h2>
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {e.faq.map(([question, answer]) => (
            <details key={question} className="group px-5">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                {question}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="max-w-3xl pb-4 text-sm leading-6 text-muted-foreground">{format(answer, { credits })}</p>
            </details>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 p-3 sm:p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}
