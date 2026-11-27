import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import { paidCall, releaseUnspent, reserveAll, type QuotaRule } from "@/lib/billing/spend-quota";
import type { Locale } from "@/lib/i18n/config";

import {
  FORMAT_NAMES_EN,
  LANGUAGE_FOR_PROMPT,
  OPENING_MAX_WORDS,
  OPENING_MIN_WORDS,
  parseOpeningText,
  type BlogBrief,
  type BlogWriterOutcome,
} from "./blog-writer-shared";
import { recordToolUse, startOfUtcDay, toolServerGate } from "./tool-tracking";

/**
 * The free AI Blog Writer's server path (owner, 2026-11-27): when the
 * visitor's browser has no AI of its own, RepGet's cheapest model writes a
 * title and a 90-140 word opening - never the article - in the page's
 * language.
 *
 * COST CONTROLS, all before the call, in this order:
 *  1. Admin -> Free tools: the tool's switch, and its daily AI spend cap
 *     (toolServerGate: default $1.00 a UTC day, lib/tools/tool-tracking.ts).
 *  2. Spend reservations (lib/billing/spend-quota.ts), atomic across server
 *     instances: BLOG_WRITER_LIMITS.perVisitorPerDay per visitor in the last
 *     24 hours, and BLOG_WRITER_LIMITS.globalPerDay for everybody together
 *     per UTC day. A call that reached the model stays counted (paidCall).
 *  3. A short answer: Haiku, at most maxTokens, no thinking, one retry.
 * Any refusal is answered in the page by the template, for free.
 *
 * Every call is recorded with its tokens and cost (recordToolUse), which is
 * what the cap and the admin page add up. The brief goes to the model as
 * material, never as instructions (lib/ai/untrusted.ts).
 */
export const BLOG_WRITER_LIMITS = {
  perVisitorPerDay: 5,
  /** Everybody together, per UTC day: about $1.20 at most with Haiku, under the default cap anyway. */
  globalPerDay: 400,
  /** A title and ~140 words in any of the five languages. */
  maxTokens: 450,
  timeoutMs: 20_000,
};

export const BLOG_WRITER_MODEL = MODELS.EXTRACTION;
const OPERATION = "public.blog_writer";

type Create = (body: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;

const defaultCreate: Create = (body) => anthropic.messages.create(body, { timeout: BLOG_WRITER_LIMITS.timeoutMs, maxRetries: 1 });

export function blogWriterRules(visitor: string, now: Date = new Date()) {
  return {
    visitor: { key: `blog-writer:visitor:${visitor}`, limit: BLOG_WRITER_LIMITS.perVisitorPerDay, window: { seconds: 86_400 } },
    global: { key: "blog-writer:global", limit: BLOG_WRITER_LIMITS.globalPerDay, window: { since: startOfUtcDay(now) } },
  } satisfies Record<string, QuotaRule>;
}

export function blogWriterSystemPrompt(format: BlogBrief["format"], locale: Locale): string {
  const language = LANGUAGE_FOR_PROMPT[locale].name;
  return [
    "You write the opening of a blog article for RepGet's free AI blog writer. The visitor gives the question their customers ask, the article's format and one sentence of their own advice.",
    "",
    "Rules:",
    `- Write in ${language}: ${LANGUAGE_FOR_PROMPT[locale].article} ${language} article title, then a ${OPENING_MIN_WORDS}–${OPENING_MAX_WORDS} word opening.`,
    "- Answer the question directly, using the supplied experience as the core of the answer.",
    `- Respect the format: ${FORMAT_NAMES_EN[format]}. Write only the opening, not the rest of the article: no headings, no list, no conclusion.`,
    "- Avoid invented facts, figures, prices, names, quotes or testimonials. If the brief gives little detail, stay general.",
    "- Plain text only: no markdown, no labels such as \"Title:\", no quotation marks around the title.",
    `- ${dataRule("article_brief")}`,
    "",
    "Return only the title on the first line, an empty line, then the opening.",
  ].join("\n");
}

export function blogWriterMessage(brief: BlogBrief): string {
  return dataBlock("article_brief", [`Question: ${brief.topic}`, `Format: ${FORMAT_NAMES_EN[brief.format]}`, `Experience: ${brief.notes}`].join("\n"));
}

/**
 * One opening for a visitor. `visitor` is visitorKey() of the request (the
 * caller reads the headers); `create` is the model call (a test double in
 * tests). The brief is already cleanBrief()'d.
 */
export async function writeBlogOpening(brief: BlogBrief, locale: Locale, visitor: string, create: Create = defaultCreate): Promise<BlogWriterOutcome> {
  if (!isAiConfigured()) return { ok: false, reason: "unavailable" };

  let gate;
  try {
    gate = await toolServerGate("blog-writer");
  } catch (error) {
    console.warn("[blog-writer] settings unavailable", error);
    return { ok: false, reason: "unavailable" };
  }
  if (gate !== "ok") return { ok: false, reason: gate };

  const rules = blogWriterRules(visitor);
  let reserved;
  try {
    reserved = await reserveAll([rules.visitor, rules.global], { operation: OPERATION, metadata: { visitor } });
  } catch (error) {
    // The quota store cannot be reached: no call (fails closed).
    console.warn("[blog-writer] quota unavailable", error);
    return { ok: false, reason: "unavailable" };
  }
  if (!reserved.ok) return { ok: false, reason: reserved.rule.key === rules.global.key ? "busy" : "limit" };

  try {
    let response: Anthropic.Message;
    try {
      response = await paidCall(reserved.reservations, () =>
        create({
          model: BLOG_WRITER_MODEL,
          max_tokens: BLOG_WRITER_LIMITS.maxTokens,
          system: blogWriterSystemPrompt(brief.format, locale),
          messages: [{ role: "user", content: blogWriterMessage(brief) }],
        }),
      );
    } catch (error) {
      console.warn("[blog-writer] no answer", error);
      return { ok: false, reason: "failed" };
    }

    const text = response.stop_reason === "refusal"
      ? ""
      : response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("\n");
    const opening = parseOpeningText(text);
    await recordToolUse({
      tool: "blog-writer",
      path: "server",
      visitor,
      locale,
      usage: response.usage ? { model: BLOG_WRITER_MODEL, inputTokens: response.usage.input_tokens ?? 0, outputTokens: response.usage.output_tokens ?? 0 } : null,
      failed: !opening,
    });
    return opening ? { ok: true, ...opening } : { ok: false, reason: "failed" };
  } finally {
    // Only a call that never reached the model hands its places back.
    await releaseUnspent(reserved.reservations, "not_spent");
  }
}
