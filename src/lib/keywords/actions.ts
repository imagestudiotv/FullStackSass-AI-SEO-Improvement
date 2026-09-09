"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { calendarItems, clusters, keywords } from "@/lib/db/schema";
import { requireWebsite } from "@/lib/tenant";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Keyword and content-plan reads and actions.
 *
 * Every entry point goes through requireWebsite(), which scopes the id to the
 * caller's organization and 404s anything else. A server action is a public
 * endpoint; the website id in the argument is attacker-controlled.
 */

export type KeywordRow = {
  id: string;
  term: string;
  volume: number | null;
  difficulty: number | null;
  cpc: string | null;
  intent: string | null;
  priorityScore: number | null;
  clusterName: string | null;
};

export async function listKeywords(websiteId: string): Promise<KeywordRow[]> {
  const { site } = await requireWebsite(websiteId);
  return db
    .select({
      id: keywords.id,
      term: keywords.term,
      volume: keywords.volume,
      difficulty: keywords.difficulty,
      cpc: keywords.cpc,
      intent: keywords.intent,
      priorityScore: keywords.priorityScore,
      clusterName: clusters.name,
    })
    .from(keywords)
    .leftJoin(clusters, eq(keywords.clusterId, clusters.id))
    .where(eq(keywords.websiteId, site.id))
    .orderBy(desc(keywords.priorityScore));
}

export type CalendarRow = {
  id: string;
  title: string;
  targetKeyword: string | null;
  intent: string | null;
  scheduledFor: Date | null;
  status: string;
  customInstructions: string | null;
  clusterName: string | null;
  /**
   * Difficulty and volume for the target keyword, shown on upcoming items so
   * someone can see why a topic was chosen before it is written. Null when the
   * keyword is not one we researched — a title typed by hand has no metrics.
   */
  difficulty: number | null;
  volume: number | null;
};

export async function listCalendar(websiteId: string): Promise<CalendarRow[]> {
  const { site } = await requireWebsite(websiteId);
  return db
    .select({
      id: calendarItems.id,
      title: calendarItems.title,
      targetKeyword: calendarItems.targetKeyword,
      intent: calendarItems.intent,
      scheduledFor: calendarItems.scheduledFor,
      status: calendarItems.status,
      customInstructions: calendarItems.customInstructions,
      clusterName: clusters.name,
      difficulty: keywords.difficulty,
      volume: keywords.volume,
    })
    .from(calendarItems)
    .leftJoin(clusters, eq(calendarItems.clusterId, clusters.id))
    /**
     * Metrics come from the keyword row, matched on the term. A left join so
     * an item whose keyword was since deleted still appears — losing a planned
     * article because its keyword row went away would be worse than showing it
     * without numbers.
     */
    .leftJoin(
      keywords,
      and(
        eq(keywords.websiteId, calendarItems.websiteId),
        eq(keywords.term, calendarItems.targetKeyword),
      ),
    )
    .where(eq(calendarItems.websiteId, site.id))
    .orderBy(asc(calendarItems.scheduledFor));
}

/** Starts (or re-runs) keyword research for a website. */
export async function startResearch(
  websiteId: string,
): Promise<ActionResult<null>> {
  const { site, orgId } = await requireWebsite(websiteId);

  // Research reads the extracted profile; without it the seeds would be
  // generated from nothing and the model call wasted.
  if (site.status === "pending" || site.status === "crawling") {
    return { ok: false, error: "Wait until the site has been analysed first" };
  }

  await inngest.send({
    name: "website/research.requested",
    data: { websiteId: site.id, organizationId: orgId },
  });

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

export async function updateCalendarItem(
  websiteId: string,
  itemId: string,
  input: {
    title?: string;
    scheduledFor?: string | null;
    /** Free-text steer for this one article; the generator already reads it. */
    customInstructions?: string | null;
  },
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof input.title === "string") {
    const title = input.title.trim();
    if (!title) return { ok: false, error: "Title cannot be empty" };
    patch.title = title.slice(0, 200);
  }
  if (input.scheduledFor !== undefined) {
    patch.scheduledFor = input.scheduledFor
      ? new Date(input.scheduledFor)
      : null;
  }
  if (input.customInstructions !== undefined) {
    const note = input.customInstructions?.trim();
    patch.customInstructions = note ? note.slice(0, 1000) : null;
  }

  // Scoped by websiteId as well as id: without it, a valid item id from
  // another tenant would be editable through a website this caller does own.
  await db
    .update(calendarItems)
    .set(patch)
    .where(
      and(eq(calendarItems.id, itemId), eq(calendarItems.websiteId, site.id)),
    );

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

export async function deleteCalendarItem(
  websiteId: string,
  itemId: string,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  await db
    .delete(calendarItems)
    .where(
      and(eq(calendarItems.id, itemId), eq(calendarItems.websiteId, site.id)),
    );

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

export async function deleteKeyword(
  websiteId: string,
  keywordId: string,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  await db
    .delete(keywords)
    .where(and(eq(keywords.id, keywordId), eq(keywords.websiteId, site.id)));

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}
