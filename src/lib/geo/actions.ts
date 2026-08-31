"use server";

import { and, desc, eq, inArray, sql as raw } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { geoPrompts, geoResults } from "@/lib/db/schema";
import { summarise } from "@/lib/geo/score";
import {
  MAX_PROMPT_LENGTH,
  MAX_PROMPTS,
  type GeoOverview,
  type GeoPromptView,
} from "@/lib/geo/shared";
import { inngest } from "@/inngest/client";
import { requireWebsite } from "@/lib/tenant";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * GEO server actions.
 *
 * Every entry point goes through requireWebsite(), which scopes to the caller's
 * organisation and throws a not-found for anything outside it. GEO data names
 * a business's competitors, so leaking it across tenants would be a real
 * disclosure rather than a cosmetic bug.
 */

/**
 * Overview for the panel: the score, and every tracked prompt with its most
 * recent result.
 *
 * Only the latest run feeds the score. Mixing runs would average away exactly
 * the change the customer is paying to notice.
 */
export async function getGeoOverview(websiteId: string): Promise<GeoOverview> {
  const { site } = await requireWebsite(websiteId);

  const tracked = await db
    .select()
    .from(geoPrompts)
    .where(eq(geoPrompts.websiteId, site.id))
    .orderBy(desc(geoPrompts.createdAt));

  if (tracked.length === 0) {
    return {
      score: 0,
      mentions: 0,
      total: 0,
      averagePosition: null,
      topCompetitors: [],
      prompts: [],
      lastCheckedAt: null,
    };
  }

  /**
   * All results for these prompts, newest first, then reduced to one per
   * prompt in code. Postgres DISTINCT ON would do this in the query, but the
   * row counts here are small (prompts are capped at 20) and the readable
   * version is easier to keep correct.
   */
  const rows = await db
    .select()
    .from(geoResults)
    .where(
      inArray(
        geoResults.geoPromptId,
        tracked.map((p) => p.id),
      ),
    )
    .orderBy(desc(geoResults.checkedAt));

  const latestByPrompt = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByPrompt.has(row.geoPromptId)) {
      latestByPrompt.set(row.geoPromptId, row);
    }
  }

  const prompts: GeoPromptView[] = tracked.map((p) => {
    const latest = latestByPrompt.get(p.id);
    return {
      id: p.id,
      prompt: p.prompt,
      isSuggested: p.isSuggested,
      active: p.active,
      latest: latest
        ? {
            mentioned: latest.mentioned,
            position: latest.position,
            excerpt: latest.excerpt,
            checkedAt: latest.checkedAt,
          }
        : null,
    };
  });

  /**
   * Scored over checked prompts only. Counting a never-checked prompt as a
   * miss would show a customer a low score built partly from questions we
   * never asked.
   */
  const checked = [...latestByPrompt.values()];
  const summary = summarise(
    checked.map((r) => ({
      mentioned: r.mentioned,
      position: r.position,
      competitors: r.competitors ?? [],
      excerpt: r.excerpt,
      cited: r.cited,
    })),
  );

  return {
    ...summary,
    prompts,
    lastCheckedAt: rows[0]?.checkedAt ?? null,
  };
}

/** Trims and rejects a prompt that is empty or over-long. */
function cleanPrompt(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < 5) return null;
  return trimmed.slice(0, MAX_PROMPT_LENGTH);
}

export async function addGeoPrompt(
  websiteId: string,
  prompt: string,
): Promise<ActionResult<{ id: string }>> {
  const { site } = await requireWebsite(websiteId);

  const cleaned = cleanPrompt(prompt);
  if (!cleaned) {
    return { ok: false, error: "Write a question of at least a few words" };
  }

  const [{ count }] = await db
    .select({ count: raw<number>`count(*)::int` })
    .from(geoPrompts)
    .where(eq(geoPrompts.websiteId, site.id));

  if (count >= MAX_PROMPTS) {
    return {
      ok: false,
      error: `You can track up to ${MAX_PROMPTS} questions. Remove one to add another.`,
    };
  }

  try {
    const [row] = await db
      .insert(geoPrompts)
      .values({ websiteId: site.id, prompt: cleaned, isSuggested: false })
      .returning({ id: geoPrompts.id });

    revalidatePath(`/websites/${site.id}`);
    return { ok: true, data: { id: row.id } };
  } catch {
    // The unique index on (website, prompt) is the only realistic failure.
    return { ok: false, error: "You are already tracking that question" };
  }
}

export async function removeGeoPrompt(
  websiteId: string,
  promptId: string,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  // Scoped by website as well as id, so an id from another tenant deletes
  // nothing rather than deleting someone else's prompt.
  await db
    .delete(geoPrompts)
    .where(and(eq(geoPrompts.id, promptId), eq(geoPrompts.websiteId, site.id)));

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

/**
 * Queues a check of every active prompt.
 *
 * Runs through Inngest rather than inline: each prompt is two model calls, so
 * twenty prompts would far exceed a server action's budget and the customer
 * would watch a spinner until it timed out.
 */
export async function runGeoCheck(
  websiteId: string,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  if (!isAiConfigured()) {
    return { ok: false, error: "AI is not configured on this deployment" };
  }

  const [any] = await db
    .select({ id: geoPrompts.id })
    .from(geoPrompts)
    .where(and(eq(geoPrompts.websiteId, site.id), eq(geoPrompts.active, true)))
    .limit(1);

  if (!any) {
    return { ok: false, error: "Add a question first" };
  }

  await inngest.send({
    name: "geo/check.requested",
    data: { websiteId: site.id },
  });

  return { ok: true, data: null };
}

/**
 * Proposes questions a real customer might ask.
 *
 * The quality of this feature rests on the questions being ones people
 * actually type. Left to invent their own, customers write brand-first
 * questions ("is Bright Smile good?") which an assistant answers from the
 * premise — the brand is in the question, so it appears in the answer, and the
 * measurement is meaningless. Suggestions are deliberately brand-free.
 */
export async function suggestGeoPrompts(
  websiteId: string,
): Promise<ActionResult<string[]>> {
  const { site } = await requireWebsite(websiteId);

  if (!isAiConfigured()) {
    return { ok: false, error: "AI is not configured on this deployment" };
  }

  const description = [
    site.industry && `Industry: ${site.industry}`,
    site.country && `Country: ${site.country}`,
    site.description && `About: ${site.description}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: MODELS.EXTRACTION,
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: `A business has this website: ${site.domain}
${description}

Write 6 questions a potential customer might ask an AI assistant when looking for a business like this one.

Rules:
- Never name this business. The question must be one someone asks BEFORE they know it exists.
- Ask the way a real person types, not like a search query.
- Be specific to the industry and, where it matters, the location.

Reply with JSON only: {"prompts": ["...", "..."]}`,
        },
      ],
    });

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
          .slice(0, 6)
      : [];

    if (suggestions.length === 0) {
      return { ok: false, error: "Could not suggest questions. Try again." };
    }

    return { ok: true, data: suggestions };
  } catch {
    return { ok: false, error: "Could not suggest questions. Try again." };
  }
}
