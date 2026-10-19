"use server";

import { and, count, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { SUPPORT_EMAIL } from "@/lib/config/site";
import { db } from "@/lib/db";
import { feedback, organization, user } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import { feedbackReplyEmail } from "@/lib/feedback/reply-email";
import { FEEDBACK_ADMIN_PAGE_SIZE, FEEDBACK_KINDS, FEEDBACK_STATUSES, type FeedbackKind, type FeedbackStatus } from "@/lib/feedback/shared";
import { isLocale } from "@/lib/i18n/config";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Admin -> Feedback: what customers and visitors sent through the feedback
 * forms (lib/feedback), its status, and replies to the sender by email in
 * their language. Every action checks admin access on the server; changes are
 * recorded in the admin audit log.
 *
 *  - A reply is recorded only once the email has gone: a reply the sender
 *    never got must not look sent.
 *  - The screenshot is never part of a list; it is served to administrators
 *    alone, by its own route (app/admin/feedback/[id]/screenshot).
 */

export type FeedbackView = FeedbackStatus | "all";

export type AdminFeedbackRow = {
  id: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  /** The first 240 characters. */
  excerpt: string;
  email: string;
  name: string | null;
  source: string;
  locale: string;
  hasScreenshot: boolean;
  replies: number;
  createdAt: Date;
};

export type AdminFeedbackDetail = Omit<AdminFeedbackRow, "excerpt" | "replies"> & {
  message: string;
  pageUrl: string | null;
  replies: { message: string; by: string; at: string; status: string | null }[];
  /** The signed-in customer it came from, while their account exists. */
  customer: { userId: string; name: string; email: string; organizationId: string | null; organizationName: string | null } | null;
  updatedAt: Date;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = "That message no longer exists - reload the page";

const isStatus = (value: unknown): value is FeedbackStatus => (FEEDBACK_STATUSES as readonly unknown[]).includes(value);
const isKind = (value: unknown): value is FeedbackKind => (FEEDBACK_KINDS as readonly unknown[]).includes(value);

function refresh(id?: string) {
  revalidatePath("/admin/feedback");
  if (id) revalidatePath(`/admin/feedback/${id}`);
}

/** One page of feedback, newest first, with the count in each status (for the tabs) and in total. */
export async function listFeedbackAdmin(input: { view: string; kind: string; page: number }): Promise<{
  rows: AdminFeedbackRow[];
  total: number;
  counts: Record<FeedbackStatus, number>;
  page: number;
}> {
  await requireAdmin();
  const view: FeedbackView = isStatus(input.view) ? input.view : input.view === "all" ? "all" : "new";
  const kind = isKind(input.kind) ? input.kind : null;
  const where = and(view === "all" ? undefined : eq(feedback.status, view), kind ? eq(feedback.kind, kind) : undefined);
  const [{ total }] = await db.select({ total: count() }).from(feedback).where(where);
  const pageCount = Math.max(1, Math.ceil(total / FEEDBACK_ADMIN_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(input.page) || 1), pageCount);
  const rows = await db
    .select({
      id: feedback.id,
      kind: feedback.kind,
      status: feedback.status,
      excerpt: sql<string>`left(${feedback.message}, 240)`,
      email: feedback.email,
      name: feedback.name,
      source: feedback.source,
      locale: feedback.locale,
      hasScreenshot: sql<boolean>`${feedback.screenshot} is not null`,
      replies: sql<number>`jsonb_array_length(${feedback.replies})::int`,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .where(where)
    .orderBy(desc(feedback.createdAt), desc(feedback.id))
    .limit(FEEDBACK_ADMIN_PAGE_SIZE)
    .offset((page - 1) * FEEDBACK_ADMIN_PAGE_SIZE);
  const byStatus = await db
    .select({ status: feedback.status, n: count() })
    .from(feedback)
    .where(kind ? eq(feedback.kind, kind) : undefined)
    .groupBy(feedback.status);
  const counts = Object.fromEntries(FEEDBACK_STATUSES.map((status) => [status, 0])) as Record<FeedbackStatus, number>;
  for (const row of byStatus) if (isStatus(row.status)) counts[row.status] = row.n;
  return { rows: rows as AdminFeedbackRow[], total, counts, page };
}

/** One message, in full, with the customer it came from. */
export async function getFeedbackAdmin(id: string): Promise<AdminFeedbackDetail | null> {
  await requireAdmin();
  if (!UUID.test(String(id))) return null;
  const [row] = await db
    .select({
      id: feedback.id,
      kind: feedback.kind,
      status: feedback.status,
      message: feedback.message,
      email: feedback.email,
      name: feedback.name,
      source: feedback.source,
      locale: feedback.locale,
      pageUrl: feedback.pageUrl,
      hasScreenshot: sql<boolean>`${feedback.screenshot} is not null`,
      replies: feedback.replies,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      organizationId: organization.id,
      organizationName: organization.name,
    })
    .from(feedback)
    .leftJoin(user, eq(user.id, feedback.userId))
    .leftJoin(organization, eq(organization.id, feedback.organizationId))
    .where(eq(feedback.id, id))
    .limit(1);
  if (!row) return null;
  const { userId, userName, userEmail, organizationId, organizationName, ...rest } = row;
  return {
    ...(rest as Omit<typeof rest, "kind" | "status"> & { kind: FeedbackKind; status: FeedbackStatus }),
    customer: userId && userName && userEmail ? { userId, name: userName, email: userEmail, organizationId, organizationName } : null,
  };
}

/** Moves a message to New, Planned, Done or Won't do. Nothing is sent to the sender. */
export async function setFeedbackStatus(input: { id: string; status: string }): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!UUID.test(String(input.id))) return { ok: false, error: NOT_FOUND };
  if (!isStatus(input.status)) return { ok: false, error: "Choose a status" };
  const status = input.status;
  const error = await db.transaction(async (tx) => {
    const [current] = await tx.select({ status: feedback.status, kind: feedback.kind, email: feedback.email }).from(feedback).where(eq(feedback.id, input.id)).for("update");
    if (!current) return NOT_FOUND;
    if (current.status === status) return null;
    await tx.update(feedback).set({ status, updatedAt: new Date() }).where(eq(feedback.id, input.id));
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "feedback.status_changed",
        targetType: "feedback",
        targetId: input.id,
        summary: `Marked feedback from ${current.email} as ${STATUS_WORDS[status]}`,
        detail: { from: current.status, to: status, kind: current.kind },
      },
      tx,
    );
    return null;
  });
  if (error) return { ok: false, error };
  refresh(input.id);
  return { ok: true, data: null };
}

