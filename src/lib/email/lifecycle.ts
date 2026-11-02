import "server-only";

import { and, asc, eq, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { emailPreferences, lifecycleEmails, member, platformControls, user } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";
import { sendEmail } from "@/lib/email/send";
import { unsubscribeToken } from "@/lib/email/unsubscribe-token";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/site-url";

import { ESSENTIAL, renderLifecycleEmail, type LifecycleEmail, type LifecycleKind } from "./lifecycle-copy";

/**
 * Lifecycle emails: the welcome, the free period, billing, publishing
 * outcomes and the weekly summary (docs/emails.md). Every one goes through
 * sendLifecycleEmail, which is the only place that decides whether it goes.
 *
 * IN ORDER:
 *  1. THE KILL SWITCH (Admin -> Emails; platform_controls "lifecycle_emails").
 *     OFF BY DEFAULT: a missing row is off, so merging and deploying this
 *     sends nothing to a real customer until an administrator turns it on.
 *     While off nothing is written either - no log row - so an email whose
 *     moment comes again later (a reminder due tomorrow) is not blocked by
 *     having been "skipped" today.
 *  2. THE CLAIM. A lifecycle_emails row, inserted BEFORE sending, unique on
 *     (scope, kind, dedupe key). The moments these follow are retried - a
 *     webhook redelivered, an Inngest step re-run - and only the caller whose
 *     insert won goes on; the rest find the row and stop. A FAILED row can be
 *     claimed again, up to MAX_ATTEMPTS, so a Resend outage delays an email
 *     instead of losing it. A "sending" row whose process died is left: a
 *     possible duplicate is worse than one missing courtesy email.
 *  3. THE RECIPIENT. A person (userId) or a workspace (organizationId: its
 *     owner, else its first member), in their language - the one chosen in
 *     Settings, else their browser's at sign-up, else English.
 *  4. THE PREFERENCE. A non-essential email ("tips and reports") is skipped
 *     for someone who turned those off; essential ones always go. Which kind
 *     is which is fixed in lifecycle-copy.ts (ESSENTIAL), not by the caller.
 *  5. THE SEND, then the outcome recorded on the row.
 *
 * NEVER THROWS. Every caller has already done the thing the email is about -
 * a payment recorded, an article published - and a rejected promise here
 * would fail or retry that. Failures are logged and returned.
 */

export const LIFECYCLE_CONTROL_KEY = "lifecycle_emails";

/** How many times one email is tried before it is left failed. */
export const MAX_ATTEMPTS = 3;

export type LifecycleOutcome =
  | { status: "sent"; id: string }
  | { status: "skipped"; reason: string }
  | { status: "duplicate" }
  | { status: "failed"; reason: string };

/** Whether an administrator has switched lifecycle emails on. A missing row is off. */
export async function lifecycleEmailsEnabled(executor: Executor = db): Promise<boolean> {
  const [row] = await executor
    .select({ enabled: platformControls.enabled })
    .from(platformControls)
    .where(eq(platformControls.key, LIFECYCLE_CONTROL_KEY))
    .limit(1);
  return row?.enabled ?? false;
}

type Recipient = { userId: string; email: string; name: string | null; locale: Locale };

function pickLocale(chosen: string | null, signup: string | null): Locale {
  if (chosen && isLocale(chosen)) return chosen;
  if (signup && isLocale(signup)) return signup;
  return DEFAULT_LOCALE;
}

async function recipientFor(
  executor: Executor,
  target: { userId?: string | null; organizationId?: string | null },
): Promise<Recipient | null> {
  const columns = {
    userId: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
    signupLocale: emailPreferences.signupLocale,
  };
  const rows = target.userId
    ? await executor
        .select(columns)
        .from(user)
        .leftJoin(emailPreferences, eq(emailPreferences.userId, user.id))
        .where(eq(user.id, target.userId))
        .limit(1)
    : await executor
        .select(columns)
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .leftJoin(emailPreferences, eq(emailPreferences.userId, user.id))
        .where(eq(member.organizationId, target.organizationId!))
        // The owner first; otherwise whoever joined first, so it is always the same person.
        .orderBy(sql`case when ${member.role} = 'owner' then 0 else 1 end`, asc(member.createdAt))
        .limit(1);
  const row = rows[0];
  if (!row?.email) return null;
  return {
    userId: row.userId,
    email: row.email,
    name: row.name?.trim() || null,
    locale: pickLocale(row.locale, row.signupLocale),
  };
}

/** False only when the person turned tips and reports off. */
export async function wantsTips(userId: string, executor: Executor = db): Promise<boolean> {
  const [row] = await executor
    .select({ tips: emailPreferences.tips })
    .from(emailPreferences)
    .where(eq(emailPreferences.userId, userId))
    .limit(1);
  return row?.tips ?? true;
}

/** Turns one person's tips and reports on or off. "via" is kept for support questions. */
export async function setTips(userId: string, tips: boolean, via: "settings" | "link", executor: Executor = db): Promise<void> {
  const now = new Date();
  await executor
    .insert(emailPreferences)
    .values({ userId, tips, tipsChangedVia: via, updatedAt: now })
    .onConflictDoUpdate({ target: emailPreferences.userId, set: { tips, tipsChangedVia: via, updatedAt: now } });
}

/**
 * Remembers the browser's language at sign-up, for the emails of someone who
 * never chooses one in Settings. Never overwrites a choice already stored.
 */
export async function rememberSignupLocale(userId: string, locale: Locale, executor: Executor = db): Promise<void> {
  await executor
    .insert(emailPreferences)
    .values({ userId, signupLocale: locale })
    .onConflictDoUpdate({
      target: emailPreferences.userId,
      set: { signupLocale: locale, updatedAt: new Date() },
      setWhere: sql`${emailPreferences.signupLocale} is null`,
    });
}

/** The page an unsubscribe link opens; null when the server cannot sign one. */
export function unsubscribeUrl(userId: string): string | null {
  const token = unsubscribeToken(userId);
  return token ? `${siteUrl()}/unsubscribe/${encodeURIComponent(token)}` : null;
}

type Claim = { id: string; attempts: number };

/** Inserts the row, or takes back a failed one; null when someone else has it. */
async function claim(
  executor: Executor,
  values: { scope: string; kind: LifecycleKind; dedupeKey: string; organizationId: string | null; userId: string | null },
): Promise<Claim | null> {
  const [inserted] = await executor
    .insert(lifecycleEmails)
    .values({ ...values, status: "sending" })
    .onConflictDoNothing()
    .returning({ id: lifecycleEmails.id, attempts: lifecycleEmails.attempts });
  if (inserted) return inserted;
  const [retried] = await executor
    .update(lifecycleEmails)
    .set({ status: "sending", reason: null, attempts: sql`${lifecycleEmails.attempts} + 1`, updatedAt: new Date() })
    .where(
      and(
        eq(lifecycleEmails.scope, values.scope),
        eq(lifecycleEmails.kind, values.kind),
        eq(lifecycleEmails.dedupeKey, values.dedupeKey),
        eq(lifecycleEmails.status, "failed"),
        lt(lifecycleEmails.attempts, MAX_ATTEMPTS),
      ),
    )
    .returning({ id: lifecycleEmails.id, attempts: lifecycleEmails.attempts });
  return retried ?? null;
}

async function settle(
  executor: Executor,
  id: string,
  outcome: { status: "sent" | "skipped" | "failed"; reason?: string | null; providerMessageId?: string | null },
  recipient?: Recipient | null,
): Promise<void> {
  await executor
    .update(lifecycleEmails)
    .set({
      status: outcome.status,
      reason: outcome.reason?.slice(0, 500) ?? null,
      providerMessageId: outcome.providerMessageId ?? null,
      ...(recipient ? { recipient: recipient.email, locale: recipient.locale, userId: recipient.userId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(lifecycleEmails.id, id));
}

export type LifecycleRequest = {
  kind: LifecycleKind;
  /** The workspace it is about: sent to its owner. */
  organizationId?: string | null;
  /** The person it is about, when it is about a person rather than a workspace. */
  userId?: string | null;
  /** What makes it one of a kind within the scope: a subscription id, an article id, an ISO week. */
  dedupeKey: string;
  /**
   * The email's content, built once it is known to go. Returning null skips
   * it ("nothing_to_send") - the weekly summary of a quiet week. May read the
   * database; it runs after the claim, so it runs once per email.
   */
  build: (recipient: Recipient) => Promise<LifecycleEmail | null> | LifecycleEmail | null;
};

export async function sendLifecycleEmail(request: LifecycleRequest, executor: Executor = db): Promise<LifecycleOutcome> {
  const { kind, dedupeKey } = request;
  const organizationId = request.organizationId ?? null;
  const userId = request.userId ?? null;
  let claimedId: string | null = null;
  try {
    if (!(await lifecycleEmailsEnabled(executor))) return { status: "skipped", reason: "disabled" };
    if (!userId && !organizationId) return { status: "skipped", reason: "no_recipient" };

    const scope = userId ? `user:${userId}` : `org:${organizationId}`;
    const claimed = await claim(executor, { scope, kind, dedupeKey, organizationId, userId });
    if (!claimed) return { status: "duplicate" };
    claimedId = claimed.id;

    const recipient = await recipientFor(executor, { userId, organizationId });
    if (!recipient) {
      await settle(executor, claimed.id, { status: "skipped", reason: "no_recipient" });
      return { status: "skipped", reason: "no_recipient" };
    }

    const essential = ESSENTIAL[kind];
    const unsubscribe = essential ? null : unsubscribeUrl(recipient.userId);
    if (!essential && !(await wantsTips(recipient.userId, executor))) {
      await settle(executor, claimed.id, { status: "skipped", reason: "unsubscribed" }, recipient);
      return { status: "skipped", reason: "unsubscribed" };
    }
    // A tips email must carry a working unsubscribe link, or it does not go.
    if (!essential && !unsubscribe) {
      await settle(executor, claimed.id, { status: "skipped", reason: "no_unsubscribe_secret" }, recipient);
      return { status: "skipped", reason: "no_unsubscribe_secret" };
    }

    const email = await request.build(recipient);
    if (!email) {
      await settle(executor, claimed.id, { status: "skipped", reason: "nothing_to_send" }, recipient);
      return { status: "skipped", reason: "nothing_to_send" };
    }

    const rendered = renderLifecycleEmail(email, {
      locale: recipient.locale,
      name: recipient.name,
      appUrl: siteUrl(),
      unsubscribeUrl: unsubscribe,
    });
    const oneClick = unsubscribe ? unsubscribe.replace("/unsubscribe/", "/api/email/unsubscribe?token=") : null;
    const result = await sendEmail({
      to: recipient.email,
      ...rendered,
      ...(oneClick
        ? { headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
        : {}),
      idempotencyKey: `lifecycle:${claimed.id}:${claimed.attempts}`,
    });
    if (!result.ok) {
      await settle(executor, claimed.id, { status: "failed", reason: result.error }, recipient);
      return { status: "failed", reason: result.error };
    }
    await settle(executor, claimed.id, { status: "sent", providerMessageId: result.id }, recipient);
    return { status: "sent", id: result.id };
  } catch (error) {
    console.error(`[lifecycle-email] ${kind} ${dedupeKey} could not be sent`, error);
    const reason = error instanceof Error ? error.message : "unknown";
    // A claimed row left "sending" would never be tried again; failed, it is.
    if (claimedId) await settle(executor, claimedId, { status: "failed", reason }).catch(() => undefined);
    return { status: "failed", reason };
  }
}
