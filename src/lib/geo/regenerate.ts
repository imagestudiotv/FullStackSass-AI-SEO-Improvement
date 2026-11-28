import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { isAiConfigured } from "@/lib/ai/client";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { db } from "@/lib/db";
import { geoPrompts, websites } from "@/lib/db/schema";
import { maxPromptsFor } from "@/lib/geo/allowance";
import { suggestQuestions } from "@/lib/geo/suggest";

/**
 * Writing a website's AI visibility questions again, in its article
 * language and from its content plan (lib/geo/suggest.ts).
 *
 * Two ways in: the customer presses "Regenerate questions" on the AI
 * visibility page, or the website's article language changes (the profile's
 * save queues it, lib/websites/actions.ts). Existing websites are OFFERED
 * it - their English questions written from the domain alone are never
 * replaced without someone asking.
 *
 * It does NOT use the plan's question allowance: the questions it writes
 * replace the suggested ones, so the list never grows past the allowance,
 * and the first-questions allowance (once per website, ever) and the Free
 * plan's monthly snapshot are left alone. The questions the customer typed
 * stay, unless they choose "replace all". It is a paid model call, so it has
 * its own small allowance: REGENERATIONS_PER_DAY per website.
 *
 * Replacing a question deletes its stored answers with it (geo_results
 * cascade): answers to an English question about recipes say nothing about
 * the Ukrainian questions that replace it, and keeping them would mix the
 * two in the score.
 */

export const REGENERATIONS_PER_DAY = 3;

export type RegenerateOutcome =
  | { ok: true; added: number; removed: number; kept: number }
  | { ok: false; reason: "not_ready" | "not_entitled" | "nothing_to_do" | "limited" | "failed" };

export async function regenerateQuestions(
  websiteId: string,
  options: { replaceAll?: boolean; reason: "manual" | "language" },
): Promise<RegenerateOutcome> {
  if (!isAiConfigured()) return { ok: false, reason: "not_ready" };
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId)).limit(1);
  if (!site) return { ok: false, reason: "not_ready" };
  if (!(await isEntitledToSpend(site.id, { free: true })).ok) return { ok: false, reason: "not_entitled" };

  const existing = await db
    .select({ id: geoPrompts.id, prompt: geoPrompts.prompt, isSuggested: geoPrompts.isSuggested })
    .from(geoPrompts)
    .where(eq(geoPrompts.websiteId, site.id));
  const replaceAll = options.replaceAll === true;
  // A language change rewrites only what we wrote: a website with none of ours keeps its list as it is.
  if (options.reason === "language" && !existing.some((p) => p.isSuggested)) return { ok: false, reason: "nothing_to_do" };

  const keep = replaceAll ? [] : existing.filter((p) => !p.isSuggested);
  const remove = replaceAll ? existing : existing.filter((p) => p.isSuggested);
  const allowance = await maxPromptsFor(site.id);
  const count = allowance - keep.length;
  if (count < 1) return { ok: false, reason: "nothing_to_do" };

  const suggested = await suggestQuestions({
    site,
    count,
    tracked: keep.map((p) => p.prompt),
    rules: [{ key: `geo-regenerate:site:${site.id}`, limit: REGENERATIONS_PER_DAY, window: { seconds: 24 * 60 * 60 } }],
  });
  if (!suggested.ok) return { ok: false, reason: suggested.reason };

  const kept = new Set(keep.map((p) => p.prompt));
  const fresh = [...new Set(suggested.questions)].filter((q) => !kept.has(q)).slice(0, count);
  if (fresh.length === 0) return { ok: false, reason: "failed" };

  await db.transaction(async (tx) => {
    if (remove.length > 0) {
      await tx.delete(geoPrompts).where(and(eq(geoPrompts.websiteId, site.id), inArray(geoPrompts.id, remove.map((p) => p.id))));
    }
    await tx
      .insert(geoPrompts)
      .values(fresh.map((prompt) => ({
        websiteId: site.id,
        prompt,
        isSuggested: true,
        language: suggested.market.language,
        region: suggested.market.region,
      })))
      .onConflictDoNothing();
  });
  return { ok: true, added: fresh.length, removed: remove.length, kept: keep.length };
}
