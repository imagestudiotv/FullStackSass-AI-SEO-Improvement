"use server";

import { and, desc, eq, inArray, sql as raw } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { geoPrompts, geoResults } from "@/lib/db/schema";
import { summarise } from "@/lib/geo/score";
import { maxPromptsFor } from "@/lib/geo/allowance";
import {
  MAX_PROMPT_LENGTH,
  type GeoOverview,
  type GeoPromptView,
} from "@/lib/geo/shared";
import { queueJob } from "@/inngest/send";
import { requireWebsite } from "@/lib/tenant";
import type { ActionResult } from "@/lib/websites/actions";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { withinGeoRateLimit } from "@/lib/billing/rate-limit";

/**
 * GEO server actions.
 *
 * Every entry point goes through requireWebsite(), which scopes to the caller's
 * organisation and throws a not-found for anything outside it. GEO data names
 * a business's competitors, so leaking it across tenants would be a real
 * disclosure rather than a cosmetic bug.
 */

/**
 * How far apart two results may be and still count as the same run.
 *
 * A check of twenty prompts is forty model calls and takes minutes, so rows
 * from one run are spread out; runs themselves are days or weeks apart on the
 * weekly cron. An hour separates the two cases with room to spare.
 */
const RUN_GAP_MS = 60 * 60 * 1000;

/**
 * The results belonging to the run before the most recent one.
 *
 * `rows` must be newest first. Walks forward to the first gap larger than
 * RUN_GAP_MS (the end of the latest run), then collects until the next gap.
 */
