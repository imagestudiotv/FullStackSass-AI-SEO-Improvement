"use server";

import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/shared";
import { audienceSummary, countRecipients, findPerson, searchPeople, type AudienceSummary } from "@/lib/broadcasts/audience";
import { BROADCAST_IMAGE_FOLDER, readBroadcastContent } from "@/lib/broadcasts/content";
import { BroadcastStateError, broadcastSendingProblem, cancelBroadcast, startBroadcast } from "@/lib/broadcasts/engine";
import { renderBroadcastEmail } from "@/lib/broadcasts/render";
import {
  BROADCAST_IMAGE_MAX_BYTES,
  BROADCAST_IMAGE_TYPES,
  BROADCAST_LIMITS,
  isBroadcastAudience,
  SEND_WORD,
  type BroadcastContent,
  type BroadcastPerson,
  type BroadcastStatus,
} from "@/lib/broadcasts/shared";
import { db } from "@/lib/db";
import { emailBroadcastRecipients, emailBroadcasts, user } from "@/lib/db/schema";
import { unsubscribeUrl } from "@/lib/email/lifecycle";
import { sendEmail } from "@/lib/email/send";
import { deleteStoredImage, isImageStorageConfigured, readStoredFile, signedImageUpload, storeArticleImage } from "@/lib/images/storage";
import { deliverNow } from "@/lib/jobs/outbox";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Admin -> Email broadcasts (Daniel, 2026-11-24: "the option to send emails
 * for all registered users at once"). The sending itself, and why nobody can
 * get one twice, is lib/broadcasts/engine.ts. Every action checks admin
 * access, and everything that changes or sends something is in the audit log.
 */

const PATH = "/admin/email-broadcasts";
const CHANGED = "This broadcast has changed since the page was loaded. Reload the page.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/* ------------------------------------------------------------------------- */
/* Reading                                                                    */
/* ------------------------------------------------------------------------- */

export type BroadcastRow = {
  id: string;
  subject: string;
  audience: string;
  /** The address of the one person a "person" broadcast is for; null otherwise, or once that account is gone. */
  personEmail: string | null;
  status: BroadcastStatus;
  scheduledFor: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  createdBy: string;
  sentBy: string | null;
  recipientCount: number | null;
  counts: { queued: number; sent: number; failed: number; skipped: number };
};

export type BroadcastsAdmin = {
  summary: AudienceSummary;
  drafts: number;
  /** When the latest broadcast that actually went out started. */
  lastSend: Date | null;
  /** Why nothing can be sent from here, or null. */
  problem: string | null;
  imagesEnabled: boolean;
  rows: BroadcastRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getBroadcastsAdmin(requestedPage = 1): Promise<BroadcastsAdmin> {
  await requireAdmin();
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [summary, [totals], [last], rows] = await Promise.all([
    audienceSummary(),
    db
      .select({
        total: sql<number>`count(*)::int`,
        drafts: sql<number>`count(*) filter (where ${emailBroadcasts.status} = 'draft')::int`,
      })
      .from(emailBroadcasts),
    db
      .select({ at: emailBroadcasts.startedAt })
      .from(emailBroadcasts)
      .where(isNotNull(emailBroadcasts.startedAt))
      .orderBy(desc(emailBroadcasts.startedAt))
      .limit(1),
    db
      .select({ broadcast: emailBroadcasts, personEmail: user.email })
      .from(emailBroadcasts)
      .leftJoin(user, eq(user.id, emailBroadcasts.personId))
      .orderBy(desc(emailBroadcasts.createdAt), desc(emailBroadcasts.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
  ]);
  const counted = rows.length
    ? await db
        .select({ id: emailBroadcastRecipients.broadcastId, status: emailBroadcastRecipients.status, n: sql<number>`count(*)::int` })
        .from(emailBroadcastRecipients)
        .where(inArray(emailBroadcastRecipients.broadcastId, rows.map((row) => row.broadcast.id)))
        .groupBy(emailBroadcastRecipients.broadcastId, emailBroadcastRecipients.status)
    : [];
  const of = (id: string, ...statuses: string[]) =>
    counted.filter((row) => row.id === id && statuses.includes(row.status)).reduce((sum, row) => sum + Number(row.n), 0);
  return {
    summary,
    drafts: Number(totals?.drafts ?? 0),
    lastSend: last?.at ?? null,
    problem: broadcastSendingProblem(),
    imagesEnabled: isImageStorageConfigured(),
    total: Number(totals?.total ?? 0),
    page,
    pageSize: ADMIN_PAGE_SIZE,
    rows: rows.map(({ broadcast: row, personEmail }) => ({
      id: row.id,
      subject: row.subject,
      audience: row.audience,
      personEmail,
      status: row.status as BroadcastStatus,
      scheduledFor: row.scheduledFor,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
      sentBy: row.sentBy,
      recipientCount: row.recipientCount,
      counts: { queued: of(row.id, "queued", "sending"), sent: of(row.id, "sent"), failed: of(row.id, "failed"), skipped: of(row.id, "skipped") },
    })),
  };
}

export type EditableBroadcast = { id: string; revision: number; status: BroadcastStatus; content: BroadcastContent };

/** One broadcast's content: a draft to continue, or any other to copy as a new draft. Null when there is none. */
export async function getBroadcast(id: string): Promise<EditableBroadcast | null> {
  await requireAdmin();
  if (!isId(id)) return null;
  const [row] = await db.select().from(emailBroadcasts).where(eq(emailBroadcasts.id, id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    revision: row.revision,
    status: row.status as BroadcastStatus,
    content: {
      audience: isBroadcastAudience(row.audience) ? row.audience : "all",
      personId: row.personId,
      subject: row.subject,
      heading: row.heading,
      previewText: row.previewText,
      bodyHtml: row.bodyHtml,
      images: row.images,
      ctaLabel: row.ctaLabel ?? "",
      ctaUrl: row.ctaUrl ?? "",
    },
  };
}

/** How many people would receive it right now, for the review dialog. `personId` is the one person of a "person" broadcast. */
export async function countBroadcastAudience(audience: string, personId: string | null = null): Promise<ActionResult<{ recipients: number }>> {
  await requireAdmin();
  if (!isBroadcastAudience(audience)) return { ok: false, error: "Choose who receives it." };
  if (audience === "person" && typeof personId !== "string") return { ok: false, error: "Choose the person to email." };
  return { ok: true, data: { recipients: await countRecipients(audience, db, new Date(), audience === "person" ? personId : null) } };
}

/** Accounts matching what was typed (email or name), for the "One person" audience. */
export async function findBroadcastPeople(query: string): Promise<ActionResult<{ people: BroadcastPerson[] }>> {
  await requireAdmin();
  const term = typeof query === "string" ? query.trim().slice(0, 200) : "";
  if (term.length < 2) return { ok: true, data: { people: [] } };
  return { ok: true, data: { people: await searchPeople(term) } };
}

/** One account, for a broadcast opened with it chosen (Admin -> Users -> Send email). Null when there is none. */
export async function getBroadcastPerson(id: string): Promise<BroadcastPerson | null> {
  await requireAdmin();
  if (typeof id !== "string" || !id || id.length > 128) return null;
  return findPerson(id);
}

/** The email as it would be sent, for the live preview. Shows a placeholder unsubscribe link: a preview has no reader. */
export async function previewBroadcast(input: unknown): Promise<ActionResult<{ subject: string; html: string }>> {
  await requireAdmin();
  const read = readBroadcastContent(input, { complete: false });
  if (!read.ok) return read;
  const rendered = renderBroadcastEmail(read.content, { unsubscribeUrl: "https://www.repget.com/unsubscribe/preview" });
  return { ok: true, data: { subject: rendered.subject, html: rendered.html } };
}

/* ------------------------------------------------------------------------- */
/* Writing                                                                    */
/* ------------------------------------------------------------------------- */

const columns = (content: BroadcastContent) => ({
  audience: content.audience,
  personId: content.personId,
  subject: content.subject,
  heading: content.heading,
  previewText: content.previewText,
  bodyHtml: content.bodyHtml,
  images: content.images,
  ctaLabel: content.ctaLabel || null,
  ctaUrl: content.ctaUrl || null,
});

/**
 * Saves a draft. The id is chosen by the page, so pressing Save twice on a
 * new one is one draft; `revision` is the one the page holds (0 for new), so
 * an older tab cannot overwrite a newer save.
 */
export async function saveBroadcastDraft(id: string, revision: number, input: unknown): Promise<ActionResult<{ id: string; revision: number }>> {
  const admin = await requireAdmin();
  if (!isId(id) || !Number.isInteger(revision) || revision < 0) return { ok: false, error: CHANGED };
  const read = readBroadcastContent(input, { complete: false });
  if (!read.ok) return read;

  const saved = await db.transaction(async (tx) => {
    const now = new Date();
    const [row] =
      revision === 0
        ? await tx
            .insert(emailBroadcasts)
            .values({ id, ...columns(read.content), revision: 1, createdBy: admin.email, updatedBy: admin.email })
            .onConflictDoNothing()
            .returning({ revision: emailBroadcasts.revision })
        : await tx
            .update(emailBroadcasts)
            .set({ ...columns(read.content), revision: sql`${emailBroadcasts.revision} + 1`, updatedBy: admin.email, updatedAt: now })
            .where(and(eq(emailBroadcasts.id, id), eq(emailBroadcasts.status, "draft"), eq(emailBroadcasts.revision, revision)))
            .returning({ revision: emailBroadcasts.revision });
    if (!row) return null;
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "broadcast.saved",
        targetType: "broadcast",
        targetId: id,
        summary: `Saved an email broadcast draft: "${read.content.subject || "no subject"}"`,
      },
      tx,
    );
    return row;
  });
  if (!saved) return { ok: false, error: CHANGED };
  revalidatePath(PATH);
  return { ok: true, data: { id, revision: saved.revision } };
}

export async function deleteBroadcastDraft(id: string): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  if (!isId(id)) return { ok: false, error: CHANGED };
  const deleted = await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(emailBroadcasts)
      .where(and(eq(emailBroadcasts.id, id), eq(emailBroadcasts.status, "draft")))
      .returning({ subject: emailBroadcasts.subject });
    if (!row) return false;
    await recordAdminAction(
      { actorEmail: admin.email, action: "broadcast.deleted", targetType: "broadcast", targetId: id, summary: `Deleted an email broadcast draft: "${row.subject || "no subject"}"` },
      tx,
    );
    return true;
  });
  if (!deleted) return { ok: false, error: "Only a draft can be deleted." };
  revalidatePath(PATH);
  return { ok: true, data: null };
}

