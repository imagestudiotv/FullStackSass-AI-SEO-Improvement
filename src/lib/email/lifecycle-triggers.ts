import "server-only";

import { and, asc, count, eq, gt, gte, inArray, isNotNull, isNull, lte, sql, type SQL } from "drizzle-orm";

import { customerTitleSql } from "@/lib/articles/review";

import { WINBACK_BONUS_CREDITS, WINBACK_PERCENT_OFF, winbackOfferEnabled } from "@/lib/billing/winback-offer";
import { db } from "@/lib/db";
import {
  articles,
  calendarItems,
  creditLedger,
  member,
  payments,
  plans,
  socialSuggestions,
  subscriptions,
  user,
  videoIdeas,
  websiteInvitations,
  websiteMembers,
  websites,
} from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";
import { isSubscriptionEnded } from "@/lib/websites/deletion";

import { sendLifecycleEmail, type LifecycleOutcome } from "./lifecycle";

/**
 * The moments each lifecycle email follows (docs/emails.md). Each function
 * here is called right AFTER the thing it reports has been recorded - by the
 * billing sync, the payment webhooks, the publish job, the video follow-up,
 * the referral conversion and the Inngest jobs in lifecycle-emails.ts - and
 * reads what it says from the database at that moment, never from the event.
 * None of them throws (sendLifecycleEmail does not), and none changes the
 * behaviour of the code that calls it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Statuses in which a provider is asking the customer to pay. */
const PAYMENT_DUE = new Set(["past_due", "unpaid"]);

/* ------------------------------------------------------------------------- */
/* Sign-up                                                                    */
/* ------------------------------------------------------------------------- */

/** Whether someone came to work on another person's website (an invitation), rather than their own. */
async function wasInvited(executor: Executor, userId: string): Promise<boolean> {
  const [shared] = await executor
    .select({ id: websiteMembers.id })
    .from(websiteMembers)
    .where(eq(websiteMembers.userId, userId))
    .limit(1);
  if (shared) return true;
  const [invited] = await executor
    .select({ id: websiteInvitations.id })
    .from(websiteInvitations)
    .innerJoin(user, sql`lower(${user.email}) = lower(${websiteInvitations.email})`)
    .where(and(eq(user.id, userId), sql`${websiteInvitations.acceptedAt} is null`))
    .limit(1);
  return Boolean(invited);
}

/** Right after sign-up: once per person. */
export async function emailWelcome(userId: string, executor: Executor = db): Promise<LifecycleOutcome> {
  return sendLifecycleEmail(
    {
      kind: "welcome",
      userId,
      dedupeKey: "signup",
      build: async () => ({ kind: "welcome", invited: await wasInvited(executor, userId) }),
    },
    executor,
  );
}

/** Whether a person has a website of their own, in any workspace they belong to. */
export async function hasOwnWebsite(executor: Executor, userId: string): Promise<boolean> {
  const [site] = await executor
    .select({ id: websites.id })
    .from(websites)
    .innerJoin(member, eq(member.organizationId, websites.organizationId))
    .where(eq(member.userId, userId))
    .limit(1);
  return Boolean(site);
}

/**
 * A few hours after sign-up, for someone who still has no website. Checked
 * here, at send time, so a website added in the meantime cancels it; and
 * never for someone who signed up to work on a website shared with them.
 */
export async function emailSetupReminder(userId: string, executor: Executor = db): Promise<LifecycleOutcome> {
  if (await hasOwnWebsite(executor, userId)) return { status: "skipped", reason: "has_website" };
  if (await wasInvited(executor, userId)) return { status: "skipped", reason: "invited" };
  return sendLifecycleEmail(
    { kind: "setup_reminder", userId, dedupeKey: "signup", build: () => ({ kind: "setup_reminder" }) },
    executor,
  );
}

/* ------------------------------------------------------------------------- */
/* Billing                                                                    */
/* ------------------------------------------------------------------------- */