const STATUS_WORDS: Record<FeedbackStatus, string> = { new: "new", planned: "planned", done: "done", wont_do: "won't do" };

/**
 * Replies to the sender by email, in the language they wrote from, and can
 * move the message to a new status at the same time (the email then says what
 * is happening with it). Recorded only once the email has gone.
 */
export async function replyToFeedback(input: { id: string; message: string; status?: string | null }): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!UUID.test(String(input.id))) return { ok: false, error: NOT_FOUND };
  const message = String(input.message ?? "").trim();
  if (message.length < 2) return { ok: false, error: "Write the reply first" };
  if (message.length > 5000) return { ok: false, error: "Keep the reply under 5,000 characters" };
  const status = input.status && isStatus(input.status) ? input.status : null;

  const [row] = await db
    .select({ email: feedback.email, name: feedback.name, locale: feedback.locale, message: feedback.message, status: feedback.status, kind: feedback.kind })
    .from(feedback)
    .where(eq(feedback.id, input.id))
    .limit(1);
  if (!row) return { ok: false, error: NOT_FOUND };
  const changed = status && status !== row.status ? status : null;

  const email = feedbackReplyEmail({
    locale: isLocale(row.locale) ? row.locale : "en",
    name: row.name,
    reply: message,
    original: row.message,
    status: changed,
  });
  // Their answer comes back to the support address, not to the sending one.
  const sent = await sendEmail({ to: row.email, subject: email.subject, html: email.html, text: email.text, replyTo: SUPPORT_EMAIL });
  if (!sent.ok) return { ok: false, error: `The reply could not be sent (${sent.error}). Nothing was recorded - try again.` };

  const now = new Date();
  const entry = { message, by: admin.email, at: now.toISOString(), status: changed };
  await db.transaction(async (tx) => {
    await tx
      .update(feedback)
      .set({
        replies: sql`${feedback.replies} || ${JSON.stringify([entry])}::jsonb`,
        ...(changed ? { status: changed } : {}),
        updatedAt: now,
      })
      .where(eq(feedback.id, input.id));
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "feedback.replied",
        targetType: "feedback",
        targetId: input.id,
        summary: `Replied to feedback from ${row.email}${changed ? ` and marked it ${STATUS_WORDS[changed]}` : ""}`,
        detail: { kind: row.kind, locale: row.locale, status: changed, emailId: sent.id },
      },
      tx,
    );
  });
  refresh(input.id);
  return { ok: true, data: null };
}