function rowsBeforeLatestRun<T extends { checkedAt: Date }>(rows: T[]): T[] {
  let cut = -1;
  for (let i = 1; i < rows.length; i += 1) {
    const gap = rows[i - 1].checkedAt.getTime() - rows[i].checkedAt.getTime();
    if (gap > RUN_GAP_MS) {
      cut = i;
      break;
    }
  }
  if (cut === -1) return [];

  const previous: T[] = [];
  for (let i = cut; i < rows.length; i += 1) {
    if (i > cut) {
      const gap = rows[i - 1].checkedAt.getTime() - rows[i].checkedAt.getTime();
      if (gap > RUN_GAP_MS) break;
    }
    previous.push(rows[i]);
  }
  return previous;
}

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
      previousScore: null,
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

  /**
   * The run before this one, scored the same way.
   *
   * Checks are queued together, so a "run" is a cluster of rows written within
   * a few minutes of each other rather than a stored batch id. Rows are split
   * on the first gap longer than RUN_GAP_MS, walking the already-sorted list —
   * no extra query, and no schema change to record something the timestamps
   * already imply.
   *
   * Null unless the previous run actually checked something, so a website
   * checked once shows a score with no change indicator rather than a rise
   * from zero it never had.
   */
  const previousRun = rowsBeforeLatestRun(rows);
  const previousScore =
    previousRun.length > 0
      ? summarise(
          previousRun.map((r) => ({
            mentioned: r.mentioned,
            position: r.position,
            competitors: r.competitors ?? [],
            excerpt: r.excerpt,
            cited: r.cited,
          })),
        ).score
      : null;

  return {
    ...summary,
    prompts,
    lastCheckedAt: rows[0]?.checkedAt ?? null,
    previousScore,
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

  /*
    The allowance is per PLAN now — 20 on Grow, 50 on Scale — so the limit is
    read from the subscription paying for this site rather than being one
    number for everybody.
  */
  const allowance = await maxPromptsFor(site.id);
  if (count >= allowance) {
    return {
      ok: false,
      error: `Your plan tracks up to ${allowance} questions. Remove one to add another.`,
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

  /*
    Entitlement, not just ownership. This queues a job that spends money, and
    a server action is a public endpoint - the page in front of it redirects
    an unpaid customer, but the action behind it is still POSTable.
  */
  const entitled = await isEntitledToSpend(site.id);
  if (!entitled.ok) return { ok: false, error: entitled.error };

  /*
    One model call per prompt per engine, so a single press is already tens of
    calls. Counted from geo_results because check-geo records no usage_events.
  */
  const rate = await withinGeoRateLimit(site.id);
  if (!rate.ok) return { ok: false, error: rate.error };

  await queueJob({
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
  /**
   * How many to ask for. Defaults to the old six, which is what the "suggest
   * more" button wants; filling an empty account asks for a plan's worth.
   */
  wanted = 6,
  /**
   * Questions already on the list, so the model is told not to repeat them.
   * Without this, "suggest more" reliably returns near-duplicates of what is
   * already there and the button appears to do nothing.
   */
  existing: string[] = [],
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

  /**
   * Questions already tracked, listed so the model does not return them
   * again. Without this, "suggest more" comes back with rephrasings of what
   * is already on screen and the button looks broken.
   */
  const avoid = existing.length
    ? [
        "- Do NOT repeat or rephrase any of these, which are already tracked:",
        ...existing.map((e) => `  - ${e}`),
      ].join("\n")
    : "";

  try {
    const response = await anthropic.messages.create({
      model: MODELS.EXTRACTION,
      // ~60 tokens a question plus overhead; 50 questions needs real room.
      max_tokens: Math.min(4000, 400 + wanted * 70),
      messages: [
        {
          role: "user",
          content: `A business has this website: ${site.domain}
${description}

Write ${wanted} questions a potential customer might ask an AI assistant when looking for a business like this one.

Rules:
- Never name this business. The question must be one someone asks BEFORE they know it exists.
- Ask the way a real person types, not like a search query.
- Be specific to the industry and, where it matters, the location.
- Vary the intent: some comparing options, some asking about price, some about a specific service or place.
${avoid}

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
          .slice(0, wanted)
      : [];

    if (suggestions.length === 0) {
      return { ok: false, error: "Could not suggest questions. Try again." };
    }

    return { ok: true, data: suggestions };
  } catch {
    return { ok: false, error: "Could not suggest questions. Try again." };
  }
}

/**
 * Fills an empty list with a plan's worth of questions, already saved.
 *
 * THIS IS THE FIX FOR THE CLIENT'S MAIN COMPLAINT: "This was the most
 * confusing part for me when firstly I joined this platforms. So it will be
 * nice to having it simple that we generate prompts without people click
 * suggest question … we want to be able to cancel prompts and also having
 * them selected from first glance."
 *
 * Before this, the screen opened empty and nothing happened until somebody
 * found the "Suggest questions" button — so the step read as broken. Now the
 * page calls this on arrival and the customer edits a finished list instead
 * of building one.
 *
 * Idempotent by design: it returns what is already there if the website has
 * any prompts, so a refresh, a double render in development, or two tabs open
 * cannot produce two sets. The unique index on (website, prompt) is the
 * backstop.
 */
export async function ensureGeoPrompts(
  websiteId: string,
): Promise<ActionResult<GeoPromptView[]>> {
  const { site } = await requireWebsite(websiteId);

  const existing = await db
    .select()
    .from(geoPrompts)
    .where(eq(geoPrompts.websiteId, site.id))
    .orderBy(desc(geoPrompts.createdAt));

  // Already populated: never top up silently, because the customer may have
  // deliberately removed the ones they did not want.
  if (existing.length > 0) {
    return { ok: true, data: existing.map(toView) };
  }

  if (!isAiConfigured()) {
    return { ok: false, error: "AI is not configured on this deployment" };
  }

  const allowance = await maxPromptsFor(site.id);
  const suggested = await suggestGeoPrompts(websiteId, allowance);
  if (!suggested.ok) return suggested;

  /**
   * Inserted in one statement, marked isSuggested so the UI can tell ours
   * apart from the customer's own. onConflictDoNothing covers the race where
   * two tabs arrive at once.
   */
  const rows = await db
    .insert(geoPrompts)
    .values(
      suggested.data.slice(0, allowance).map((prompt) => ({
        websiteId: site.id,
        prompt,
        isSuggested: true,
      })),
    )
    .onConflictDoNothing()
    .returning();

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: rows.map(toView) };
}

/** A stored row as the client component wants it. */
function toView(row: typeof geoPrompts.$inferSelect): GeoPromptView {
  return {
    id: row.id,
    prompt: row.prompt,
    isSuggested: row.isSuggested,
    active: row.active,
    latest: null,
  };
}