/** A subscription row as the emails need it: attached to a website, with its plan's name. */
async function subscriptionFacts(executor: Executor, where: SQL) {
  const [row] = await executor
    .select({
      id: subscriptions.id,
      organizationId: subscriptions.organizationId,
      websiteId: subscriptions.websiteId,
      provider: subscriptions.provider,
      status: subscriptions.status,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      cancelAt: subscriptions.cancelAt,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      plan: plans.name,
      domain: websites.domain,
    })
    .from(subscriptions)
    // Inner: a detached row (its website deleted, superseded, a duplicate) emails nobody.
    .innerJoin(websites, eq(websites.id, subscriptions.websiteId))
    .leftJoin(plans, eq(plans.id, subscriptions.planId))
    .where(where)
    .limit(1);
  return row ?? null;
}

/** What the row said before a sync wrote over it (subscription-sync.ts); null for a new row. */
export type PreviousSubscription = { status: string; cancelAtPeriodEnd: boolean } | null;

/**
 * The emails a subscription change calls for, decided from what changed -
 * BEFORE (as the sync found the row) against AFTER (as it left it) - so a
 * customer is told once, when it happens, and turning the emails on never
 * sends anything about a change that happened before:
 *
 *  - trial_started: now in a free trial (the TRIAL_DAYS trial, or a legacy
 *    free-articles one), and was not.
 *  - trial_ended: the free period ended, unpaid, without the customer having
 *    cancelled it (that was confirmed already).
 *  - cancellation_confirmed: set to end at the period's end, with that date;
 *    or ended at once from a paid plan.
 *  - payment_failed: the provider now asks for a payment, and did not.
 *
 * Called by syncProviderSubscription after its transaction commits, for both
 * Stripe and PayPal. A row with no website attached emails nobody - that is
 * a deleted site, or a PayPal trial that a plan started in place of.
 */
export async function emailsAfterSubscriptionSync(
  executor: Executor,
  subscriptionId: string,
  previous: PreviousSubscription,
): Promise<void> {
  const row = await subscriptionFacts(executor, eq(subscriptions.id, subscriptionId));
  if (!row?.websiteId) return;
  const websiteId = row.websiteId;
  const plan = row.plan ?? "RepGet";
  const ended = isSubscriptionEnded(row.status);
  const base = { organizationId: row.organizationId };

  if (
    row.status === "trialing" &&
    previous?.status !== "trialing" &&
    row.currentPeriodEnd
  ) {
    const endsOn = row.currentPeriodEnd;
    await sendLifecycleEmail(
      {
        ...base,
        kind: "trial_started",
        dedupeKey: row.id,
        build: () => ({
          kind: "trial_started",
          websiteId,
          domain: row.domain,
          plan,
          endsOn,
          provider: row.provider === "paypal" ? "paypal" : "stripe",
        }),
      },
      executor,
    );
  }

  if (!previous) return;

  if (ended && previous.status === "trialing" && !previous.cancelAtPeriodEnd) {
    await sendLifecycleEmail(
      { ...base, kind: "trial_ended", dedupeKey: row.id, build: () => ({ kind: "trial_ended", websiteId, domain: row.domain }) },
      executor,
    );
  }

  // The scheduled date when the provider gave one (it can come before the period's end).
  const scheduledEnd = row.cancelAt ?? row.currentPeriodEnd;
  if (!ended && row.cancelAtPeriodEnd && !previous.cancelAtPeriodEnd && scheduledEnd) {
    const endsOn = scheduledEnd;
    await sendLifecycleEmail(
      {
        ...base,
        kind: "cancellation_confirmed",
        // Per period: cancelled, resumed and cancelled again in one month is one email.
        dedupeKey: `${row.id}:${endsOn.toISOString()}`,
        build: () => ({
          kind: "cancellation_confirmed",
          websiteId,
          domain: row.domain,
          plan,
          endsOn,
          trial: row.status === "trialing",
        }),
      },
      executor,
    );
  } else if (
    ended &&
    // A paid plan; never a checkout that was not completed ("incomplete" -> "incomplete_expired").
    ["active", "past_due", "unpaid"].includes(previous.status) &&
    !previous.cancelAtPeriodEnd
  ) {
    await sendLifecycleEmail(
      {
        ...base,
        kind: "cancellation_confirmed",
        dedupeKey: `${row.id}:ended`,
        build: () => ({ kind: "cancellation_confirmed", websiteId, domain: row.domain, plan, endsOn: null, trial: false }),
      },
      executor,
    );
  }

  // Ended after the customer cancelled it, or a free period that never became a plan: the win-back, two days later.
  if (ended && !isSubscriptionEnded(previous.status) && endedByLeaving(previous)) {
    await scheduleWinback(row.id);
  }

  if (PAYMENT_DUE.has(row.status) && !PAYMENT_DUE.has(previous.status)) {
    await sendLifecycleEmail(
      {
        ...base,
        kind: "payment_failed",
        // One per billing period: the provider's own retries are not new emails.
        dedupeKey: `${row.id}:${row.currentPeriodEnd?.toISOString() ?? "period"}`,
        build: () => ({ kind: "payment_failed", websiteId, domain: row.domain, plan }),
      },
      executor,
    );
  }
}

