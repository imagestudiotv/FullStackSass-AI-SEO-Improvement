import "server-only";

import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { payments, supportChatState } from "@/lib/db/schema";

/**
 * "RepGet - Proactive Human Support During Onboarding" (ticket 2026-11-19,
 * item 6): who may get the one onboarding welcome in the live chat, and the
 * claim that makes it once per account.
 *
 * THE DIVISION OF WORK. RepGet decides WHO and WHEN; Crisp decides WHAT. The
 * browser pushes the custom event `repget_onboarding_help_eligible` only after
 * this module's claim succeeded, and the owner's Crisp Message Trigger
 * (`repget_onboarding_human_help`, "On user event") shows the approved text.
 * The text is never in our code: it is typed into Crisp.
 *
 * WHO, per the spec ("newly registered users on their first dashboard visit
 * ... only once per account ... not existing customers, users who already
 * received the welcome, or anyone who already started a support
 * conversation"):
 *
 *  - NEW: the account is younger than WELCOME_WINDOW_DAYS. Seven days, not
 *    "the first visit" literally: someone who signs up, connects nothing and
 *    comes back two days later is exactly who this is for, and a person who
 *    waited the 60 seconds on a phone with the chat still loading should not
 *    lose it. Older accounts predate the feature or have found their way.
 *  - NOT A CUSTOMER: the workspace has no paid payment (payments.status paid
 *    or refunded, amount > 0). Deliberately not "has an active subscription":
 *    a trial is a subscription with no payment yet and IS onboarding, and a
 *    zero-price plan (Free) is not a customer either.
 *  - THEIR OWN WORKSPACE: someone invited to another person's site is not
 *    onboarding a business of their own.
 *  - SETUP NOT FINISHED: the launch checklist's required steps
 *    (lib/onboarding/launch.ts) are not all done.
 *  - NOT WELCOMED: support_chat_state.welcomed_at is null.
 *  - NO CONVERSATION: no message sent or received in the in-app chat since
 *    this shipped (first_message_at), and - checked in the browser, because
 *    only Crisp knows it - no conversation already ongoing in that browser.
 *    LIMIT: a conversation from before this shipped, or one started by email,
 *    is invisible to both checks.
 */

export const WELCOME_WINDOW_DAYS = 7;

/**
 * The welcome is OFF until the owner sets CRISP_ONBOARDING_WELCOME=1, after
 * the Crisp trigger exists. A claim is final (welcomed_at), so a claim made
 * before the trigger exists would use up the person's one welcome on an
 * event nothing answers.
 */
export function onboardingWelcomeOn(): boolean {
  return process.env.CRISP_ONBOARDING_WELCOME?.trim() === "1" && Boolean(process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim());
}

/** A new support request after this much quiet; messages closer together are one request. */
export const SUPPORT_REQUEST_GAP_HOURS = 6;

export type WelcomeFacts = {
  accountCreatedAt: Date;
  /** Owns the workspace's sites rather than only working on shared ones. */
  ownsWorkspace: boolean;
  isCustomer: boolean;
  setupComplete: boolean;
  welcomedAt: Date | null;
  firstMessageAt: Date | null;
};

export type WelcomeRefusal = "not_new" | "guest" | "customer" | "setup_complete" | "welcomed" | "conversation";

export function welcomeRefusal(facts: WelcomeFacts, now: Date): WelcomeRefusal | null {
  if (facts.welcomedAt) return "welcomed";
  if (facts.firstMessageAt) return "conversation";
  if (now.getTime() - facts.accountCreatedAt.getTime() > WELCOME_WINDOW_DAYS * 24 * 60 * 60 * 1000) return "not_new";
  if (!facts.ownsWorkspace) return "guest";
  if (facts.isCustomer) return "customer";
  if (facts.setupComplete) return "setup_complete";
  return null;
}

type Executor = Pick<typeof db, "select" | "insert" | "update">;

/** Whether the workspace has ever paid: a payment that went through, for real money. */
export async function workspaceHasPaid(organizationId: string, executor: Executor = db): Promise<boolean> {
  const [row] = await executor
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.organizationId, organizationId), inArray(payments.status, ["paid", "refunded"]), gt(payments.amountCents, 0)))
    .limit(1);
  return Boolean(row);
}

export type SupportChatRow = typeof supportChatState.$inferSelect;

export async function readSupportChatState(userId: string, executor: Executor = db): Promise<SupportChatRow | null> {
  const [row] = await executor.select().from(supportChatState).where(eq(supportChatState.userId, userId)).limit(1);
  return row ?? null;
}

export type WelcomeContext = {
  userId: string;
  organizationId: string;
  accountCreatedAt: Date;
  ownsWorkspace: boolean;
  setupComplete: boolean;
};

/** Every fact for one person, read from the database; the caller supplies what the page already computed. */
export async function loadWelcomeFacts(context: WelcomeContext, executor: Executor = db): Promise<WelcomeFacts> {
  const [state, isCustomer] = await Promise.all([
    readSupportChatState(context.userId, executor),
    workspaceHasPaid(context.organizationId, executor),
  ]);
  return {
    accountCreatedAt: context.accountCreatedAt,
    ownsWorkspace: context.ownsWorkspace,
    isCustomer,
    setupComplete: context.setupComplete,
    welcomedAt: state?.welcomedAt ?? null,
    firstMessageAt: state?.firstMessageAt ?? null,
  };
}

export type ClaimResult = { ok: true } | { ok: false; reason: WelcomeRefusal };

