import "server-only";

import { anthropic, MODELS } from "@/lib/ai/client";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import { paidCall, releaseUnspent, reserveAll, type QuotaRule } from "@/lib/billing/spend-quota";
import type { websites } from "@/lib/db/schema";
import { MAX_PROMPT_LENGTH } from "@/lib/geo/shared";
import { marketOf, type Market } from "@/lib/geo/market";
import { db } from "@/lib/db";
import { calendarItems, clusters, keywords } from "@/lib/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { PRICING, track } from "@/lib/usage";

/**
 * The one paid call behind every suggested AI-visibility question: "Suggest"
 * on the AI visibility page (lib/geo/actions.ts) and a new website's first
 * questions (lib/geo/first-questions.ts).
 *
 * WHO MAY ASK IS THE CALLER'S BUSINESS - an editor on a website with a live
 * plan, or the job for a website that has one. The hourly allowance, the
 * spending record and the cost are here, so no caller can skip them.
 */

/** The spend ledger's name for it. */
export const SUGGEST_OPERATION = "geo.suggest";

/**
 * Suggestion requests per workspace per hour. Onboarding fills a list once and
 * "suggest more" is pressed a handful of times; thirty is room for both and a
 * ceiling on a loop.
 */
const SUGGESTIONS_PER_WORKSPACE_PER_HOUR = 30;

/** Trims and rejects a prompt that is empty or over-long. */
export function cleanPrompt(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < 5) return null;
  return trimmed.slice(0, MAX_PROMPT_LENGTH);
}

export type SuggestOutcome = { ok: true; questions: string[]; market: Market } | { ok: false; reason: "limited" | "failed" };

/** What the website's content plan is about: its clusters, its strongest keywords, its planned articles. */
export type PlanTopics = { clusters: string[]; keywords: string[]; titles: string[] };

const NO_TOPICS: PlanTopics = { clusters: [], keywords: [], titles: [] };

/**
 * The content plan's topics, read for the questions (review of 2026-11-27:
 * a gifts-and-greetings website was tracked on recipes, films and travel,
 * because the questions were written from its domain name alone). Bounded:
 * a dozen clusters, thirty keywords by priority, twenty planned titles.
 */
export async function planTopics(websiteId: string): Promise<PlanTopics> {
  const [clusterRows, keywordRows, titleRows] = await Promise.all([
    db.select({ name: clusters.name, pillar: clusters.pillarKeyword }).from(clusters).where(eq(clusters.websiteId, websiteId)).orderBy(asc(clusters.createdAt)).limit(12),
    db
      .select({ term: keywords.term })
      .from(keywords)
      .where(eq(keywords.websiteId, websiteId))
      .orderBy(sql`${keywords.priorityScore} desc nulls last`, sql`${keywords.volume} desc nulls last`)
      .limit(30),
    db
      .select({ title: calendarItems.title })
      .from(calendarItems)
      .where(eq(calendarItems.websiteId, websiteId))
      .orderBy(sql`${calendarItems.scheduledFor} desc nulls last`)
      .limit(20),
  ]);
  return {
    clusters: [...new Set(clusterRows.flatMap((row) => [row.name, row.pillar ?? ""]).map((v) => v.trim()).filter(Boolean))],
    keywords: [...new Set(keywordRows.map((row) => row.term.trim()).filter(Boolean))],
    titles: [...new Set(titleRows.map((row) => row.title.trim()).filter(Boolean))],
  };
}

/** Of `count` questions, how many are about the business's category rather than a plan topic: 2-3. */
export function categoryQuestionCount(count: number, hasTopics: boolean): number {
  if (!hasTopics) return count;
  return count >= 8 ? 3 : Math.min(2, Math.max(count - 1, 0));
}

/**
 * The instruction for the questions: in the website's language for its
 * market, most about the content plan's topics, two or three about the
 * business's category. Pure, so it can be tested without a model.
 */