/* ------------------------------------------------------------------------- */
/* Win-back                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Whether a subscription that has just ended was LEFT by its customer (the
 * win-back's people, lib/billing/winback-offer.ts), judged from the row as it
 * was before: a free period (cancelled, or ended without a plan starting), a
 * paid plan that was set to cancel, or a paid plan ended at once. Never an
 * unpaid plan the provider ended after failed payments, nor a checkout that
 * was never completed.
 */
export function endedByLeaving(previous: NonNullable<PreviousSubscription>): boolean {
  if (previous.status === "trialing" || previous.status === "active") return true;
  return PAYMENT_DUE.has(previous.status) && previous.cancelAtPeriodEnd;
}

/**
 * Queues the win-back for WINBACK_WAIT later (lifecycle-winback job), keyed by
 * the subscription so a repeated sync is one job. Everything is decided again
 * when it runs (emailWinback). Never thrown.
 */
async function scheduleWinback(subscriptionId: string): Promise<void> {
  try {
    const { queueJob } = await import("@/inngest/send");
    await queueJob({ id: `lifecycle-winback:${subscriptionId}`, name: "email/subscription.ended", data: { subscriptionId } });
  } catch (error) {
    console.error(`[lifecycle-email] the win-back for ${subscriptionId} could not be queued`, error);
  }
}

/** The person a workspace's emails go to: its owner, else whoever joined first (as recipientFor in lifecycle.ts). */
async function workspaceOwner(executor: Executor, organizationId: string): Promise<string | null> {
  const [row] = await executor
    .select({ userId: member.userId })
    .from(member)
    .where(eq(member.organizationId, organizationId))
    .orderBy(sql`case when ${member.role} = 'owner' then 0 else 1 end`, asc(member.createdAt))
    .limit(1);
  return row?.userId ?? null;
}

/** Whether a person still has a subscription running (or owed) in any workspace they belong to. */
export async function hasRunningSubscription(executor: Executor, userId: string): Promise<boolean> {
  const [row] = await executor
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .innerJoin(member, eq(member.organizationId, subscriptions.organizationId))
    .where(and(eq(member.userId, userId), inArray(subscriptions.status, ["active", "trialing", "past_due", "unpaid"])))
    .limit(1);
  return Boolean(row);
}

/**
 * The win-back email, about two days after a subscription the customer left
 * has ended (scheduled by emailsAfterSubscriptionSync). Read again now: the
 * subscription must still be ended and the person must have no other
 * subscription running - one who came back meanwhile gets nothing. Once per
 * PERSON, ever (scope user, one dedupe key). Tips and reports, so it respects
 * the unsubscribe. Not sent while the offer is off (WINBACK_OFFER_ENABLED),
 * so it never promises a discount checkout would not give.
 */
