"use server";

import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { isAiConfigured } from "@/lib/ai/client";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { refundSpend } from "@/lib/credits/spend";
import { db } from "@/lib/db";
import { chatActions, chatMessages, chatThreads } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { PRICING, track } from "@/lib/usage";
import { requireEditor } from "@/lib/websites/require-editor";

import { ACTION_SPECS } from "./actions-catalog";
import type { ChatActionView } from "./action-kinds";
import { HISTORY_MESSAGES, MAX_MESSAGE_CHARS, threadTitle } from "./config";
import { runAssistant } from "./engine";
import { freeLeftToday, takeAllowance } from "./quota";
import {
  actionView,
  historyTurns,
  linksFor,
  listThreads,
  removeUnanswered,
  threadMessages,
  threadOf,
  type ChatMessageView,
  type ChatThreadSummary,
} from "./store";
import type { ChatContext } from "./tools";

/**
 * The Home page chat's actions. Each checks, on the server: an editor of the
 * website (a viewer cannot spend its owner's credits) and a plan or the free
 * trial (client, 2026-10-31: trials get the chat too). A person sees only
 * their own conversations. Errors are codes the panel shows in the reader's
 * language.
 */

export type ChatError = "view_only" | "no_plan" | "not_configured" | "empty" | "too_long" | "not_found" | "not_enough_credits" | "ai_failed" | "already_handled";

export type ChatResult<T = null> = { ok: true; data: T } | { ok: false; error: ChatError; price?: number; available?: number };

const fail = (error: ChatError): { ok: false; error: ChatError } => ({ ok: false, error });

async function guard(websiteId: string): Promise<{ ok: true; ctx: ChatContext } | { ok: false; error: ChatError }> {
  const editor = await requireEditor(websiteId);
  if (!editor.ok) return fail("view_only");
  const { site, userId, ownerOrgId, access } = editor.context;
  const level = (await isEntitledToSpend(websiteId)).ok ? "paid" : (await isEntitledToSpend(websiteId, { freeArticles: true })).ok ? "trial" : null;
  if (!level) return fail("no_plan");
  const { locale } = await getAppMessages(userId);
  return {
    ok: true,
    ctx: {
      websiteId,
      ownerOrgId,
      userId,
      access: access === "owner" ? "owner" : "editor",
      domain: site.domain,
      brandName: site.brandName ?? null,
      locale,
      level,
    },
  };
}

export async function listChatThreads(websiteId: string): Promise<ChatResult<ChatThreadSummary[]>> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  return { ok: true, data: await listThreads(websiteId, checked.ctx.userId) };
}

export async function loadChatThread(websiteId: string, threadId: string): Promise<ChatResult<ChatMessageView[]>> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const thread = await threadOf(websiteId, checked.ctx.userId, threadId);
  if (!thread) return fail("not_found");
  return { ok: true, data: await threadMessages(thread.id) };
}

export async function deleteChatThread(websiteId: string, threadId: string): Promise<ChatResult> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  await db.delete(chatThreads).where(and(eq(chatThreads.id, threadId), eq(chatThreads.websiteId, websiteId), eq(chatThreads.userId, checked.ctx.userId)));
  return { ok: true, data: null };
}

export type SentMessage = { threadId: string; messages: ChatMessageView[]; freeLeft: number };

/**
 * Sends a question and returns the conversation with the answer. The message
 * is one of the workspace's free messages of the day, or is charged; if no
 * answer comes, the message is removed and its credit returned.
 */