export function questionBrief(input: { domain: string; market: Market; count: number; topics: PlanTopics }): string {
  const { domain, market, count, topics } = input;
  const hasTopics = topics.clusters.length + topics.keywords.length + topics.titles.length > 0;
  const category = categoryQuestionCount(count, hasTopics);
  const fromPlan = count - category;
  const where = market.region ? ` in ${market.region}` : "";
  const plan = hasTopics
    ? dataBlock(
        "site_data",
        [
          topics.clusters.length ? `Content plan topics: ${topics.clusters.join("; ")}` : "",
          topics.keywords.length ? `Keywords the website is targeting: ${topics.keywords.join("; ")}` : "",
          topics.titles.length ? `Articles planned: ${topics.titles.join("; ")}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      )
    : "";
  return [
    `A business has this website: ${domain}`,
    plan || null,
    "",
    `Write ${count} questions a potential customer${where} might ask an AI assistant such as ChatGPT when looking for what this business offers.`,
    "",
    "Rules:",
    `- Write every question in ${market.language}, the way a native speaker${where} types it to an assistant: natural, not translated from English.`,
    hasTopics
      ? `- ${fromPlan} of them about the topics in the content plan above, spread across them: what the people the plan is written for want to find, buy, compare or choose.`
      : null,
    `- ${category} of them about this kind of business${where}: where to find one, which are best, what one costs.`,
    "- Never name this business. The question must be one someone asks BEFORE they know it exists.",
    "- Ask the way a real person types, not like a search query.",
    `- Be specific to the industry${market.region ? ` and to ${market.region}` : ""}, where it matters.`,
    "- Vary the intent: some comparing options, some asking about price, some about a specific product, service or occasion.",
    `- ${dataRule("business_profile")}`,
    hasTopics ? `- ${dataRule("site_data")}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export async function suggestQuestions(input: {
  site: typeof websites.$inferSelect;
  /** How many to ask for, already held to the plan's allowance. */
  count: number;
  /** Questions already tracked, trimmed, so the model does not return them again. */
  tracked?: string[];
  /** Further allowances this call must hold (the first questions' once ever). */
  rules?: QuotaRule[];
  /** The content plan's topics; read from the database when not given. */
  topics?: PlanTopics;
}): Promise<SuggestOutcome> {
  const { site, count, tracked = [] } = input;
  const market = marketOf(site);
  const topics = input.topics ?? (await planTopics(site.id).catch(() => NO_TOPICS));
  // Billed to the website's owner, not an invited editor's own workspace.
  const ownerOrgId = site.organizationId;

  const held = await reserveAll(
    [
      ...(input.rules ?? []),
      { key: `geo-suggest:org:${ownerOrgId}`, limit: SUGGESTIONS_PER_WORKSPACE_PER_HOUR, window: { seconds: 60 * 60 } },
    ],
    { operation: SUGGEST_OPERATION, organizationId: ownerOrgId, websiteId: site.id },
  );
  if (!held.ok) return { ok: false, reason: "limited" };
  const slots = held.reservations;

  // As material (lib/ai/untrusted.ts): the profile was first filled from the crawled homepage.
  const facts = [
    site.industry && `Industry: ${site.industry}`,
    site.country && `Country: ${site.country}`,
    site.description && `About: ${site.description}`,
  ]
    .filter(Boolean)
    .join("\n");
  const description = facts ? dataBlock("business_profile", facts) : "";

  /**
   * Questions already tracked, listed so the model does not return them
   * again. Without this, "suggest more" comes back with rephrasings of what
   * is already on screen and the button looks broken.
   */
  const avoid = tracked.length
    ? [
        "- Do NOT repeat or rephrase any of these, which are already tracked:",
        ...tracked.map((e) => `  - ${e}`),
      ].join("\n")
    : "";

  let response;
  try {
    response = await paidCall(slots, () => anthropic.messages.create({
      model: MODELS.EXTRACTION,
      // ~60 tokens a question plus overhead; 50 questions needs real room.
      max_tokens: Math.min(4000, 400 + count * 70),
      messages: [
        {
          role: "user",
          content: `${description}
${questionBrief({ domain: site.domain, market, count, topics })}
${avoid}

Reply with JSON only: {"prompts": ["...", "..."]}`,
        },
      ],
    }));
  } catch {
    /*
      A provider refusal was not billed, so its slots go back; a timeout may
      have been, and paidCall has already recorded it as spent - releasing a
      consumed reservation changes nothing.
    */
    await releaseUnspent(slots, "provider_refused");
    return { ok: false, reason: "failed" };
  }

  const price = PRICING.llm[MODELS.EXTRACTION];
  await track(ownerOrgId, {
    kind: "llm",
    websiteId: site.id,
    provider: "anthropic",
    model: MODELS.EXTRACTION,
    costUsd:
      (response.usage.input_tokens / 1000) * price.inputPer1k +
      (response.usage.output_tokens / 1000) * price.outputPer1k,
    metadata: { purpose: "geo_suggest", wanted: count },
  }).catch(() => {});

  try {
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    const parsed = JSON.parse(text) as { prompts?: unknown };
    const suggestions = Array.isArray(parsed.prompts)
      ? parsed.prompts
          .filter((p): p is string => typeof p === "string")
          .map((p) => cleanPrompt(p))
          .filter((p): p is string => p !== null)
          .slice(0, count)
      : [];

    if (suggestions.length === 0) {
      return { ok: false, reason: "failed" };
    }

    return { ok: true, questions: suggestions, market };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