export async function emailWinback(subscriptionId: string, executor: Executor = db): Promise<LifecycleOutcome> {
  if (!winbackOfferEnabled()) return { status: "skipped", reason: "offer_off" };
  const [row] = await executor
    .select({ id: subscriptions.id, organizationId: subscriptions.organizationId, websiteId: subscriptions.websiteId, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  if (!row) return { status: "skipped", reason: "no_subscription" };
  if (!isSubscriptionEnded(row.status)) return { status: "skipped", reason: "not_ended" };
  const userId = await workspaceOwner(executor, row.organizationId);
  if (!userId) return { status: "skipped", reason: "no_recipient" };
  if (await hasRunningSubscription(executor, userId)) return { status: "skipped", reason: "has_subscription" };
  return sendLifecycleEmail(
    {
      userId,
      kind: "winback",
      dedupeKey: "winback",
      build: async () => {
        // A plan that took money, or a free period that never did.
        const [paid] = await executor
          .select({ n: count() })
          .from(payments)
          .where(and(eq(payments.subscriptionId, row.id), gt(payments.amountCents, 0), inArray(payments.status, ["paid", "refunded"])));
        return {
          kind: "winback",
          websiteId: row.websiteId,
          ended: Number(paid?.n ?? 0) > 0 ? "plan" : "trial",
          percentOff: WINBACK_PERCENT_OFF,
          credits: WINBACK_BONUS_CREDITS,
        };
      },
    },
    executor,
  );
}

/**
 * "Welcome to your plan": the subscription's FIRST payment of real money -
 * the moment the referral converts (stripe-events.ts, paypal-events.ts).
 * Counted from the payments table, which the webhook has just written, so a
 * renewal is never mistaken for it, and a customer who paid before these
 * emails existed is not welcomed months later.
 */
export async function emailFirstPayment(
  input: { provider: "stripe" | "paypal"; providerSubscriptionId: string; amountCents: number },
  executor: Executor = db,
): Promise<LifecycleOutcome> {
  if (!(input.amountCents > 0)) return { status: "skipped", reason: "no_money" };
  const [paid] = await executor
    .select({ n: count() })
    .from(payments)
    .where(
      and(
        eq(payments.provider, input.provider),
        eq(payments.providerSubscriptionId, input.providerSubscriptionId),
        gt(payments.amountCents, 0),
        inArray(payments.status, ["paid", "refunded"]),
      ),
    );
  if (Number(paid?.n ?? 0) !== 1) return { status: "skipped", reason: "not_first_payment" };
  const row = await subscriptionFacts(
    executor,
    input.provider === "stripe"
      ? eq(subscriptions.stripeSubscriptionId, input.providerSubscriptionId)
      : eq(subscriptions.paypalSubscriptionId, input.providerSubscriptionId),
  );
  if (!row?.websiteId) return { status: "skipped", reason: "no_website" };
  const websiteId = row.websiteId;
  return sendLifecycleEmail(
    {
      organizationId: row.organizationId,
      kind: "plan_started",
      dedupeKey: `${input.provider}:${input.providerSubscriptionId}`,
      build: () => ({ kind: "plan_started", websiteId, domain: row.domain, plan: row.plan ?? "RepGet" }),
    },
    executor,
  );
}

/**
 * The free trials ending in the next 24 hours (every trial: the TRIAL_DAYS
 * one, and a legacy free-articles one): still trialing, not cancelled,
 * attached to a website. Read from the stored trial end by the
 * hourly job, so the reminder goes about a day before, and every condition is
 * checked again at that moment - a trial that has started its plan, been
 * cancelled or been moved is simply no longer in this list.
 */
export async function emailTrialsEnding(now: Date = new Date(), executor: Executor = db): Promise<number> {
  const due = await executor
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "trialing"),
        eq(subscriptions.cancelAtPeriodEnd, false),
        isNotNull(subscriptions.websiteId),
        gt(subscriptions.currentPeriodEnd, now),
        lte(subscriptions.currentPeriodEnd, new Date(now.getTime() + DAY_MS)),
      ),
    )
    .limit(500);
  let sent = 0;
  for (const { id } of due) {
    const outcome = await emailTrialEnding(id, executor);
    if (outcome.status === "sent") sent += 1;
  }
  return sent;
}