/**
 * Claims the one welcome. Atomic: the row is written with
 * `ON CONFLICT ... DO UPDATE ... WHERE welcomed_at IS NULL AND
 * first_message_at IS NULL RETURNING`, so of two tabs or devices asking at
 * the same moment exactly one gets a row back - and only that one pushes the
 * event to Crisp. A refusal writes nothing.
 */
export async function claimWelcome(context: WelcomeContext, now: Date = new Date(), executor: Executor = db): Promise<ClaimResult> {
  const reason = welcomeRefusal(await loadWelcomeFacts(context, executor), now);
  if (reason) return { ok: false, reason };
  const claimed = await executor
    .insert(supportChatState)
    .values({ userId: context.userId, organizationId: context.organizationId, welcomedAt: now, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: supportChatState.userId,
      set: { welcomedAt: now, organizationId: context.organizationId, updatedAt: now },
      setWhere: and(isNull(supportChatState.welcomedAt), isNull(supportChatState.firstMessageAt)),
    })
    .returning({ userId: supportChatState.userId });
  return claimed.length > 0 ? { ok: true } : { ok: false, reason: "welcomed" };
}

export type SupportChatEvent = "opened" | "closed" | "sent" | "received";

export function isSupportChatEvent(value: unknown): value is SupportChatEvent {
  return value === "opened" || value === "closed" || value === "sent" || value === "received";
}

/**
 * One chat event from the browser (Crisp's chat:opened, chat:closed,
 * message:sent, message:received). Each column is set the FIRST time only
 * (COALESCE), so a repeated or replayed event changes nothing, and the
 * support-request counter moves only when a message is sent after
 * SUPPORT_REQUEST_GAP_HOURS of quiet.
 *
 * What it records about the welcome only counts once a welcome was claimed:
 * opening the chat a week before it is not "opened the welcome".
 *
 * A browser can send these for itself only (the action takes the signed-in
 * person), so the worst a forged call does is mark its own sender as
 * having a conversation - which only stops their own welcome.
 */
export async function recordSupportChatEvent(
  userId: string,
  organizationId: string,
  event: SupportChatEvent,
  now: Date = new Date(),
  executor: Executor = db,
): Promise<void> {
  const s = supportChatState;
  const welcomed = sql`${s.welcomedAt} is not null`;
  // Bound as text and cast: a Date inside a raw sql`` fragment is not serialised by the driver (UTC wall clock, as drizzle writes timestamps).
  const at = sql`${now.toISOString()}::timestamp`;
  const gapStart = sql`${new Date(now.getTime() - SUPPORT_REQUEST_GAP_HOURS * 60 * 60 * 1000).toISOString()}::timestamp`;
  const set: Partial<Record<keyof typeof s.$inferInsert, unknown>> = { updatedAt: now, organizationId };
  if (event === "opened") {
    set.welcomeOpenedAt = sql`case when ${welcomed} then coalesce(${s.welcomeOpenedAt}, ${at}) else ${s.welcomeOpenedAt} end`;
  } else if (event === "closed") {
    // Closed without having answered it: the welcome was dismissed.
    set.welcomeDismissedAt = sql`case when ${welcomed} and ${s.welcomeAnsweredAt} is null then coalesce(${s.welcomeDismissedAt}, ${at}) else ${s.welcomeDismissedAt} end`;
  } else {
    set.firstMessageAt = sql`coalesce(${s.firstMessageAt}, ${at})`;
    set.lastMessageAt = now;
    if (event === "sent") {
      set.welcomeAnsweredAt = sql`case when ${welcomed} then coalesce(${s.welcomeAnsweredAt}, ${at}) else ${s.welcomeAnsweredAt} end`;
      const newRequest = sql`(${s.lastRequestAt} is null or ${s.lastRequestAt} < ${gapStart})`;
      set.supportRequests = sql`${s.supportRequests} + case when ${newRequest} then 1 else 0 end`;
      set.lastRequestAt = now;
    }
  }
  const message = event === "sent" || event === "received";
  await executor
    .insert(s)
    .values({
      userId,
      organizationId,
      firstMessageAt: message ? now : null,
      lastMessageAt: message ? now : null,
      supportRequests: event === "sent" ? 1 : 0,
      lastRequestAt: event === "sent" ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({ target: s.userId, set: set as never });
}

/**
 * Notes, once, that someone who was welcomed has finished the required setup
 * steps - the spec's "together with whether the user completes onboarding".
 * A no-op for everyone else (no row, not welcomed, already noted).
 */
export async function markOnboardingCompleted(userId: string, now: Date = new Date(), executor: Executor = db): Promise<void> {
  await executor
    .update(supportChatState)
    .set({ onboardingCompletedAt: now, updatedAt: now })
    .where(
      and(
        eq(supportChatState.userId, userId),
        sql`${supportChatState.welcomedAt} is not null`,
        isNull(supportChatState.onboardingCompletedAt),
      ),
    );
}

/**
 * What the app layout needs: whether to start the dashboard wait for this
 * person - after noting, for someone already welcomed, that they finished
 * setup. Costs nothing for accounts older than a month (no query at all).
 */
export async function welcomeForLayout(context: WelcomeContext, now: Date = new Date()): Promise<boolean> {
  const ageDays = (now.getTime() - context.accountCreatedAt.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays > 30) return false;
  if (context.setupComplete) {
    await markOnboardingCompleted(context.userId, now);
    return false;
  }
  if (ageDays > WELCOME_WINDOW_DAYS || !context.ownsWorkspace) return false;
  return welcomeRefusal(await loadWelcomeFacts(context), now) === null;
}