/** The email as it is on the page, to the signed-in administrator and nobody else. */
export async function sendBroadcastTest(input: unknown): Promise<ActionResult<{ to: string }>> {
  const admin = await requireAdmin();
  const problem = broadcastSendingProblem();
  if (problem) return { ok: false, error: problem };
  const read = readBroadcastContent(input, { complete: true });
  if (!read.ok) return read;
  const unsubscribe = unsubscribeUrl(admin.userId);
  const email = renderBroadcastEmail(read.content, { unsubscribeUrl: unsubscribe });
  await recordAdminAction({
    actorEmail: admin.email,
    action: "broadcast.test_sent",
    targetType: "broadcast",
    summary: `Sent a test of an email broadcast to themselves: "${read.content.subject}"`,
  });
  const result = await sendEmail({
    to: admin.email,
    ...email,
    subject: `[Test] ${email.subject}`,
  });
  if (!result.ok) return { ok: false, error: `The test was not sent: ${result.error}` };
  return { ok: true, data: { to: admin.email } };
}

/** What the dialog showed and asked for, checked again against now. */
async function confirmRecipients(
  audience: BroadcastContent["audience"],
  personId: string | null,
  confirmation: { recipients: number; word: string },
): Promise<string | null> {
  const actual = await countRecipients(audience, db, new Date(), personId);
  if (actual === 0) {
    return audience === "person"
      ? "This person cannot be emailed: they unsubscribed, never verified their address or no longer have an account."
      : "Nobody in this audience can be emailed.";
  }
  const shown = Number(confirmation?.recipients);
  // A sign-up between opening the dialog and pressing the button is fine; a different audience is not.
  if (!Number.isFinite(shown) || Math.abs(actual - shown) > Math.max(5, Math.ceil(shown * 0.1))) {
    return `The audience is now ${actual} ${actual === 1 ? "person" : "people"}. Review it again.`;
  }
  if (actual > 1 && confirmation?.word !== SEND_WORD) return `Type ${SEND_WORD} to confirm.`;
  return null;
}