/**
 * "Fingers crossed!" (client, 2026-11-11, "Email Autopilot"): about a day into
 * a website's free period, its journey and its first figures. The free
 * periods that started 24 to 48 hours ago, still trialing (any trial), not
 * cancelled, attached to a website - read by the hourly job from the stored
 * period start, and checked again when sent. Once per subscription.
 */
export async function emailTrialsProgress(now: Date = new Date(), executor: Executor = db): Promise<number> {
  const due = await executor
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "trialing"),
        eq(subscriptions.cancelAtPeriodEnd, false),
        isNotNull(subscriptions.websiteId),
        gt(subscriptions.currentPeriodStart, new Date(now.getTime() - 2 * DAY_MS)),
        lte(subscriptions.currentPeriodStart, new Date(now.getTime() - DAY_MS)),
        gt(subscriptions.currentPeriodEnd, now),
      ),
    )
    .limit(500);
  let sent = 0;
  for (const { id } of due) {
    const outcome = await emailTrialProgress(id, now, executor);
    if (outcome.status === "sent") sent += 1;
  }
  return sent;
}

/** The website's first figures, from its own records: articles written and live, topics planned (never translations). */
export async function trialProgress(websiteId: string, executor: Executor = db) {
  const site = and(eq(articles.websiteId, websiteId), isNull(articles.translationOf));
  const [written] = await executor
    .select({ n: count() })
    .from(articles)
    .where(and(site, inArray(articles.status, ["draft", "published"]), isNotNull(articles.bodyHtml)));
  const [live] = await executor
    .select({ n: count() })
    .from(articles)
    .where(and(site, eq(articles.status, "published")));
  const [planned] = await executor
    .select({ n: count() })
    .from(calendarItems)
    .where(and(eq(calendarItems.websiteId, websiteId), eq(calendarItems.status, "planned")));
  return {
    articlesWritten: Number(written?.n ?? 0),
    articlesLive: Number(live?.n ?? 0),
    topicsPlanned: Number(planned?.n ?? 0),
  };
}

/** One free period's "Fingers crossed!", after reading it again: skipped once it is paid, cancelled or ended. */
export async function emailTrialProgress(
  subscriptionId: string,
  now: Date = new Date(),
  executor: Executor = db,
): Promise<LifecycleOutcome> {
  const row = await subscriptionFacts(executor, eq(subscriptions.id, subscriptionId));
  if (!row?.websiteId || !row.currentPeriodStart) return { status: "skipped", reason: "no_website" };
  if (row.status !== "trialing" || row.cancelAtPeriodEnd) {
    return { status: "skipped", reason: "not_on_trial" };
  }
  if (now.getTime() - row.currentPeriodStart.getTime() < DAY_MS) return { status: "skipped", reason: "too_early" };
  const websiteId = row.websiteId;
  return sendLifecycleEmail(
    {
      organizationId: row.organizationId,
      kind: "trial_progress",
      dedupeKey: row.id,
      build: async () => {
        const figures = await trialProgress(websiteId, executor);
        const above = (value: number) => (value > 0 ? value : undefined);
        return {
          kind: "trial_progress",
          websiteId,
          domain: row.domain,
          articlesWritten: above(figures.articlesWritten),
          articlesLive: above(figures.articlesLive),
          topicsPlanned: above(figures.topicsPlanned),
        };
      },
    },
    executor,
  );
}

