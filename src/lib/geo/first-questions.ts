import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";

import { isAiConfigured } from "@/lib/ai/client";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { db } from "@/lib/db";
import { agencyWorkspaces, geoPrompts, spendReservations, websites } from "@/lib/db/schema";
import { maxPromptsFor } from "@/lib/geo/allowance";
import { SUGGEST_OPERATION, suggestQuestions } from "@/lib/geo/suggest";

/**
 * A new website's first AI-visibility questions, written by themselves.
 *
 * The onboarding's AI visibility step used to fill the list the moment it
 * opened, and it was the only thing that did. That step is gone (Daniel,
 * 2026-11-24), so a website that is analysed, has a plan (paid, trial or
 * Free) and has no questions gets a plan's worth of them here, saved and
 * active, as the step did. The customer edits them on the AI visibility
 * page; checking them stays the weekly run's job, or the customer's button.
 *
 * ONCE PER WEBSITE, EVER (`geo:first:<id>`, limit one), and never for a
 * website whose questions somebody has already asked for: whoever removed
 * them all did not ask for them back. A call the provider refused hands its
 * turn back and is tried again.
 *
 * Not for agency workspaces (the Partner Network's own websites), as the
 * first content plan is not (lib/keywords/first-plan.ts).
 */

/** Only websites added this recently: older ones without questions were left that way by someone. */
export const FIRST_QUESTIONS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type FirstQuestionsOutcome =
  /** The questions are saved. */
  | "added"
  /** Still being analysed, or gone, or the AI is not configured here. */
  | "not_ready"
  /** No plan, or Free's AI cost protection is on: nothing is spent. */
  | "not_entitled"
  /** It has questions, or they were asked for before. */
  | "already_asked"
  /** The hourly allowance is used up, or the call failed: the next sweep. */
  | "limited"
  | "failed";

const neverAsked = sql`not exists (select 1 from ${geoPrompts} where ${geoPrompts.websiteId} = ${websites.id})
  and not exists (select 1 from ${spendReservations}
    where ${spendReservations.websiteId} = ${websites.id}
      and ${spendReservations.operation} = ${SUGGEST_OPERATION}
      and ${spendReservations.state} in ('reserved', 'consumed'))`;

const notAgency = sql`not exists (select 1 from ${agencyWorkspaces} where ${agencyWorkspaces.organizationId} = ${websites.organizationId})`;

/** Websites the sweep looks at: added recently, analysed, no questions yet, outside agency workspaces. */
export async function firstQuestionCandidates(now: Date = new Date()): Promise<string[]> {
  const rows = await db
    .select({ id: websites.id })
    .from(websites)
    .where(
      and(
        // "researching" too: the first content plan takes minutes, and the questions need nothing from it.
        sql`${websites.status} in ('ready', 'researching')`,
        gte(websites.createdAt, new Date(now.getTime() - FIRST_QUESTIONS_WINDOW_MS)),
        neverAsked,
        notAgency,
      ),
    )
    .orderBy(websites.createdAt);
  return rows.map((row) => row.id);
}

/** Writes the website's first questions if they are due (see above). Safe to call any number of times. */
export async function askFirstQuestionsIfDue(websiteId: string): Promise<FirstQuestionsOutcome> {
  if (!isAiConfigured()) return "not_ready";
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId)).limit(1);
  if (!site || (site.status !== "ready" && site.status !== "researching")) return "not_ready";

  const [due] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, site.id), neverAsked, notAgency))
    .limit(1);
  if (!due) return "already_asked";

  // Free too: its monthly snapshot needs questions to ask (a few, maxPromptsFor).
  if (!(await isEntitledToSpend(site.id, { free: true })).ok) return "not_entitled";

  const allowance = await maxPromptsFor(site.id);
  if (allowance < 1) return "not_entitled";
  const suggested = await suggestQuestions({
    site,
    count: allowance,
    rules: [{ key: `geo:first:${site.id}`, limit: 1, window: { since: new Date(0) } }],
  });
  if (!suggested.ok) return suggested.reason;

  await db
    .insert(geoPrompts)
    .values(suggested.questions.slice(0, allowance).map((prompt) => ({ websiteId: site.id, prompt, isSuggested: true, language: suggested.market.language, region: suggested.market.region })))
    .onConflictDoNothing();
  return "added";
}
