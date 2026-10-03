import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { geoPrompts, geoResults, spendReservations } from "@/lib/db/schema";
import { ENGINES } from "@/lib/geo/engines";
import { requireWebsite } from "@/lib/tenant";

import {
  runBoundaries,
  type CheckRequest,
  type QuestionDetails,
  type VisibilityDetails,
} from "./visibility-state";

/**
 * What the AI Visibility page shows beyond getGeoOverview: the evidence kept
 * for each question's latest answer, a short history, when the latest and
 * previous checks ran, and whether a check somebody asked for is queued,
 * running or was given up on.
 *
 * A plain server module (not "use server"): the page calls it after its own
 * guards and no browser can call it. It only READS stored rows - opening the
 * page, refreshing it while a check runs, or filtering the list starts no
 * check and spends nothing.
 *
 * BOUNDED: at most HISTORY_PER_QUESTION answers per question (one lateral,
 * index-backed read per question on geo_results_prompt_idx), at most
 * MAX_QUESTIONS questions, and one reservation row.
 */

/** Answers kept per question: the latest with its evidence, then the previous ones. */
export const HISTORY_PER_QUESTION = 5;

/** Far above any plan's allowance (lib/geo/shared.ts); a ceiling, not a feature. */
const MAX_QUESTIONS = 200;

/**
 * The key runGeoCheck reserves a check under (lib/geo/actions.ts). One row
 * per press; its createdAt is when the check was asked for.
 */
const checkKey = (websiteId: string) => `geo-check:site:${websiteId}`;

const assistantName = (engine: string) => ENGINES.find((e) => e.id === engine)?.name ?? engine;

export async function loadVisibilityDetails(
  websiteId: string,
  now: Date = new Date(),
): Promise<VisibilityDetails> {
  const { site } = await requireWebsite(websiteId);

  const recent = db
    .select({
      checkedAt: geoResults.checkedAt,
      engine: geoResults.engine,
      mentioned: geoResults.mentioned,
      position: geoResults.position,
      cited: geoResults.cited,
      competitors: geoResults.competitors,
      excerpt: geoResults.excerpt,
    })
    .from(geoResults)
    .where(eq(geoResults.geoPromptId, geoPrompts.id))
    .orderBy(desc(geoResults.checkedAt))
    .limit(HISTORY_PER_QUESTION)
    .as("recent");

  const [rows, [reservation]] = await Promise.all([
    db
      .select({
        id: geoPrompts.id,
        createdAt: geoPrompts.createdAt,
        checkedAt: recent.checkedAt,
        engine: recent.engine,
        mentioned: recent.mentioned,
        position: recent.position,
        cited: recent.cited,
        competitors: recent.competitors,
        excerpt: recent.excerpt,
      })
      .from(geoPrompts)
      .leftJoinLateral(recent, sql`true`)
      .where(eq(geoPrompts.websiteId, site.id))
      .orderBy(desc(geoPrompts.createdAt), geoPrompts.id, desc(recent.checkedAt))
      .limit(MAX_QUESTIONS * HISTORY_PER_QUESTION),
    db
      .select({
        id: spendReservations.id,
        createdAt: spendReservations.createdAt,
        state: spendReservations.state,
        spendStartedAt: spendReservations.spendStartedAt,
      })
      .from(spendReservations)
      .where(eq(spendReservations.key, checkKey(site.id)))
      .orderBy(desc(spendReservations.countedAt), desc(spendReservations.createdAt))
      .limit(1),
  ]);

  const questions: Record<string, QuestionDetails> = {};
  const times: number[] = [];
  const assistants = new Set<string>();

  for (const row of rows) {
    const question = (questions[row.id] ??= { createdAt: row.createdAt, latest: null, earlier: [] });
    if (row.checkedAt === null || row.mentioned === null) continue;
    times.push(row.checkedAt.getTime());
    if (question.latest === null) {
      const assistant = assistantName(row.engine ?? "");
      assistants.add(assistant);
      question.latest = {
        checkedAt: row.checkedAt,
        mentioned: row.mentioned,
        position: row.position,
        assistant,
        cited: row.cited ?? false,
        competitors: (row.competitors ?? []).filter((c): c is string => typeof c === "string" && c.trim() !== ""),
        excerpt: row.excerpt,
      };
    } else {
      question.earlier.push({ checkedAt: row.checkedAt, mentioned: row.mentioned, position: row.position });
    }
  }

  /*
    Every question's newest answers are here, so the newest run and the one
    before it are too (a question would need more than HISTORY_PER_QUESTION
    answers inside one run to hide the boundary).
  */
  const runs = runBoundaries(times.sort((a, b) => b - a));

  const request: CheckRequest | null = reservation
    ? {
        id: reservation.id,
        requestedAt: reservation.createdAt,
        elapsedMs: Math.max(0, now.getTime() - reservation.createdAt.getTime()),
        state:
          reservation.state === "released"
            ? "released"
            : reservation.state === "consumed"
              ? "consumed"
              : "reserved",
        spendStarted: reservation.spendStartedAt !== null,
      }
    : null;

  return {
    questions,
    latestRunStartedAt: runs.latestStartedAt === null ? null : new Date(runs.latestStartedAt),
    previousRunAt: runs.previousAt === null ? null : new Date(runs.previousAt),
    request,
    assistants: [...assistants],
  };
}
