import "server-only";

import { and, asc, desc, eq, gte, lt } from "drizzle-orm";

import { db } from "@/lib/db";
import { chatActions, chatMessages, chatThreads } from "@/lib/db/schema";

import { isChatActionKind, type ChatActionView } from "./action-kinds";
import { CHAT_KEEP_DAYS, chatPageHref, isChatPage, MAX_THREADS_LISTED, type ChatLink } from "./config";
import type { Turn } from "./engine";

/** The conversations, messages and offered actions as the chat panel shows them. */

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  text: string;
  links: ChatLink[];
  actions: ChatActionView[];
  createdAt: string;
};

export type ChatThreadSummary = { id: string; title: string; updatedAt: string };

const keepSince = (now: Date) => new Date(now.getTime() - CHAT_KEEP_DAYS * 86_400_000);

/** A person's conversations about one website, newest first (only their own). */
export async function listThreads(websiteId: string, userId: string, now: Date = new Date()): Promise<ChatThreadSummary[]> {
  const rows = await db
    .select({ id: chatThreads.id, title: chatThreads.title, updatedAt: chatThreads.updatedAt })
    .from(chatThreads)
    .where(and(eq(chatThreads.websiteId, websiteId), eq(chatThreads.userId, userId), gte(chatThreads.updatedAt, keepSince(now))))
    .orderBy(desc(chatThreads.updatedAt))
    .limit(MAX_THREADS_LISTED);
  return rows.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updatedAt.toISOString() }));
}

export async function threadOf(websiteId: string, userId: string, threadId: string) {
  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.websiteId, websiteId), eq(chatThreads.userId, userId)));
  return thread ?? null;
}

/**
 * The pages an answer links to, stored as page names; the address is built
 * for the website. Not the Dashboard: the chat is on it.
 */
export function linksFor(pages: string[], websiteId: string): ChatLink[] {
  return pages
    .filter(isChatPage)
    .filter((page) => page !== "dashboard")
    .slice(0, 3)
    .map((page) => ({ label: page, href: chatPageHref(page, websiteId) }));
}

export async function threadMessages(threadId: string): Promise<ChatMessageView[]> {
  const [messages, actions] = await Promise.all([
    db.select().from(chatMessages).where(eq(chatMessages.threadId, threadId)).orderBy(asc(chatMessages.createdAt)),
    db.select().from(chatActions).where(eq(chatActions.threadId, threadId)).orderBy(asc(chatActions.createdAt)),
  ]);
  return messages.map((message) => ({
    id: message.id,
    role: message.role === "assistant" ? "assistant" : "user",
    text: message.text,
    links: message.links,
    actions: actions.filter((action) => action.messageId === message.id).map(actionView).filter((a): a is ChatActionView => a !== null),
    createdAt: message.createdAt.toISOString(),
  }));
}

export function actionView(row: typeof chatActions.$inferSelect): ChatActionView | null {
  if (!isChatActionKind(row.kind)) return null;
  const status = row.status === "running" ? "proposed" : row.status;
  return {
    id: row.id,
    kind: row.kind,
    details: row.details,
    status: (["proposed", "done", "failed", "cancelled"].includes(status) ? status : "proposed") as ChatActionView["status"],
    outcome: row.outcome,
  };
}

/**
 * The conversation for the model: each earlier message, and under an answer
 * what it offered and what became of it, so the assistant knows what was
 * already done or turned down.
 */
export function historyTurns(messages: ChatMessageView[]): Turn[] {
  return messages.map((message) => {
    if (message.role === "user" || message.actions.length === 0) return { role: message.role, text: message.text };
    const offers = message.actions.map((action) => `${action.kind} "${action.details}": ${action.status}`).join("; ");
    return { role: message.role, text: `${message.text}\n\n(Offered: ${offers})` };
  });
}

/** Deletes conversations with no message for CHAT_KEEP_DAYS (client: kept 30 days). */
export async function deleteOldThreads(now: Date = new Date()): Promise<number> {
  const old = await db
    .delete(chatThreads)
    .where(lt(chatThreads.updatedAt, keepSince(now)))
    .returning({ id: chatThreads.id });
  return old.length;
}

/** Removes a message that got no answer, and its conversation when that was its only message. */
export async function removeUnanswered(messageId: string, threadId: string): Promise<void> {
  await db.delete(chatMessages).where(eq(chatMessages.id, messageId));
  const [left] = await db.select({ id: chatMessages.id }).from(chatMessages).where(eq(chatMessages.threadId, threadId)).limit(1);
  if (!left) await db.delete(chatThreads).where(eq(chatThreads.id, threadId));
}