export async function sendChatMessage(websiteId: string, input: { threadId?: string | null; text: string }): Promise<ChatResult<SentMessage>> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const { ctx } = checked;
  if (!isAiConfigured()) return fail("not_configured");
  const text = input.text.trim();
  if (!text) return fail("empty");
  if (text.length > MAX_MESSAGE_CHARS) return fail("too_long");

  const existing = input.threadId ? await threadOf(websiteId, ctx.userId, input.threadId) : null;
  if (input.threadId && !existing) return fail("not_found");
  const earlier = existing ? (await threadMessages(existing.id)).slice(-HISTORY_MESSAGES) : [];

  const messageId = randomUUID();
  const key = `chat:${messageId}`;
  const stored = await db.transaction(async (tx) => {
    const allowance = await takeAllowance(tx, { organizationId: ctx.ownerOrgId, websiteId, key });
    if (!allowance.ok) return { ok: false as const, error: "not_enough_credits" as const, price: allowance.price, available: allowance.available };
    const threadId =
      existing?.id ??
      (
        await tx
          .insert(chatThreads)
          .values({ organizationId: ctx.ownerOrgId, websiteId, userId: ctx.userId, title: threadTitle(text) })
          .returning({ id: chatThreads.id })
      )[0].id;
    await tx.insert(chatMessages).values({
      id: messageId,
      threadId,
      organizationId: ctx.ownerOrgId,
      userId: ctx.userId,
      role: "user",
      text,
      free: allowance.free,
      creditSpendKey: allowance.spendKey,
    });
    if (existing) await tx.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, threadId));
    return { ok: true as const, threadId, spendKey: allowance.spendKey };
  });
  if (!stored.ok) return stored;

  let reply;
  try {
    reply = await runAssistant(ctx, historyTurns(earlier), text);
  } catch (error) {
    console.error("[chat] no answer", error);
  }
  if (!reply?.text) {
    if (stored.spendKey) await refundSpend(stored.spendKey);
    await removeUnanswered(messageId, stored.threadId);
    return fail("ai_failed");
  }
  const answer = reply;

  const price = PRICING.llm[answer.usage.model as keyof typeof PRICING.llm];
  await track(ctx.ownerOrgId, {
    kind: "llm",
    websiteId,
    provider: "anthropic",
    model: answer.usage.model,
    quantity: answer.usage.inputTokens + answer.usage.outputTokens,
    costUsd: price ? (answer.usage.inputTokens / 1000) * price.inputPer1k + (answer.usage.outputTokens / 1000) * price.outputPer1k : undefined,
    metadata: { purpose: "chat", threadId: stored.threadId, proposals: answer.proposals.length },
  });

  await db.transaction(async (tx) => {
    const [saved] = await tx
      .insert(chatMessages)
      .values({ threadId: stored.threadId, organizationId: ctx.ownerOrgId, role: "assistant", text: answer.text, links: linksFor(answer.pages, websiteId) })
      .returning({ id: chatMessages.id });
    if (answer.proposals.length) {
      await tx.insert(chatActions).values(
        answer.proposals.map((proposal) => ({ threadId: stored.threadId, messageId: saved.id, websiteId, kind: proposal.kind, input: proposal.input, details: proposal.details })),
      );
    }
    await tx.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, stored.threadId));
  });

  return { ok: true, data: { threadId: stored.threadId, messages: await threadMessages(stored.threadId), freeLeft: await freeLeftToday(ctx.ownerOrgId) } };
}

async function actionFor(websiteId: string, userId: string, actionId: string) {
  const [row] = await db
    .select({ action: chatActions, threadUser: chatThreads.userId })
    .from(chatActions)
    .innerJoin(chatThreads, eq(chatActions.threadId, chatThreads.id))
    .where(and(eq(chatActions.id, actionId), eq(chatActions.websiteId, websiteId)))
    .orderBy(desc(chatActions.createdAt))
    .limit(1);
  return row && row.threadUser === userId ? row.action : null;
}

/**
 * Does what the assistant offered, once: the card's Confirm. Runs the same
 * server action as the feature's own page, with its checks and its price.
 */
export async function confirmChatAction(websiteId: string, actionId: string): Promise<ChatResult<ChatActionView>> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const row = await actionFor(websiteId, checked.ctx.userId, actionId);
  if (!row) return fail("not_found");
  const [claimed] = await db
    .update(chatActions)
    .set({ status: "running", decidedBy: checked.ctx.userId, decidedAt: new Date() })
    .where(and(eq(chatActions.id, row.id), eq(chatActions.status, "proposed")))
    .returning();
  if (!claimed) return fail("already_handled");

  const spec = ACTION_SPECS[claimed.kind as keyof typeof ACTION_SPECS];
  let outcome: Awaited<ReturnType<typeof spec.run>>;
  try {
    outcome = spec ? await spec.run(websiteId, claimed.input) : { ok: false, error: "unknown" };
  } catch (error) {
    console.error("[chat] action failed", claimed.kind, error);
    outcome = { ok: false, error: "failed" };
  }
  const [saved] = await db
    .update(chatActions)
    .set(outcome.ok ? { status: "done", outcome: outcome.note } : { status: "failed", outcome: outcome.error.slice(0, 300) })
    .where(eq(chatActions.id, claimed.id))
    .returning();
  revalidatePath("/dashboard");
  return { ok: true, data: actionView(saved)! };
}

export async function cancelChatAction(websiteId: string, actionId: string): Promise<ChatResult<ChatActionView>> {
  const checked = await guard(websiteId);
  if (!checked.ok) return fail(checked.error);
  const row = await actionFor(websiteId, checked.ctx.userId, actionId);
  if (!row) return fail("not_found");
  const [saved] = await db
    .update(chatActions)
    .set({ status: "cancelled", decidedBy: checked.ctx.userId, decidedAt: new Date() })
    .where(and(eq(chatActions.id, row.id), eq(chatActions.status, "proposed")))
    .returning();
  if (!saved) return fail("already_handled");
  return { ok: true, data: actionView(saved)! };
}