async function draftAt(id: string, revision: number) {
  if (!isId(id) || !Number.isInteger(revision)) return null;
  const [row] = await db
    .select()
    .from(emailBroadcasts)
    .where(and(eq(emailBroadcasts.id, id), eq(emailBroadcasts.status, "draft"), eq(emailBroadcasts.revision, revision)))
    .limit(1);
  return row ?? null;
}

/** Sends a saved draft now, to everyone in its audience. A second press finds it already started. */
export async function sendBroadcastNow(
  id: string,
  revision: number,
  confirmation: { recipients: number; word: string },
): Promise<ActionResult<{ recipients: number }>> {
  const admin = await requireAdmin();
  const problem = broadcastSendingProblem();
  if (problem) return { ok: false, error: problem };
  const draft = await draftAt(id, revision);
  if (!draft) return { ok: false, error: CHANGED };
  const refused = await confirmRecipients(draft.audience as BroadcastContent["audience"], draft.personId, confirmation);
  if (refused) return { ok: false, error: refused };

  let started: { recipients: number; eventId: string };
  try {
    started = await db.transaction(async (tx) => {
      const result = await startBroadcast(tx, { id, from: "draft", revision, actor: admin.email });
      await recordAdminAction(
        {
          actorEmail: admin.email,
          action: "broadcast.sent",
          targetType: "broadcast",
          targetId: id,
          summary: `Email broadcast started: "${result.subject}" to ${result.recipients} people (${draft.audience})`,
          detail: { recipients: result.recipients, audience: draft.audience, ...(draft.personId ? { personId: draft.personId } : {}) },
        },
        tx,
      );
      return result;
    });
  } catch (error) {
    if (error instanceof BroadcastStateError) return { ok: false, error: error.message };
    throw error;
  }
  await deliverNow(started.eventId);
  revalidatePath(PATH);
  return { ok: true, data: { recipients: started.recipients } };
}