/** One trial's reminder, after reading it again: skipped once it is paid, cancelled or ended. */
export async function emailTrialEnding(subscriptionId: string, executor: Executor = db): Promise<LifecycleOutcome> {
  const row = await subscriptionFacts(executor, eq(subscriptions.id, subscriptionId));
  if (!row?.websiteId || !row.currentPeriodEnd) return { status: "skipped", reason: "no_website" };
  if (row.status !== "trialing" || row.cancelAtPeriodEnd) {
    return { status: "skipped", reason: "not_on_trial" };
  }
  const websiteId = row.websiteId;
  const endsOn = row.currentPeriodEnd;
  return sendLifecycleEmail(
    {
      organizationId: row.organizationId,
      kind: "trial_ending",
      dedupeKey: `${row.id}:${endsOn.toISOString()}`,
      build: () => ({ kind: "trial_ending", websiteId, domain: row.domain, plan: row.plan ?? "RepGet", endsOn }),
    },
    executor,
  );
}

/* ------------------------------------------------------------------------- */
/* Articles, videos, referrals                                                */
/* ------------------------------------------------------------------------- */

async function domainOf(executor: Executor, websiteId: string): Promise<string | null> {
  const [site] = await executor.select({ domain: websites.domain }).from(websites).where(eq(websites.id, websiteId)).limit(1);
  return site?.domain ?? null;
}

/** An article went live (publish-article.ts, the plugin's report): once per article, with its live address. */
export async function emailArticlePublished(
  input: { organizationId: string; websiteId: string; articleId: string; title: string; url: string | null },
  executor: Executor = db,
): Promise<LifecycleOutcome> {
  const url = input.url;
  if (!url) return { status: "skipped", reason: "no_live_url" };
  return sendLifecycleEmail(
    {
      organizationId: input.organizationId,
      kind: "article_published",
      dedupeKey: input.articleId,
      build: async () => {
        const domain = await domainOf(executor, input.websiteId);
        return domain
          ? { kind: "article_published", websiteId: input.websiteId, articleId: input.articleId, domain, title: input.title, url }
          : null;
      },
    },
    executor,
  );
}

/**
 * An article could not be published (every retry spent, or the plugin
 * reported a refusal). At most one a day per website: a site that is down
 * fails every article queued for it, and one email says so; the rest are on
 * the notification bell.
 */
export async function emailArticleFailed(
  input: { organizationId: string; websiteId: string; articleId: string; error: string | null },
  now: Date = new Date(),
  executor: Executor = db,
): Promise<LifecycleOutcome> {
  return sendLifecycleEmail(
    {
      organizationId: input.organizationId,
      kind: "article_failed",
      dedupeKey: `${input.websiteId}:${now.toISOString().slice(0, 10)}`,
      build: async () => {
        const [article] = await executor
          // A failed send's title: the revision that went out, never a working copy.
          .select({ title: customerTitleSql, domain: websites.domain })
          .from(articles)
          .innerJoin(websites, eq(websites.id, articles.websiteId))
          .where(eq(articles.id, input.articleId))
          .limit(1);
        return article
          ? {
              kind: "article_failed",
              websiteId: input.websiteId,
              articleId: input.articleId,
              domain: article.domain,
              title: article.title,
              error: input.error,
            }
          : null;
      },
    },
    executor,
  );
}

/** A posted video passed `views` views (lib/video/followup.ts): once per video and milestone. */
export async function emailVideoViews(
  input: { ideaId: string; milestone: number },
  executor: Executor = db,
): Promise<LifecycleOutcome> {
  const [idea] = await executor
    .select({ title: videoIdeas.title, websiteId: videoIdeas.websiteId, organizationId: websites.organizationId, domain: websites.domain })
    .from(videoIdeas)
    .innerJoin(websites, eq(websites.id, videoIdeas.websiteId))
    .where(eq(videoIdeas.id, input.ideaId))
    .limit(1);
  if (!idea) return { status: "skipped", reason: "no_video" };
  return sendLifecycleEmail(
    {
      organizationId: idea.organizationId,
      kind: "video_views",
      dedupeKey: `${input.ideaId}:${input.milestone}`,
      build: () => ({ kind: "video_views", websiteId: idea.websiteId, domain: idea.domain, title: idea.title, views: input.milestone }),
    },
    executor,
  );
}

