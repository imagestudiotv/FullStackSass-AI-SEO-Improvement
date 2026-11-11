import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import { paidCall, releaseUnspent, reserveAll, type QuotaRule } from "@/lib/billing/spend-quota";
import type { CustomerStory } from "@/lib/blog/engagement";
import { LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import type { Locale } from "@/lib/i18n/config";

import { DISCOVER_COMMENT, hasLink, type DiscoverStyle } from "./discover-rules";

/**
 * Discover & earn's "Comment with AI" (client ticket, 2026-11-11): one
 * suggested comment for a customer story, which the member then edits and
 * confirms before it is posted (lib/earn/discover-actions.ts).
 *
 * Free to the member, so it is capped like any paid call on the platform:
 * DRAFT_LIMITS.perUserPerDay over a sliding day per member, and
 * DRAFT_LIMITS.globalPerHour for everyone together. A draft that never
 * reached the model (an error before it, a provider refusal) is handed back.
 *
 * Grounded ONLY in the post: its title and description and the business's own
 * fields, passed as data (lib/ai/untrusted.ts). The draft never claims the
 * member used the business, and carries no links - the page refuses a comment
 * with one, so a draft with one is cleaned or dropped here.
 */
export const DRAFT_LIMITS = {
  perUserPerDay: 40,
  globalPerHour: 600,
};

/** Short and cheap: 1-3 sentences. */
const MODEL = MODELS.EXTRACTION;
const MAX_TOKENS = 400;

export type DraftRefusal = "unavailable" | "limit" | "busy" | "failed";
export type DraftResult = { ok: true; draft: string } | { ok: false; reason: DraftRefusal };

export function draftRules(userId: string): QuotaRule[] {
  return [
    { key: `discover-draft:user-day:${userId}`, limit: DRAFT_LIMITS.perUserPerDay, window: { seconds: 86_400 } },
    { key: "discover-draft:global", limit: DRAFT_LIMITS.globalPerHour, window: { seconds: 3_600 } },
  ];
}

const STYLE_BRIEF: Record<DiscoverStyle, string> = {
  question: "A thoughtful, specific question to the business about what the story describes, that the owner could answer in a reply.",
  insight: "A helpful, concrete suggestion for the business or its story, phrased politely, based on what the story describes.",
  appreciation: "A positive, specific observation about something the story describes, without exaggeration.",
};

export function draftPrompt(story: Pick<CustomerStory, "title" | "description" | "name" | "category" | "tagline">, style: DiscoverStyle, locale: Locale): string {
  return [
    "You write ONE short comment that a member of RepGet (a growth platform for businesses) may post under a customer story on RepGet's blog. The member will review and edit it before posting.",
    "",
    "Rules:",
    `- Write in ${LANGUAGE_NAMES_EN[locale]}.`,
    `- The comment: ${STYLE_BRIEF[style]}`,
    `- 1 to 3 sentences, between ${DISCOVER_COMMENT.min} and 400 characters.`,
    "- Base it ONLY on the story in the <business_profile> block. Do not invent facts, figures, products or results.",
    "- Never claim or suggest that the writer has used, bought from, visited or worked with the business.",
    "- No links, web addresses, e-mail addresses, hashtags, emojis or quotation marks around the comment.",
    "- Plain text only. Reply with the comment itself, nothing before or after it.",
    `- ${dataRule("business_profile")}`,
    "",
    dataBlock(
      "business_profile",
      [
        `Business: ${story.name}`,
        story.category ? `Category: ${story.category}` : null,
        `Tagline: ${story.tagline}`,
        `Story title: ${story.title}`,
        `Story summary: ${story.description}`,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ].join("\n");
}

/** The model's answer as a usable draft: plain, trimmed, without links; null when what is left is too short. */
export function cleanDraft(text: string): string | null {
  const unquote = (value: string) => value.trim().replace(/^["'“”«»„]+|["'“”«»„]+$/g, "").trim();
  let draft = unquote(text.replace(/[*_`#>]/g, "").replace(/\s+/g, " "));
  if (hasLink(draft)) {
    // Drop the sentences that carry one rather than the whole draft.
    draft = unquote(
      draft
        .split(/(?<=[.!?]["'”»]?)\s+/)
        .filter((sentence) => !hasLink(sentence))
        .join(" "),
    );
  }
  if (draft.length > DISCOVER_COMMENT.max) draft = draft.slice(0, DISCOVER_COMMENT.max).replace(/\s+\S*$/, "").trim();
  return draft.length >= DISCOVER_COMMENT.min && !hasLink(draft) ? draft : null;
}

/**
 * One draft for a member. `userId` is the session's; `story` is read on the
 * server from the post id. `create` is the model call (a test double in tests).
 */
export async function draftDiscoverComment(
  input: { userId: string; story: CustomerStory; style: DiscoverStyle; locale: Locale },
  create: (body: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message> = (body) => anthropic.messages.create(body),
): Promise<DraftResult> {
  if (!isAiConfigured()) return { ok: false, reason: "unavailable" };

  const slot = await reserveAll(draftRules(input.userId), {
    operation: "earn.discover_draft",
    // Not subjectId: that is one reservation per subject, and a member may redraft a story.
    metadata: { userId: input.userId, postId: input.story.postId, style: input.style },
  });
  if (!slot.ok) return { ok: false, reason: slot.rule.key === "discover-draft:global" ? "busy" : "limit" };

  let draft: string | null = null;
  try {
    const response = await paidCall(slot.reservations, () =>
      create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: draftPrompt(input.story, input.style, input.locale),
        messages: [{ role: "user", content: "Write the comment." }],
      }),
    );
    draft = cleanDraft(
      response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join(" "),
    );
  } catch (error) {
    console.warn("[earn/discover] no draft", error);
  } finally {
    // Only a draft that never reached the model comes back; a billed one stays counted.
    await releaseUnspent(slot.reservations, "not_spent");
  }
  return draft ? { ok: true, draft } : { ok: false, reason: "failed" };
}