/** Sends a saved draft later. Who receives it is decided when it starts. `at` is an ISO time. */
export async function scheduleBroadcast(
  id: string,
  revision: number,
  at: string,
  confirmation: { recipients: number; word: string },
): Promise<ActionResult<{ at: string }>> {
  const admin = await requireAdmin();
  const problem = broadcastSendingProblem();
  if (problem) return { ok: false, error: problem };
  const when = new Date(typeof at === "string" ? at : "");
  const now = Date.now();
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Choose a date and time." };
  if (when.getTime() < now + 60_000) return { ok: false, error: "Choose a time in the future." };
  if (when.getTime() > now + BROADCAST_LIMITS.scheduleDays * 24 * 60 * 60 * 1000) {
    return { ok: false, error: `Choose a time within ${BROADCAST_LIMITS.scheduleDays} days.` };
  }
  const draft = await draftAt(id, revision);
  if (!draft) return { ok: false, error: CHANGED };
  const read = readBroadcastContent({ ...draft, ctaLabel: draft.ctaLabel ?? "", ctaUrl: draft.ctaUrl ?? "" }, { complete: true });
  if (!read.ok) return read;
  const refused = await confirmRecipients(read.content.audience, read.content.personId, confirmation);
  if (refused) return { ok: false, error: refused };

  const done = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(emailBroadcasts)
      .set({ status: "scheduled", scheduledFor: when, sentBy: admin.email, updatedAt: new Date() })
      .where(and(eq(emailBroadcasts.id, id), eq(emailBroadcasts.status, "draft"), eq(emailBroadcasts.revision, revision)))
      .returning({ subject: emailBroadcasts.subject });
    if (!row) return false;
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "broadcast.scheduled",
        targetType: "broadcast",
        targetId: id,
        summary: `Scheduled an email broadcast for ${when.toISOString()}: "${row.subject}" (${draft.audience})`,
        detail: { at: when.toISOString(), audience: draft.audience, ...(draft.personId ? { personId: draft.personId } : {}) },
      },
      tx,
    );
    return true;
  });
  if (!done) return { ok: false, error: CHANGED };
  revalidatePath(PATH);
  return { ok: true, data: { at: when.toISOString() } };
}