/** A referral reward was credited (lib/referrals/core.ts), after its credit committed. */
export async function emailReferralReward(
  input: { referrerOrgId: string; referralId: string; grant: number; credits: number },
  executor: Executor = db,
): Promise<LifecycleOutcome> {
  return sendLifecycleEmail(
    {
      organizationId: input.referrerOrgId,
      kind: "referral_reward",
      dedupeKey: `${input.referralId}:${input.grant}`,
      build: () => ({ kind: "referral_reward", credits: input.credits }),
    },
    executor,
  );
}

/* ------------------------------------------------------------------------- */
/* Weekly summary                                                             */
/* ------------------------------------------------------------------------- */

/** The ISO week a date falls in, "2026-W45": the summary's dedupe key. */
export function isoWeek(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** The workspaces the summary goes to: a website on a plan or in its free trial. */
export async function weeklySummaryOrganizations(executor: Executor = db): Promise<string[]> {
  const rows = await executor
    .selectDistinct({ organizationId: subscriptions.organizationId })
    .from(subscriptions)
    .where(and(isNotNull(subscriptions.websiteId), inArray(subscriptions.status, ["active", "trialing"])));
  return rows.map((row) => row.organizationId);
}

/**
 * The last seven days of one workspace, from its own records: articles that
 * first went live, social posts and videos published, and - as context, never
 * on their own - its live articles in total and its credit balance. A figure
 * that is zero is left out; a week in which nothing was published sends
 * nothing at all.
 */
export async function weeklySummary(organizationId: string, now: Date, executor: Executor = db) {
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const own = sql`${websites.organizationId} = ${organizationId}`;
  const [published] = await executor
    .select({ n: count() })
    .from(articles)
    .innerJoin(websites, eq(websites.id, articles.websiteId))
    .where(and(own, gte(articles.firstLiveAt, since), lte(articles.firstLiveAt, now)));
  const [live] = await executor
    .select({ n: count() })
    .from(articles)
    .innerJoin(websites, eq(websites.id, articles.websiteId))
    .where(and(own, eq(articles.status, "published")));
  const [social] = await executor
    .select({ n: count() })
    .from(socialSuggestions)
    .innerJoin(websites, eq(websites.id, socialSuggestions.websiteId))
    .where(and(own, eq(socialSuggestions.status, "posted"), gte(socialSuggestions.postedAt, since), lte(socialSuggestions.postedAt, now)));
  const [videos] = await executor
    .select({ n: count() })
    .from(videoIdeas)
    .innerJoin(websites, eq(websites.id, videoIdeas.websiteId))
    .where(and(own, eq(videoIdeas.status, "posted"), gte(videoIdeas.postedAt, since), lte(videoIdeas.postedAt, now)));
  const [balance] = await executor
    .select({ n: sql<number>`coalesce(sum(${creditLedger.amount}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.organizationId, organizationId));
  return {
    articlesPublished: Number(published?.n ?? 0),
    liveArticles: Number(live?.n ?? 0),
    socialPosts: Number(social?.n ?? 0),
    videosPosted: Number(videos?.n ?? 0),
    credits: Number(balance?.n ?? 0),
  };
}

export async function emailWeeklySummary(organizationId: string, now: Date = new Date(), executor: Executor = db): Promise<LifecycleOutcome> {
  return sendLifecycleEmail(
    {
      organizationId,
      kind: "weekly_summary",
      dedupeKey: isoWeek(now),
      build: async () => {
        const week = await weeklySummary(organizationId, now, executor);
        if (week.articlesPublished + week.socialPosts + week.videosPosted === 0) return null;
        const above = (value: number) => (value > 0 ? value : undefined);
        return {
          kind: "weekly_summary",
          articlesPublished: above(week.articlesPublished),
          liveArticles: above(week.liveArticles),
          socialPosts: above(week.socialPosts),
          videosPosted: above(week.videosPosted),
          credits: above(week.credits),
        };
      },
    },
    executor,
  );
}