/** Stops a scheduled or running broadcast. What has been sent cannot be recalled. */
export async function cancelBroadcastNow(id: string): Promise<ActionResult<{ notSent: number; was: string }>> {
  const admin = await requireAdmin();
  if (!isId(id)) return { ok: false, error: CHANGED };
  const done = await db.transaction(async (tx) => {
    const result = await cancelBroadcast(tx, { id, actor: admin.email });
    if (!result) return null;
    await recordAdminAction(
      {
        actorEmail: admin.email,
        action: "broadcast.cancelled",
        targetType: "broadcast",
        targetId: id,
        summary: `Cancelled a ${result.was === "scheduled" ? "scheduled" : "running"} email broadcast: "${result.subject}"${result.was === "sending" ? ` - ${result.notSent} people not sent it` : ""}`,
        detail: { was: result.was, notSent: result.notSent },
      },
      tx,
    );
    return result;
  });
  if (!done) return { ok: false, error: "This broadcast is not scheduled or sending any more." };
  revalidatePath(PATH);
  return { ok: true, data: { notSent: done.notSent, was: done.was } };
}

/* ------------------------------------------------------------------------- */
/* Pictures                                                                   */
/* ------------------------------------------------------------------------- */

const PENDING_FOLDER = "broadcasts/pending";
const PENDING_UPLOAD = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg)$/;
const TYPE_OF = { png: "image/png", jpg: "image/jpeg" } as const;
const NO_STORAGE = "Image storage is not set up on this deployment.";
const tooBig = `The limit is ${BROADCAST_IMAGE_MAX_BYTES / 1024 / 1024} MB per picture.`;

function sniff(data: Buffer): (typeof BROADCAST_IMAGE_TYPES)[number] | null {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  return null;
}

/**
 * A signed address for one picture, as the blog's uploads work
 * (lib/admin/blog.ts startBlogImageUpload): the file goes straight to storage,
 * into a folder nothing reads, until finishBroadcastImageUpload has checked it.
 * Kept out of the blog's picture library, where one could be deleted while an
 * email still shows it.
 */
export async function startBroadcastImageUpload(file: { type: string; size: number }): Promise<ActionResult<{ upload: string; signedUrl: string }>> {
  await requireAdmin();
  if (!isImageStorageConfigured()) return { ok: false, error: NO_STORAGE };
  const extension = file?.type === "image/png" ? "png" : file?.type === "image/jpeg" ? "jpg" : null;
  if (!extension) return { ok: false, error: "Use a PNG or JPEG picture: some mail programs show nothing else." };
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, error: "Choose a picture to upload." };
  if (file.size > BROADCAST_IMAGE_MAX_BYTES) return { ok: false, error: tooBig };
  const upload = `${crypto.randomUUID()}.${extension}`;
  try {
    return { ok: true, data: { upload, signedUrl: await signedImageUpload(`${PENDING_FOLDER}/${upload}`) } };
  } catch (error) {
    console.error("[admin/broadcasts] preparing a picture upload failed", error);
    return { ok: false, error: "The upload could not be started. Try again." };
  }
}

export async function finishBroadcastImageUpload(input: { upload: string; name: string }): Promise<ActionResult<{ url: string }>> {
  await requireAdmin();
  if (!isImageStorageConfigured()) return { ok: false, error: NO_STORAGE };
  const match = PENDING_UPLOAD.exec(typeof input?.upload === "string" ? input.upload : "");
  if (!match) return { ok: false, error: "That upload does not exist. Upload the picture again." };
  const path = `${PENDING_FOLDER}/${match[0]}`;
  const discard = () => deleteStoredImage(path).catch((error) => console.error("[admin/broadcasts] removing a pending upload failed", error));
  try {
    const stored = await readStoredFile(path, BROADCAST_IMAGE_MAX_BYTES);
    if (!stored) return { ok: false, error: "The picture did not arrive. Upload it again." };
    if (!stored.data) {
      await discard();
      return { ok: false, error: tooBig };
    }
    const type = TYPE_OF[match[1] as keyof typeof TYPE_OF];
    if (sniff(stored.data) !== type) {
      await discard();
      return { ok: false, error: "That file is not a PNG or JPEG picture." };
    }
    const name = typeof input.name === "string" ? input.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 200) : "";
    const [area, folder] = BROADCAST_IMAGE_FOLDER.split("/");
    const url = await storeArticleImage(area, folder, stored.data, type, name);
    await discard();
    return { ok: true, data: { url } };
  } catch (error) {
    console.error("[admin/broadcasts] finishing a picture upload failed", error);
    return { ok: false, error: "The picture could not be stored. Try again." };
  }
}
